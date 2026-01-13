/**
 * StatsCards Component
 * Displays key learner statistics in card format
 */
import React from 'react';
import { Card, CardContent } from '../Card';
import { BookOpen, Target, Trophy, TrendingUp } from 'lucide-react';

/**
 * Individual stat card
 */
function StatCard({ icon: Icon, label, value, color = 'primary' }) {
  const colorClasses = {
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    info: 'text-info-600 dark:text-info-400',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-2">
          <Icon className={`h-4 w-4 ${colorClasses[color]}`} />
          {label}
        </div>
        <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * StatsCards Component
 */
export function StatsCards({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={BookOpen}
        label="Courses Enrolled"
        value={stats.total_courses || 0}
        color="primary"
      />
      <StatCard
        icon={Target}
        label="Completion Rate"
        value={`${stats.completion_rate || 0}%`}
        color="success"
      />
      <StatCard
        icon={Trophy}
        label="Avg Quiz Score"
        value={stats.avg_quiz_score !== null ? `${stats.avg_quiz_score}%` : 'N/A'}
        color="warning"
      />
      <StatCard
        icon={TrendingUp}
        label="Competency Level"
        value={stats.avg_competency_level || '0.0'}
        color="info"
      />
    </div>
  );
}

export default StatsCards;
