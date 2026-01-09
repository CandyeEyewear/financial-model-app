/**
 * KPI (Key Performance Indicator) Component
 * Accessible financial metrics display
 * WCAG 2.1 AA Compliant
 */
import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle,
  Info
} from 'lucide-react';

/**
 * KPI Card component for displaying financial metrics
 * Uses both color AND icons for accessibility (not color-only indicators)
 * 
 * @component
 * @example
 * <KPI
 *   label="DSCR"
 *   value="1.45x"
 *   trend="up"
 *   change="+5.2%"
 *   status="success"
 *   tooltip="Debt Service Coverage Ratio"
 * />
 */
export function KPI({
  // Content
  label,
  value,
  change,
  tooltip,
  subtitle,
  
  // State
  trend, // 'up' | 'down' | 'flat' | undefined
  status, // 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  alert = false,
  
  // Styling
  size = 'default', // 'sm' | 'default' | 'lg'
  variant = 'default', // 'default' | 'outlined' | 'filled'
  className = '',
}) {
  // Determine status from trend if not explicitly provided
  const effectiveStatus = status || (
    alert ? 'danger' :
    trend === 'up' ? 'success' :
    trend === 'down' ? 'danger' :
    'neutral'
  );
  
  // Status configuration
  const statusConfig = {
    success: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      border: 'border-success-200 dark:border-success-800',
      text: 'text-success-700 dark:text-success-400',
      icon: TrendingUp,
      iconLabel: 'Positive trend',
    },
    warning: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      border: 'border-warning-200 dark:border-warning-800',
      text: 'text-warning-700 dark:text-warning-400',
      icon: AlertTriangle,
      iconLabel: 'Caution',
    },
    danger: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      border: 'border-danger-200 dark:border-danger-800',
      text: 'text-danger-700 dark:text-danger-400',
      icon: TrendingDown,
      iconLabel: 'Negative trend',
    },
    info: {
      bg: 'bg-info-50 dark:bg-info-900/20',
      border: 'border-info-200 dark:border-info-800',
      text: 'text-info-700 dark:text-info-400',
      icon: Info,
      iconLabel: 'Information',
    },
    neutral: {
      bg: 'bg-white dark:bg-neutral-800',
      border: 'border-neutral-200 dark:border-neutral-700',
      text: 'text-neutral-700 dark:text-neutral-300',
      icon: Minus,
      iconLabel: 'Stable',
    },
  };
  
  const config = statusConfig[effectiveStatus] || statusConfig.neutral;
  
  // Override icon based on trend
  const TrendIcon = trend === 'up' ? TrendingUp :
                    trend === 'down' ? TrendingDown :
                    trend === 'flat' ? Minus :
                    alert ? AlertTriangle :
                    config.icon;
  
  // Size configuration
  const sizeConfig = {
    sm: {
      container: 'p-3 h-16',
      label: 'text-xs',
      value: 'text-base font-bold',
      change: 'text-xs',
      icon: 'w-3.5 h-3.5',
    },
    default: {
      container: 'p-4 h-20',
      label: 'text-sm',
      value: 'text-xl font-bold',
      change: 'text-sm',
      icon: 'w-4 h-4',
    },
    lg: {
      container: 'p-5 h-24',
      label: 'text-base',
      value: 'text-2xl font-bold',
      change: 'text-base',
      icon: 'w-5 h-5',
    },
  };
  
  const sizeClasses = sizeConfig[size] || sizeConfig.default;
  
  // Variant configuration
  const variantClasses = {
    default: `${config.bg} border ${config.border}`,
    outlined: `bg-white dark:bg-neutral-800 border-2 ${config.border}`,
    filled: `${config.bg} border-0`,
  };
  
  return (
    <div
      className={`
        flex flex-col justify-center
        rounded-card
        transition-all duration-normal
        hover:shadow-card-hover
        ${sizeClasses.container}
        ${variantClasses[variant]}
        ${className}
      `}
      title={tooltip}
      role="group"
      aria-label={`${label}: ${value}${change ? `, change: ${change}` : ''}`}
    >
      {/* Top row: label + status indicators */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`${sizeClasses.label} text-neutral-500 dark:text-neutral-400 font-medium`}>
          {label}
        </span>
        
        {/* Status icon - provides non-color indicator for accessibility */}
        {(trend || alert) && (
          <span 
            className={config.text}
            role="img"
            aria-label={
              trend === 'up' ? 'Trending up' :
              trend === 'down' ? 'Trending down' :
              trend === 'flat' ? 'Stable' :
              alert ? 'Alert' : ''
            }
          >
            <TrendIcon className={sizeClasses.icon} aria-hidden="true" />
          </span>
        )}
        
        {/* Alert badge for additional emphasis */}
        {alert && (
          <span className="sr-only">Alert: This metric requires attention</span>
        )}
      </div>
      
      {/* Bottom row: value + optional percentage change */}
      <div className="flex items-baseline gap-2">
        <span className={`
          ${sizeClasses.value}
          ${alert ? 'text-danger-700 dark:text-danger-400' : 'text-neutral-900 dark:text-neutral-100'}
          tabular-nums
        `}>
          {value}
        </span>
        
        {change && (
          <span className={`
            ${sizeClasses.change}
            font-medium
            ${change.startsWith('-') || change.startsWith('−')
              ? 'text-danger-600 dark:text-danger-400'
              : change.startsWith('+')
              ? 'text-success-600 dark:text-success-400'
              : 'text-neutral-500 dark:text-neutral-400'
            }
          `}>
            {change}
          </span>
        )}
      </div>

      {/* Optional subtitle */}
      {subtitle && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{subtitle}</span>
      )}
    </div>
  );
}

/**
 * KPI Grid - Layout component for multiple KPIs
 */
export function KPIGrid({ 
  children, 
  columns = 4, // 2 | 3 | 4 | 5 | 6
  className = '' 
}) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };
  
  return (
    <div 
      className={`grid gap-4 ${columnClasses[columns]} ${className}`}
      role="list"
      aria-label="Key Performance Indicators"
    >
      {React.Children.map(children, (child, index) => (
        <div role="listitem" key={index}>
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * KPI Comparison - Show two values with comparison
 */
export function KPIComparison({
  label,
  currentValue,
  previousValue,
  format = 'number', // 'number' | 'currency' | 'percent'
  tooltip,
  className = '',
}) {
  // Calculate change
  const numCurrent = parseFloat(String(currentValue).replace(/[^0-9.-]/g, ''));
  const numPrevious = parseFloat(String(previousValue).replace(/[^0-9.-]/g, ''));
  
  let change = null;
  let trend = 'flat';
  
  if (!isNaN(numCurrent) && !isNaN(numPrevious) && numPrevious !== 0) {
    const changePercent = ((numCurrent - numPrevious) / Math.abs(numPrevious)) * 100;
    change = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`;
    trend = changePercent > 0.5 ? 'up' : changePercent < -0.5 ? 'down' : 'flat';
  }
  
  return (
    <KPI
      label={label}
      value={currentValue}
      change={change}
      trend={trend}
      tooltip={tooltip}
      className={className}
    />
  );
}

export default KPI;
