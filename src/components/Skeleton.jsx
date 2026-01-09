/**
 * Skeleton Loading Components
 * Accessible loading states for async content
 */
import React from 'react';

/**
 * Base Skeleton component
 * 
 * @component
 * @example
 * <Skeleton className="h-4 w-32" />
 */
export function Skeleton({
  className = '',
  variant = 'default', // 'default' | 'circle' | 'rounded'
  animate = true,
  ...props
}) {
  const variantClasses = {
    default: 'rounded',
    circle: 'rounded-full',
    rounded: 'rounded-card',
  };
  
  return (
    <div
      className={`
        bg-neutral-200 dark:bg-neutral-700
        ${animate ? 'animate-pulse' : ''}
        ${variantClasses[variant]}
        ${className}
      `}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Text skeleton - for paragraphs and text content
 */
export function SkeletonText({
  lines = 3,
  className = '',
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton
 */
export function SkeletonAvatar({
  size = 'default', // 'sm' | 'default' | 'lg'
  className = '',
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    default: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  return (
    <Skeleton 
      variant="circle" 
      className={`${sizeClasses[size]} ${className}`}
    />
  );
}

/**
 * Button skeleton
 */
export function SkeletonButton({
  size = 'default',
  fullWidth = false,
  className = '',
}) {
  const sizeClasses = {
    sm: 'h-8 w-20',
    default: 'h-10 w-24',
    lg: 'h-12 w-32',
  };
  
  return (
    <Skeleton 
      className={`
        ${fullWidth ? 'w-full' : sizeClasses[size]}
        h-10 rounded-button
        ${className}
      `}
    />
  );
}

/**
 * Card skeleton - complete card loading state
 */
export function SkeletonCard({
  hasHeader = true,
  hasFooter = false,
  contentLines = 4,
  className = '',
}) {
  return (
    <div 
      className={`
        bg-white dark:bg-neutral-800
        border border-neutral-200 dark:border-neutral-700
        rounded-card shadow-card
        overflow-hidden
        ${className}
      `}
      role="status"
      aria-label="Loading..."
    >
      {hasHeader && (
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
      )}
      
      <div className="p-6">
        <SkeletonText lines={contentLines} />
      </div>
      
      {hasFooter && (
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex gap-2">
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </div>
      )}
      
      <span className="sr-only">Loading content...</span>
    </div>
  );
}

/**
 * Table skeleton
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}) {
  return (
    <div 
      className={`overflow-hidden rounded-card border border-neutral-200 dark:border-neutral-700 ${className}`}
      role="status"
      aria-label="Loading table..."
    >
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex}
          className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0"
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
      
      <span className="sr-only">Loading table data...</span>
    </div>
  );
}

/**
 * KPI skeleton
 */
export function SkeletonKPI({ className = '' }) {
  return (
    <div 
      className={`
        p-4 h-20
        bg-white dark:bg-neutral-800
        border border-neutral-200 dark:border-neutral-700
        rounded-card
        ${className}
      `}
      role="status"
      aria-label="Loading metric..."
    >
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-6 w-24" />
      <span className="sr-only">Loading metric...</span>
    </div>
  );
}

/**
 * Chart skeleton
 */
export function SkeletonChart({
  height = 300,
  className = '',
}) {
  return (
    <div 
      className={`
        bg-white dark:bg-neutral-800
        border border-neutral-200 dark:border-neutral-700
        rounded-card
        overflow-hidden
        ${className}
      `}
      style={{ height }}
      role="status"
      aria-label="Loading chart..."
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        <div className="flex-1 flex items-end gap-2 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton 
              key={i}
              className="flex-1"
              style={{ height: `${Math.random() * 60 + 30}%` }}
            />
          ))}
        </div>
        
        <div className="flex justify-between mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-8" />
          ))}
        </div>
      </div>
      
      <span className="sr-only">Loading chart...</span>
    </div>
  );
}

/**
 * Profile/User skeleton
 */
export function SkeletonProfile({ className = '' }) {
  return (
    <div 
      className={`flex items-center gap-3 ${className}`}
      role="status"
      aria-label="Loading profile..."
    >
      <SkeletonAvatar size="lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <span className="sr-only">Loading profile...</span>
    </div>
  );
}

/**
 * Form skeleton
 */
export function SkeletonForm({
  fields = 4,
  className = '',
}) {
  return (
    <div 
      className={`space-y-4 ${className}`}
      role="status"
      aria-label="Loading form..."
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>
      ))}
      
      <div className="flex gap-2 pt-4">
        <SkeletonButton />
        <SkeletonButton />
      </div>
      
      <span className="sr-only">Loading form...</span>
    </div>
  );
}

export default Skeleton;
