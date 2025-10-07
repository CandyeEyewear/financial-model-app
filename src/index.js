import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';
import { Auth0Provider } from '@auth0/auth0-react';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain="dev-56588f47f28r24xx.us.auth0.com"
      clientId="I0qg8oRhFZ18Uv7oXeY53udosv0Ql0oQ"
      authorizationParams={{
        redirect_uri: window.location.origin + '/callback'
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);