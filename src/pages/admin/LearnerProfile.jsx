/**
 * Learner Profile Page
 * Comprehensive view of a team member's learning progress
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import { ProfileHeader } from '../../components/learner-profile/ProfileHeader';
import { StatsCards } from '../../components/learner-profile/StatsCards';
import { CompetencyProgress } from '../../components/learner-profile/CompetencyProgress';
import { CourseProgress } from '../../components/learner-profile/CourseProgress';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Badge component
 */
function Badge({ children, variant = 'default' }) {
  const variantClasses = {
    default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-3 py-1.5
        rounded-full
        text-sm font-medium
        ${variantClasses[variant]}
      `}
    >
      {children}
    </span>
  );
}

/**
 * LearnerProfile Component
 */
export default function LearnerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessToken();
        const response = await fetch(`/api/company-admin/team/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load profile');
        }

        const profileData = await response.json();
        setData(profileData);
      } catch (err) {
        console.error('Error fetching learner profile:', err);
        setError(err.message || 'Could not load learner profile');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id, getAccessToken]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
              <p className="text-neutral-600 dark:text-neutral-400">
                Loading learner profile...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            leftIcon={ArrowLeft}
            className="mb-6"
          >
            Back
          </Button>
          <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-danger-600 dark:text-danger-400" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {error || 'Profile not found'}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              We couldn't load this learner's profile. Please try again.
            </p>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          leftIcon={ArrowLeft}
        >
          Back
        </Button>

        {/* Profile Header */}
        <ProfileHeader learner={data.learner} groups={data.groups} />

        {/* Stats Cards */}
        <StatsCards stats={data.stats} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Competency Progress */}
          <CompetencyProgress competencies={data.competencies} />

          {/* Course Progress */}
          <CourseProgress enrollments={data.enrollments} />
        </div>

        {/* Groups Section */}
        {data.groups && data.groups.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                Groups & Teams
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.groups.map((g) => (
                <Badge key={g.id} variant="primary">
                  {g.group?.name || 'Unnamed Group'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {data.activity && data.activity.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {data.activity.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="text-neutral-500 dark:text-neutral-400 text-xs whitespace-nowrap">
                    {new Date(activity.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {activity.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
