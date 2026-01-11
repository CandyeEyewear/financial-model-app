-- Team Management System Migration
-- Adds support for Business and Enterprise users to manage teams

-- ==========================================
-- TEAMS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  -- Owner (user who created the team - must be business/enterprise tier)
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- Team settings
  max_members INTEGER DEFAULT 5, -- Business gets 5, Enterprise gets unlimited

  -- Branding (for business/enterprise)
  logo_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team owner can do anything with their team
CREATE POLICY "Team owners can manage their teams" ON public.teams
  FOR ALL USING (auth.uid() = owner_id);

-- Team members can view their team
CREATE POLICY "Team members can view team" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

-- Trigger for teams updated_at
DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- TEAM MEMBERS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,

  -- Invited email (for pending invites where user doesn't exist yet)
  invited_email TEXT,

  -- Member role within the team
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

  -- Invitation status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'removed')),

  -- Invitation tracking
  invited_by UUID REFERENCES public.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique membership per team (either by user_id or invited_email)
  UNIQUE(team_id, user_id),
  UNIQUE(team_id, invited_email)
);

-- Create indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team owners and admins can manage members
CREATE POLICY "Team owners/admins can manage members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.team_members AS tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
      AND tm.status = 'active'
    )
  );

-- Users can view their own membership
CREATE POLICY "Users can view own membership" ON public.team_members
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own membership (accept/decline invite)
CREATE POLICY "Users can update own membership" ON public.team_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for team_members updated_at
DROP TRIGGER IF EXISTS team_members_updated_at ON public.team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- UPDATE SAVED_MODELS FOR TEAM SHARING
-- ==========================================

-- Add team_id to saved_models for team-shared models
ALTER TABLE public.saved_models
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add sharing permission level
ALTER TABLE public.saved_models
ADD COLUMN IF NOT EXISTS share_level TEXT DEFAULT 'private'
CHECK (share_level IN ('private', 'team_view', 'team_edit'));

-- Create index for team models
CREATE INDEX IF NOT EXISTS idx_saved_models_team ON public.saved_models(team_id);

-- Update RLS policy for team model access
DROP POLICY IF EXISTS "Users can view own models" ON public.saved_models;
CREATE POLICY "Users can view own or team models" ON public.saved_models
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      team_id IS NOT NULL
      AND share_level IN ('team_view', 'team_edit')
      AND EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = saved_models.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own models" ON public.saved_models;
CREATE POLICY "Users can update own or team-editable models" ON public.saved_models
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (
      team_id IS NOT NULL
      AND share_level = 'team_edit'
      AND EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = saved_models.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
        AND team_members.role IN ('owner', 'admin', 'member')
      )
    )
  );

-- ==========================================
-- UPDATE USERS TABLE FOR TEAM REFERENCE
-- ==========================================

-- Add current_team_id to track which team user is currently working in
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS current_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to check if user can manage team
CREATE OR REPLACE FUNCTION public.can_manage_team(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams WHERE id = p_team_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team member count
CREATE OR REPLACE FUNCTION public.get_team_member_count(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM public.team_members
  WHERE team_id = p_team_id AND status = 'active';
  RETURN member_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if team can add more members
CREATE OR REPLACE FUNCTION public.can_add_team_member(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  team_record RECORD;
  member_count INTEGER;
  owner_tier TEXT;
BEGIN
  -- Get team info
  SELECT * INTO team_record FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get owner's tier
  SELECT tier INTO owner_tier FROM public.users WHERE id = team_record.owner_id;

  -- Enterprise has unlimited members
  IF owner_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Business tier has max_members limit (default 5)
  member_count := public.get_team_member_count(p_team_id);
  RETURN member_count < team_record.max_members;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create team (validates user tier)
CREATE OR REPLACE FUNCTION public.create_team(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  user_tier TEXT;
  new_team_id UUID;
  existing_team_count INTEGER;
BEGIN
  -- Get user's tier
  SELECT tier INTO user_tier FROM public.users WHERE id = auth.uid();

  -- Only business and enterprise can create teams
  IF user_tier NOT IN ('business', 'enterprise') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Team management requires Business or Enterprise subscription'
    );
  END IF;

  -- Check if user already has a team (business can have 1, enterprise can have multiple)
  SELECT COUNT(*) INTO existing_team_count
  FROM public.teams WHERE owner_id = auth.uid();

  IF user_tier = 'business' AND existing_team_count >= 1 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Business plan allows only one team. Upgrade to Enterprise for multiple teams.'
    );
  END IF;

  -- Create team
  INSERT INTO public.teams (name, description, owner_id, max_members)
  VALUES (
    p_name,
    p_description,
    auth.uid(),
    CASE WHEN user_tier = 'enterprise' THEN 999999 ELSE 5 END
  )
  RETURNING id INTO new_team_id;

  -- Add owner as team member with owner role
  INSERT INTO public.team_members (team_id, user_id, role, status, joined_at)
  VALUES (new_team_id, auth.uid(), 'owner', 'active', NOW());

  -- Set as user's current team
  UPDATE public.users SET current_team_id = new_team_id WHERE id = auth.uid();

  RETURN json_build_object(
    'success', true,
    'team_id', new_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invite team member
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_team_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'member'
)
RETURNS JSON AS $$
DECLARE
  existing_user_id UUID;
  can_add BOOLEAN;
BEGIN
  -- Check if caller can manage team
  IF NOT public.can_manage_team(p_team_id, auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to manage this team');
  END IF;

  -- Check if team can add more members
  can_add := public.can_add_team_member(p_team_id);
  IF NOT can_add THEN
    RETURN json_build_object('success', false, 'error', 'Team member limit reached. Upgrade your plan for more members.');
  END IF;

  -- Check if user exists
  SELECT id INTO existing_user_id FROM public.users WHERE email = p_email;

  IF existing_user_id IS NOT NULL THEN
    -- Check if already a member
    IF EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = p_team_id AND user_id = existing_user_id AND status IN ('active', 'pending')
    ) THEN
      RETURN json_build_object('success', false, 'error', 'User is already a team member or has pending invite');
    END IF;

    -- Add existing user
    INSERT INTO public.team_members (team_id, user_id, role, status, invited_by, invited_at)
    VALUES (p_team_id, existing_user_id, p_role, 'pending', auth.uid(), NOW());
  ELSE
    -- Check if email already invited
    IF EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = p_team_id AND invited_email = p_email AND status = 'pending'
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Invite already sent to this email');
    END IF;

    -- Invite by email (user doesn't exist yet)
    INSERT INTO public.team_members (team_id, invited_email, role, status, invited_by, invited_at)
    VALUES (p_team_id, p_email, p_role, 'pending', auth.uid(), NOW());
  END IF;

  RETURN json_build_object('success', true, 'message', 'Invitation sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept team invite
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_team_id UUID)
RETURNS JSON AS $$
DECLARE
  member_record RECORD;
BEGIN
  -- Find the invite
  SELECT * INTO member_record
  FROM public.team_members
  WHERE team_id = p_team_id
  AND (user_id = auth.uid() OR invited_email = (SELECT email FROM public.users WHERE id = auth.uid()))
  AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No pending invite found');
  END IF;

  -- Update membership
  UPDATE public.team_members
  SET status = 'active', user_id = auth.uid(), joined_at = NOW(), invited_email = NULL
  WHERE id = member_record.id;

  RETURN json_build_object('success', true, 'message', 'Successfully joined team');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decline team invite
CREATE OR REPLACE FUNCTION public.decline_team_invite(p_team_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE public.team_members
  SET status = 'declined'
  WHERE team_id = p_team_id
  AND (user_id = auth.uid() OR invited_email = (SELECT email FROM public.users WHERE id = auth.uid()))
  AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No pending invite found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Invite declined');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove team member
CREATE OR REPLACE FUNCTION public.remove_team_member(p_team_id UUID, p_user_id UUID)
RETURNS JSON AS $$
BEGIN
  -- Check if caller can manage team
  IF NOT public.can_manage_team(p_team_id, auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to manage this team');
  END IF;

  -- Cannot remove the owner
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND owner_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot remove team owner');
  END IF;

  -- Remove member
  UPDATE public.team_members
  SET status = 'removed'
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- Clear user's current_team_id if this was their current team
  UPDATE public.users
  SET current_team_id = NULL
  WHERE id = p_user_id AND current_team_id = p_team_id;

  RETURN json_build_object('success', true, 'message', 'Member removed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave team (for members)
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id UUID)
RETURNS JSON AS $$
BEGIN
  -- Cannot leave if owner
  IF EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND owner_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Team owner cannot leave. Transfer ownership or delete the team.');
  END IF;

  -- Update membership status
  UPDATE public.team_members
  SET status = 'removed'
  WHERE team_id = p_team_id AND user_id = auth.uid();

  -- Clear current_team_id
  UPDATE public.users
  SET current_team_id = NULL
  WHERE id = auth.uid() AND current_team_id = p_team_id;

  RETURN json_build_object('success', true, 'message', 'Left team successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.teams TO anon, authenticated;
GRANT ALL ON public.team_members TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_count TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_team_member TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_team_invite TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team TO authenticated;
