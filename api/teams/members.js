import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify authenticated user
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

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

/**
 * Check if user can manage team members
 */
async function canManageTeamMembers(userId, teamId) {
  // Check if user is team owner
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single();

  if (team?.owner_id === userId) return true;

  // Check if user is admin of team
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return membership?.role === 'admin' || membership?.role === 'owner';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (req.method) {
    case 'GET':
      return getMembers(req, res);
    case 'POST':
      return inviteMember(req, res);
    case 'PUT':
      return updateMember(req, res);
    case 'DELETE':
      return removeMember(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET /api/teams/members?teamId=xxx - Get team members
 */
async function getMembers(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { teamId } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Verify user is part of this team
    const { data: membership } = await supabase
      .from('team_members')
      .select('role, status')
      .eq('team_id', teamId)
      .eq('user_id', auth.user.id)
      .single();

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Not a member of this team' });
    }

    // Get all members
    const { data: members, error } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        invited_email,
        role,
        status,
        invited_at,
        joined_at,
        users:user_id (
          id,
          email,
          name,
          avatar_url,
          tier
        )
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Get team info for context
    const { data: team } = await supabase
      .from('teams')
      .select('*, owner:owner_id(name, email)')
      .eq('id', teamId)
      .single();

    res.status(200).json({
      success: true,
      data: {
        members: members || [],
        team,
        canManage: await canManageTeamMembers(auth.user.id, teamId),
        myRole: membership.role
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
}

/**
 * POST /api/teams/members - Invite a new member
 */
async function inviteMember(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { teamId, email, role = 'member' } = req.body;

    if (!teamId || !email) {
      return res.status(400).json({ error: 'Team ID and email are required' });
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer' });
    }

    // Check if user can manage this team
    if (!(await canManageTeamMembers(auth.user.id, teamId))) {
      return res.status(403).json({ error: 'Not authorized to invite members' });
    }

    // Get team to check member limits
    const { data: team } = await supabase
      .from('teams')
      .select('*, owner:owner_id(tier)')
      .eq('id', teamId)
      .single();

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check member limit (count active + pending)
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .in('status', ['active', 'pending']);

    if (team.owner.tier !== 'enterprise' && memberCount >= team.max_members) {
      return res.status(403).json({
        error: `Team member limit (${team.max_members}) reached. Upgrade your plan for more members.`,
        upgradeRequired: true
      });
    }

    // Check if user with this email exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    // Check if already invited/member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('status')
      .eq('team_id', teamId)
      .or(existingUser ? `user_id.eq.${existingUser.id}` : `invited_email.eq.${email.toLowerCase()}`)
      .single();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return res.status(400).json({ error: 'User is already a team member' });
      }
      if (existingMember.status === 'pending') {
        return res.status(400).json({ error: 'Invite already sent to this user' });
      }
    }

    // Create invite
    const inviteData = {
      team_id: teamId,
      role,
      status: 'pending',
      invited_by: auth.user.id,
      invited_at: new Date().toISOString()
    };

    if (existingUser) {
      inviteData.user_id = existingUser.id;
    } else {
      inviteData.invited_email = email.toLowerCase();
    }

    const { data: invite, error } = await supabase
      .from('team_members')
      .insert(inviteData)
      .select()
      .single();

    if (error) throw error;

    // TODO: Send email notification to invited user

    res.status(201).json({
      success: true,
      data: invite,
      message: `Invitation sent to ${email}`
    });

  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: error.message || 'Failed to send invite' });
  }
}

/**
 * PUT /api/teams/members - Update member role or respond to invite
 */
async function updateMember(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { teamId, memberId, action, role } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Handle invite response (accept/decline)
    if (action === 'accept' || action === 'decline') {
      // Find user's pending invite
      const { data: invite } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .or(`user_id.eq.${auth.user.id},invited_email.eq.${auth.profile.email}`)
        .eq('status', 'pending')
        .single();

      if (!invite) {
        return res.status(404).json({ error: 'No pending invite found' });
      }

      if (action === 'accept') {
        const { error } = await supabase
          .from('team_members')
          .update({
            status: 'active',
            user_id: auth.user.id,
            invited_email: null,
            joined_at: new Date().toISOString()
          })
          .eq('id', invite.id);

        if (error) throw error;

        // Set as user's current team if they don't have one
        if (!auth.profile.current_team_id) {
          await supabase
            .from('users')
            .update({ current_team_id: teamId })
            .eq('id', auth.user.id);
        }

        return res.status(200).json({
          success: true,
          message: 'Successfully joined the team'
        });
      } else {
        const { error } = await supabase
          .from('team_members')
          .update({ status: 'declined' })
          .eq('id', invite.id);

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'Invite declined'
        });
      }
    }

    // Handle role update
    if (role && memberId) {
      if (!(await canManageTeamMembers(auth.user.id, teamId))) {
        return res.status(403).json({ error: 'Not authorized to update member roles' });
      }

      // Cannot change owner role
      const { data: member } = await supabase
        .from('team_members')
        .select('role, user_id')
        .eq('id', memberId)
        .single();

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      if (member.role === 'owner') {
        return res.status(403).json({ error: 'Cannot change team owner role' });
      }

      // Cannot promote to owner
      if (role === 'owner') {
        return res.status(403).json({ error: 'Use transfer ownership to change team owner' });
      }

      const { error } = await supabase
        .from('team_members')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Member role updated'
      });
    }

    return res.status(400).json({ error: 'Invalid update request' });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
}

/**
 * DELETE /api/teams/members - Remove member or leave team
 */
async function removeMember(req, res) {
  const auth = await verifyUser(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { teamId, memberId, action } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Handle leaving team
    if (action === 'leave') {
      // Check if user is owner
      const { data: team } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', teamId)
        .single();

      if (team?.owner_id === auth.user.id) {
        return res.status(403).json({
          error: 'Team owner cannot leave. Transfer ownership or delete the team.'
        });
      }

      const { error } = await supabase
        .from('team_members')
        .update({ status: 'removed' })
        .eq('team_id', teamId)
        .eq('user_id', auth.user.id);

      if (error) throw error;

      // Clear current_team_id if this was user's current team
      await supabase
        .from('users')
        .update({ current_team_id: null })
        .eq('id', auth.user.id)
        .eq('current_team_id', teamId);

      return res.status(200).json({
        success: true,
        message: 'Left team successfully'
      });
    }

    // Handle removing another member
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    if (!(await canManageTeamMembers(auth.user.id, teamId))) {
      return res.status(403).json({ error: 'Not authorized to remove members' });
    }

    // Get member info
    const { data: member } = await supabase
      .from('team_members')
      .select('role, user_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'owner') {
      return res.status(403).json({ error: 'Cannot remove team owner' });
    }

    // Remove member
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', memberId);

    if (error) throw error;

    // Clear their current_team_id if applicable
    if (member.user_id) {
      await supabase
        .from('users')
        .update({ current_team_id: null })
        .eq('id', member.user_id)
        .eq('current_team_id', teamId);
    }

    return res.status(200).json({
      success: true,
      message: 'Member removed from team'
    });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
}
