import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifySuperAdmin, logAdminAction } from '../middleware/adminAuth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  switch (req.method) {
    case 'GET':
      return getPackages(req, res);
    case 'POST':
      return createPackage(req, res);
    case 'PUT':
      return updatePackage(req, res);
    case 'DELETE':
      return deletePackage(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getPackages(req, res) {
  // Any admin can view packages
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { include_inactive = false } = req.query;

    let query = supabase
      .from('subscription_packages')
      .select('*')
      .order('display_order', { ascending: true });

    if (!include_inactive || include_inactive === 'false') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('subscription_packages table does not exist. Please run migrations.');
        return res.status(200).json({
          success: true,
          data: [],
          warning: 'Packages table not found. Please run database migrations.'
        });
      }
      throw error;
    }

    // Get subscriber count for each tier
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('tier');

    // Handle users table gracefully
    const tierCounts = {};
    if (!usersError && users) {
      users.forEach(u => {
        const tier = u.tier || 'free';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });
    }

    // Add subscriber count to each package
    const packagesWithCounts = (data || []).map(pkg => ({
      ...pkg,
      subscriber_count: tierCounts[pkg.tier_id] || 0
    }));

    res.status(200).json({ success: true, data: packagesWithCounts });

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      error: 'Failed to fetch packages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function createPackage(req, res) {
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const {
      tier_id,
      name,
      description,
      price_monthly,
      price_yearly,
      currency = 'JMD',
      query_limit,
      reports_limit,
      features,
      display_order
    } = req.body;

    if (!tier_id || !name) {
      return res.status(400).json({ error: 'tier_id and name are required' });
    }

    // Check if tier_id already exists
    const { data: existing } = await supabase
      .from('subscription_packages')
      .select('id')
      .eq('tier_id', tier_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A package with this tier_id already exists' });
    }

    const { data, error } = await supabase
      .from('subscription_packages')
      .insert({
        tier_id,
        name,
        description,
        price_monthly: price_monthly || 0,
        price_yearly: price_yearly || 0,
        currency,
        query_limit: query_limit || 10,
        reports_limit: reports_limit || 5,
        features: features || {},
        display_order: display_order || 99
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(auth.user.id, 'created_package', 'package', data.id, { tier_id, name });

    res.status(201).json({ success: true, data });

  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
}

async function updatePackage(req, res) {
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Package id is required' });
    }

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('subscription_packages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(auth.user.id, 'updated_package', 'package', id, updates);

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
}

async function deletePackage(req, res) {
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Package id is required' });
    }

    // Check if there are users on this tier
    const { data: pkg } = await supabase
      .from('subscription_packages')
      .select('tier_id')
      .eq('id', id)
      .single();

    if (pkg) {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('tier', pkg.tier_id);

      if (count > 0) {
        return res.status(400).json({
          error: `Cannot delete: ${count} users are on this tier. Move them first.`
        });
      }
    }

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('subscription_packages')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await logAdminAction(auth.user.id, 'deleted_package', 'package', id);

    res.status(200).json({ success: true, message: 'Package deactivated' });

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
}
