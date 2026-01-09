import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Callback() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, error } = useAuth();
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    // Check for error in URL hash (OAuth errors)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorDescription = hashParams.get('error_description');
    
    if (errorDescription) {
      setLocalError(errorDescription);
      return;
    }

    // If authenticated, redirect to home
    if (!isLoading && isAuthenticated) {
      navigate('/');
    }
    
    // If not loading and not authenticated, something might have gone wrong
    // Wait a bit for the auth state to settle
    const timeout = setTimeout(() => {
      if (!isLoading && !isAuthenticated) {
        navigate('/auth');
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [isLoading, isAuthenticated, navigate]);

  if (localError || error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '400px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#dc2626', fontSize: '1.1rem', marginBottom: '10px' }}>
            Authentication Error
          </div>
          <div style={{ color: '#7f1d1d', fontSize: '0.9rem' }}>
            {localError || error}
          </div>
        </div>
        <button 
          onClick={() => navigate('/auth')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1e40af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Return to Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid #e5e7eb',
        borderTopColor: '#1e40af',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{
        fontSize: '1.25rem',
        color: '#1e40af',
        fontWeight: 500
      }}>
        Completing sign in...
      </div>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default Callback;
