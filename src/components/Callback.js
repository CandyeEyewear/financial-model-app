import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

function Callback() {
  const { handleRedirectCallback, isLoading } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await handleRedirectCallback();
        navigate('/'); // Redirect to your main app
      } catch (error) {
        console.error('Error handling callback:', error);
        navigate('/');
      }
    };

    if (!isLoading) {
      handleCallback();
    }
  }, [handleRedirectCallback, isLoading, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '1.5rem',
      color: '#1e40af'
    }}>
      <div>Loading your FinSight dashboard...</div>
    </div>
  );
}

export default Callback;