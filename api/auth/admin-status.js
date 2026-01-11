import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/auth/admin-status
 * Check if the authenticated user is an admin
 * Returns { isAdmin: boolean, role: string | null }
 */
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(200).json({ isAdmin: false, role: null });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(200).json({ isAdmin: false, role: null });
    }

    // Query admin_users table with service role (bypasses RLS)
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser) {
      return res.status(200).json({ isAdmin: false, role: null });
    }

    return res.status(200).json({
      isAdmin: true,
      role: adminUser.role
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return res.status(200).json({ isAdmin: false, role: null });
  }
}
