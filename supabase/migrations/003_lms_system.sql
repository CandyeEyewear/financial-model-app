-- Learning Management System (LMS) Migration
-- Adds support for courses, enrollments, competencies, and learning tracking

-- ==========================================
-- COURSES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration_minutes INTEGER DEFAULT 0,

  -- Course metadata
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  category TEXT,
  tags TEXT[], -- Array of tags

  -- Content
  content JSONB, -- Course modules and lessons

  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,

  -- Team/Organization
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_team ON public.courses(team_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON public.courses(created_by);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Team members can view published courses
CREATE POLICY "Team members can view published courses" ON public.courses
  FOR SELECT USING (
    status = 'published' AND (
      team_id IS NULL OR -- Public courses
      EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = courses.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
      )
    )
  );

-- Course creators can manage their courses
CREATE POLICY "Course creators can manage courses" ON public.courses
  FOR ALL USING (created_by = auth.uid());

-- ==========================================
-- ENROLLMENTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- Enrollment details
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'dropped')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Dates
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,

  -- Assignment metadata
  assigned_by UUID REFERENCES public.users(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique enrollment per user per course
  UNIQUE(course_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_profile ON public.enrollments(profile_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments" ON public.enrollments
  FOR SELECT USING (profile_id = auth.uid());

-- Team admins can view and manage team member enrollments
CREATE POLICY "Team admins can manage enrollments" ON public.enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = enrollments.profile_id
      AND tm1.status = 'active'
      AND tm1.role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- COMPETENCY FRAMEWORK
-- ==========================================

CREATE TABLE IF NOT EXISTS public.competencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  framework_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001', -- Default framework
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Icon name for UI (e.g., 'message-circle', 'lightbulb')
  category TEXT, -- Group competencies by category

  -- Leveling
  max_level INTEGER DEFAULT 5, -- 0-5 levels
  level_descriptions JSONB, -- Description for each level

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Team/Organization
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competencies_framework ON public.competencies(framework_id);
CREATE INDEX IF NOT EXISTS idx_competencies_team ON public.competencies(team_id);
CREATE INDEX IF NOT EXISTS idx_competencies_category ON public.competencies(category);

-- Enable RLS
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

-- Everyone can view competencies
CREATE POLICY "All users can view competencies" ON public.competencies
  FOR SELECT USING (true);

-- Team owners can manage team competencies
CREATE POLICY "Team owners can manage competencies" ON public.competencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = competencies.team_id
      AND teams.owner_id = auth.uid()
    )
  );

-- ==========================================
-- LEARNER COMPETENCIES (Progress tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.learner_competencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  competency_id UUID REFERENCES public.competencies(id) ON DELETE CASCADE NOT NULL,

  -- Current level
  current_level INTEGER DEFAULT 0 CHECK (current_level >= 0 AND current_level <= 5),
  progress_to_next INTEGER DEFAULT 0 CHECK (progress_to_next >= 0 AND progress_to_next <= 100),

  -- Assessment data
  self_assessed_level INTEGER CHECK (self_assessed_level >= 0 AND self_assessed_level <= 5),
  manager_assessed_level INTEGER CHECK (manager_assessed_level >= 0 AND manager_assessed_level <= 5),
  last_assessment_at TIMESTAMPTZ,

  -- Progress tracking
  courses_completed INTEGER DEFAULT 0,
  assessments_passed INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique competency per user
  UNIQUE(profile_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_competencies_profile ON public.learner_competencies(profile_id);
CREATE INDEX IF NOT EXISTS idx_learner_competencies_competency ON public.learner_competencies(competency_id);

-- Enable RLS
ALTER TABLE public.learner_competencies ENABLE ROW LEVEL SECURITY;

-- Users can view their own competencies
CREATE POLICY "Users can view own competencies" ON public.learner_competencies
  FOR SELECT USING (profile_id = auth.uid());

-- Team admins can view team member competencies
CREATE POLICY "Team admins can view member competencies" ON public.learner_competencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = learner_competencies.profile_id
      AND tm1.status = 'active'
      AND tm1.role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- QUIZZES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Quiz configuration
  questions JSONB NOT NULL, -- Array of question objects
  passing_score INTEGER DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  time_limit_minutes INTEGER, -- NULL = no time limit
  max_attempts INTEGER, -- NULL = unlimited

  -- Ordering
  module_number INTEGER,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes(course_id);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Users can view quizzes for courses they're enrolled in
CREATE POLICY "Enrolled users can view quizzes" ON public.quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.course_id = quizzes.course_id
      AND enrollments.profile_id = auth.uid()
    )
  );

-- ==========================================
-- QUIZ ATTEMPTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- Attempt data
  answers JSONB, -- User's answers
  score INTEGER CHECK (score >= 0 AND score <= 100),
  passed BOOLEAN DEFAULT false,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INTEGER,

  -- Attempt number
  attempt_number INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_profile ON public.quiz_attempts(profile_id);

-- Enable RLS
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own attempts
CREATE POLICY "Users can view own attempts" ON public.quiz_attempts
  FOR SELECT USING (profile_id = auth.uid());

-- Users can insert their own attempts
CREATE POLICY "Users can create own attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Team admins can view team member attempts
CREATE POLICY "Team admins can view member attempts" ON public.quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = quiz_attempts.profile_id
      AND tm1.status = 'active'
      AND tm1.role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- GROUPS TABLE (Learning cohorts/groups)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Group metadata
  group_type TEXT DEFAULT 'cohort' CHECK (group_type IN ('cohort', 'department', 'location', 'custom')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_team ON public.groups(team_id);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Team members can view groups
CREATE POLICY "Team members can view groups" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = groups.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
    )
  );

-- ==========================================
-- USER GROUPS TABLE (Group membership)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- Membership
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique membership
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_group ON public.user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_user ON public.user_groups(user_id);

-- Enable RLS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- Users can view their own group memberships
CREATE POLICY "Users can view own group memberships" ON public.user_groups
  FOR SELECT USING (user_id = auth.uid());

-- Team admins can view and manage group memberships
CREATE POLICY "Team admins can manage group memberships" ON public.user_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.groups
      JOIN public.team_members ON team_members.team_id = groups.team_id
      WHERE groups.id = user_groups.group_id
      AND team_members.user_id = auth.uid()
      AND team_members.status = 'active'
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- ACTIVITY LOGS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,

  -- Activity data
  activity_type TEXT NOT NULL, -- 'enrollment', 'completion', 'assessment', 'competency_update', etc.
  description TEXT NOT NULL,
  metadata JSONB, -- Additional data about the activity

  -- References (optional)
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_profile ON public.activity_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON public.activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity
CREATE POLICY "Users can view own activity" ON public.activity_logs
  FOR SELECT USING (profile_id = auth.uid());

-- Team admins can view team member activity
CREATE POLICY "Team admins can view member activity" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = activity_logs.profile_id
      AND tm1.status = 'active'
      AND tm1.role IN ('owner', 'admin')
    )
  );

-- ==========================================
-- UPDATE TRIGGERS
-- ==========================================

-- Courses updated_at trigger
DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enrollments updated_at trigger
DROP TRIGGER IF EXISTS enrollments_updated_at ON public.enrollments;
CREATE TRIGGER enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Competencies updated_at trigger
DROP TRIGGER IF EXISTS competencies_updated_at ON public.competencies;
CREATE TRIGGER competencies_updated_at
  BEFORE UPDATE ON public.competencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Learner competencies updated_at trigger
DROP TRIGGER IF EXISTS learner_competencies_updated_at ON public.learner_competencies;
CREATE TRIGGER learner_competencies_updated_at
  BEFORE UPDATE ON public.learner_competencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Quizzes updated_at trigger
DROP TRIGGER IF EXISTS quizzes_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Groups updated_at trigger
DROP TRIGGER IF EXISTS groups_updated_at ON public.groups;
CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- SEED DATA: Default Competency Framework
-- ==========================================

-- Insert default competencies
INSERT INTO public.competencies (id, framework_id, name, description, icon, category, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Communication', 'Ability to effectively convey information and ideas', 'message-circle', 'Behavioral', 1),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Customer Focus', 'Understanding and meeting customer needs', 'users', 'Behavioral', 2),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Problem Solving', 'Identifying issues and finding effective solutions', 'lightbulb', 'Technical', 3),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Leadership', 'Guiding and inspiring others towards goals', 'crown', 'Leadership', 4),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Teamwork', 'Collaborating effectively with others', 'users-round', 'Behavioral', 5),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Adaptability', 'Adjusting to change and new situations', 'refresh-cw', 'Behavioral', 6),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Time Management', 'Organizing and prioritizing work effectively', 'clock', 'Technical', 7),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Decision Making', 'Making informed and timely decisions', 'git-branch', 'Leadership', 8),
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Integrity', 'Acting ethically and with honesty', 'shield-check', 'Behavioral', 9),
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Continuous Learning', 'Commitment to ongoing development', 'graduation-cap', 'Technical', 10)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE 'LMS System migration completed successfully!';
  RAISE NOTICE 'Created tables: courses, enrollments, competencies, learner_competencies, quizzes, quiz_attempts, groups, user_groups, activity_logs';
  RAISE NOTICE 'Seeded 10 default competencies in the framework';
END $$;
