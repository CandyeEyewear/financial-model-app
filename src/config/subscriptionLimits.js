/**
 * Centralized Subscription Limits Configuration
 *
 * This file contains all subscription tier limits and feature flags.
 * Used by both frontend (AuthContext) and backend (API endpoints).
 */

// AI query limits per month by tier
export const AI_QUERY_LIMITS = {
  free: 10,
  professional: 100,
  business: 500,
  enterprise: 999999  // Effectively unlimited
};

// Report generation limits per month by tier
export const REPORT_LIMITS = {
  free: 2,
  professional: 20,
  business: 100,
  enterprise: 999999  // Effectively unlimited
};

// Team limits by tier
export const TEAM_LIMITS = {
  free: 0,
  professional: 0,
  business: 1,
  enterprise: 999999  // Effectively unlimited
};

// Max team members by tier
export const TEAM_MEMBER_LIMITS = {
  free: 0,
  professional: 0,
  business: 5,
  enterprise: 999999  // Effectively unlimited
};

// Feature flags by tier
export const TIER_FEATURES = {
  free: {
    ai_chat: true,
    basic_models: true,
    advanced_models: false,
    export_pdf: false,
    priority_support: false,
    team_sharing: false,
    custom_branding: false,
    api_access: false
  },
  professional: {
    ai_chat: true,
    basic_models: true,
    advanced_models: true,
    export_pdf: true,
    priority_support: false,
    team_sharing: false,
    custom_branding: false,
    api_access: false
  },
  business: {
    ai_chat: true,
    basic_models: true,
    advanced_models: true,
    export_pdf: true,
    priority_support: true,
    team_sharing: true,
    custom_branding: false,
    api_access: false
  },
  enterprise: {
    ai_chat: true,
    basic_models: true,
    advanced_models: true,
    export_pdf: true,
    priority_support: true,
    team_sharing: true,
    custom_branding: true,
    api_access: true
  }
};

// Helper functions
export const getAIQueryLimit = (tier) => AI_QUERY_LIMITS[tier] || AI_QUERY_LIMITS.free;
export const getReportLimit = (tier) => REPORT_LIMITS[tier] || REPORT_LIMITS.free;
export const getTeamLimit = (tier) => TEAM_LIMITS[tier] || TEAM_LIMITS.free;
export const getTeamMemberLimit = (tier) => TEAM_MEMBER_LIMITS[tier] || TEAM_MEMBER_LIMITS.free;

export const hasFeature = (tier, feature) => {
  const features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  return features[feature] === true;
};

export const canExportPDF = (tier) => hasFeature(tier, 'export_pdf');
export const canManageTeams = (tier) => hasFeature(tier, 'team_sharing');
export const hasAdvancedModels = (tier) => hasFeature(tier, 'advanced_models');
export const hasAPIAccess = (tier) => hasFeature(tier, 'api_access');

// Default export for convenience
export default {
  AI_QUERY_LIMITS,
  REPORT_LIMITS,
  TEAM_LIMITS,
  TEAM_MEMBER_LIMITS,
  TIER_FEATURES,
  getAIQueryLimit,
  getReportLimit,
  getTeamLimit,
  getTeamMemberLimit,
  hasFeature,
  canExportPDF,
  canManageTeams,
  hasAdvancedModels,
  hasAPIAccess
};
