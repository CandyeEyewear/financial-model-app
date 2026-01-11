/**
 * FinSight - Financial Modeling Platform
 * Main Application Component
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import FinancialModelAndStressTester from './FinancialModelAndStressTester';
import ChatAssistant from './ChatAssistant';
import AuthPage from './components/AuthPage';
import Callback from './components/Callback';
import UserProfile from './components/UserProfile';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancelled from './pages/PaymentCancelled';
import PricingPage from './components/PricingPage';
import { Button } from './components/Button';
import { MessageCircle, X, LogOut, User, Loader2, RefreshCw, Shield } from 'lucide-react';

/**
 * Main App Component - Handles routing and auth state
 */
function App() {
  const { isLoading, error, isAuthenticated } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
            Loading FinSight...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-danger-600 dark:text-danger-400" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Something went wrong
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            leftIcon={RefreshCw}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route path="/auth" element={
          isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
        } />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route path="/profile" element={
          isAuthenticated ? <UserProfile /> : <Navigate to="/auth" replace />
        } />
        <Route path="/payment-success" element={
          isAuthenticated ? <PaymentSuccess /> : <Navigate to="/auth" replace />
        } />
        <Route path="/payment-cancelled" element={
          isAuthenticated ? <PaymentCancelled /> : <Navigate to="/auth" replace />
        } />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/" element={
          isAuthenticated ? <ProtectedRoute /> : <Navigate to="/auth" replace />
        } />
      </Routes>
    </Router>
  );
}

/**
 * Protected Route - Main application after authentication
 */
function ProtectedRoute() {
  const { user, userProfile, signOut, session, isAdmin, isSuperAdmin } = useAuth();
  const [showAssistant, setShowAssistant] = useState(false);
  const [projectionData, setProjectionData] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Ref to access FinancialModelAndStressTester methods
  const modelRef = useRef(null);

  // ==========================================
  // CALLBACKS FOR CHATASSISTANT
  // ==========================================

  /**
   * Handle parameter updates from AI assistant
   * @param {string} paramName - The parameter to update
   * @param {number} newValue - The new value
   */
  const handleParamUpdate = useCallback((paramName, newValue) => {
    console.log(`[App] AI updating param: ${paramName} = ${newValue}`);
    if (modelRef.current) {
      modelRef.current.updateParam(paramName, newValue);
    } else {
      console.warn('[App] modelRef.current is null - cannot update param');
    }
  }, []);

  /**
   * Handle stress test requests from AI assistant
   * @param {object} shocks - Shock parameters
   */
  const handleRunStressTest = useCallback((shocks) => {
    console.log('[App] AI running stress test with shocks:', shocks);
    if (modelRef.current) {
      modelRef.current.runStressTest(shocks);
    } else {
      console.warn('[App] modelRef.current is null - cannot run stress test');
    }
  }, []);

  /**
   * Handle tab navigation requests from AI assistant
   * @param {string} tabId - Tab to navigate to
   */
  const handleNavigateToTab = useCallback((tabId) => {
    console.log(`[App] AI navigating to tab: ${tabId}`);
    if (modelRef.current) {
      modelRef.current.navigateToTab(tabId);
    } else {
      console.warn('[App] modelRef.current is null - cannot navigate to tab');
    }
  }, []);

  // AI Analysis handler
  const handleAIAnalysis = useCallback(async (event) => {
    const { summary } = event.detail || {};
    
    if (!summary) {
      window.dispatchEvent(
        new CustomEvent("ai-summary-ready", {
          detail: "No loan metrics data available.",
        })
      );
      return;
    }

    // Show loading message
    window.dispatchEvent(
      new CustomEvent("ai-summary-ready", {
        detail: "FinAssist is analyzing the loan metrics...",
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

    try {
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt,
          systemMessage: "You are FinAssist AI, a senior credit analyst providing conversational, practical analysis."
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      const result = data?.choices?.[0]?.message?.content || "No response received.";
      window.dispatchEvent(
        new CustomEvent("ai-summary-ready", { detail: result })
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("ai-summary-ready", {
          detail: "Error: Unable to generate AI summary. Please try again.",
        })
      );
    }
  }, [session]);

  // Set up AI listener
  useEffect(() => {
    window.addEventListener("trigger-ai-analysis", handleAIAnalysis);
    return () => window.removeEventListener("trigger-ai-analysis", handleAIAnalysis);
  }, [handleAIAnalysis]);

  // Logout handler
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      // Error is handled by auth context
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Get tier badge color
  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'enterprise': return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
      case 'business': return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400';
      case 'professional': return 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-400';
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-sticky bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <img 
                src={`${process.env.PUBLIC_URL}/favicon.ico`} 
                alt="FinSight Logo" 
                className="h-8 w-8 sm:h-10 sm:w-10"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  FinSight
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-0.5">
                  Financial Modeling Platform
                </p>
              </div>
            </div>
            
            {/* User Info and Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Admin Panel Button - Only shows for admins */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">Admin Panel</span>
                </Link>
              )}

              {/* User profile - clickable link to profile page */}
              <Link 
                to="/profile" 
                className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
                aria-label="View profile"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[150px]">
                    {userProfile?.name || user?.email?.split('@')[0]}
                  </p>
                  {userProfile?.tier && userProfile.tier !== 'free' && (
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-badge ${getTierBadgeClass(userProfile.tier)}`}>
                      {userProfile.tier.charAt(0).toUpperCase() + userProfile.tier.slice(1)}
                    </span>
                  )}
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                </div>
              </Link>
              
              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                loading={isLoggingOut}
                aria-label="Sign out"
                className="hidden sm:flex"
              >
                <LogOut className="w-4 h-4 mr-1.5" aria-hidden="true" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
              
              {/* Mobile logout */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="sm:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
                aria-label="Sign out"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <FinancialModelAndStressTester
          ref={modelRef}
          onDataUpdate={setProjectionData}
          accessToken={session?.access_token}
        />
      </main>

      {/* Floating Chat Button - Responsive */}
      {!showAssistant && (
        <button
          onClick={() => setShowAssistant(true)}
          className="
            fixed z-modal
            bottom-4 right-4 sm:bottom-6 sm:right-6
            w-14 h-14 sm:w-16 sm:h-16
            rounded-full
            bg-gradient-to-br from-primary-500 to-primary-700
            text-white
            shadow-lg hover:shadow-xl
            transition-all duration-normal
            hover:scale-105 active:scale-95
            focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300
            flex items-center justify-center
          "
          aria-label="Open FinAssist AI chat"
        >
          <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
        </button>
      )}

      {/* Floating Chat Panel - Responsive */}
      {showAssistant && (
        <>
          {/* Mobile Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-modal-backdrop lg:hidden"
            onClick={() => setShowAssistant(false)}
            aria-hidden="true"
          />
          
          {/* Chat Panel */}
          <aside
            className="
              fixed z-modal
              
              /* Mobile: Full screen with margin */
              inset-x-2 bottom-2 top-16
              sm:inset-x-4 sm:bottom-4 sm:top-20
              
              /* Large screens: Fixed size in corner */
              lg:inset-auto lg:bottom-6 lg:right-6
              lg:w-[420px] lg:h-[600px]
              
              bg-white dark:bg-neutral-800
              rounded-card-lg
              shadow-modal
              
              flex flex-col
              overflow-hidden
              border border-neutral-200 dark:border-neutral-700
              
              animate-slide-in-up lg:animate-scale-in
            "
            role="complementary"
            aria-label="FinAssist AI Chat"
          >
            {/* Chat Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold">FinAssist</h2>
                  <p className="text-xs text-primary-100">AI Financial Analyst</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssistant(false)}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>
            
            {/* Chat Content */}
            <div className="flex-1 overflow-hidden">
              <ChatAssistant
                modelData={projectionData}
                onParamUpdate={handleParamUpdate}
                onRunStressTest={handleRunStressTest}
                onNavigateToTab={handleNavigateToTab}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export default App;
