// Vercel Serverless Function: Health Check
// Route: /api/health

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Allow GET and HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let supabaseStatus = 'Unknown';

  try {
    // Check Supabase connection
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Simple query to test connection
      const { error } = await supabase.from('users').select('count').limit(1);
      supabaseStatus = error ? 'Error' : 'Connected';
    } else {
      supabaseStatus = 'Not Configured';
    }
  } catch (error) {
    supabaseStatus = 'Error';
  }

  return res.status(200).json({
    status: 'OK',
    message: 'FinSight API is running on Vercel',
    supabase: supabaseStatus,
    deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  });
}
