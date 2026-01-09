/**
 * Authentication Page Component
 * Beautiful, accessible auth forms using Tailwind
 */
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from './Input';
import { Button } from './Button';
import { AlertCircle, CheckCircle, Mail, Lock, User, Layers } from 'lucide-react';

/**
 * AuthPage - Handles Sign In, Sign Up, and Password Reset
 */
const AuthPage = ({ mode: initialMode }) => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(initialMode || searchParams.get('mode') || 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const { signIn, signUp, signInWithProvider, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          navigate('/');
        }
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password, { full_name: name });
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else if (data?.user?.identities?.length === 0) {
          setMessage({ type: 'error', text: 'An account with this email already exists.' });
        } else {
          setMessage({ 
            type: 'success', 
            text: 'Check your email for a confirmation link to complete your registration.' 
          });
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setMessage({ type: 'error', text: error.message });
        } else {
          setMessage({ 
            type: 'success', 
            text: 'Check your email for a password reset link.' 
          });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const { error } = await signInWithProvider(provider);
      if (error) {
        setMessage({ type: 'error', text: error.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signin': return 'Sign in to your account';
      case 'signup': return 'Create your account';
      case 'reset': return 'Reset your password';
      default: return 'Welcome';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-card-lg shadow-card-lg p-8 sm:p-10">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Layers className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              FinSight
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              {getTitle()}
            </p>
          </div>

          {/* Message Display */}
          {message.text && (
            <div 
              role="alert"
              className={`
                flex items-start gap-3 p-4 rounded-card mb-6
                ${message.type === 'error' 
                  ? 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800' 
                  : 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
                }
              `}
            >
              {message.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
              )}
              <span className={`text-sm ${
                message.type === 'error' 
                  ? 'text-danger-700 dark:text-danger-300' 
                  : 'text-success-700 dark:text-success-300'
              }`}>
                {message.text}
              </span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <Input
                label="Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                leftIcon={User}
                autoComplete="name"
              />
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              leftIcon={Mail}
              autoComplete="email"
            />

            {mode !== 'reset' && (
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                leftIcon={Lock}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              fullWidth
              size="lg"
            >
              {mode === 'signin' ? 'Sign In' :
               mode === 'signup' ? 'Create Account' :
               'Send Reset Link'}
            </Button>
          </form>

          {/* OAuth Providers */}
          {mode !== 'reset' && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-sm text-neutral-400 dark:text-neutral-500">
                  or continue with
                </span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={loading}
                  className="gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </Button>
              </div>
            </>
          )}

          {/* Mode Switch */}
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700 text-center">
            {mode === 'signin' && (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Sign up
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-6">
          By continuing, you agree to our{' '}
          <a href="#" className="underline hover:text-neutral-600">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="underline hover:text-neutral-600">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
