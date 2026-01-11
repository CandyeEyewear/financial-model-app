// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Auth helper functions
export const auth = {
  // Sign up with email and password
  signUp: async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  },

  // Sign in with email and password
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Sign in with OAuth providers (Google, GitHub, etc.)
  signInWithProvider: async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback`
      }
    });
    return { data, error };
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Password reset
  resetPassword: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { data, error };
  },

  // Update password
  updatePassword: async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  },

  // Listen to auth state changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Database helper functions
export const db = {
  // Get user profile from users table
  getUserProfile: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Create or update user profile
  upsertUserProfile: async (profile) => {
    const { data, error } = await supabase
      .from('users')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .single();
    return { data, error };
  },

  // Update user usage
  incrementUsage: async (userId) => {
    const { data, error } = await supabase.rpc('increment_ai_usage', {
      user_id: userId
    });
    return { data, error };
  },

  // Get user usage stats
  getUsageStats: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('ai_queries_this_month, reports_this_month, tier, last_reset_date')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Reset monthly usage if needed
  checkAndResetUsage: async (userId) => {
    const { data, error } = await supabase.rpc('check_and_reset_usage', {
      user_id: userId
    });
    return { data, error };
  },

  // ==========================================
  // SAVED MODELS / SCENARIOS
  // ==========================================

  // List all saved models for a user
  listSavedModels: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return { data: null, error: userError };
    }

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

    const { data, error } = await supabase
      .from('saved_models')
      .select('id, name, description, created_at, updated_at, model_data')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    return { data, error };
  },

  // Get a single saved model by ID
  getSavedModel: async (modelId) => {
    const { data, error } = await supabase
      .from('saved_models')
      .select('*')
      .eq('id', modelId)
      .single();
    return { data, error };
  },

  // Save a new model
  createSavedModel: async (name, description, modelData) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return { data: null, error: userError };
    }

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

    const { data, error } = await supabase
      .from('saved_models')
      .insert({
        user_id: userId,
        name,
        description,
        model_data: modelData
      })
      .select()
      .single();
    return { data, error };
  },

  // Update an existing model
  updateSavedModel: async (modelId, name, description, modelData) => {
    const { data, error } = await supabase
      .from('saved_models')
      .update({
        name,
        description,
        model_data: modelData,
        updated_at: new Date().toISOString()
      })
      .eq('id', modelId)
      .select()
      .single();
    return { data, error };
  },

  // Delete a saved model
  deleteSavedModel: async (modelId) => {
    const { error } = await supabase
      .from('saved_models')
      .delete()
      .eq('id', modelId);
    return { error };
  },

  // Duplicate a saved model
  duplicateSavedModel: async (modelId, newName) => {
    // First, get the original model
    const { data: original, error: fetchError } = await supabase
      .from('saved_models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (fetchError) return { data: null, error: fetchError };

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

    // Create a copy with a new name
    const { data, error } = await supabase
      .from('saved_models')
      .insert({
        user_id: userId,
        name: newName,
        description: original.description,
        model_data: original.model_data
      })
      .select()
      .single();

    return { data, error };
  },

  // ==========================================
  // TEAM MANAGEMENT
  // ==========================================

  // Get user's teams (owned and member)
  getUserTeams: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

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
      .eq('owner_id', userId);

    if (ownedError) return { data: null, error: ownedError };

    // Get teams where user is a member
    const { data: memberTeams, error: memberError } = await supabase
      .from('team_members')
      .select(`
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
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('role', 'owner');

    if (memberError) return { data: null, error: memberError };

    return {
      data: {
        ownedTeams: ownedTeams || [],
        memberTeams: (memberTeams || []).map(m => ({ ...m.teams, myRole: m.role }))
      },
      error: null
    };
  },

  // Get pending team invites for current user
  getPendingInvites: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

    // Get user's email for email-based invites
    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const { data, error } = await supabase
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
          owner_id
        )
      `)
      .or(`user_id.eq.${userId},invited_email.eq.${profile?.email}`)
      .eq('status', 'pending');

    return { data, error };
  },

  // Get team members
  getTeamMembers: async (teamId) => {
    const { data, error } = await supabase
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
          avatar_url
        )
      `)
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true, nullsFirst: false });

    return { data, error };
  },

  // Create a new team
  createTeam: async (name, description) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;
    if (!userId) {
      return { data: null, error: new Error('Authenticated user not found') };
    }

    // Get user profile to check tier
    const { data: profile } = await supabase
      .from('users')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || !['business', 'enterprise'].includes(profile.tier)) {
      return { data: null, error: new Error('Team management requires Business or Enterprise subscription') };
    }

    const maxMembers = profile.tier === 'enterprise' ? 999999 : 5;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        description,
        owner_id: userId,
        max_members: maxMembers
      })
      .select()
      .single();

    if (teamError) return { data: null, error: teamError };

    // Add owner as team member
    await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      });

    // Set as current team
    await supabase
      .from('users')
      .update({ current_team_id: team.id })
      .eq('id', userId);

    return { data: team, error: null };
  },

  // Invite team member
  inviteTeamMember: async (teamId, email, role = 'member') => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    const inviteData = {
      team_id: teamId,
      role,
      status: 'pending',
      invited_by: userData.user.id,
      invited_at: new Date().toISOString()
    };

    if (existingUser) {
      inviteData.user_id = existingUser.id;
    } else {
      inviteData.invited_email = email.toLowerCase();
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert(inviteData)
      .select()
      .single();

    return { data, error };
  },

  // Accept team invite
  acceptTeamInvite: async (teamId) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;

    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const { data, error } = await supabase
      .from('team_members')
      .update({
        status: 'active',
        user_id: userId,
        invited_email: null,
        joined_at: new Date().toISOString()
      })
      .or(`user_id.eq.${userId},invited_email.eq.${profile?.email}`)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .select()
      .single();

    return { data, error };
  },

  // Decline team invite
  declineTeamInvite: async (teamId) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { data: null, error: userError };

    const userId = userData?.user?.id;

    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const { error } = await supabase
      .from('team_members')
      .update({ status: 'declined' })
      .or(`user_id.eq.${userId},invited_email.eq.${profile?.email}`)
      .eq('team_id', teamId)
      .eq('status', 'pending');

    return { error };
  },

  // Remove team member
  removeTeamMember: async (memberId) => {
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', memberId);

    return { error };
  },

  // Leave team
  leaveTeam: async (teamId) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { error: userError };

    const { error } = await supabase
      .from('team_members')
      .update({ status: 'removed' })
      .eq('team_id', teamId)
      .eq('user_id', userData.user.id);

    // Clear current_team_id
    await supabase
      .from('users')
      .update({ current_team_id: null })
      .eq('id', userData.user.id)
      .eq('current_team_id', teamId);

    return { error };
  },

  // Update member role
  updateMemberRole: async (memberId, role) => {
    const { data, error } = await supabase
      .from('team_members')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .select()
      .single();

    return { data, error };
  },

  // Set current team
  setCurrentTeam: async (teamId) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return { error: userError };

    const { error } = await supabase
      .from('users')
      .update({ current_team_id: teamId })
      .eq('id', userData.user.id);

    return { error };
  },

  // Delete team
  deleteTeam: async (teamId) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    return { error };
  }
};

export default supabase;
