// Vercel Serverless Function: Report Usage API
// Route: /api/reports/usage
// Methods:
//   GET  - Check current report usage and limits
//   POST - Increment report usage (call when generating a report)

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors.js';
import { REPORT_LIMITS, getReportLimit, canExportPDF } from '../config/subscriptionLimits.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Error codes
const ERROR_CODES = {
  MISSING_AUTH: 'E001',
  INVALID_TOKEN: 'E002',
  PROFILE_ERROR: 'E003',
  RATE_LIMITED: 'E004',
  FEATURE_DISABLED: 'E005',
  INVALID_METHOD: 'E006'
};

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.INVALID_METHOD,
      requestId
    });
  }

  try {
    // Validate Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        code: ERROR_CODES.MISSING_AUTH,
        requestId
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({
        error: 'Invalid token format',
        code: ERROR_CODES.MISSING_AUTH,
        requestId
      });
    }

    // Verify JWT Token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: ERROR_CODES.INVALID_TOKEN,
        requestId
      });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, tier, reports_this_month, last_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // User doesn't exist - create them with defaults
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            tier: 'free',
            ai_queries_this_month: 0,
            reports_this_month: 0,
            last_reset_date: new Date().toISOString()
          })
          .select('id, tier, reports_this_month, last_reset_date')
          .single();

        if (createError) {
          console.error('Profile create error:', createError);
          return res.status(500).json({
            error: 'Failed to create user profile',
            code: ERROR_CODES.PROFILE_ERROR,
            requestId
          });
        }

        // Use the newly created profile
        Object.assign(userProfile || {}, newProfile);
      } else {
        console.error('Profile error:', profileError);
        return res.status(500).json({
          error: 'Failed to fetch user profile',
          code: ERROR_CODES.PROFILE_ERROR,
          requestId
        });
      }
    }

    // Check and reset monthly usage if needed
    const now = new Date();
    const lastReset = userProfile?.last_reset_date ? new Date(userProfile.last_reset_date) : null;
    let currentUsage = userProfile?.reports_this_month || 0;

    const shouldReset = !lastReset ||
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear();

    if (shouldReset) {
      await supabase
        .from('users')
        .update({
          reports_this_month: 0,
          last_reset_date: now.toISOString()
        })
        .eq('id', user.id);
      currentUsage = 0;
    }

    const tier = userProfile?.tier || 'free';
    const limit = getReportLimit(tier);
    const canExport = canExportPDF(tier);

    // Check if user is admin (bypass limits)
    let isAdmin = false;
    try {
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!adminError && adminUser) {
        isAdmin = true;
      }
    } catch (e) {
      // Silently ignore admin check errors
    }

    // GET - Return current usage and limits
    if (req.method === 'GET') {
      return res.status(200).json({
        used: currentUsage,
        limit: isAdmin ? 999999 : limit,
        tier,
        percentage: (currentUsage / limit) * 100,
        canGenerateReport: isAdmin || currentUsage < limit,
        canExportPDF: isAdmin || canExport,
        isAdmin,
        requestId
      });
    }

    // POST - Increment usage (check limits first)
    if (req.method === 'POST') {
      const { reportType = 'general' } = req.body || {};

      // Check PDF export feature for PDF reports
      if (reportType === 'pdf' && !isAdmin && !canExport) {
        return res.status(403).json({
          error: 'PDF export is not available on your plan',
          code: ERROR_CODES.FEATURE_DISABLED,
          tier,
          message: 'Upgrade to Professional or higher to export PDFs.',
          upgradeUrl: '/pricing',
          requestId
        });
      }

      // Check report limit
      if (!isAdmin && currentUsage >= limit) {
        return res.status(429).json({
          error: 'Monthly report limit reached',
          code: ERROR_CODES.RATE_LIMITED,
          limit,
          used: currentUsage,
          tier,
          message: `You've generated ${currentUsage} of ${limit} reports this month. Upgrade to continue.`,
          upgradeUrl: '/pricing',
          requestId
        });
      }

      // Increment usage
      const { error: updateError } = await supabase
        .from('users')
        .update({
          reports_this_month: currentUsage + 1
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Usage update error:', updateError);
        // Don't fail the request, just log the error
      }

      return res.status(200).json({
        success: true,
        used: currentUsage + 1,
        limit: isAdmin ? 999999 : limit,
        tier,
        percentage: ((currentUsage + 1) / limit) * 100,
        requestId
      });
    }

  } catch (error) {
    console.error('Report usage error:', error);
    return res.status(500).json({
      error: 'Failed to process request',
      message: error.message,
      requestId
    });
  }
}
