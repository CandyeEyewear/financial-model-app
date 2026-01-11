import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify authenticated user and get their profile
 */
async function verifyUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No authorization token', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  // Get user profile with tier
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return { error: 'Could not fetch user profile', status: 500 };
  }

  return { user, profile };
}

/**
 * Check if user has team management permission (business or enterprise tier)
 */
function canManageTeams(tier) {
  return tier === 'business' || tier === 'enterprise';
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (req.method) {
    case 'GET':
      return getTeams(req, res);
    case 'POST':
      return createTeam(req, res);
    case 'PUT':
      return updateTeam(req, res);
    case 'DELETE':
      return deleteTeam(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET /api/teams - Get user's teams
 */
async function getTeams(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    // Get teams where user is owner
    const { data: ownedTeams, error: ownedError } = await supabase
      .from('teams')
      .select(`
        *,
        team_members (
          id,
          user_id,
          invited_email,
          role,
          status,
          joined_at,
          users:user_id (
            id,
            email,
            name,
            avatar_url
          )
        )
      `)
      .eq('owner_id', auth.user.id);

    if (ownedError) throw ownedError;

    // Get teams where user is a member (not owner)
    const { data: memberTeams, error: memberError } = await supabase
      .from('team_members')
      .select(`
        team_id,
        role,
        status,
        joined_at,
        teams:team_id (
          id,
          name,
          description,
          owner_id,
          max_members,
          created_at
        )
      `)
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .neq('role', 'owner');

    if (memberError) throw memberError;

    // Get pending invites for user
    const { data: pendingInvites, error: inviteError } = await supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        role,
        invited_at,
        teams:team_id (
          id,
          name,
          description,
          owner_id,
          users:owner_id (
            name,
            email
          )
        )
      `)
      .or(`user_id.eq.${auth.user.id},invited_email.eq.${auth.profile.email}`)
      .eq('status', 'pending');

    if (inviteError) throw inviteError;

    // Calculate member counts for owned teams
    const teamsWithCounts = (ownedTeams || []).map(team => ({
      ...team,
      member_count: team.team_members?.filter(m => m.status === 'active').length || 0,
      isOwner: true
    }));

    // Transform member teams
    const memberTeamsTransformed = (memberTeams || [])
      .filter(m => m.teams)
      .map(m => ({
        ...m.teams,
        myRole: m.role,
        joined_at: m.joined_at,
        isOwner: false
      }));

    res.status(200).json({
      success: true,
      data: {
        ownedTeams: teamsWithCounts,
        memberTeams: memberTeamsTransformed,
        pendingInvites: pendingInvites || [],
        canCreateTeam: canManageTeams(auth.profile.tier),
        currentTeamId: auth.profile.current_team_id
      }
    });

  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

/**
 * POST /api/teams - Create a new team
 */
async function createTeam(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // Check if user can create teams
  if (!canManageTeams(auth.profile.tier)) {
    return res.status(403).json({
      error: 'Team management requires Business or Enterprise subscription',
      upgradeRequired: true
    });
  }

  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check existing team count for business users
    if (auth.profile.tier === 'business') {
      const { count } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', auth.user.id);

      if (count >= 1) {
        return res.status(403).json({
          error: 'Business plan allows only one team. Upgrade to Enterprise for multiple teams.',
          upgradeRequired: true
        });
      }
    }

    // Create team
    const maxMembers = auth.profile.tier === 'enterprise' ? 999999 : 5;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: auth.user.id,
        max_members: maxMembers
      })
      .select()
      .single();

    if (teamError) throw teamError;

    // Add owner as team member
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: auth.user.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      });

    if (memberError) throw memberError;

    // Set as user's current team
    await supabase
      .from('users')
      .update({ current_team_id: team.id })
      .eq('id', auth.user.id);

    res.status(201).json({
      success: true,
      data: team
    });

  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: error.message || 'Failed to create team' });
  }
}

/**
 * PUT /api/teams - Update team details
 */
async function updateTeam(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { id, name, description } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Verify user owns this team or is admin
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user can manage this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', id)
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .single();

    if (team.owner_id !== auth.user.id && (!membership || !['owner', 'admin'].includes(membership.role))) {
      return res.status(403).json({ error: 'Not authorized to update this team' });
    }

    // Update team
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const { data: updatedTeam, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: updatedTeam
    });

  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
}

/**
 * DELETE /api/teams - Delete a team
 */
async function deleteTeam(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Verify user owns this team
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.owner_id !== auth.user.id) {
      return res.status(403).json({ error: 'Only team owner can delete the team' });
    }

    // Clear current_team_id for all members
    await supabase
      .from('users')
      .update({ current_team_id: null })
      .eq('current_team_id', id);

    // Delete team (will cascade delete team_members)
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully'
    });

  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
}
