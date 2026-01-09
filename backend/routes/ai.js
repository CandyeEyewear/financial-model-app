/**
 * ================================================================================
 * ⚠️  DEPRECATED - DO NOT USE IN PRODUCTION
 * ================================================================================
 * 
 * This Express router file was used with the old Auth0/MongoDB authentication.
 * It has been replaced by Vercel Serverless Functions.
 * 
 * Replacement files:
 * - /api/ai/analyze.js - Handles POST /api/ai/analyze
 * - /api/ai/usage.js   - Handles GET /api/ai/usage
 * 
 * Key changes:
 * - Auth0 JWT → Supabase Auth
 * - MongoDB User model → Supabase PostgreSQL users table
 * - Express middleware → Vercel serverless handler
 * 
 * This file is kept for reference only. Delete it when no longer needed.
 * ================================================================================
 */

// Old code preserved for reference:

/*
const express = require('express');
const router = express.Router();
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const User = require('../models/User');

// Auth0 JWT verification middleware - NOW REPLACED BY SUPABASE AUTH
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256']
});

// Subscription limits
const PLAN_LIMITS = {
  free: 10,
  professional: 100,
  business: 500,
  enterprise: Infinity
};

// MongoDB usage tracking middleware - NOW REPLACED BY SUPABASE
const trackUsage = async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const userEmail = req.auth.email || req.auth.sub;
    
    let user = await User.findOne({ auth0Id: userId });
    
    if (!user) {
      user = new User({
        auth0Id: userId,
        email: userEmail,
        name: req.auth.name || userEmail,
        tier: 'free',
        lastLoginAt: new Date()
      });
      await user.save();
    } else {
      user.lastLoginAt = new Date();
    }
    
    user.resetMonthlyUsage();
    
    if (!user.canMakeAIQuery()) {
      const limit = PLAN_LIMITS[user.tier];
      return res.status(429).json({ 
        error: 'Monthly AI query limit reached',
        limit,
        used: user.usage.aiQueriesThisMonth,
        tier: user.tier,
        message: `You've used ${user.usage.aiQueriesThisMonth} of ${limit} AI queries this month. Upgrade to continue.`,
        upgradeUrl: '/pricing'
      });
    }
    
    await user.incrementAIUsage();
    req.user = user;
    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
};

router.post('/analyze', checkJwt, trackUsage, async (req, res) => {
  // ... implementation moved to /api/ai/analyze.js
});

router.get('/usage', checkJwt, async (req, res) => {
  // ... implementation moved to /api/ai/usage.js
});

router.get('/test', (req, res) => {
  res.json({ message: 'AI routes working' });
});

module.exports = router;
*/

// Export empty router - this file is deprecated
module.exports = {};
