// Vercel Serverless Function: Get/Delete Single Model
// Route: /api/models/[id]

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Model ID is required' });
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

    if (req.method === 'GET') {
      // Get single model
      const { data: model, error } = await supabase
        .from('saved_models')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Model not found' });
        }
        console.error('Get error:', error);
        return res.status(500).json({ error: 'Failed to fetch model' });
      }

      return res.status(200).json({
        success: true,
        model
      });

    } else if (req.method === 'DELETE') {
      // Delete model
      const { error } = await supabase
        .from('saved_models')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Delete error:', error);
        return res.status(500).json({ error: 'Failed to delete model' });
      }

      return res.status(200).json({
        success: true,
        message: 'Model deleted successfully'
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Model operation error:', error);
    return res.status(500).json({
      error: 'Operation failed',
      message: error.message
    });
  }
}
