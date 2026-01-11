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
      return getUsers(req, res);
    case 'POST':
      return createUser(req, res);
    case 'PUT':
      return updateUser(req, res);
    case 'DELETE':
      return deleteUser(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getUsers(req, res) {
  // Verify admin access
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { page = 1, limit = 20, search = '', tier = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    // Tier filter
    if (tier && tier !== 'all') {
      query = query.eq('tier', tier);
    }

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('subscription_status', status);
    }

    // Pagination and ordering
    query = query
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) throw error;

    // Get admin status for each user
    const userIds = (data || []).map(u => u.id);
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('user_id, role')
      .in('user_id', userIds)
      .eq('is_active', true);

    const adminMap = {};
    (adminUsers || []).forEach(a => {
      adminMap[a.user_id] = a.role;
    });

    // Transform data
    const users = (data || []).map(user => ({
      ...user,
      adminRole: adminMap[user.id] || null,
      isAdmin: !!adminMap[user.id]
    }));

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function createUser(req, res) {
  // Verify super admin access
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { email, name, tier = 'free', send_invite = true } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) throw authError;

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        tier,
        subscription_status: tier === 'free' ? 'none' : 'active',
        created_by: auth.user.id
      });

    if (profileError) throw profileError;

    // Send invite email if requested
    if (send_invite) {
      try {
        await supabase.auth.admin.generateLink({
          type: 'invite',
          email
        });
      } catch (inviteError) {
        console.error('Failed to send invite:', inviteError);
      }
    }

    // Log action
    await logAdminAction(
      auth.user.id,
      'created_user',
      'user',
      authData.user.id,
      { email, tier }
    );

    res.status(201).json({
      success: true,
      data: {
        id: authData.user.id,
        email,
        name,
        tier
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
}

async function updateUser(req, res) {
  // Verify admin access
  const auth = await verifyAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Only super admins can change tier
    if (updates.tier && auth.adminUser.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can change user tiers' });
    }

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log action
    await logAdminAction(
      auth.user.id,
      'updated_user',
      'user',
      id,
      updates
    );

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

async function deleteUser(req, res) {
  // Verify super admin access
  const auth = await verifySuperAdmin(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Don't allow deleting yourself
    if (id === auth.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // Also disable in auth (optional - you might want to keep this)
    // await supabase.auth.admin.deleteUser(id);

    // Log action
    await logAdminAction(
      auth.user.id,
      'deleted_user',
      'user',
      id
    );

    res.status(200).json({ success: true, message: 'User deactivated' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
