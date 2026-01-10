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
  }
};

export default supabase;
