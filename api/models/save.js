// Vercel Serverless Function: Save Financial Model
// Route: /api/models/save

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  // Only allow POST
  if (req.method !== 'POST') {
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

    const { name, description, modelData, modelId } = req.body;

    if (!name || !modelData) {
      return res.status(400).json({ error: 'Name and modelData are required' });
    }

    let result;

    if (modelId) {
      // Update existing model
      const { data, error } = await supabase
        .from('saved_models')
        .update({
          name,
          description,
          model_data: modelData,
          updated_at: new Date().toISOString()
        })
        .eq('id', modelId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        return res.status(500).json({ error: 'Failed to update model' });
      }

      result = data;
    } else {
      // Create new model
      const { data, error } = await supabase
        .from('saved_models')
        .insert({
          user_id: user.id,
          name,
          description,
          model_data: modelData
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        return res.status(500).json({ error: 'Failed to save model' });
      }

      result = data;
    }

    return res.status(200).json({
      success: true,
      model: result
    });

  } catch (error) {
    console.error('Save model error:', error);
    return res.status(500).json({
      error: 'Failed to save model',
      message: error.message
    });
  }
}
