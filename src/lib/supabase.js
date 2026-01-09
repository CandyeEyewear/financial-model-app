// Supabase client configuration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Check for missing environment variables
const missingEnvVars = [];
if (!supabaseUrl) missingEnvVars.push('REACT_APP_SUPABASE_URL');
if (!supabaseAnonKey) missingEnvVars.push('REACT_APP_SUPABASE_ANON_KEY');

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set these in your Vercel Dashboard > Project Settings > Environment Variables');
  console.error('Note: REACT_APP_* variables must be set BEFORE the build runs.');
}

// Create Supabase client (will fail gracefully if credentials missing)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Export a flag indicating if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

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
  }
};

export default supabase;
