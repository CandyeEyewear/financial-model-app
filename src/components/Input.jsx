/**
 * Accessible Input Component
 * WCAG 2.1 AA Compliant
 */
import React, { forwardRef, useId } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Input component with full accessibility support
 * 
 * @component
 * @example
 * <Input
 *   label="Email Address"
 *   type="email"
 *   placeholder="you@example.com"
 *   error="Please enter a valid email"
 *   required
 * />
 */
export const Input = forwardRef(({
  // Content
  label,
  helpText,
  error,
  success,
  
  // State
  disabled = false,
  required = false,
  readOnly = false,
  
  // Styling
  className = '',
  inputClassName = '',
  size = 'default', // 'sm' | 'default' | 'lg'
  variant = 'default', // 'default' | 'filled' | 'ghost'
  
  // Icons
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  
  // Other
  id: providedId,
  type = 'text',
  ...props
}, ref) => {
  // Generate unique ID for accessibility
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const helpTextId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  
  // Determine input state
  const hasError = !!error;
  const hasSuccess = !!success;
  
  // Size classes
  const sizeClasses = {
    sm: 'h-8 text-sm px-2.5',
    default: 'h-10 text-base px-3',
    lg: 'h-12 text-lg px-4',
  };
  
  // Variant classes
  const variantClasses = {
    default: 'bg-white dark:bg-neutral-800 border',
    filled: 'bg-neutral-100 dark:bg-neutral-900 border-transparent focus:bg-white dark:focus:bg-neutral-800',
    ghost: 'bg-transparent border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800',
  };
  
  // State classes
  const stateClasses = hasError
    ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
    : hasSuccess
    ? 'border-success-500 focus:ring-success-500 focus:border-success-500'
    : 'border-neutral-300 dark:border-neutral-600 focus:ring-primary-500 focus:border-primary-500';
  
  // Build input classes
  const inputClasses = [
    'w-full rounded-input transition-all duration-fast',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
    'disabled:bg-neutral-100 dark:disabled:bg-neutral-900',
    'disabled:text-neutral-500 disabled:cursor-not-allowed',
    'read-only:bg-neutral-50 dark:read-only:bg-neutral-900',
    sizeClasses[size],
    variantClasses[variant],
    stateClasses,
    LeftIcon && 'pl-10',
    RightIcon && 'pr-10',
    inputClassName,
  ].filter(Boolean).join(' ');
  
  // Build aria attributes
  const ariaProps = {
    'aria-invalid': hasError ? 'true' : undefined,
    'aria-describedby': [
      hasError && errorId,
      helpText && helpTextId,
    ].filter(Boolean).join(' ') || undefined,
    'aria-required': required ? 'true' : undefined,
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={`
            block text-sm font-medium
            ${hasError 
              ? 'text-danger-700 dark:text-danger-400' 
              : 'text-neutral-700 dark:text-neutral-300'
            }
          `}
        >
          {label}
          {required && (
            <span 
              className="text-danger-500 ml-1" 
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}
      
      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {LeftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LeftIcon 
              className={`h-5 w-5 ${
                hasError 
                  ? 'text-danger-500' 
                  : 'text-neutral-400 dark:text-neutral-500'
              }`} 
              aria-hidden="true"
            />
          </div>
        )}
        
        {/* Input element */}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          readOnly={readOnly}
          className={inputClasses}
          {...ariaProps}
          {...props}
        />
        
        {/* Right icon or status icon */}
        {(RightIcon || hasError || hasSuccess) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {hasError ? (
              <AlertCircle 
                className="h-5 w-5 text-danger-500" 
                aria-hidden="true"
              />
            ) : hasSuccess ? (
              <CheckCircle 
                className="h-5 w-5 text-success-500" 
                aria-hidden="true"
              />
            ) : RightIcon ? (
              <RightIcon 
                className="h-5 w-5 text-neutral-400 dark:text-neutral-500" 
                aria-hidden="true"
              />
            ) : null}
          </div>
        )}
      </div>
      
      {/* Error message */}
      {hasError && (
        <p 
          id={errorId}
          className="flex items-center gap-1.5 text-sm text-danger-600 dark:text-danger-400"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      
      {/* Success message */}
      {hasSuccess && !hasError && (
        <p 
          className="flex items-center gap-1.5 text-sm text-success-600 dark:text-success-400"
        >
          <CheckCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {success}
        </p>
      )}
      
      {/* Help text */}
      {helpText && !hasError && (
        <p 
          id={helpTextId}
          className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400"
        >
          <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {helpText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/**
 * Textarea component with full accessibility support
 */
export const Textarea = forwardRef(({
  label,
  helpText,
  error,
  disabled = false,
  required = false,
  className = '',
  textareaClassName = '',
  rows = 4,
  id: providedId,
  ...props
}, ref) => {
  const generatedId = useId();
  const textareaId = providedId || generatedId;
  const helpTextId = `${textareaId}-help`;
  const errorId = `${textareaId}-error`;
  
  const hasError = !!error;
  
  const stateClasses = hasError
    ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
    : 'border-neutral-300 dark:border-neutral-600 focus:ring-primary-500 focus:border-primary-500';
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className={`
            block text-sm font-medium
            ${hasError 
              ? 'text-danger-700 dark:text-danger-400' 
              : 'text-neutral-700 dark:text-neutral-300'
            }
          `}
        >
          {label}
          {required && (
            <span className="text-danger-500 ml-1" aria-hidden="true">*</span>
          )}
        </label>
      )}
      
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={[
          hasError && errorId,
          helpText && helpTextId,
        ].filter(Boolean).join(' ') || undefined}
        className={`
          w-full px-3 py-2.5 text-base rounded-input
          bg-white dark:bg-neutral-800
          transition-all duration-fast
          focus:outline-none focus:ring-2 focus:ring-offset-0
          placeholder:text-neutral-400 dark:placeholder:text-neutral-500
          disabled:bg-neutral-100 dark:disabled:bg-neutral-900
          disabled:text-neutral-500 disabled:cursor-not-allowed
          resize-y
          ${stateClasses}
          ${textareaClassName}
        `}
        {...props}
      />
      
      {hasError && (
        <p 
          id={errorId}
          className="flex items-center gap-1.5 text-sm text-danger-600 dark:text-danger-400"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      
      {helpText && !hasError && (
        <p 
          id={helpTextId}
          className="text-sm text-neutral-500 dark:text-neutral-400"
        >
          {helpText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
