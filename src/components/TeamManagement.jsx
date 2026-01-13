/**
 * TeamManagement Component
 * Allows Business and Enterprise users to manage their teams
 */
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/supabase";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./Card";
import { Button } from "./Button";
import { LearnerLink } from "./LearnerLink";
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  Eye,
  Mail,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Plus,
} from "lucide-react";

/**
 * Role configuration for display
 */
const ROLE_CONFIG = {
  owner: {
    name: "Owner",
    icon: Crown,
    color: "text-warning-600 dark:text-warning-400",
    bgColor: "bg-warning-100 dark:bg-warning-900/30",
  },
  admin: {
    name: "Admin",
    icon: Shield,
    color: "text-primary-600 dark:text-primary-400",
    bgColor: "bg-primary-100 dark:bg-primary-900/30",
  },
  member: {
    name: "Member",
    icon: User,
    color: "text-neutral-600 dark:text-neutral-400",
    bgColor: "bg-neutral-100 dark:bg-neutral-800",
  },
  viewer: {
    name: "Viewer",
    icon: Eye,
    color: "text-neutral-500 dark:text-neutral-500",
    bgColor: "bg-neutral-100 dark:bg-neutral-800",
  },
};

/**
 * Status configuration
 */
const STATUS_CONFIG = {
  active: {
    name: "Active",
    icon: CheckCircle,
    color: "text-success-600 dark:text-success-400",
  },
  pending: {
    name: "Pending",
    icon: Clock,
    color: "text-warning-600 dark:text-warning-400",
  },
  declined: {
    name: "Declined",
    icon: XCircle,
    color: "text-danger-600 dark:text-danger-400",
  },
};

/**
 * Create Team Modal
 */
function CreateTeamModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const { data, error: createError } = await db.createTeam(name.trim(), description.trim());
      if (createError) throw createError;
      onCreated(data);
      onClose();
      setName("");
      setDescription("");
    } catch (err) {
      setError(err.message || "Failed to create team");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Create New Team
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Team Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Marketing Team"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Brief description of this team"
                rows={3}
              />
            </div>
            {error && (
              <div className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isCreating}>
              Create Team
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Invite Member Modal
 */
function InviteMemberModal({ isOpen, onClose, teamId, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsInviting(true);
    setError(null);

    try {
      const { error: inviteError } = await db.inviteTeamMember(teamId, email.trim(), role);
      if (inviteError) throw inviteError;
      onInvited();
      onClose();
      setEmail("");
      setRole("member");
    } catch (err) {
      setError(err.message || "Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Invite Team Member
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="colleague@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="admin">Admin - Can manage team members</option>
                <option value="member">Member - Can view and edit models</option>
                <option value="viewer">Viewer - Can only view models</option>
              </select>
            </div>
            {error && (
              <div className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isInviting} leftIcon={UserPlus}>
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Team Member Row
 */
function TeamMemberRow({ member, canManage, onRemove, onRoleChange }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
  const statusConfig = STATUS_CONFIG[member.status] || STATUS_CONFIG.pending;
  const RoleIcon = roleConfig.icon;
  const StatusIcon = statusConfig.icon;

  const handleRemove = async () => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    setIsRemoving(true);
    try {
      await onRemove(member.id);
    } finally {
      setIsRemoving(false);
    }
  };

  const displayName = member.users?.name || member.users?.email?.split("@")[0] || member.invited_email || "Unknown";
  const displayEmail = member.users?.email || member.invited_email;

  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700 last:border-0">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full ${roleConfig.bgColor} flex items-center justify-center`}>
          <span className={`text-sm font-semibold ${roleConfig.color}`}>
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            {member.users?.id && member.status === "active" ? (
              <LearnerLink
                learnerId={member.users.id}
                name={displayName}
                email={displayEmail}
                avatarUrl={member.users.avatar_url}
                showAvatar={false}
                size="sm"
              />
            ) : (
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {displayName}
              </span>
            )}
            {member.status === "pending" && (
              <span className="text-xs px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-full">
                Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <Mail className="w-3 h-3" />
            {displayEmail}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Role Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${roleConfig.bgColor}`}>
          <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
          <span className={`text-xs font-medium ${roleConfig.color}`}>
            {roleConfig.name}
          </span>
        </div>

        {/* Actions */}
        {canManage && member.role !== "owner" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            loading={isRemoving}
            className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Team Card - Expandable card showing team details
 */
function TeamCard({ team, isOwner, onRefresh }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [members, setMembers] = useState(team.team_members || []);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const { getMaxTeamMembers, userProfile } = useAuth();

  const maxMembers = getMaxTeamMembers();
  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  const loadMembers = async () => {
    if (!isOwner) return;
    setIsLoadingMembers(true);
    try {
      const { data } = await db.getTeamMembers(team.id);
      if (data) setMembers(data);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleToggleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && isOwner && !team.team_members) {
      loadMembers();
    }
  };

  const handleRemoveMember = async (memberId) => {
    await db.removeTeamMember(memberId);
    setMembers(members.filter((m) => m.id !== memberId));
    onRefresh();
  };

  const handleInvited = () => {
    loadMembers();
    onRefresh();
  };

  return (
    <Card className="mb-4">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        onClick={handleToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              {team.name}
            </h3>
            <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""}
              </span>
              {pendingMembers.length > 0 && (
                <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400">
                  <Clock className="w-3.5 h-3.5" />
                  {pendingMembers.length} pending
                </span>
              )}
              {isOwner && (
                <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400">
                  <Crown className="w-3.5 h-3.5" />
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsInviteModalOpen(true);
              }}
              leftIcon={UserPlus}
            >
              Invite
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="pt-0 border-t border-neutral-200 dark:border-neutral-700">
          {team.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {team.description}
            </p>
          )}

          {/* Member limit indicator */}
          {isOwner && maxMembers !== Infinity && (
            <div className="mb-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">
                  Team members
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {activeMembers.length + pendingMembers.length} / {maxMembers}
                </span>
              </div>
              <div className="mt-2 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(((activeMembers.length + pendingMembers.length) / maxMembers) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="mt-2">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              Team Members
            </h4>
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : members.length > 0 ? (
              <div>
                {members
                  .filter((m) => m.status !== "removed" && m.status !== "declined")
                  .map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      canManage={isOwner}
                      onRemove={handleRemoveMember}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">
                No members yet. Invite your team!
              </p>
            )}
          </div>
        </CardContent>
      )}

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        teamId={team.id}
        onInvited={handleInvited}
      />
    </Card>
  );
}

/**
 * Pending Invite Card
 */
function PendingInviteCard({ invite, onRespond }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await db.acceptTeamInvite(invite.team_id);
      onRespond();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await db.declineTeamInvite(invite.team_id);
      onRespond();
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            {invite.teams?.name}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Invited as {ROLE_CONFIG[invite.role]?.name || "Member"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDecline}
          loading={isDeclining}
          className="text-danger-600 hover:bg-danger-50"
        >
          Decline
        </Button>
        <Button size="sm" onClick={handleAccept} loading={isAccepting}>
          Accept
        </Button>
      </div>
    </div>
  );
}

/**
 * Main TeamManagement Component
 */
export function TeamManagement() {
  const {
    teams,
    pendingInvites,
    canManageTeams,
    getTeamLimit,
    refreshTeamData,
    userProfile,
  } = useAuth();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const canCreate = canManageTeams();
  const teamLimit = getTeamLimit();
  const ownedTeamCount = teams.ownedTeams?.length || 0;
  const canCreateMore = canCreate && (teamLimit === Infinity || ownedTeamCount < teamLimit);

  const handleTeamCreated = () => {
    refreshTeamData();
  };

  const handleInviteResponse = () => {
    refreshTeamData();
  };

  // Don't render for free/professional users
  if (!canCreate && pendingInvites.length === 0 && teams.memberTeams.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle icon={Users}>Team Management</CardTitle>
          {canCreateMore && (
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={Plus}
            >
              Create Team
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Invitations ({pendingInvites.length})
            </h4>
            {pendingInvites.map((invite) => (
              <PendingInviteCard
                key={invite.id}
                invite={invite}
                onRespond={handleInviteResponse}
              />
            ))}
          </div>
        )}

        {/* Owned Teams */}
        {teams.ownedTeams?.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
              <Crown className="w-4 h-4 text-warning-500" />
              Your Teams
            </h4>
            {teams.ownedTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isOwner={true}
                onRefresh={refreshTeamData}
              />
            ))}
          </div>
        )}

        {/* Member Teams */}
        {teams.memberTeams?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Teams You Belong To
            </h4>
            {teams.memberTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isOwner={false}
                onRefresh={refreshTeamData}
              />
            ))}
          </div>
        )}

        {/* Empty state for team owners who haven't created a team */}
        {canCreate && teams.ownedTeams?.length === 0 && teams.memberTeams?.length === 0 && pendingInvites.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              Create Your First Team
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-sm mx-auto">
              Teams allow you to collaborate with colleagues and share financial models.
              {userProfile?.tier === "business"
                ? " Your Business plan includes up to 5 team members."
                : " Your Enterprise plan includes unlimited team members."}
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={Plus}>
              Create Team
            </Button>
          </div>
        )}

        {/* Upgrade prompt for non-eligible users who see this due to invites */}
        {!canCreate && (teams.memberTeams.length > 0 || pendingInvites.length > 0) && (
          <div className="mt-4 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You're a member of team(s) above. To create and manage your own teams,
              upgrade to a Business or Enterprise plan.
            </p>
          </div>
        )}
      </CardContent>

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleTeamCreated}
      />
    </Card>
  );
}

export default TeamManagement;
