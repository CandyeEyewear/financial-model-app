// Vercel Serverless Function: AI Analysis Endpoint
// Route: /api/ai/analyze
// Version: 2.0 - Production-grade with comprehensive error handling

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors.js';

// Validate required environment variables at startup
const REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEEPSEEK_API_KEY'];
const missingVars = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

// Initialize Supabase client (only if env vars exist)
let supabase = null;
if (!missingVars.includes('SUPABASE_URL') && !missingVars.includes('SUPABASE_SERVICE_ROLE_KEY')) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Plan limits
const PLAN_LIMITS = {
  free: 10,
  professional: 100,
  business: 500,
  enterprise: 999999
};

// Error codes for debugging
const ERROR_CODES = {
  MISSING_ENV: 'E001',
  INVALID_METHOD: 'E002',
  MISSING_AUTH: 'E003',
  INVALID_TOKEN: 'E004',
  PROFILE_ERROR: 'E005',
  RATE_LIMITED: 'E006',
  MISSING_PROMPT: 'E007',
  AI_API_ERROR: 'E008',
  AI_RESPONSE_PARSE: 'E009',
  USAGE_LOG_ERROR: 'E010',
  UNKNOWN: 'E999'
};

// Helper: Safe JSON parse
const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

// Helper: Check if date is valid
const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};

// Helper: Safely get nested property
const safeGet = (obj, path, defaultValue = null) => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
};

// Helper: Log error with context
const logError = (context, error, extra = {}) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    context,
    error: error?.message || String(error),
    stack: error?.stack,
    ...extra
  }));
};

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle CORS preflight
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: ERROR_CODES.INVALID_METHOD,
      requestId 
    });
  }

  try {
    // Step 1: Validate Environment
    if (missingVars.length > 0) {
      logError('ENV_CHECK', new Error('Missing environment variables'), { missingVars });
      return res.status(500).json({
        error: 'Server configuration error',
        code: ERROR_CODES.MISSING_ENV,
        message: 'The server is not properly configured. Please contact support.',
        requestId
      });
    }

    if (!supabase) {
      logError('SUPABASE_INIT', new Error('Supabase client not initialized'));
      return res.status(500).json({
        error: 'Database connection error',
        code: ERROR_CODES.MISSING_ENV,
        requestId
      });
    }

    // Step 2: Validate Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header',
        code: ERROR_CODES.MISSING_AUTH,
        requestId
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ 
        error: 'Invalid token format',
        code: ERROR_CODES.MISSING_AUTH,
        requestId
      });
    }

    // Step 3: Verify JWT Token
    let user;
    try {
      const { data, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        logError('AUTH_VERIFY', authError, { tokenPrefix: token.substring(0, 20) });
        return res.status(401).json({ 
          error: 'Invalid or expired token',
          code: ERROR_CODES.INVALID_TOKEN,
          details: authError.message,
          requestId
        });
      }
      
      if (!data?.user) {
        return res.status(401).json({ 
          error: 'User not found in token',
          code: ERROR_CODES.INVALID_TOKEN,
          requestId
        });
      }
      
      user = data.user;
    } catch (authErr) {
      logError('AUTH_EXCEPTION', authErr);
      return res.status(401).json({ 
        error: 'Authentication failed',
        code: ERROR_CODES.INVALID_TOKEN,
        requestId
      });
    }

    // Step 4: Get User Profile (with auto-create)
    let userProfile;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, tier, ai_queries_this_month, reports_this_month, last_reset_date, last_login_at')
        .eq('id', user.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // User doesn't exist - create them
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              tier: 'free',
              ai_queries_this_month: 0,
              reports_this_month: 0,
              last_reset_date: new Date().toISOString(),
              last_login_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError) {
            logError('PROFILE_CREATE', createError, { userId: user.id });
            return res.status(500).json({ 
              error: 'Failed to create user profile',
              code: ERROR_CODES.PROFILE_ERROR,
              requestId
            });
          }
          
          userProfile = newProfile;
        } else {
          logError('PROFILE_FETCH', profileError, { userId: user.id });
          return res.status(500).json({ 
            error: 'Failed to fetch user profile',
            code: ERROR_CODES.PROFILE_ERROR,
            requestId
          });
        }
      } else {
        userProfile = profile;
      }
    } catch (profileErr) {
      logError('PROFILE_EXCEPTION', profileErr, { userId: user.id });
      return res.status(500).json({ 
        error: 'Database error',
        code: ERROR_CODES.PROFILE_ERROR,
        requestId
      });
    }

    // Step 5: Check & Reset Monthly Usage (null-safe)
    const now = new Date();
    const lastResetDate = userProfile.last_reset_date ? new Date(userProfile.last_reset_date) : null;
    
    const shouldReset = !lastResetDate || 
                       !isValidDate(lastResetDate) ||
                       now.getMonth() !== lastResetDate.getMonth() || 
                       now.getFullYear() !== lastResetDate.getFullYear();

    if (shouldReset) {
      try {
        await supabase
          .from('users')
          .update({
            ai_queries_this_month: 0,
            reports_this_month: 0,
            last_reset_date: now.toISOString()
          })
          .eq('id', user.id);
        
        userProfile.ai_queries_this_month = 0;
      } catch (resetErr) {
        logError('USAGE_RESET', resetErr, { userId: user.id });
      }
    }

    // Step 6: Check Usage Limits
    const tier = userProfile.tier || 'free';
    const limit = PLAN_LIMITS[tier] || PLAN_LIMITS.free;
    const currentUsage = userProfile.ai_queries_this_month || 0;

    if (currentUsage >= limit) {
      return res.status(429).json({
        error: 'Monthly AI query limit reached',
        code: ERROR_CODES.RATE_LIMITED,
        limit,
        used: currentUsage,
        tier,
        message: `You've used ${currentUsage} of ${limit} AI queries this month. Upgrade to continue.`,
        upgradeUrl: '/pricing',
        requestId
      });
    }

    // Step 7: Validate Request Body
    const { prompt, systemMessage, messages, extractionMode, tools } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Prompt is required and must be a non-empty string',
        code: ERROR_CODES.MISSING_PROMPT,
        requestId
      });
    }

    // Step 8: Build DeepSeek Request
    const temperature = extractionMode ? 0.2 : 0.8;
    const maxTokens = extractionMode ? 3000 : 1500;

    const deepseekMessages = [];

    if (systemMessage && typeof systemMessage === 'string') {
      deepseekMessages.push({ role: 'system', content: systemMessage });
    }

    if (messages && Array.isArray(messages)) {
      const validMessages = messages.filter(m =>
        m && typeof m.role === 'string' && typeof m.content === 'string'
      );
      deepseekMessages.push(...validMessages);
    }

    deepseekMessages.push({ role: 'user', content: prompt.trim() });

    // Step 9: Call DeepSeek API
    let aiResponse;
    let aiData;

    try {
      const requestBody = {
        model: 'deepseek-chat',
        messages: deepseekMessages,
        temperature,
        max_tokens: maxTokens
      };

      // Add tools if provided (for function calling)
      if (tools && Array.isArray(tools) && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      aiResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        logError('DEEPSEEK_API', new Error(`HTTP ${aiResponse.status}`), { 
          status: aiResponse.status,
          response: errorText.substring(0, 500)
        });
        
        const errorJson = safeJsonParse(errorText, {});
        
        return res.status(502).json({
          error: 'AI service error',
          code: ERROR_CODES.AI_API_ERROR,
          details: errorJson.error?.message || `DeepSeek returned status ${aiResponse.status}`,
          requestId
        });
      }

      aiData = await aiResponse.json();
      
    } catch (fetchErr) {
      logError('DEEPSEEK_FETCH', fetchErr);
      return res.status(502).json({
        error: 'Failed to connect to AI service',
        code: ERROR_CODES.AI_API_ERROR,
        details: fetchErr.message,
        requestId
      });
    }

    // Step 10: Parse AI Response (null-safe)
    const aiMessage = safeGet(aiData, 'choices.0.message', {});
    const aiContent = aiMessage.content;
    const aiToolCalls = aiMessage.tool_calls;

    // Content is optional if tool calls are present
    if (!aiContent && (!aiToolCalls || aiToolCalls.length === 0)) {
      logError('DEEPSEEK_RESPONSE', new Error('Empty or malformed response'), {
        hasChoices: !!aiData?.choices,
        choicesLength: aiData?.choices?.length,
        hasToolCalls: !!aiToolCalls
      });

      return res.status(502).json({
        error: 'AI service returned an invalid response',
        code: ERROR_CODES.AI_RESPONSE_PARSE,
        requestId
      });
    }

    // Step 11: Update Usage (non-blocking)
    supabase
      .from('users')
      .update({
        ai_queries_this_month: currentUsage + 1,
        last_login_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .then(() => {})
      .catch(err => logError('USAGE_UPDATE', err, { userId: user.id }));

    supabase
      .from('ai_usage_logs')
      .insert({
        user_id: user.id,
        prompt_type: 'analyze',
        tokens_used: aiData.usage?.total_tokens || 0,
        model: aiData.model || 'deepseek-chat'
      })
      .then(() => {})
      .catch(err => logError('USAGE_LOG', err, { userId: user.id }));

    // Step 12: Return Success
    const responseMessage = { content: aiContent };

    // Include tool_calls if present
    if (aiToolCalls && aiToolCalls.length > 0) {
      responseMessage.tool_calls = aiToolCalls;
    }

    return res.status(200).json({
      choices: [{ message: responseMessage }],
      model: aiData.model || 'deepseek-chat',
      usage: aiData.usage || {},
      userUsage: {
        used: currentUsage + 1,
        limit,
        tier,
        percentage: Math.round(((currentUsage + 1) / limit) * 100)
      },
      requestId
    });

  } catch (error) {
    logError('UNHANDLED', error, {
      method: req.method,
      path: req.url
    });
    
    return res.status(500).json({
      error: 'An unexpected error occurred',
      code: ERROR_CODES.UNKNOWN,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later',
      requestId
    });
  }
}
