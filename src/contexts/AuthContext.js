// AuthContext - Supabase Auth Provider
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, auth, db } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Plan limits
  const PLAN_LIMITS = {
    free: 10,
    professional: 100,
    business: 500,
    enterprise: Infinity
  };

  // Fetch or create user profile
  const fetchOrCreateProfile = async (user) => {
    if (!user) return null;

    try {
      // Try to get existing profile
      let { data: profile, error } = await db.getUserProfile(user.id);

      // If no profile exists, create one
      if (error && error.code === 'PGRST116') {
        const newProfile = {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0],
          tier: 'free',
          ai_queries_this_month: 0,
          reports_this_month: 0,
          last_reset_date: new Date().toISOString(),
          subscription_status: 'trialing',
          created_at: new Date().toISOString()
        };

        const { data: createdProfile, error: createError } = await db.upsertUserProfile(newProfile);
        
        if (createError) {
          console.error('Error creating profile:', createError);
          return null;
        }
        
        profile = createdProfile;
      } else if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return profile;
    } catch (err) {
      console.error('Profile fetch/create error:', err);
      return null;
    }
  };

  // Check if user can make AI query
  const canMakeAIQuery = () => {
    if (!userProfile) return false;
    const limit = PLAN_LIMITS[userProfile.tier] || PLAN_LIMITS.free;
    return userProfile.ai_queries_this_month < limit;
  };

  // Get usage info
  const getUsageInfo = () => {
    if (!userProfile) return null;
    const limit = PLAN_LIMITS[userProfile.tier] || PLAN_LIMITS.free;
    return {
      used: userProfile.ai_queries_this_month || 0,
      limit,
      tier: userProfile.tier || 'free',
      percentage: ((userProfile.ai_queries_this_month || 0) / limit) * 100
    };
  };

  // Sign up
  const signUp = async (email, password, metadata = {}) => {
    setError(null);
    const { data, error } = await auth.signUp(email, password, metadata);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  // Sign in with email/password
  const signIn = async (email, password) => {
    setError(null);
    const { data, error } = await auth.signIn(email, password);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  // Sign in with OAuth provider
  const signInWithProvider = async (provider) => {
    setError(null);
    const { data, error } = await auth.signInWithProvider(provider);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  // Sign out
  const signOut = async () => {
    setError(null);
    const { error } = await auth.signOut();
    if (error) {
      setError(error.message);
      return { error };
    }
    setUser(null);
    setUserProfile(null);
    setSession(null);
    return { error: null };
  };

  // Reset password
  const resetPassword = async (email) => {
    setError(null);
    const { data, error } = await auth.resetPassword(email);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { session: currentSession, error } = await auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        if (currentSession?.user && mounted) {
          setSession(currentSession);
          setUser(currentSession.user);
          const profile = await fetchOrCreateProfile(currentSession.user);
          setUserProfile(profile);
        }

        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event);
      
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
          const profile = await fetchOrCreateProfile(currentSession.user);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }

        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    userProfile,
    session,
    isLoading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
    canMakeAIQuery,
    getUsageInfo,
    PLAN_LIMITS
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
