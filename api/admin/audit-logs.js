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
    const {
      page = 1,
      limit = 50,
      action = '',
      target_type = '',
      admin_id = '',
      start_date = '',
      end_date = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filters
    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    if (target_type && target_type !== 'all') {
      query = query.eq('target_type', target_type);
    }

    if (admin_id && admin_id !== 'all') {
      query = query.eq('admin_id', admin_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    // Pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    // Get admin user details for each log entry
    const adminIds = [...new Set((data || []).map(log => log.admin_id))];
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', adminIds);

    const adminMap = {};
    (adminUsers || []).forEach(u => {
      adminMap[u.id] = { email: u.email, name: u.name };
    });

    // Enrich logs with admin info
    const enrichedLogs = (data || []).map(log => ({
      ...log,
      admin: adminMap[log.admin_id] || { email: 'Unknown', name: null }
    }));

    // Get unique actions and target types for filters
    const { data: filterOptions } = await supabase
      .from('admin_audit_logs')
      .select('action, target_type')
      .limit(1000);

    const uniqueActions = [...new Set((filterOptions || []).map(f => f.action))].sort();
    const uniqueTargetTypes = [...new Set((filterOptions || []).map(f => f.target_type))].sort();

    res.status(200).json({
      success: true,
      data: enrichedLogs,
      filters: {
        actions: uniqueActions,
        targetTypes: uniqueTargetTypes
      },
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}
