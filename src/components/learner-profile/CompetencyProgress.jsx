/**
 * CompetencyProgress Component
 * Displays learner's competency development with visual progress bars
 */
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';
import {
  MessageCircle,
  Users,
  Lightbulb,
  UsersRound,
  RefreshCw,
  Clock,
  Crown,
  GitBranch,
  ShieldCheck,
  GraduationCap,
  Circle,
} from 'lucide-react';
import { Button } from '../Button';

// Icon mapping
const iconMap = {
  'message-circle': MessageCircle,
  users: Users,
  lightbulb: Lightbulb,
  'users-round': UsersRound,
  'refresh-cw': RefreshCw,
  clock: Clock,
  crown: Crown,
  'git-branch': GitBranch,
  'shield-check': ShieldCheck,
  'graduation-cap': GraduationCap,
};

// Level definitions
const levelNames = [
  'Not Started',
  'Foundational',
  'Developing',
  'Proficient',
  'Advanced',
  'Expert',
];

const levelColors = {
  0: 'bg-neutral-200 dark:bg-neutral-700',
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-green-500',
  5: 'bg-blue-500',
};

/**
 * Progress bar component
 */
function ProgressBar({ value, max = 100, color = 'primary' }) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    primary: 'bg-primary-600 dark:bg-primary-500',
    success: 'bg-success-600 dark:bg-success-500',
    warning: 'bg-warning-600 dark:bg-warning-500',
    info: 'bg-info-600 dark:bg-info-500',
  };

  return (
    <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClasses[color]} transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Badge component
 */
function Badge({ children, variant = 'default' }) {
  const variantClasses = {
    default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-700',
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        rounded-full
        text-xs font-medium
        ${variantClasses[variant]}
      `}
    >
      {children}
    </span>
  );
}

/**
 * Individual competency item
 */
function CompetencyItem({ competency }) {
  const IconComponent = iconMap[competency.icon] || Circle;
  const progressPercent =
    (competency.current_level / 5) * 100 + (competency.progress_to_next || 0) / 5;
  const levelName = levelNames[competency.current_level] || 'Not Started';

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex-shrink-0">
        <IconComponent className="h-5 w-5 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {competency.name}
          </span>
          <Badge variant={competency.current_level > 0 ? 'success' : 'default'}>
            Level {competency.current_level} ({levelName})
          </Badge>
        </div>
        <ProgressBar value={progressPercent} color="primary" />
        {competency.self_assessed_level !== null && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Self-assessed: Level {competency.self_assessed_level}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * CompetencyProgress Component
 */
export function CompetencyProgress({ competencies = [] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Competency Development</CardTitle>
        <Button size="sm" variant="secondary">
          Start Assessment
        </Button>
      </CardHeader>
      <CardContent>
        {competencies.length > 0 ? (
          <div className="space-y-1 divide-y divide-neutral-200 dark:divide-neutral-700">
            {competencies.map((comp) => (
              <CompetencyItem key={comp.competency_id} competency={comp} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-600 dark:text-neutral-400">
              No competency data yet
            </p>
            <Button size="sm" variant="secondary" className="mt-4">
              Start Assessment
            </Button>
          </div>
        )}
        {competencies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Last assessed:{' '}
              {competencies.find((c) => c.last_assessment_at)
                ? new Date(
                    competencies.find((c) => c.last_assessment_at).last_assessment_at
                  ).toLocaleDateString()
                : 'Not yet'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CompetencyProgress;
