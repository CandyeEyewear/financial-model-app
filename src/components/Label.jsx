/**
 * Accessible Label Component
 * WCAG 2.1 AA Compliant
 */
import React from 'react';

/**
 * Label component for form fields
 * 
 * @component
 * @example
 * <Label htmlFor="email" required>Email Address</Label>
 */
export const Label = ({
  children,
  htmlFor,
  required = false,
  disabled = false,
  error = false,
  className = '',
  srOnly = false,
  ...props
}) => {
  const baseClasses = `
    block text-sm font-medium
    transition-colors duration-fast
  `;
  
  const stateClasses = error
    ? 'text-danger-700 dark:text-danger-400'
    : disabled
    ? 'text-neutral-400 dark:text-neutral-500'
    : 'text-neutral-700 dark:text-neutral-300';
  
  const labelClasses = srOnly
    ? 'sr-only'
    : `${baseClasses} ${stateClasses} ${className}`;
  
  return (
    <label
      htmlFor={htmlFor}
      className={labelClasses}
      {...props}
    >
      {children}
      {required && !srOnly && (
        <span 
          className="text-danger-500 ml-0.5" 
          aria-hidden="true"
          title="Required field"
        >
          *
        </span>
      )}
      {required && (
        <span className="sr-only"> (required)</span>
      )}
    </label>
  );
};

/**
 * Field wrapper component for consistent form field layout
 */
export const Field = ({
  children,
  label,
  htmlFor,
  required = false,
  error,
  helpText,
  className = '',
}) => {
  const helpId = htmlFor ? `${htmlFor}-help` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label 
          htmlFor={htmlFor} 
          required={required}
          error={!!error}
        >
          {label}
        </Label>
      )}
      
      {children}
      
      {error && (
        <p 
          id={errorId}
          className="text-sm text-danger-600 dark:text-danger-400"
          role="alert"
        >
          {error}
        </p>
      )}
      
      {helpText && !error && (
        <p 
          id={helpId}
          className="text-sm text-neutral-500 dark:text-neutral-400"
        >
          {helpText}
        </p>
      )}
    </div>
  );
};

export default Label;
