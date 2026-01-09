import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  User,
  CreditCard,
  Settings,
  TrendingUp,
  CheckCircle,
  Users,
  UserPlus,
  LogOut,
  Crown,
  Zap,
  Database,
  FileText,
  Calendar,
  ExternalLink,
  AlertCircle,
  X,
  Mail,
  Trash2,
  Shield,
  UserCheck,
  Building2,
} from "lucide-react";

export function UserProfile() {
  const { user, isAuthenticated, isLoading, logout, getAccessTokenSilently } = useAuth0();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Team Members state
  const [teamMembers, setTeamMembers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfileData();
      fetchTeamMembers();
    }
  }, [isAuthenticated]);

  const fetchProfileData = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        "https://api.finsight.salesmasterjm.com/api/user/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch profile data");
      }

      const data = await response.json();
      console.log("Profile data received:", data);
      setProfileData(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        "https://api.finsight.salesmasterjm.com/api/team/members",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    }
  };

  const handleInviteTeamMember = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);

    try {
      const token = await getAccessTokenSilently();
      
      const response = await fetch(
        "https://api.finsight.salesmasterjm.com/api/team/invite",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
          }),
        }
      );

      const contentType = response.headers.get("content-type");
      
      if (!contentType || !contentType.includes("application/json")) {
        if (response.status === 403) {
          throw new Error("You don't have permission to invite team members.");
        } else {
          throw new Error(`Server error (${response.status}).`);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send invitation");
      }

      await fetchTeamMembers();
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("member");
    } catch (err) {
      console.error("Error inviting team member:", err);
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this team member?")) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `https://api.finsight.salesmasterjm.com/api/team/members/${memberId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove team member");
      }

      await fetchTeamMembers();
    } catch (err) {
      console.error("Error removing team member:", err);
      alert("Failed to remove team member: " + err.message);
    }
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
            Error Loading Profile
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mb-6">{error}</p>
          <button
            onClick={fetchProfileData}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { tier = "free", role = "member", organization_id, usage = {}, limits = {}, subscription = {}, isTeamMember = false, teamSize = 1 } = profileData || {};

  // Tier configuration
  const tierConfig = {
    free: {
      name: "Free Plan",
      icon: Zap,
      color: "slate",
      gradient: "from-slate-400 to-slate-600",
      badge: "bg-slate-100 text-slate-700",
    },
    professional: {
      name: "Professional Plan",
      icon: TrendingUp,
      color: "blue",
      gradient: "from-blue-400 to-blue-600",
      badge: "bg-blue-100 text-blue-700",
    },
    business: {
      name: "Business Plan",
      icon: Crown,
      color: "purple",
      gradient: "from-purple-400 to-purple-600",
      badge: "bg-purple-100 text-purple-700",
    },
  };

  const currentTier = tierConfig[tier] || tierConfig.free;
  const TierIcon = currentTier.icon;

  const calculatePercentage = (used, limit) => {
    if (limit === "Unlimited" || limit === Infinity || !limit) {
      return 0;
    }
    return Math.min((used / limit) * 100, 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const maxTeamMembers = tier === "business" ? 5 : 0;
  const canInviteMore = teamMembers.length < maxTeamMembers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-1 sm:mb-2">
              Your Profile
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Manage your account and subscription
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-slate-200 hover:border-red-200 text-sm sm:text-base w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>

        {/* User Info Card - Mobile Responsive */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${currentTier.gradient} flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg flex-shrink-0`}>
                {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">
                  {user?.name || "User"}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${currentTier.badge} flex items-center gap-1 whitespace-nowrap`}>
                    <TierIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{currentTier.name}</span>
                    <span className="sm:hidden">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                  </span>
                  
                  {role && (
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1 whitespace-nowrap ${
                      role === 'owner' 
                        ? 'bg-amber-100 text-amber-700'
                        : role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {role === 'owner' && <Crown className="w-3 h-3 sm:w-4 sm:h-4" />}
                      {role === 'admin' && <Shield className="w-3 h-3 sm:w-4 sm:h-4" />}
                      {role === 'member' && <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />}
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  )}
                  
                  {subscription?.status === "active" && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-green-100 text-green-700 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>
            {tier === "free" && (
              <a
                href="/pricing"
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base whitespace-nowrap"
              >
                <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                Upgrade Plan
              </a>
            )}
          </div>
          
          {organization_id && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-500 overflow-hidden">
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  Org ID: <span className="font-mono">{organization_id}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Team Usage Banner - Mobile Responsive */}
        {isTeamMember && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-blue-800 font-semibold">
                Team Usage (Shared Pool)
              </p>
            </div>
            <p className="text-xs sm:text-sm text-blue-700">
              Usage shown includes all {teamSize} team members. Limits are shared across your entire team.
            </p>
          </div>
        )}

        {/* Usage Statistics - Mobile Responsive Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800">
              Usage This Month
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <UsageStatWithBar
              icon={Zap}
              label="AI Queries"
              value={usage.aiQueriesThisMonth || 0}
              limit={limits.aiQueries}
              percentage={calculatePercentage(usage.aiQueriesThisMonth || 0, limits.aiQueries)}
            />

            <UsageStatWithBar
              icon={FileText}
              label="Reports Generated"
              value={usage.reportsThisMonth || 0}
              limit={limits.reports}
              percentage={calculatePercentage(usage.reportsThisMonth || 0, limits.reports)}
            />

            <UsageStatWithBar
              icon={Database}
              label="Storage Used"
              value={`${(usage.storageUsedMB || 0).toFixed(2)} MB`}
              limit={limits.storageMB ? `${(limits.storageMB / 1024).toFixed(1)} GB` : "0 GB"}
              percentage={calculatePercentage(usage.storageUsedMB || 0, limits.storageMB)}
            />
          </div>

          <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="break-words">
                Usage resets on <span className="font-semibold">{formatDate(usage.resetDate)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Details - Mobile Responsive */}
        {subscription?.status === "active" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-semibold text-slate-800">
                Subscription Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Plan</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800">
                  {currentTier.name}
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Billing Cycle</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800 capitalize">
                  {subscription.billingCycle || "Monthly"}
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Amount</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800">
                  ${subscription.amount || 0} USD
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Next Renewal</p>
                <p className="text-base sm:text-lg font-semibold text-slate-800">
                  {formatDate(subscription.renewsAt)}
                </p>
              </div>

              {subscription.transactionNumber && (
                <div className="sm:col-span-2">
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">Transaction Number</p>
                  <p className="text-xs sm:text-sm font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-200 break-all">
                    {subscription.transactionNumber}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Management - Mobile Responsive */}
        {subscription?.status === "active" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-semibold text-slate-800">
                Manage Subscription
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <a
                href="/pricing"
                className="flex items-center gap-3 p-3 sm:p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 flex-shrink-0">
                  <Crown className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Change Plan</p>
                  <p className="text-xs sm:text-sm text-slate-600 truncate">Upgrade or downgrade</p>
                </div>
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </a>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel your subscription?')) {
                    alert('To cancel, please contact support@finsight.com');
                  }
                }}
                className="flex items-center gap-3 p-3 sm:p-4 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all group"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 flex-shrink-0">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Cancel Subscription</p>
                  <p className="text-xs sm:text-sm text-slate-600 truncate">End at renewal date</p>
                </div>
              </button>
            </div>

            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-slate-50 rounded-lg">
              <p className="text-xs sm:text-sm text-slate-600">
                <strong>Note:</strong> If you cancel, you'll keep access until {formatDate(subscription.renewsAt)}. 
                Need help? Contact <a href="mailto:support@finsight.com" className="text-blue-600 hover:underline break-all">support@finsight.com</a>
              </p>
            </div>
          </div>
        )}

        {/* Team Members - Mobile Responsive */}
        {tier === "business" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                <h2 className="text-lg sm:text-xl font-semibold text-slate-800">
                  Team Members
                </h2>
                <span className="text-xs sm:text-sm text-slate-600">
                  ({teamMembers.length}/{maxTeamMembers})
                </span>
              </div>
              
              <button
                onClick={() => setShowInviteModal(true)}
                disabled={!canInviteMore}
                className={`px-3 sm:px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors text-sm sm:text-base w-full sm:w-auto ${
                  canInviteMore
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                Invite Member
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <p className="text-sm sm:text-base text-slate-600">
                Collaborate with your team on financial models and reports.
              </p>

              {teamMembers.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {member.email?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-sm sm:text-base truncate">
                            {member.name || member.email}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 truncate">{member.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                        <span
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
                            member.role === "owner"
                              ? "bg-amber-100 text-amber-700"
                              : member.role === "admin"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {member.role === "owner" && <Crown className="w-3 h-3" />}
                          {member.role === "admin" && <Shield className="w-3 h-3" />}
                          {member.role === "member" && <UserCheck className="w-3 h-3" />}
                          {member.role}
                        </span>
                        
                        {member.status === "pending" && (
                          <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                            Pending
                          </span>
                        )}
                        
                        {member.role !== "owner" && (
                          <button
                            onClick={() => handleRemoveTeamMember(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 border-2 border-dashed border-slate-300 rounded-lg">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm sm:text-base text-slate-600 font-medium mb-1">No team members yet</p>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Invite up to {maxTeamMembers} team members to collaborate
                  </p>
                </div>
              )}

              {!canInviteMore && teamMembers.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-amber-800 font-medium">
                    ⚠️ Team member limit reached
                  </p>
                  <p className="text-xs sm:text-sm text-amber-700 mt-1">
                    You've reached the maximum of {maxTeamMembers} team members for your plan.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invite Modal - Mobile Responsive */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Invite Team Member
                </h3>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteRole("member");
                    setInviteError(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <form onSubmit={handleInviteTeamMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  >
                    <option value="member">Member (View & Edit)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    {inviteRole === "admin"
                      ? "Admins can manage team members and billing"
                      : "Members can create and edit models"}
                  </p>
                </div>

                {inviteError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs sm:text-sm text-red-700">{inviteError}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail("");
                      setInviteRole("member");
                      setInviteError(null);
                    }}
                    className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    {inviting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send Invite
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quick Actions - Mobile Responsive */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800">
              Quick Actions
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {tier === "free" && (
              <a
                href="/pricing"
                className="flex items-center gap-3 p-3 sm:p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 flex-shrink-0">
                  <Crown className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm sm:text-base">Upgrade Plan</p>
                  <p className="text-xs sm:text-sm text-slate-600 truncate">Unlock premium features</p>
                </div>
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              </a>
            )}

            <a
              href="/"
              className="flex items-center gap-3 p-3 sm:p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm sm:text-base">Dashboard</p>
                <p className="text-xs sm:text-sm text-slate-600 truncate">Go to main dashboard</p>
              </div>
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
            </a>

            <a
              href="/pricing"
              className="flex items-center gap-3 p-3 sm:p-4 border-2 border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 flex-shrink-0">
                <CreditCard className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm sm:text-base">View Pricing</p>
                <p className="text-xs sm:text-sm text-slate-600 truncate">Compare all plans</p>
              </div>
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
            </a>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-3 sm:p-4 border-2 border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-all group"
            >
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 flex-shrink-0">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-slate-800 text-sm sm:text-base">Log Out</p>
                <p className="text-xs sm:text-sm text-slate-600 truncate">Sign out of your account</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Usage Stat Component - Mobile Responsive
function UsageStatWithBar({ icon: Icon, label, value, limit, percentage }) {
  const isUnlimited = limit === "Unlimited" || limit === Infinity;
  
  const displayLimit = isUnlimited 
    ? "∞ (Unlimited)" 
    : (typeof limit === 'number' ? limit.toLocaleString() : (limit || "0"));
  
  const getBarColor = () => {
    if (isUnlimited) return "bg-green-500";
    if (percentage === 0) return "bg-slate-300";
    if (percentage > 90) return "bg-red-500";
    if (percentage > 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-slate-700">{label}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{value}</span>
          <span className="text-xs sm:text-sm text-slate-600 whitespace-nowrap">
            of <span className="font-semibold">{displayLimit}</span>
          </span>
        </div>
        
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${getBarColor()}`}
            style={{
              width: isUnlimited ? "100%" : `${Math.max(percentage, 0)}%`,
            }}
          />
        </div>
        
        {!isUnlimited && percentage > 80 && (
          <p className="text-xs text-amber-600 font-medium">
            ⚠️ Approaching limit
          </p>
        )}
      </div>
    </div>
  );
}

export default UserProfile;