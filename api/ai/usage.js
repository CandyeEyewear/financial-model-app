// Vercel Serverless Function: Get User Usage Stats
// Route: /api/ai/usage

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors.js';
import { AI_QUERY_LIMITS, getAIQueryLimit } from '../config/subscriptionLimits.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Plan limits (use centralized config)
const PLAN_LIMITS = AI_QUERY_LIMITS;

export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user profile from database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('ai_queries_this_month, reports_this_month, tier, last_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return res.status(404).json({ error: 'User not found' });
      }
      console.error('Profile error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check and reset monthly usage if needed
    const now = new Date();
    const lastReset = new Date(userProfile.last_reset_date);
    let currentUsage = userProfile.ai_queries_this_month;

    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await supabase
        .from('users')
        .update({
          ai_queries_this_month: 0,
          reports_this_month: 0,
          last_reset_date: now.toISOString()
        })
        .eq('id', user.id);
      currentUsage = 0;
    }

    const limit = PLAN_LIMITS[userProfile.tier] || PLAN_LIMITS.free;

    return res.status(200).json({
      used: currentUsage,
      limit,
      tier: userProfile.tier,
      percentage: (currentUsage / limit) * 100,
      resetDate: userProfile.last_reset_date
    });

  } catch (error) {
    console.error('Usage fetch error:', error);
    return res.status(500).json({
      error: 'Failed to fetch usage',
      message: error.message
    });
  }
}
