import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifySuperAdmin, logAdminAction } from '../middleware/adminAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (req.method) {
    case 'GET':
      return getSubscriptions(req, res);
    case 'POST':
      return assignSubscription(req, res);
    case 'PUT':
      return updateSubscription(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getSubscriptions(req, res) {
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { page = 1, limit = 20, tier = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get users with their subscription info
    let query = supabase
      .from('users')
      .select('id, email, name, tier, subscription_status, ai_queries_this_month, ezee_subscription_id, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Tier filter
    if (tier && tier !== 'all') {
      query = query.eq('tier', tier);
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('subscription_status', status);
    }

    // Pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: users, count, error } = await query;

    if (error) throw error;

    // Get subscription packages for reference
    const { data: packages } = await supabase
      .from('subscription_packages')
      .select('tier_id, name, price_monthly, query_limit')
      .eq('is_active', true);

    const packageMap = {};
    (packages || []).forEach(p => {
      packageMap[p.tier_id] = p;
    });

    // Transform data
    const subscriptions = (users || []).map(user => ({
      ...user,
      package: packageMap[user.tier] || packageMap['free'],
      isActive: user.subscription_status === 'active'
    }));

    res.status(200).json({
      success: true,
      data: subscriptions,
      packages: packages || [],
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
}

async function assignSubscription(req, res) {
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { user_id, tier_id, notes = '' } = req.body;

    if (!user_id || !tier_id) {
      return res.status(400).json({ error: 'user_id and tier_id are required' });
    }

    // Verify the tier exists
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_packages')
      .select('*')
      .eq('tier_id', tier_id)
      .eq('is_active', true)
      .single();

    if (tierError || !tierData) {
      return res.status(400).json({ error: 'Invalid tier_id' });
    }

    // Update user's subscription
    const { data, error } = await supabase
      .from('users')
      .update({
        tier: tier_id,
        subscription_status: tier_id === 'free' ? 'none' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'assigned_subscription',
      'subscription',
      user_id,
      { tier_id, notes }
    );

    res.status(200).json({
      success: true,
      data: {
        ...data,
        package: tierData
      }
    });

  } catch (error) {
    console.error('Assign subscription error:', error);
    res.status(500).json({ error: 'Failed to assign subscription' });
  }
}

async function updateSubscription(req, res) {
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { user_id, tier_id, subscription_status, ai_queries_this_month, notes } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (tier_id !== undefined) {
      updates.tier = tier_id;
    }

    if (subscription_status !== undefined) {
      updates.subscription_status = subscription_status;
    }

    if (ai_queries_this_month !== undefined) {
      updates.ai_queries_this_month = ai_queries_this_month;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user_id)
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'updated_subscription',
      'subscription',
      user_id,
      { ...updates, notes }
    );

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
}
