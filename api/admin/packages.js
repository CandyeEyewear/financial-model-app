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

/**
 * Map database schema to frontend expected format
 * Database schema: id, name, description, amount, currency, frequency, ai_query_limit, report_limit
 * Frontend expects: tier_id, name, description, price_monthly, price_yearly, currency, query_limit, reports_limit, features
 */
function mapPackageToFrontend(pkg) {
  const amount = parseFloat(pkg.amount) || 0;
  const isAnnual = pkg.frequency === 'annually';

  return {
    id: pkg.id,
    tier_id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price_monthly: isAnnual ? Math.round(amount / 12) : amount,
    price_yearly: isAnnual ? amount : amount * 12,
    currency: pkg.currency || 'USD',
    frequency: pkg.frequency || 'monthly',
    query_limit: pkg.ai_query_limit ?? getDefaultQueryLimit(pkg.id),
    reports_limit: pkg.report_limit ?? getDefaultReportsLimit(pkg.id),
    features: getDefaultFeatures(pkg.id),
    is_active: true, // Table doesn't have this field, assume active
    display_order: getDefaultDisplayOrder(pkg.id),
    created_at: pkg.created_at,
    updated_at: pkg.updated_at
  };
}

/**
 * Map frontend data to database schema for insert/update
 */
function mapFrontendToDatabase(data) {
  return {
    id: data.tier_id || data.id,
    name: data.name,
    description: data.description,
    amount: data.price_monthly || 0,
    currency: data.currency || 'USD',
    frequency: data.frequency || 'monthly',
    ai_query_limit: data.query_limit,
    report_limit: data.reports_limit
  };
}

// Helper functions for default values
function getDefaultQueryLimit(tierId) {
  const limits = { free: 10, professional: 2000, business: 10000, enterprise: null };
  return limits[tierId] ?? 10;
}

function getDefaultReportsLimit(tierId) {
  const limits = { free: 5, professional: 200, business: 1000, enterprise: null };
  return limits[tierId] ?? 5;
}

function getDefaultFeatures(tierId) {
  const features = {
    free: { ai_chat: true, basic_models: true },
    professional: { ai_chat: true, basic_models: true, advanced_models: true, export_pdf: true },
    business: { ai_chat: true, basic_models: true, advanced_models: true, export_pdf: true, priority_support: true, team_sharing: true },
    enterprise: { ai_chat: true, basic_models: true, advanced_models: true, export_pdf: true, priority_support: true, team_sharing: true, custom_branding: true, api_access: true }
  };
  return features[tierId] || { ai_chat: true, basic_models: true };
}

function getDefaultDisplayOrder(tierId) {
  const order = { free: 1, professional: 2, business: 3, enterprise: 4 };
  return order[tierId] || 99;
}

async function getPackages(req, res) {
  // Any admin can view packages
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { include_inactive = false } = req.query;

    // Query the subscription_packages table
    const { data, error } = await supabase
      .from('subscription_packages')
      .select('*')
      .order('amount', { ascending: true });

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('subscription_packages table does not exist.');
        return res.status(200).json({
          success: true,
          data: [],
          warning: 'Packages table not found. Please run database migrations.'
        });
      }
      throw error;
    }

    // Map to frontend format
    const mappedPackages = (data || []).map(mapPackageToFrontend);

    // Get subscriber count for each tier
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('tier');

    const tierCounts = {};
    if (!usersError && users) {
      users.forEach(u => {
        const tier = u.tier || 'free';
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      });
    }

    // Add subscriber count to each package
    const packagesWithCounts = mappedPackages.map(pkg => ({
      ...pkg,
      subscriber_count: tierCounts[pkg.tier_id] || 0
    }));

    // Sort by display order
    packagesWithCounts.sort((a, b) => a.display_order - b.display_order);

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
      currency = 'USD',
      frequency = 'monthly',
      query_limit,
      reports_limit
    } = req.body;

    if (!tier_id || !name) {
      return res.status(400).json({ error: 'tier_id and name are required' });
    }

    // Check if tier_id already exists
    const { data: existing } = await supabase
      .from('subscription_packages')
      .select('id')
      .eq('id', tier_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A package with this tier_id already exists' });
    }

    // Insert into database with correct schema
    const insertData = {
      id: tier_id,
      name,
      description,
      amount: price_monthly || 0,
      currency,
      frequency,
      ai_query_limit: query_limit,
      report_limit: reports_limit
    };

    const { data, error } = await supabase
      .from('subscription_packages')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Map response to frontend format
    const responseData = mapPackageToFrontend(data);

    await logAdminAction(auth.user.id, 'created_package', 'package', data.id, { tier_id, name });

    res.status(201).json({ success: true, data: responseData });

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

    // Map frontend field names to database field names
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.price_monthly !== undefined) updateData.amount = updates.price_monthly;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
    if (updates.query_limit !== undefined) updateData.ai_query_limit = updates.query_limit;
    if (updates.reports_limit !== undefined) updateData.report_limit = updates.reports_limit;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('subscription_packages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Map response to frontend format
    const responseData = mapPackageToFrontend(data);

    await logAdminAction(auth.user.id, 'updated_package', 'package', id, updates);

    res.status(200).json({ success: true, data: responseData });

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
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tier', id);

    if (count > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${count} users are on this tier. Move them first.`
      });
    }

    // Hard delete since table doesn't have is_active column
    const { error } = await supabase
      .from('subscription_packages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAdminAction(auth.user.id, 'deleted_package', 'package', id);

    res.status(200).json({ success: true, message: 'Package deleted' });

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
}
