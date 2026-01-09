// Vercel Serverless Function: List Saved Models
// Route: /api/models/list

const { createClient } = require('@supabase/supabase-js');
const { handleCors } = require('../_cors.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user's saved models
    const { data: models, error } = await supabase
      .from('saved_models')
      .select('id, name, description, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('List error:', error);
      return res.status(500).json({ error: 'Failed to fetch models' });
    }

    return res.status(200).json({
      success: true,
      models
    });

  } catch (error) {
    console.error('List models error:', error);
    return res.status(500).json({
      error: 'Failed to list models',
      message: error.message
    });
  }
};
