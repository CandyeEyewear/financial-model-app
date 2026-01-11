/**
 * UserProfile Component
 * User profile page with usage stats and subscription management
 * Uses Supabase authentication via AuthContext
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./Card";
import { Button } from "./Button";
import { KPI, KPIGrid } from "./KPI";
import {
  User,
  CreditCard,
  Settings,
  TrendingUp,
  CheckCircle,
  LogOut,
  Crown,
  Zap,
  Database,
  FileText,
  Calendar,
  ExternalLink,
  AlertCircle,
  Mail,
  Shield,
  ArrowLeft,
  Loader2,
  Users,
} from "lucide-react";
import { TeamManagement } from "./TeamManagement";

/**
 * Tier configuration for display
 */
const TIER_CONFIG = {
  free: {
    name: "Free",
    icon: Zap,
    color: "neutral",
    bgClass: "bg-neutral-100 dark:bg-neutral-800",
    textClass: "text-neutral-700 dark:text-neutral-300",
    badgeClass: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
  },
  professional: {
    name: "Professional",
    icon: TrendingUp,
    color: "primary",
    bgClass: "bg-primary-100 dark:bg-primary-900/30",
    textClass: "text-primary-700 dark:text-primary-300",
    badgeClass: "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300",
  },
  business: {
    name: "Business",
    icon: Crown,
    color: "warning",
    bgClass: "bg-warning-100 dark:bg-warning-900/30",
    textClass: "text-warning-700 dark:text-warning-300",
    badgeClass: "bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300",
  },
  enterprise: {
    name: "Enterprise",
    icon: Shield,
    color: "success",
    bgClass: "bg-success-100 dark:bg-success-900/30",
    textClass: "text-success-700 dark:text-success-300",
    badgeClass: "bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300",
  },
};

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Calculate usage percentage
 */
function calculatePercentage(used, limit) {
  if (limit === Infinity || !limit) return 0;
  return Math.min((used / limit) * 100, 100);
}

/**
 * Usage Progress Bar Component
 */
function UsageBar({ label, icon: Icon, used, limit, className = "" }) {
  const isUnlimited = limit === Infinity || limit === "Unlimited";
  const percentage = isUnlimited ? 100 : calculatePercentage(used, limit);
  
  const getBarColor = () => {
    if (isUnlimited) return "bg-success-500";
    if (percentage > 90) return "bg-danger-500";
    if (percentage > 70) return "bg-warning-500";
    return "bg-primary-500";
  };

  const getStatus = () => {
    if (isUnlimited) return "success";
    if (percentage > 90) return "danger";
    if (percentage > 70) return "warning";
    return "neutral";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </span>
        </div>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {typeof used === 'number' ? used.toLocaleString() : used}
          </span>
          {" / "}
          {isUnlimited ? "∞" : (typeof limit === 'number' ? limit.toLocaleString() : limit)}
        </span>
      </div>
      
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {!isUnlimited && percentage > 80 && (
        <p className="text-xs text-warning-600 dark:text-warning-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Approaching limit
        </p>
      )}
    </div>
  );
}

/**
 * Main UserProfile Component
 */
export function UserProfile() {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    isLoading,
    signOut,
    getUsageInfo,
    PLAN_LIMITS,
    isAdmin,
    adminRole,
    isSuperAdmin,
    canManageTeams,
    teams,
    pendingInvites,
  } = useAuth();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  // No user state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent padding="lg">
            <AlertCircle className="w-16 h-16 text-warning-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Not Signed In
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Please sign in to view your profile.
            </p>
            <Button onClick={() => navigate("/auth")} leftIcon={User}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get tier configuration
  const tier = userProfile?.tier || "free";
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.free;
  const TierIcon = tierConfig.icon;
  
  // Get usage info
  const usageInfo = getUsageInfo() || {
    used: userProfile?.ai_queries_this_month || 0,
    limit: PLAN_LIMITS[tier] || 10,
    tier,
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              leftIcon={ArrowLeft}
            >
              Back to Dashboard
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            loading={isLoggingOut}
            leftIcon={LogOut}
          >
            Sign Out
          </Button>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle icon={User}>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              {/* Avatar */}
              <div className={`w-20 h-20 rounded-full ${tierConfig.bgClass} flex items-center justify-center flex-shrink-0`}>
                <span className={`text-2xl font-bold ${tierConfig.textClass}`}>
                  {userProfile?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {userProfile?.name || user?.email?.split("@")[0] || "User"}
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 truncate flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" />
                  {user?.email}
                </p>
                
                {/* Badges */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${tierConfig.badgeClass}`}>
                    <TierIcon className="w-4 h-4" />
                    {tierConfig.name}
                  </span>

                  {userProfile?.subscription_status === "active" && (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Active
                    </span>
                  )}

                  {/* Admin Badge - Only for admins */}
                  {isAdmin && (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      {isSuperAdmin ? (
                        <>
                          <Crown className="w-4 h-4" />
                          Super Admin
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          {adminRole?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Upgrade Button */}
              {tier === "free" && (
                <Button
                  onClick={() => navigate("/pricing")}
                  leftIcon={Crown}
                  className="flex-shrink-0"
                >
                  Upgrade Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle icon={TrendingUp}>Usage This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UsageBar
                label="AI Queries"
                icon={Zap}
                used={userProfile?.ai_queries_this_month || 0}
                limit={usageInfo.limit}
              />
              
              <UsageBar
                label="Reports Generated"
                icon={FileText}
                used={userProfile?.reports_this_month || 0}
                limit={tier === "free" ? 5 : tier === "professional" ? 50 : Infinity}
              />
              
              <UsageBar
                label="Saved Models"
                icon={Database}
                used={0}
                limit={tier === "free" ? 3 : tier === "professional" ? 25 : Infinity}
              />
            </div>
            
            {userProfile?.last_reset_date && (
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Usage resets on{" "}
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDate(userProfile.last_reset_date)}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats KPIs */}
        <KPIGrid columns={4}>
          <KPI
            label="AI Queries"
            value={userProfile?.ai_queries_this_month || 0}
            status={usageInfo.percentage > 80 ? "warning" : "neutral"}
            tooltip="AI queries used this month"
          />
          <KPI
            label="Reports"
            value={userProfile?.reports_this_month || 0}
            status="neutral"
            tooltip="Reports generated this month"
          />
          <KPI
            label="Plan"
            value={tierConfig.name}
            status={tier === "free" ? "neutral" : "success"}
            tooltip="Your current subscription plan"
          />
          <KPI
            label="Member Since"
            value={userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
            status="neutral"
            tooltip="Account creation date"
          />
        </KPIGrid>

        {/* Team Management - Show for Business/Enterprise OR users with team invites/memberships */}
        {(canManageTeams() || pendingInvites?.length > 0 || teams?.memberTeams?.length > 0) && (
          <TeamManagement />
        )}

        {/* Subscription Details (for paid users) */}
        {tier !== "free" && userProfile?.subscription_status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle icon={CreditCard}>Subscription Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Plan</p>
                  <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {tierConfig.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">Status</p>
                  <p className="text-lg font-semibold text-success-600 dark:text-success-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Active
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate("/pricing")}
                  leftIcon={Crown}
                >
                  Change Plan
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => alert("To manage your subscription, please contact support@finsight.com")}
                >
                  Manage Subscription
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle icon={Settings}>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tier === "free" && (
                <button
                  onClick={() => navigate("/pricing")}
                  className="flex items-center gap-4 p-4 border-2 border-primary-200 dark:border-primary-800 rounded-lg hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                >
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50">
                    <Crown className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">Upgrade Plan</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Unlock premium features</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                </button>
              )}

              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-4 p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all group"
              >
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700">
                  <TrendingUp className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Go to main dashboard</p>
                </div>
                <ExternalLink className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
              </button>

              <button
                onClick={() => navigate("/pricing")}
                className="flex items-center gap-4 p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all group"
              >
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700">
                  <CreditCard className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">View Pricing</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Compare all plans</p>
                </div>
                <ExternalLink className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-4 p-4 border-2 border-danger-200 dark:border-danger-800 rounded-lg hover:border-danger-400 dark:hover:border-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/30 rounded-lg flex items-center justify-center group-hover:bg-danger-200 dark:group-hover:bg-danger-900/50">
                  {isLoggingOut ? (
                    <Loader2 className="w-6 h-6 text-danger-600 dark:text-danger-400 animate-spin" />
                  ) : (
                    <LogOut className="w-6 h-6 text-danger-600 dark:text-danger-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-100">Sign Out</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Sign out of your account</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}

export default UserProfile;
