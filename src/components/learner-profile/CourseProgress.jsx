/**
 * CourseProgress Component
 * Displays learner's course enrollments with progress tracking
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import { CheckCircle, Clock, PlayCircle, Plus, BookOpen } from 'lucide-react';
import { Button } from '../Button';

/**
 * Progress bar component
 */
function ProgressBar({ value, max = 100 }) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Course item component
 */
function CourseItem({ enrollment, status }) {
  const course = enrollment.course;
  if (!course) return null;

  const statusConfig = {
    completed: {
      bgColor: 'bg-success-50 dark:bg-success-900/20',
      borderColor: 'border-success-200 dark:border-success-800',
      icon: CheckCircle,
      iconColor: 'text-success-600 dark:text-success-400',
    },
    in_progress: {
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      icon: PlayCircle,
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    not_started: {
      bgColor: 'bg-neutral-50 dark:bg-neutral-800',
      borderColor: 'border-neutral-200 dark:border-neutral-700',
      icon: Clock,
      iconColor: 'text-neutral-500 dark:text-neutral-400',
    },
  };

  const config = statusConfig[status] || statusConfig.not_started;
  const Icon = config.icon;

  return (
    <div
      className={`
        p-3 rounded-lg border
        ${config.bgColor}
        ${config.borderColor}
      `}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
            {course.title}
          </h4>
          {status === 'in_progress' && (
            <>
              <div className="flex items-center justify-between mt-2 mb-1">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {enrollment.progress}% complete
                </span>
              </div>
              <ProgressBar value={enrollment.progress} />
            </>
          )}
          {status === 'completed' && enrollment.completed_at && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Completed {new Date(enrollment.completed_at).toLocaleDateString()}
            </p>
          )}
          {status === 'not_started' && enrollment.enrolled_at && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Assigned {new Date(enrollment.enrolled_at).toLocaleDateString()}
            </p>
          )}
          {enrollment.due_date && status === 'in_progress' && (
            <p className="text-xs text-warning-600 dark:text-warning-400 mt-1">
              Due: {new Date(enrollment.due_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CourseProgress Component
 */
export function CourseProgress({ enrollments = [] }) {
  const completed = enrollments.filter((e) => e.status === 'completed');
  const inProgress = enrollments.filter((e) => e.status === 'in_progress');
  const notStarted = enrollments.filter(
    (e) => e.status === 'enrolled' || e.status === 'not_started'
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Course Activity</CardTitle>
        <Button size="sm" leftIcon={Plus} variant="secondary">
          Assign Course
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Completed Courses */}
        {completed.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success-600 dark:text-success-400" />
              Completed ({completed.length})
            </h4>
            <div className="space-y-2">
              {completed.map((enrollment) => (
                <CourseItem
                  key={enrollment.id}
                  enrollment={enrollment}
                  status="completed"
                />
              ))}
            </div>
          </div>
        )}

        {/* In Progress */}
        {inProgress.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3 flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              In Progress ({inProgress.length})
            </h4>
            <div className="space-y-2">
              {inProgress.map((enrollment) => (
                <CourseItem
                  key={enrollment.id}
                  enrollment={enrollment}
                  status="in_progress"
                />
              ))}
            </div>
          </div>
        )}

        {/* Not Started */}
        {notStarted.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              Not Started ({notStarted.length})
            </h4>
            <div className="space-y-2">
              {notStarted.map((enrollment) => (
                <CourseItem
                  key={enrollment.id}
                  enrollment={enrollment}
                  status="not_started"
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {enrollments.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              No courses assigned yet
            </p>
            <Button size="sm" leftIcon={Plus} variant="secondary">
              Assign First Course
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CourseProgress;
