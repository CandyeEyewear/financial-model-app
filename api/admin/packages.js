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

    // Try subscription_packages table first (full schema)
    let { data, error } = await supabase
      .from('subscription_packages')
      .select('*')
      .order('display_order', { ascending: true });

    let usingLegacyTable = false;

    // If subscription_packages doesn't exist or is empty, try legacy "packages" table
    if (error || !data || data.length === 0) {
      const legacyResult = await supabase
        .from('packages')
        .select('*');

      if (!legacyResult.error && legacyResult.data && legacyResult.data.length > 0) {
        usingLegacyTable = true;
        // Map legacy schema to expected format
        data = legacyResult.data.map((pkg, index) => ({
          id: pkg.id,
          tier_id: pkg.id, // Legacy table uses id as tier_id
          name: pkg.name,
          description: pkg.description,
          price_monthly: pkg.frequency === 'monthly' ? parseFloat(pkg.amount) || 0 : 0,
          price_yearly: pkg.frequency === 'annually' ? parseFloat(pkg.amount) || 0 : (parseFloat(pkg.amount) || 0) * 12,
          currency: pkg.currency || 'USD',
          query_limit: pkg.query_limit || getDefaultQueryLimit(pkg.id),
          reports_limit: pkg.reports_limit || getDefaultReportsLimit(pkg.id),
          features: pkg.features || getDefaultFeatures(pkg.id),
          is_active: pkg.is_active !== false,
          display_order: pkg.display_order || index + 1,
          created_at: pkg.created_at,
          updated_at: pkg.updated_at
        }));
        error = null;
      }
    }

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error('No packages table found. Please run migrations or create packages.');
        return res.status(200).json({
          success: true,
          data: [],
          warning: 'Packages table not found. Please run database migrations.'
        });
      }
      throw error;
    }

    // Filter inactive if needed
    if (!include_inactive || include_inactive === 'false') {
      data = (data || []).filter(pkg => pkg.is_active !== false);
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

    res.status(200).json({
      success: true,
      data: packagesWithCounts,
      legacy_table: usingLegacyTable
    });

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      error: 'Failed to fetch packages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper functions for default values when using legacy table
function getDefaultQueryLimit(tierId) {
  const limits = { free: 10, professional: 100, business: 500, enterprise: -1 };
  return limits[tierId] || 10;
}

function getDefaultReportsLimit(tierId) {
  const limits = { free: 2, professional: 20, business: 100, enterprise: -1 };
  return limits[tierId] || 5;
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

// Detect which table is being used
async function detectPackagesTable() {
  // Try subscription_packages first
  const { data: subPkgs, error: subErr } = await supabase
    .from('subscription_packages')
    .select('id')
    .limit(1);

  if (!subErr) {
    return 'subscription_packages';
  }

  // Try legacy packages table
  const { error: legacyErr } = await supabase
    .from('packages')
    .select('id')
    .limit(1);

  if (!legacyErr) {
    return 'packages';
  }

  return 'subscription_packages'; // Default
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
      currency = 'USD',
      query_limit,
      reports_limit,
      features,
      display_order
    } = req.body;

    if (!tier_id || !name) {
      return res.status(400).json({ error: 'tier_id and name are required' });
    }

    const tableName = await detectPackagesTable();

    // Check if tier_id already exists
    const idField = tableName === 'packages' ? 'id' : 'tier_id';
    const { data: existing } = await supabase
      .from(tableName)
      .select('id')
      .eq(idField, tier_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A package with this tier_id already exists' });
    }

    let insertData;
    if (tableName === 'packages') {
      // Legacy table format
      insertData = {
        id: tier_id,
        name,
        description,
        amount: price_monthly || 0,
        currency: currency || 'USD',
        frequency: 'monthly'
      };
    } else {
      // Full schema format
      insertData = {
        tier_id,
        name,
        description,
        price_monthly: price_monthly || 0,
        price_yearly: price_yearly || 0,
        currency: currency || 'USD',
        query_limit: query_limit || 10,
        reports_limit: reports_limit || 5,
        features: features || {},
        display_order: display_order || 99
      };
    }

    const { data, error } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Map response to expected format
    const responseData = tableName === 'packages' ? {
      id: data.id,
      tier_id: data.id,
      name: data.name,
      description: data.description,
      price_monthly: parseFloat(data.amount) || 0,
      price_yearly: (parseFloat(data.amount) || 0) * 12,
      currency: data.currency || 'USD',
      query_limit: getDefaultQueryLimit(data.id),
      reports_limit: getDefaultReportsLimit(data.id),
      features: getDefaultFeatures(data.id),
      is_active: true,
      display_order: 99
    } : data;

    await logAdminAction(auth.user.id, 'created_package', 'package', responseData.id || responseData.tier_id, { tier_id, name });

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

    const tableName = await detectPackagesTable();

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    let updateData;
    if (tableName === 'packages') {
      // Map to legacy schema
      updateData = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.price_monthly !== undefined) updateData.amount = updates.price_monthly;
      if (updates.currency !== undefined) updateData.currency = updates.currency;
      if (updates.updated_at !== undefined) updateData.updated_at = updates.updated_at;
    } else {
      updateData = { ...updates };
      updateData.updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Map response to expected format
    const responseData = tableName === 'packages' ? {
      id: data.id,
      tier_id: data.id,
      name: data.name,
      description: data.description,
      price_monthly: parseFloat(data.amount) || 0,
      price_yearly: (parseFloat(data.amount) || 0) * 12,
      currency: data.currency || 'USD',
      query_limit: getDefaultQueryLimit(data.id),
      reports_limit: getDefaultReportsLimit(data.id),
      features: getDefaultFeatures(data.id),
      is_active: data.is_active !== false,
      display_order: data.display_order || 99
    } : data;

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

    const tableName = await detectPackagesTable();

    // Check if there are users on this tier
    const tierId = tableName === 'packages' ? id : null;
    let tierIdToCheck = tierId;

    if (!tierIdToCheck) {
      const { data: pkg } = await supabase
        .from(tableName)
        .select('tier_id')
        .eq('id', id)
        .single();

      tierIdToCheck = pkg?.tier_id;
    }

    if (tierIdToCheck) {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('tier', tierIdToCheck);

      if (count > 0) {
        return res.status(400).json({
          error: `Cannot delete: ${count} users are on this tier. Move them first.`
        });
      }
    }

    // Soft delete - mark as inactive or delete for legacy table
    let error;
    if (tableName === 'packages') {
      // Legacy table might not have is_active, so try update first, then delete
      const updateResult = await supabase
        .from(tableName)
        .update({ is_active: false })
        .eq('id', id);

      if (updateResult.error) {
        // If update fails (column doesn't exist), do hard delete
        const deleteResult = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);
        error = deleteResult.error;
      } else {
        error = updateResult.error;
      }
    } else {
      const result = await supabase
        .from(tableName)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      error = result.error;
    }

    if (error) throw error;

    await logAdminAction(auth.user.id, 'deleted_package', 'package', id);

    res.status(200).json({ success: true, message: 'Package deactivated' });

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
}
