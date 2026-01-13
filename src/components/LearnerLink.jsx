/**
 * LearnerLink Component
 * Clickable learner name with optional avatar
 * Links to learner profile page
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';

/**
 * Avatar component for displaying user profile picture or initials
 */
function Avatar({ src, name, size = 'md' }) {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
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
        font-semibold
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
 * LearnerLink Component
 * Makes learner names clickable throughout the app
 *
 * @param {string} learnerId - User ID to link to
 * @param {string} name - Learner's full name
 * @param {string} email - Learner's email (optional)
 * @param {string} avatarUrl - URL to avatar image (optional)
 * @param {boolean} showAvatar - Whether to show avatar (default: true)
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 * @param {string} className - Additional CSS classes
 */
export function LearnerLink({
  learnerId,
  name,
  email,
  avatarUrl,
  showAvatar = true,
  size = 'md',
  className = '',
}) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-medium',
  };

  return (
    <Link
      to={`/admin/team/${learnerId}`}
      className={`
        inline-flex items-center gap-2
        text-primary-600 dark:text-primary-400
        hover:text-primary-700 dark:hover:text-primary-300
        hover:underline
        transition-colors duration-normal
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showAvatar && <Avatar src={avatarUrl} name={name} size={size} />}
      <span>{name || email || 'Unknown User'}</span>
    </Link>
  );
}

export default LearnerLink;
