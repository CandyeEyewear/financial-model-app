// Vercel Serverless Function: AI Analysis Endpoint
// Route: /api/ai/analyze

const { createClient } = require('@supabase/supabase-js');
const { handleCors } = require('../_cors.js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Plan limits
const PLAN_LIMITS = {
  free: 10,
  professional: 100,
  business: 500,
  enterprise: 999999
};

module.exports = async function handler(req, res) {
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

    // Get user profile from database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Check and reset monthly usage if needed
    const now = new Date();
    const lastReset = new Date(userProfile.last_reset_date);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await supabase
        .from('users')
        .update({
          ai_queries_this_month: 0,
          reports_this_month: 0,
          last_reset_date: now.toISOString()
        })
        .eq('id', user.id);
      userProfile.ai_queries_this_month = 0;
    }

    // Check usage limits
    const limit = PLAN_LIMITS[userProfile.tier] || PLAN_LIMITS.free;
    if (userProfile.ai_queries_this_month >= limit) {
      return res.status(429).json({
        error: 'Monthly AI query limit reached',
        limit,
        used: userProfile.ai_queries_this_month,
        tier: userProfile.tier,
        message: `You've used ${userProfile.ai_queries_this_month} of ${limit} AI queries this month. Upgrade to continue.`,
        upgradeUrl: '/pricing'
      });
    }

    // Get request body
    const { prompt, modelData, messages, systemMessage } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Check for API key
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY is not set');
      return res.status(500).json({
        error: 'Server configuration error: Missing API key'
      });
    }

    // Build messages array for DeepSeek
    const deepseekMessages = [];

    if (systemMessage) {
      deepseekMessages.push({
        role: 'system',
        content: systemMessage
      });
    }

    if (messages && Array.isArray(messages)) {
      deepseekMessages.push(...messages);
    }

    deepseekMessages.push({
      role: 'user',
      content: prompt
    });

    // Call DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: deepseekMessages,
        temperature: 0.8,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API Error:', errorText);
      return res.status(response.status).json({
        error: 'DeepSeek API error',
        details: errorText
      });
    }

    const data = await response.json();

    // Increment usage after successful response
    await supabase
      .from('users')
      .update({
        ai_queries_this_month: userProfile.ai_queries_this_month + 1,
        last_login_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Log usage
    await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: user.id,
        prompt_type: 'analyze',
        tokens_used: data.usage?.total_tokens || 0,
        model: data.model
      });

    // Return response with usage info
    return res.status(200).json({
      choices: [{
        message: {
          content: data.choices[0].message.content
        }
      }],
      model: data.model,
      usage: data.usage,
      userUsage: {
        used: userProfile.ai_queries_this_month + 1,
        limit,
        tier: userProfile.tier,
        percentage: ((userProfile.ai_queries_this_month + 1) / limit) * 100
      }
    });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    return res.status(500).json({
      error: 'Failed to analyze data',
      message: error.message
    });
  }
};
