import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify authenticated user and check admin permissions
 */
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No authorization token', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  // Get user profile
  const { data: adminProfile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return { error: 'Could not fetch user profile', status: 500 };
  }

  // Check if user is team owner or admin
  const { data: teamMembership } = await supabase
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'admin'])
    .single();

  if (!teamMembership) {
    return { error: 'Forbidden - Admin access required', status: 403 };
  }

  return { user, profile: adminProfile, teamId: teamMembership.team_id };
}

/**
 * GET /api/company-admin/team/[id]
 * Fetch comprehensive learner profile data
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const authResult = await verifyAdmin(req.headers.authorization);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const { teamId } = authResult;
    const learnerId = req.query.id;

    if (!learnerId) {
      return res.status(400).json({ error: 'Learner ID is required' });
    }

    // 1. Get learner profile
    const { data: learner, error: learnerError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        avatar_url,
        tier,
        created_at,
        last_login_at
      `)
      .eq('id', learnerId)
      .single();

    if (learnerError || !learner) {
      return res.status(404).json({ error: 'Learner not found' });
    }

    // Verify learner is in the same team
    const { data: learnerTeamMembership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', learnerId)
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (!learnerTeamMembership) {
      return res.status(403).json({ error: 'Learner not in your team' });
    }

    // 2. Get enrollments with course details
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        progress,
        enrolled_at,
        completed_at,
        due_date,
        course:courses (
          id,
          title,
          thumbnail_url,
          duration_minutes
        )
      `)
      .eq('profile_id', learnerId)
      .order('enrolled_at', { ascending: false });

    // 3. Get competency progress
    const { data: learnerCompetencies } = await supabase
      .from('learner_competencies')
      .select(`
        id,
        current_level,
        progress_to_next,
        self_assessed_level,
        manager_assessed_level,
        courses_completed,
        last_assessment_at,
        competency:competencies (
          id,
          name,
          icon,
          category,
          description
        )
      `)
      .eq('profile_id', learnerId);

    // 4. Get all competencies to show gaps
    const { data: allCompetencies } = await supabase
      .from('competencies')
      .select('id, name, icon, category')
      .eq('framework_id', 'a0000000-0000-0000-0000-000000000001')
      .order('sort_order');

    // 5. Get groups membership
    const { data: groups } = await supabase
      .from('user_groups')
      .select(`
        id,
        joined_at,
        group:groups (
          id,
          name,
          description
        )
      `)
      .eq('user_id', learnerId);

    // 6. Get quiz/assessment results
    const { data: quizResults } = await supabase
      .from('quiz_attempts')
      .select(`
        id,
        score,
        passed,
        completed_at,
        quiz:quizzes (
          id,
          title,
          course_id
        )
      `)
      .eq('profile_id', learnerId)
      .order('completed_at', { ascending: false })
      .limit(20);

    // 7. Get recent activity
    const { data: activityLogs } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('profile_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate stats
    const totalCourses = enrollments?.length || 0;
    const completedCourses = enrollments?.filter(e => e.status === 'completed').length || 0;
    const inProgressCourses = enrollments?.filter(e => e.status === 'in_progress').length || 0;
    const completionRate = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

    const avgQuizScore = quizResults && quizResults.length > 0
      ? Math.round(quizResults.reduce((sum, q) => sum + (q.score || 0), 0) / quizResults.length)
      : null;

    const avgCompetencyLevel = learnerCompetencies && learnerCompetencies.length > 0
      ? Math.round((learnerCompetencies.reduce((sum, c) => sum + (c.current_level || 0), 0) / learnerCompetencies.length) * 10) / 10
      : 0;

    // Merge competency data with all competencies to show gaps
    const competencyProgress = allCompetencies?.map(comp => {
      const learnerComp = learnerCompetencies?.find(lc => lc.competency?.id === comp.id);
      return {
        competency_id: comp.id,
        name: comp.name,
        icon: comp.icon,
        category: comp.category,
        current_level: learnerComp?.current_level || 0,
        progress_to_next: learnerComp?.progress_to_next || 0,
        self_assessed_level: learnerComp?.self_assessed_level || null,
        manager_assessed_level: learnerComp?.manager_assessed_level || null,
        courses_completed: learnerComp?.courses_completed || 0,
        last_assessment_at: learnerComp?.last_assessment_at || null,
      };
    }) || [];

    // Return comprehensive profile data
    return res.status(200).json({
      learner: {
        ...learner,
        full_name: learner.name,
        job_title: learnerTeamMembership.role,
        department: null, // Can be extended later
      },
      stats: {
        total_courses: totalCourses,
        completed_courses: completedCourses,
        in_progress_courses: inProgressCourses,
        completion_rate: completionRate,
        avg_quiz_score: avgQuizScore,
        avg_competency_level: avgCompetencyLevel,
      },
      enrollments: enrollments || [],
      competencies: competencyProgress,
      groups: groups || [],
      quiz_results: quizResults || [],
      activity: activityLogs || [],
    });

  } catch (error) {
    console.error('Error fetching learner profile:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
