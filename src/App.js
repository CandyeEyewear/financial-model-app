import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import FinancialModelAndStressTester from './FinancialModelAndStressTester';
import ChatAssistant from './ChatAssistant';
import Callback from './components/Callback';
import { generateModelDataSummary } from './utils/ModelDataSummary';



// Simple icons as SVG
const MessageCircleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

function App() {
  const { isLoading, error } = useAuth0();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.5rem',
        color: '#1e40af'
      }}>
        Loading FinSight...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#dc2626',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>Oops... {error.message}</div>
        <button 
          onClick={() => window.location.href = 'https://salesmasterjm.com/finsight'}
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
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route path="/" element={<ProtectedRoute />} />
      </Routes>
    </Router>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, loginWithRedirect, user, logout } = useAuth0();
  const [showAssistant, setShowAssistant] = useState(false);
   const [projectionData, setProjectionData] = useState(null);

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }
    // 🧠 Global DeepSeek AI listener (Option 2)
  // In App.js, update the useEffect:
useEffect(() => {
  const handleTrigger = (event) => {
    console.log("🚀 Global listener: AI analysis requested");

    const { summary } = event.detail || {};
    
    if (!summary) {
      window.dispatchEvent(
        new CustomEvent("ai-summary-ready", {
          detail: "⚠️ No loan metrics data available.",
        })
      );
      return;
    }

    // Show loading message
    window.dispatchEvent(
      new CustomEvent("ai-summary-ready", {
        detail: "🧠 FinAssist is analyzing your loan metrics...",
      })
    );

    const prompt = `
You are FinAssist AI, a senior credit analyst. Analyze the following loan metrics from a lender's perspective.

Focus on:
1. Debt service coverage (DSCR) - Is cash flow sufficient?
2. Interest coverage (ICR) - Can they handle interest payments?
3. Leverage (Net Debt/EBITDA) - Is debt level sustainable?
4. Covenant compliance - Any breaches or concerns?
5. Refinancing risk - Can they refinance if needed?
6. Key strengths and weaknesses

Be conversational and practical. Speak like a colleague explaining this deal over coffee.

=== LOAN METRICS DATA ===
${summary}

Provide your analysis:
`;

    fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const result =
          data?.choices?.[0]?.message?.content ||
          "No response received from DeepSeek.";
        console.log("✅ DeepSeek AI summary generated");
        window.dispatchEvent(
          new CustomEvent("ai-summary-ready", { detail: result })
        );
      })
      .catch((err) => {
        console.error("❌ DeepSeek fetch error:", err);
        window.dispatchEvent(
          new CustomEvent("ai-summary-ready", {
            detail: "Error: Unable to generate AI summary. Please check your API key and try again.",
          })
        );
      });
  };

  window.addEventListener("trigger-ai-analysis", handleTrigger);
  console.log("🧠 Global AI listener mounted in App.js");

  return () => window.removeEventListener("trigger-ai-analysis", handleTrigger);
}, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top Bar with Logout */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 40,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
          Welcome, {user?.name || user?.email}
        </div>
        <button 
          onClick={() => logout({ logoutParams: { returnTo: 'https://salesmasterjm.com/finsight' } })}
          style={{
            padding: '8px 20px',
            backgroundColor: '#1e40af',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          Logout
        </button>
      </div>

      {/* Main App */}
      <div style={{ flex: 1 }}>
       <FinancialModelAndStressTester onDataUpdate={setProjectionData} />
      </div>

      {/* Floating Chat Button */}
      {!showAssistant && (
        <button
          onClick={() => setShowAssistant(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#1e40af',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(30, 64, 175, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <MessageCircleIcon />
        </button>
      )}

      {/* Floating Chat Panel */}
      {showAssistant && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '400px',
          height: '600px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: '#1e40af',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircleIcon />
              <span style={{ fontWeight: 600 }}>FinAssist</span>
            </div>
            <button
              onClick={() => setShowAssistant(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <XIcon />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatAssistant modelData={projectionData} />} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;