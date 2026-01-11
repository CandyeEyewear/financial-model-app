/**
 * AuthContext - Supabase Authentication Provider
 * Handles user authentication, session management, and usage tracking
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, auth, db } from '../lib/supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthContext');
const AuthContext = createContext({});

/**
 * useAuth hook - Access authentication context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider - Wraps app with authentication state
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // 'super_admin', 'admin', 'support', 'billing'

  // Plan limits for AI queries
  const PLAN_LIMITS = {
    free: 10,
    professional: 100,
    business: 500,
    enterprise: Infinity
  };

  /**
   * Fetch or create user profile in database
   * Includes timeout to prevent hanging on slow/failed database connections
   */
  const fetchOrCreateProfile = async (user) => {
    if (!user) return null;

    // Timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timeout')), 10000);
    });

    try {
      const fetchProfile = async () => {
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
            log.error('Error creating profile', createError);
            return null;
          }
          
          profile = createdProfile;
          log.info('Created new user profile');
        } else if (error) {
          log.error('Error fetching profile', error);
          return null;
        }

        return profile;
      };

      // Race between fetch and timeout
      return await Promise.race([fetchProfile(), timeoutPromise]);
    } catch (err) {
      log.error('Profile fetch/create error', err);
      return null;
    }
  };

  /**
   * Check if user can make AI query based on plan limits
   */
  const canMakeAIQuery = () => {
    if (!userProfile) return false;
    const limit = PLAN_LIMITS[userProfile.tier] || PLAN_LIMITS.free;
    return userProfile.ai_queries_this_month < limit;
  };

  /**
   * Get current usage info
   */
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

  /**
   * Check if user is admin
   */
  const checkAdminStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setIsAdmin(true);
        setAdminRole(data.role);
        log.info(`Admin access granted: ${data.role}`);
      } else {
        setIsAdmin(false);
        setAdminRole(null);
      }
    } catch (err) {
      log.error('Admin check failed:', err);
      setIsAdmin(false);
      setAdminRole(null);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email, password, metadata = {}) => {
    setError(null);
    const { data, error } = await auth.signUp(email, password, metadata);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email, password) => {
    setError(null);
    const { data, error } = await auth.signIn(email, password);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  /**
   * Sign in with OAuth provider (Google, GitHub, etc.)
   */
  const signInWithProvider = async (provider) => {
    setError(null);
    const { data, error } = await auth.signInWithProvider(provider);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  /**
   * Sign out current user
   */
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
    setIsAdmin(false);
    setAdminRole(null);
    return { error: null };
  };

  /**
   * Reset password via email
   */
  const resetPassword = async (email) => {
    setError(null);
    const { data, error } = await auth.resetPassword(email);
    if (error) {
      setError(error.message);
      return { data: null, error };
    }
    return { data, error: null };
  };

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { session: currentSession, error } = await auth.getSession();
        
        if (error) {
          log.warn('Session retrieval error', error);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        if (currentSession?.user && mounted) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Set loading to false first, then fetch profile in background
          setIsLoading(false);
          // Fetch profile without blocking the loading state
          fetchOrCreateProfile(currentSession.user).then(profile => {
            if (mounted) {
              setUserProfile(profile);
            }
          }).catch(err => {
            log.error('Profile fetch error during init', err);
          });
          // Check admin status in background
          checkAdminStatus(currentSession.user.id);
        } else if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        log.error('Auth initialization error', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, currentSession) => {
      log.debug(`Auth state changed: ${event}`);

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user || null);
      // Always set loading to false first to prevent infinite loading
      setIsLoading(false);

      if (currentSession?.user) {
        // Fetch profile in background without blocking
        fetchOrCreateProfile(currentSession.user).then(profile => {
          if (mounted) {
            setUserProfile(profile);
          }
        }).catch(err => {
          log.error('Profile fetch error during auth change', err);
        });
        // Check admin status
        checkAdminStatus(currentSession.user.id);
      } else {
        // User logged out - reset admin state
        setUserProfile(null);
        setIsAdmin(false);
        setAdminRole(null);
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
    PLAN_LIMITS,
    // Admin properties
    isAdmin,
    adminRole,
    isSuperAdmin: adminRole === 'super_admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
