/**
 * ProfileHeader Component
 * Displays learner profile header with key information
 */
import React from 'react';
import { Mail, Edit, Calendar, Building, Users } from 'lucide-react';
import { Button } from '../Button';

/**
 * Avatar component
 */
function Avatar({ src, name, size = 'lg' }) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-12 w-12 text-base',
    lg: 'h-20 w-20 text-2xl',
  };

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full
        bg-primary-100 dark:bg-primary-900/30
        text-primary-700 dark:text-primary-300
        font-bold
        flex items-center justify-center
        flex-shrink-0
        overflow-hidden
      `}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      {!src && <span>{initials}</span>}
      {src && (
        <span style={{ display: 'none' }} className="flex items-center justify-center w-full h-full">
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * Badge component
 */
function Badge({ children, variant = 'default' }) {
  const variantClasses = {
    default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
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
 * ProfileHeader Component
 */
export function ProfileHeader({ learner, groups = [] }) {
  if (!learner) return null;

  const joinedDate = learner.created_at
    ? new Date(learner.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            src={learner.avatar_url}
            name={learner.full_name || learner.name}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {learner.full_name || learner.name || learner.email}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {learner.email}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {learner.job_title && (
                <span className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {learner.job_title}
                </span>
              )}
              {groups.length > 0 && (
                <Badge variant="default">
                  <Users className="h-3 w-3 mr-1" />
                  {groups[0].group?.name || groups[0].name}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {joinedDate}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={Mail}>
            Message
          </Button>
          <Button variant="secondary" size="sm" leftIcon={Edit}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;
