import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify user is an admin
 * @param {string} authHeader - Authorization header with Bearer token
 * @returns {Promise<{user?: object, adminUser?: object, error?: string, status?: number}>}
 */
export async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No authorization token', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  // Check if user is admin
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (adminError || !adminUser) {
    return { error: 'Not authorized as admin', status: 403 };
  }

  return { user, adminUser };
}

/**
 * Verify user is super admin
 * @param {string} authHeader - Authorization header with Bearer token
 * @returns {Promise<{user?: object, adminUser?: object, error?: string, status?: number}>}
 */
export async function verifySuperAdmin(authHeader) {
  const result = await verifyAdmin(authHeader);

  if (result.error) {
    return result;
  }

  if (result.adminUser.role !== 'super_admin') {
    return { error: 'Super admin access required', status: 403 };
  }

  return result;
}

/**
 * Check if a user has a specific admin role
 * @param {string} authHeader - Authorization header with Bearer token
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<{user?: object, adminUser?: object, error?: string, status?: number}>}
 */
export async function verifyAdminRole(authHeader, allowedRoles) {
  const result = await verifyAdmin(authHeader);

  if (result.error) {
    return result;
  }

  if (!allowedRoles.includes(result.adminUser.role)) {
    return { error: `Required role: ${allowedRoles.join(' or ')}`, status: 403 };
  }

  return result;
}

/**
 * Log admin action to audit log
 * @param {string} adminId - Admin user's UUID
 * @param {string} action - Action type (e.g., 'created_user', 'updated_subscription')
 * @param {string} targetType - Type of target (e.g., 'user', 'subscription')
 * @param {string|null} targetId - UUID of the target entity
 * @param {object} details - Additional details about the action
 * @param {string|null} ipAddress - Request IP address
 * @param {string|null} userAgent - Request user agent
 */
export async function logAdminAction(adminId, action, targetType, targetId = null, details = {}, ipAddress = null, userAgent = null) {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: targetId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent
      });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

/**
 * Check if a specific user is an admin (for use in non-admin endpoints)
 * @param {string} userId - User UUID to check
 * @returns {Promise<{isAdmin: boolean, role: string|null}>}
 */
export async function checkIfAdmin(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { isAdmin: false, role: null };
  }

  return { isAdmin: true, role: data.role };
}

/**
 * Get admin user details
 * @param {string} userId - User UUID
 * @returns {Promise<object|null>}
 */
export async function getAdminUser(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export default {
  verifyAdmin,
  verifySuperAdmin,
  verifyAdminRole,
  logAdminAction,
  checkIfAdmin,
  getAdminUser
};
