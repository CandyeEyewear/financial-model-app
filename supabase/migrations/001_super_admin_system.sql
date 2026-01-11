-- ============================================
-- FINSIGHT SUPER ADMIN SYSTEM
-- Migration: 001_super_admin_system.sql
-- ============================================

-- ============================================
-- SUPER ADMIN SYSTEM TABLES
-- ============================================

-- 1. Admin Users Table
-- Tracks which users have admin privileges
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support', 'billing')),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- 2. Subscription Packages Table
-- Defines available subscription tiers
CREATE TABLE IF NOT EXISTS subscription_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'JMD',
  query_limit INTEGER DEFAULT 10,
  reports_limit INTEGER DEFAULT 5,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default packages
INSERT INTO subscription_packages (tier_id, name, description, price_monthly, price_yearly, query_limit, reports_limit, features, display_order) VALUES
  ('free', 'Free', 'Basic access for individual users', 0, 0, 10, 2, '{"ai_chat": true, "basic_models": true, "export_pdf": false}', 1),
  ('professional', 'Professional', 'For active financial analysts', 2900, 29000, 100, 20, '{"ai_chat": true, "basic_models": true, "advanced_models": true, "export_pdf": true, "priority_support": false}', 2),
  ('business', 'Business', 'For teams and growing firms', 7900, 79000, 500, 100, '{"ai_chat": true, "basic_models": true, "advanced_models": true, "export_pdf": true, "priority_support": true, "team_sharing": true}', 3),
  ('enterprise', 'Enterprise', 'Unlimited access for large organizations', 19900, 199000, -1, -1, '{"ai_chat": true, "basic_models": true, "advanced_models": true, "export_pdf": true, "priority_support": true, "team_sharing": true, "custom_branding": true, "api_access": true}', 4)
ON CONFLICT (tier_id) DO NOTHING;

-- 3. Admin Audit Logs Table
-- Tracks all admin actions for accountability
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. System Costs Table
-- Track operational costs for revenue calculations
CREATE TABLE IF NOT EXISTS system_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_type TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'JMD',
  period_start DATE NOT NULL,
  period_end DATE,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  category_id UUID,
  vendor TEXT,
  invoice_number TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Promo Codes Table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  applicable_tiers TEXT[] DEFAULT '{}',
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Cost Categories Table
CREATE TABLE IF NOT EXISTS cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'dollar-sign',
  color TEXT DEFAULT 'gray',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default cost categories
INSERT INTO cost_categories (name, description, icon, color, display_order) VALUES
  ('api', 'AI API costs (DeepSeek, OpenAI, etc.)', 'cpu', 'blue', 1),
  ('hosting', 'Server and hosting costs (Vercel, AWS, etc.)', 'server', 'purple', 2),
  ('database', 'Database costs (Supabase, etc.)', 'database', 'green', 3),
  ('marketing', 'Marketing and advertising', 'megaphone', 'orange', 4),
  ('support', 'Customer support costs', 'headphones', 'cyan', 5),
  ('contractor', 'Freelancer and contractor payments', 'users', 'pink', 6),
  ('software', 'Software subscriptions and licenses', 'package', 'indigo', 7),
  ('payment_fees', 'Payment processor fees (eZeePayments)', 'credit-card', 'red', 8),
  ('other', 'Other miscellaneous costs', 'more-horizontal', 'gray', 99)
ON CONFLICT (name) DO NOTHING;

-- Add foreign key to system_costs for category
ALTER TABLE system_costs
  ADD CONSTRAINT fk_system_costs_category
  FOREIGN KEY (category_id) REFERENCES cost_categories(id);

-- ============================================
-- ENHANCE EXISTING TABLES
-- ============================================

-- Add to users table if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add to ai_usage_logs if exists (for cost tracking)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_usage_logs') THEN
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS cost_estimate DECIMAL(10,4) DEFAULT 0;
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS model_used TEXT;
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_system_costs_period ON system_costs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_system_costs_category ON system_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_system_costs_recurring ON system_costs(is_recurring);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Admin Users: Only super_admins can manage
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view all admin users" ON admin_users;
CREATE POLICY "Super admins can view all admin users" ON admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
CREATE POLICY "Super admins can manage admin users" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Subscription Packages: Admins can view, super_admins can edit
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packages" ON subscription_packages;
CREATE POLICY "Anyone can view active packages" ON subscription_packages
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Super admins can manage packages" ON subscription_packages;
CREATE POLICY "Super admins can manage packages" ON subscription_packages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Audit Logs: Only admins can view
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

DROP POLICY IF EXISTS "Admins can create audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can create audit logs" ON admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

-- System Costs: Only super_admins
ALTER TABLE system_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage costs" ON system_costs;
CREATE POLICY "Super admins can manage costs" ON system_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Promo Codes: Admins can view, super_admins can manage
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view promo codes" ON promo_codes;
CREATE POLICY "Admins can view promo codes" ON promo_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.is_active = true
    )
  );

DROP POLICY IF EXISTS "Super admins can manage promo codes" ON promo_codes;
CREATE POLICY "Super admins can manage promo codes" ON promo_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Cost Categories: public read, super admin write
ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active categories" ON cost_categories;
CREATE POLICY "Anyone can view active categories" ON cost_categories
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Super admins can manage categories" ON cost_categories;
CREATE POLICY "Super admins can manage categories" ON cost_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective query limit (returns -1 for unlimited)
CREATE OR REPLACE FUNCTION get_user_query_limit(check_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  user_tier TEXT;
  tier_limit INTEGER;
BEGIN
  -- Super admins have unlimited
  IF is_super_admin(check_user_id) THEN
    RETURN -1;
  END IF;

  -- Get user's tier from users table
  SELECT tier INTO user_tier
  FROM users
  WHERE id = check_user_id;

  -- Default to free if no subscription
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get tier limit
  SELECT query_limit INTO tier_limit
  FROM subscription_packages
  WHERE tier_id = user_tier;

  RETURN COALESCE(tier_limit, 10);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total recurring costs for a month
CREATE OR REPLACE FUNCTION get_monthly_recurring_costs(target_month DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM system_costs
  WHERE is_recurring = true
    AND is_active = true
    AND period_start <= target_month
    AND (period_end IS NULL OR period_end >= target_month);

  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total costs for a date range
CREATE OR REPLACE FUNCTION get_total_costs(start_date DATE, end_date DATE)
RETURNS DECIMAL AS $$
DECLARE
  recurring_total DECIMAL;
  onetime_total DECIMAL;
  months_count INTEGER;
BEGIN
  -- Count months in range
  months_count := GREATEST(1, EXTRACT(MONTH FROM AGE(end_date, start_date)) + 1);

  -- Get recurring costs (multiply by months)
  SELECT COALESCE(SUM(amount), 0) * months_count INTO recurring_total
  FROM system_costs
  WHERE is_recurring = true
    AND is_active = true
    AND period_start <= end_date
    AND (period_end IS NULL OR period_end >= start_date);

  -- Get one-time costs in range
  SELECT COALESCE(SUM(amount), 0) INTO onetime_total
  FROM system_costs
  WHERE is_recurring = false
    AND is_active = true
    AND period_start >= start_date
    AND period_start <= end_date;

  RETURN recurring_total + onetime_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- Revenue Summary View
CREATE OR REPLACE VIEW admin_revenue_summary AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(DISTINCT user_id) AS paying_users,
  COUNT(*) AS total_transactions,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_transactions,
  'JMD' AS currency
FROM users
WHERE tier != 'free'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Subscription Distribution View
CREATE OR REPLACE VIEW admin_subscription_distribution AS
SELECT
  COALESCE(u.tier, 'free') AS tier,
  sp.name AS tier_name,
  sp.price_monthly,
  COUNT(DISTINCT u.id) AS user_count,
  COUNT(DISTINCT u.id) * sp.price_monthly AS potential_mrr
FROM users u
LEFT JOIN subscription_packages sp ON u.tier = sp.tier_id OR (u.tier IS NULL AND sp.tier_id = 'free')
GROUP BY u.tier, sp.name, sp.price_monthly, sp.display_order
ORDER BY sp.display_order;

-- Usage Summary View
CREATE OR REPLACE VIEW admin_usage_summary AS
SELECT
  DATE_TRUNC('day', updated_at) AS day,
  COUNT(*) AS active_users,
  SUM(ai_queries_this_month) AS total_queries
FROM users
WHERE ai_queries_this_month > 0
GROUP BY DATE_TRUNC('day', updated_at)
ORDER BY day DESC;

-- Cost Summary View
CREATE OR REPLACE VIEW admin_cost_summary AS
SELECT
  cc.name AS category,
  cc.icon,
  cc.color,
  COUNT(*) AS entry_count,
  SUM(CASE WHEN sc.is_recurring THEN sc.amount ELSE 0 END) AS recurring_total,
  SUM(CASE WHEN NOT sc.is_recurring THEN sc.amount ELSE 0 END) AS onetime_total,
  SUM(sc.amount) AS total
FROM system_costs sc
JOIN cost_categories cc ON sc.category_id = cc.id
WHERE sc.is_active = true
GROUP BY cc.name, cc.icon, cc.color, cc.display_order
ORDER BY cc.display_order;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE admin_users IS 'Tracks which users have admin privileges';
COMMENT ON TABLE subscription_packages IS 'Defines available subscription tiers and pricing';
COMMENT ON TABLE admin_audit_logs IS 'Tracks all admin actions for accountability';
COMMENT ON TABLE system_costs IS 'Track operational costs for revenue calculations';
COMMENT ON TABLE promo_codes IS 'Promotional codes for subscription discounts';
COMMENT ON TABLE cost_categories IS 'Predefined categories for organizing costs';

COMMENT ON FUNCTION is_admin IS 'Check if a user has any admin role';
COMMENT ON FUNCTION is_super_admin IS 'Check if a user has super admin role';
COMMENT ON FUNCTION get_user_query_limit IS 'Get the AI query limit for a user based on their tier';
COMMENT ON FUNCTION log_admin_action IS 'Log an admin action to the audit log';
COMMENT ON FUNCTION get_monthly_recurring_costs IS 'Calculate total recurring costs for a given month';
COMMENT ON FUNCTION get_total_costs IS 'Calculate total costs (recurring + one-time) for a date range';
