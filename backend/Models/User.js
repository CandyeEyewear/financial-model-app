/**
 * ================================================================================
 * ⚠️  DEPRECATED - DO NOT USE IN PRODUCTION
 * ================================================================================
 * 
 * This Mongoose model was used with the old MongoDB/Auth0 authentication.
 * It has been replaced by a Supabase PostgreSQL table.
 * 
 * The new user data structure is in Supabase:
 * - Table: users
 * - Schema: See /supabase/schema.sql
 * 
 * Key changes:
 * - auth0Id field → id (UUID from Supabase Auth)
 * - Mongoose schema → PostgreSQL columns
 * - Methods → Supabase RPC functions
 * 
 * This file is kept for reference only. Delete it when no longer needed.
 * ================================================================================
 */

/*
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  auth0Id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  name: String,
  tier: {
    type: String,
    enum: ['free', 'professional', 'business', 'enterprise'],
    default: 'free'
  },
  usage: {
    aiQueriesThisMonth: { type: Number, default: 0 },
    reportsThisMonth: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: () => new Date() }
  },
  subscription: {
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing'],
      default: 'trialing'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodEnd: Date
  },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: Date
}, { timestamps: true });

userSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  const lastReset = this.usage.lastResetDate;
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.aiQueriesThisMonth = 0;
    this.usage.reportsThisMonth = 0;
    this.usage.lastResetDate = now;
    return true;
  }
  return false;
};

userSchema.methods.canMakeAIQuery = function() {
  const limits = { free: 10, professional: 100, business: 500, enterprise: Infinity };
  return this.usage.aiQueriesThisMonth < limits[this.tier];
};

userSchema.methods.incrementAIUsage = async function() {
  this.usage.aiQueriesThisMonth += 1;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
*/

// Export nothing - this file is deprecated
module.exports = {};
