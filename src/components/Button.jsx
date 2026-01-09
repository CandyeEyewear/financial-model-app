/**
 * Accessible Button Component
 * WCAG 2.1 AA Compliant
 */
import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button component with full accessibility support
 * 
 * @component
 * @example
 * <Button variant="primary" size="default" onClick={handleClick}>
 *   Click me
 * </Button>
 */
export const Button = forwardRef(({
  children,
  
  // Variants
  variant = 'primary', // 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost' | 'link'
  size = 'default', // 'sm' | 'default' | 'lg' | 'icon'
  
  // State
  disabled = false,
  loading = false,
  
  // Icons
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  
  // Styling
  className = '',
  fullWidth = false,
  
  // Accessibility
  'aria-label': ariaLabel,
  
  // HTML attributes
  type = 'button',
  ...props
}, ref) => {
  // Base classes
  const baseClasses = `
    inline-flex items-center justify-center
    font-semibold
    transition-all duration-normal
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
  `;
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm gap-1.5 rounded-button',
    default: 'h-10 px-4 text-sm gap-2 rounded-button',
    lg: 'h-12 px-6 text-base gap-2.5 rounded-button-lg',
    icon: 'h-10 w-10 p-0 rounded-button',
  };
  
  // Variant classes
  const variantClasses = {
    primary: `
      bg-primary-600 text-white
      hover:bg-primary-700 active:bg-primary-800
      focus-visible:ring-primary-500
      shadow-button hover:shadow-button-hover
    `,
    secondary: `
      bg-white dark:bg-neutral-800
      text-neutral-700 dark:text-neutral-200
      border-2 border-neutral-300 dark:border-neutral-600
      hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400
      focus-visible:ring-primary-500
    `,
    success: `
      bg-success-600 text-white
      hover:bg-success-700 active:bg-success-800
      focus-visible:ring-success-500
      shadow-button hover:shadow-button-hover
    `,
    warning: `
      bg-warning-600 text-white
      hover:bg-warning-700 active:bg-warning-800
      focus-visible:ring-warning-500
      shadow-button hover:shadow-button-hover
    `,
    danger: `
      bg-danger-600 text-white
      hover:bg-danger-700 active:bg-danger-800
      focus-visible:ring-danger-500
      shadow-button hover:shadow-button-hover
    `,
    ghost: `
      bg-transparent
      text-neutral-700 dark:text-neutral-300
      hover:bg-neutral-100 dark:hover:bg-neutral-700
      focus-visible:ring-neutral-500
    `,
    link: `
      bg-transparent
      text-primary-600 dark:text-primary-400
      hover:text-primary-700 dark:hover:text-primary-300
      hover:underline
      focus-visible:ring-primary-500
      p-0 h-auto
    `,
  };
  
  // Build final classes
  const buttonClasses = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && 'w-full',
    className,
  ].filter(Boolean).join(' ');
  
  // Determine if button is interactive
  const isDisabled = disabled || loading;
  
  // Icon size based on button size
  const iconSizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      aria-label={ariaLabel}
      className={buttonClasses}
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <Loader2 
          className={`${iconSizeClass} animate-spin`}
          aria-hidden="true"
        />
      )}
      
      {/* Left icon (hidden when loading) */}
      {!loading && LeftIcon && (
        <LeftIcon 
          className={iconSizeClass}
          aria-hidden="true"
        />
      )}
      
      {/* Button content */}
      {size !== 'icon' && (
        <span className={loading ? 'opacity-70' : ''}>
          {children}
        </span>
      )}
      
      {/* Icon-only button content */}
      {size === 'icon' && !loading && children}
      
      {/* Right icon */}
      {!loading && RightIcon && (
        <RightIcon 
          className={iconSizeClass}
          aria-hidden="true"
        />
      )}
    </button>
  );
});

Button.displayName = 'Button';

/**
 * IconButton - Square button for icons only
 */
export const IconButton = forwardRef(({
  icon: Icon,
  'aria-label': ariaLabel,
  variant = 'ghost',
  size = 'default',
  ...props
}, ref) => {
  // Development-only warning for accessibility
  if (!ariaLabel && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('IconButton requires aria-label for accessibility');
  }
  
  const sizeMap = {
    sm: 'h-8 w-8',
    default: 'h-10 w-10',
    lg: 'h-12 w-12',
  };
  
  const iconSizeMap = {
    sm: 'h-4 w-4',
    default: 'h-5 w-5',
    lg: 'h-6 w-6',
  };
  
  return (
    <Button
      ref={ref}
      variant={variant}
      aria-label={ariaLabel}
      className={`p-0 ${sizeMap[size]}`}
      {...props}
    >
      <Icon className={iconSizeMap[size]} aria-hidden="true" />
    </Button>
  );
});

IconButton.displayName = 'IconButton';

/**
 * ButtonGroup - Group buttons together
 */
export const ButtonGroup = ({ children, className = '' }) => {
  return (
    <div 
      className={`inline-flex rounded-button overflow-hidden ${className}`}
      role="group"
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          className: `
            ${child.props.className || ''}
            ${index > 0 ? '-ml-px' : ''}
            rounded-none
            first:rounded-l-button last:rounded-r-button
            focus:z-10
          `,
        });
      })}
    </div>
  );
};

ButtonGroup.displayName = 'ButtonGroup';

export default Button;
