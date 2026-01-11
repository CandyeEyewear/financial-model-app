-- Supabase Database Schema for FinSight
-- Run this in your Supabase SQL Editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  
  -- Subscription tier
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'professional', 'business', 'enterprise')),
  
  -- Usage tracking
  ai_queries_this_month INTEGER DEFAULT 0,
  reports_this_month INTEGER DEFAULT 0,
  last_reset_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Subscription details (for payment integration)
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'pending_payment')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  ezee_subscription_id TEXT,
  ezee_transaction_number TEXT,
  current_period_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON public.users(tier);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
-- Users can read their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own data (for initial profile creation)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create function to increment AI usage
CREATE OR REPLACE FUNCTION public.increment_ai_usage(user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  user_record RECORD;
  limit_val INTEGER;
BEGIN
  -- Get user and check/reset usage
  SELECT * INTO user_record FROM public.users WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get plan limit
  CASE user_record.tier
    WHEN 'free' THEN limit_val := 10;
    WHEN 'professional' THEN limit_val := 100;
    WHEN 'business' THEN limit_val := 500;
    WHEN 'enterprise' THEN limit_val := 999999;
    ELSE limit_val := 10;
  END CASE;
  
  -- Check if we need to reset (new month)
  IF DATE_TRUNC('month', user_record.last_reset_date) < DATE_TRUNC('month', NOW()) THEN
    UPDATE public.users 
    SET ai_queries_this_month = 1, 
        reports_this_month = 0,
        last_reset_date = NOW()
    WHERE id = user_id;
    
    RETURN json_build_object(
      'success', true, 
      'used', 1, 
      'limit', limit_val,
      'reset', true
    );
  END IF;
  
  -- Check if user is within limit
  IF user_record.ai_queries_this_month >= limit_val THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Monthly limit reached',
      'used', user_record.ai_queries_this_month,
      'limit', limit_val
    );
  END IF;
  
  -- Increment usage
  UPDATE public.users 
  SET ai_queries_this_month = ai_queries_this_month + 1
  WHERE id = user_id
  RETURNING ai_queries_this_month INTO user_record.ai_queries_this_month;
  
  RETURN json_build_object(
    'success', true, 
    'used', user_record.ai_queries_this_month, 
    'limit', limit_val
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check and reset monthly usage
CREATE OR REPLACE FUNCTION public.check_and_reset_usage(user_id UUID)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT * INTO user_record FROM public.users WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if we need to reset (new month)
  IF DATE_TRUNC('month', user_record.last_reset_date) < DATE_TRUNC('month', NOW()) THEN
    UPDATE public.users 
    SET ai_queries_this_month = 0, 
        reports_this_month = 0,
        last_reset_date = NOW()
    WHERE id = user_id;
    
    RETURN json_build_object('success', true, 'reset', true);
  END IF;
  
  RETURN json_build_object('success', true, 'reset', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create saved_models table for storing user's financial models
CREATE TABLE IF NOT EXISTS public.saved_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  model_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for saved models
CREATE INDEX IF NOT EXISTS idx_saved_models_user ON public.saved_models(user_id);

-- Enable RLS on saved_models
ALTER TABLE public.saved_models ENABLE ROW LEVEL SECURITY;

-- Policies for saved_models
CREATE POLICY "Users can view own models" ON public.saved_models
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own models" ON public.saved_models
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own models" ON public.saved_models
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own models" ON public.saved_models
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for saved_models updated_at
DROP TRIGGER IF EXISTS saved_models_updated_at ON public.saved_models;
CREATE TRIGGER saved_models_updated_at
  BEFORE UPDATE ON public.saved_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create ai_usage_logs table for tracking AI usage history
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  prompt_type TEXT,
  tokens_used INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for usage logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at);

-- Enable RLS on ai_usage_logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage logs
CREATE POLICY "Users can view own usage logs" ON public.ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert logs (from API)
CREATE POLICY "Service can insert usage logs" ON public.ai_usage_logs
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- AI CHAT HISTORY TABLE
-- ==========================================

-- Create ai_chat_messages table for persistent chat history
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_results JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_deal ON public.ai_chat_messages(user_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.ai_chat_messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own messages
CREATE POLICY "Users can view own messages" ON public.ai_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own messages
CREATE POLICY "Users can insert own messages" ON public.ai_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.ai_chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Function to enforce 50 message limit per deal
CREATE OR REPLACE FUNCTION public.enforce_chat_message_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete oldest messages if count exceeds 50 for this user/deal
  DELETE FROM public.ai_chat_messages
  WHERE id IN (
    SELECT id FROM public.ai_chat_messages
    WHERE user_id = NEW.user_id AND deal_id = NEW.deal_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run after each insert
DROP TRIGGER IF EXISTS limit_chat_messages ON public.ai_chat_messages;
CREATE TRIGGER limit_chat_messages
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_chat_message_limit();

-- ==========================================
-- eZEEPAYMENTS SUBSCRIPTION AND PAYMENT TABLES
-- ==========================================

-- Create subscriptions table for eZeePayments recurring billing
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('professional', 'business', 'enterprise')),

  -- eZeePayments specific fields
  ezee_subscription_id TEXT UNIQUE NOT NULL,
  ezee_transaction_number TEXT,

  -- Subscription details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'JMD')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'active', 'canceled', 'ended', 'past_due')),

  -- Dates
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,

  -- Metadata
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_ezee_id ON public.subscriptions(ezee_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can update any subscription (for webhooks)
CREATE POLICY "Service can update subscriptions" ON public.subscriptions
  FOR UPDATE USING (true);

-- Trigger for subscriptions updated_at
DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create payments table for tracking individual payment transactions
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  -- Order and transaction details
  order_id TEXT UNIQUE NOT NULL,
  transaction_number TEXT,

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'JMD')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),

  -- eZeePayments response
  response_code TEXT,
  response_description TEXT,

  -- Dates
  processed_at TIMESTAMPTZ,

  -- Metadata
  customer_email TEXT,
  customer_name TEXT,
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON public.payments(transaction_number);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments(subscription_id);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for payments
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can update any payment (for webhooks)
CREATE POLICY "Service can update payments" ON public.payments
  FOR UPDATE USING (true);

CREATE POLICY "Service can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

-- Trigger for payments updated_at
DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to upgrade user tier after successful payment
CREATE OR REPLACE FUNCTION public.upgrade_user_tier_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only upgrade if payment is successful
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get subscription details
    DECLARE
      sub_tier TEXT;
    BEGIN
      SELECT tier_id INTO sub_tier
      FROM public.subscriptions
      WHERE id = NEW.subscription_id;

      -- Update user tier and subscription status
      IF sub_tier IS NOT NULL THEN
        UPDATE public.users
        SET
          tier = sub_tier,
          subscription_status = 'active',
          ezee_subscription_id = (SELECT ezee_subscription_id FROM public.subscriptions WHERE id = NEW.subscription_id),
          ezee_transaction_number = NEW.transaction_number,
          current_period_end = NOW() + INTERVAL '1 month'
        WHERE id = NEW.user_id;

        -- Update subscription status
        UPDATE public.subscriptions
        SET
          status = 'active',
          start_date = COALESCE(start_date, NOW()),
          last_payment_at = NOW(),
          ezee_transaction_number = NEW.transaction_number
        WHERE id = NEW.subscription_id;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to upgrade user tier after payment
DROP TRIGGER IF EXISTS upgrade_tier_on_payment ON public.payments;
CREATE TRIGGER upgrade_tier_on_payment
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.upgrade_user_tier_on_payment();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
