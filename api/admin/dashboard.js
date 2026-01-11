import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../middleware/adminAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin access
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    // Get date range (default: last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Parallel queries for dashboard data
    const [
      usersResult,
      packagesResult,
      costsResult,
      recentActivityResult
    ] = await Promise.all([
      // Total users with subscription info
      supabase
        .from('users')
        .select('id, email, name, tier, ai_queries_this_month, subscription_status, created_at, updated_at'),

      // Subscription packages
      supabase
        .from('subscription_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),

      // System costs
      supabase
        .from('system_costs')
        .select('amount, is_recurring, created_at')
        .eq('is_active', true),

      // Recent admin activity
      supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    const users = usersResult.data || [];
    const packages = packagesResult.data || [];
    const costs = costsResult.data || [];
    const recentActivity = recentActivityResult.data || [];

    // Calculate metrics
    const totalUsers = users.length;

    // New users this month
    const newUsersThisMonth = users.filter(u =>
      new Date(u.created_at) >= startDate
    ).length;

    // Subscription distribution
    const tierCounts = { free: 0 };
    users.forEach(u => {
      const tier = u.tier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Calculate MRR based on tier counts
    const packagePrices = {};
    packages.forEach(pkg => {
      packagePrices[pkg.tier_id] = pkg.price_monthly || 0;
    });

    let mrr = 0;
    Object.entries(tierCounts).forEach(([tier, count]) => {
      mrr += (packagePrices[tier] || 0) * count;
    });

    // Calculate active subscriptions (non-free)
    const activeSubscriptions = users.filter(u =>
      u.tier && u.tier !== 'free' && u.subscription_status === 'active'
    ).length;

    // Usage stats
    const totalQueries = users.reduce((sum, u) => sum + (u.ai_queries_this_month || 0), 0);
    const activeUsersThisMonth = users.filter(u => u.ai_queries_this_month > 0).length;

    // Cost calculations
    const recurringCosts = costs
      .filter(c => c.is_recurring)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const onetimeCosts = costs
      .filter(c => !c.is_recurring)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const estimatedCosts = recurringCosts + onetimeCosts;

    // Gross revenue estimate (simplified - based on active paid subscriptions)
    let grossRevenue = 0;
    users.forEach(u => {
      if (u.tier && u.tier !== 'free' && u.subscription_status === 'active') {
        grossRevenue += packagePrices[u.tier] || 0;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsersThisMonth,
          activeSubscriptions,
          mrr,
          grossRevenue,
          estimatedCosts,
          netRevenue: grossRevenue - estimatedCosts,
          activeUsersThisMonth,
          totalQueries
        },
        subscriptions: {
          distribution: tierCounts,
          packages
        },
        usage: {
          totalQueries,
          activeUsers: activeUsersThisMonth,
          avgQueriesPerUser: totalUsers > 0 ? Math.round(totalQueries / totalUsers) : 0
        },
        recentActivity
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
}
