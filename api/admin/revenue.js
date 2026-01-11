import { createClient } from '@supabase/supabase-js';
import { verifySuperAdmin } from '../middleware/adminAuth.js';

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

  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get subscription packages
    const { data: packages } = await supabase
      .from('subscription_packages')
      .select('tier_id, name, price_monthly')
      .eq('is_active', true);

    const packagePrices = {};
    (packages || []).forEach(p => {
      packagePrices[p.tier_id] = p.price_monthly || 0;
    });

    // Get users with subscription data
    const { data: users } = await supabase
      .from('users')
      .select('id, tier, subscription_status, created_at, updated_at');

    // Calculate subscription distribution
    const tierCounts = {};
    (users || []).forEach(u => {
      const tier = u.tier || 'free';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    // Calculate MRR
    let mrr = 0;
    Object.entries(tierCounts).forEach(([tier, count]) => {
      mrr += (packagePrices[tier] || 0) * count;
    });

    // Calculate gross revenue (active paid subscribers)
    let grossRevenue = 0;
    (users || []).forEach(u => {
      if (u.tier && u.tier !== 'free' && u.subscription_status === 'active') {
        grossRevenue += packagePrices[u.tier] || 0;
      }
    });

    // Get costs data
    const { data: costs } = await supabase
      .from('system_costs')
      .select(`
        *,
        cost_categories (name, icon, color)
      `)
      .eq('is_active', true);

    // Calculate total costs
    const recurringCosts = (costs || [])
      .filter(c => c.is_recurring)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const onetimeCosts = (costs || [])
      .filter(c => !c.is_recurring && new Date(c.period_start) >= startDate)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const totalCosts = recurringCosts + onetimeCosts;
    const netRevenue = grossRevenue - totalCosts;

    // Costs breakdown by category
    const costsByType = {};
    (costs || []).forEach(c => {
      const category = c.cost_categories?.name || c.cost_type || 'other';
      costsByType[category] = (costsByType[category] || 0) + (c.amount || 0);
    });

    // Revenue by day (simplified - based on when users signed up or upgraded)
    const revenueByDay = {};
    const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < Math.min(dayCount, 30); i++) {
      const day = new Date(endDate);
      day.setDate(day.getDate() - i);
      const dateKey = day.toISOString().split('T')[0];
      revenueByDay[dateKey] = 0;
    }

    // Distribute MRR across days (simplified)
    const dailyRevenue = mrr / 30;
    Object.keys(revenueByDay).forEach(date => {
      revenueByDay[date] = Math.round(dailyRevenue);
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          grossRevenue,
          totalCosts,
          netRevenue,
          mrr,
          profitMargin: grossRevenue > 0 ? ((netRevenue / grossRevenue) * 100).toFixed(1) : 0
        },
        subscriptions: {
          distribution: tierCounts,
          total: Object.values(tierCounts).reduce((a, b) => a + b, 0)
        },
        costs: {
          recurring: recurringCosts,
          onetime: onetimeCosts,
          total: totalCosts
        },
        charts: {
          revenueByDay: Object.entries(revenueByDay)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          costsByType: Object.entries(costsByType)
            .map(([type, amount]) => ({ type, amount }))
            .sort((a, b) => b.amount - a.amount)
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
}
