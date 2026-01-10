/**
 * Card Components
 * Semantic HTML structure for card layouts
 * WCAG 2.1 AA Compliant
 */
import React from 'react';

/**
 * Card container component
 * Uses <article> or <section> for semantic meaning
 * 
 * @component
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 * </Card>
 */
export function Card({
  children,
  className = '',
  variant = 'default', // 'default' | 'outlined' | 'elevated' | 'ghost'
  padding = 'default', // 'none' | 'sm' | 'default' | 'lg'
  as: Component = 'section', // 'section' | 'article' | 'div' | 'aside'
  interactive = false,
  onClick,
  ...props
}) {
  // Variant styles
  const variantClasses = {
    default: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-card',
    outlined: 'bg-transparent border-2 border-neutral-200 dark:border-neutral-700',
    elevated: 'bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 shadow-card-lg',
    ghost: 'bg-transparent border-transparent',
  };
  
  // Interactive styles
  const interactiveClasses = interactive || onClick
    ? 'cursor-pointer hover:shadow-card-hover transition-shadow duration-normal focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
    : '';
  
  // Handle keyboard interaction for clickable cards
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick(e);
    }
  };
  
  return (
    <Component
      className={`
        rounded-card
        ${variantClasses[variant]}
        ${interactiveClasses}
        ${className}
      `}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Card Header component
 */
export function CardHeader({
  children,
  className = '',
  actions,
  ...props
}) {
  return (
    <header
      className={`
        px-6 py-4
        border-b border-neutral-200 dark:border-neutral-700
        ${className}
      `}
      {...props}
    >
      {actions ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">{children}</div>
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        </div>
      ) : (
        children
      )}
    </header>
  );
}

/**
 * Card Title component
 */
export function CardTitle({
  children,
  as: Component = 'h3',
  className = '',
  icon: Icon,
  ...props
}) {
  return (
    <Component
      className={`
        text-lg font-semibold
        text-neutral-900 dark:text-neutral-100
        flex items-center gap-2
        ${className}
      `}
      {...props}
    >
      {Icon && (
        <Icon 
          className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" 
          aria-hidden="true"
        />
      )}
      {children}
    </Component>
  );
}

/**
 * Card Description component
 */
export function CardDescription({
  children,
  className = '',
  ...props
}) {
  return (
    <p
      className={`
        text-sm text-neutral-500 dark:text-neutral-400
        mt-1
        ${className}
      `}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Card Content component
 */
export function CardContent({
  children,
  className = '',
  padding = 'default', // 'none' | 'sm' | 'default' | 'lg'
  ...props
}) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  };
  
  return (
    <div
      className={`${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Footer component
 */
export function CardFooter({
  children,
  className = '',
  ...props
}) {
  return (
    <footer
      className={`
        px-6 py-4
        border-t border-neutral-200 dark:border-neutral-700
        bg-neutral-50 dark:bg-neutral-800/50
        rounded-b-card
        ${className}
      `}
      {...props}
    >
      {children}
    </footer>
  );
}

/**
 * Metric Card - Specialized card for displaying metrics
 */
export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  status = 'neutral', // 'success' | 'warning' | 'danger' | 'neutral'
  className = '',
}) {
  const statusColors = {
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    danger: 'from-danger-500 to-danger-600',
    neutral: 'from-primary-500 to-primary-600',
  };
  
  return (
    <Card 
      className={`overflow-hidden ${className}`}
      as="div"
    >
      <div className={`p-5 bg-gradient-to-br ${statusColors[status]} text-white`}>
        {Icon && (
          <Icon className="w-8 h-8 opacity-80 mb-2" aria-hidden="true" />
        )}
        <div className="text-sm opacity-90 mb-1">{title}</div>
        <div className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums">{value}</div>
        {subtitle && (
          <div className="text-xs opacity-75 mt-1">{subtitle}</div>
        )}
      </div>
    </Card>
  );
}

/**
 * Stats Card - Grid of stats in a card
 */
export function StatsCard({
  title,
  stats, // Array of { label, value, change? }
  columns = 3,
  className = '',
}) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className={`grid grid-cols-${columns} gap-4`}>
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {stat.value}
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                {stat.label}
              </div>
              {stat.change && (
                <div className={`text-xs font-medium ${
                  stat.change.startsWith('+') ? 'text-success-600' :
                  stat.change.startsWith('-') ? 'text-danger-600' :
                  'text-neutral-500'
                }`}>
                  {stat.change}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default Card;
