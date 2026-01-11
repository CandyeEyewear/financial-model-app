import { createClient } from '@supabase/supabase-js';
import { verifySuperAdmin, logAdminAction } from '../middleware/adminAuth.js';

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

  // Only super admins can manage costs
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  switch (req.method) {
    case 'GET':
      return getCosts(req, res, auth);
    case 'POST':
      return createCost(req, res, auth);
    case 'PUT':
      return updateCost(req, res, auth);
    case 'DELETE':
      return deleteCost(req, res, auth);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getCosts(req, res, auth) {
  try {
    const {
      category,
      recurring,
      start_date,
      end_date,
      include_inactive = false
    } = req.query;

    // Build query
    let query = supabase
      .from('system_costs')
      .select(`
        *,
        cost_categories (
          id,
          name,
          icon,
          color
        )
      `)
      .order('created_at', { ascending: false });

    // Filters
    if (!include_inactive || include_inactive === 'false') {
      query = query.eq('is_active', true);
    }

    if (category && category !== 'all') {
      // Get category ID first
      const { data: cat } = await supabase
        .from('cost_categories')
        .select('id')
        .eq('name', category)
        .single();

      if (cat) {
        query = query.eq('category_id', cat.id);
      }
    }

    if (recurring !== undefined && recurring !== 'all') {
      query = query.eq('is_recurring', recurring === 'true');
    }

    if (start_date) {
      query = query.gte('period_start', start_date);
    }

    if (end_date) {
      query = query.lte('period_start', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Also get categories for the form
    const { data: categories } = await supabase
      .from('cost_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    // Calculate totals
    const recurringTotal = (data || [])
      .filter(c => c.is_recurring)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    const onetimeTotal = (data || [])
      .filter(c => !c.is_recurring)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        costs: data || [],
        categories: categories || [],
        summary: {
          recurringTotal,
          onetimeTotal,
          grandTotal: recurringTotal + onetimeTotal,
          count: (data || []).length
        }
      }
    });

  } catch (error) {
    console.error('Get costs error:', error);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
}

async function createCost(req, res, auth) {
  try {
    const {
      category_id,
      cost_type,
      description,
      amount,
      currency = 'JMD',
      period_start,
      period_end,
      is_recurring = false,
      vendor,
      invoice_number,
      notes
    } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // If category_id not provided but cost_type is, look up category
    let finalCategoryId = category_id;
    if (!finalCategoryId && cost_type) {
      const { data: cat } = await supabase
        .from('cost_categories')
        .select('id')
        .eq('name', cost_type)
        .single();

      finalCategoryId = cat?.id;
    }

    // Create cost entry
    const { data, error } = await supabase
      .from('system_costs')
      .insert({
        category_id: finalCategoryId,
        cost_type: cost_type || 'other',
        description,
        amount,
        currency,
        period_start: period_start || new Date().toISOString().split('T')[0],
        period_end: period_end || null,
        is_recurring,
        vendor,
        invoice_number,
        notes,
        created_by: auth.user.id
      })
      .select(`
        *,
        cost_categories (name, icon, color)
      `)
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'created_cost',
      'cost',
      data.id,
      { amount, description, is_recurring }
    );

    res.status(201).json({ success: true, data });

  } catch (error) {
    console.error('Create cost error:', error);
    res.status(500).json({ error: 'Failed to create cost entry' });
  }
}

async function updateCost(req, res, auth) {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Cost ID is required' });
    }

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('system_costs')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        cost_categories (name, icon, color)
      `)
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'updated_cost',
      'cost',
      id,
      updates
    );

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Update cost error:', error);
    res.status(500).json({ error: 'Failed to update cost entry' });
  }
}

async function deleteCost(req, res, auth) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Cost ID is required' });
    }

    // Soft delete
    const { error } = await supabase
      .from('system_costs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'deleted_cost',
      'cost',
      id
    );

    res.status(200).json({ success: true, message: 'Cost entry deleted' });

  } catch (error) {
    console.error('Delete cost error:', error);
    res.status(500).json({ error: 'Failed to delete cost entry' });
  }
}
