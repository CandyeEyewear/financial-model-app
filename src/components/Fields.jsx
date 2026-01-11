/**
 * Financial Field Components
 * Specialized input fields for financial data entry
 */
import React, { useState, useEffect, useId, forwardRef } from 'react';
import { Input } from './Input';
import { Label } from './Label';
import { DollarSign, Percent, Hash, Calendar } from 'lucide-react';
import { formatNumber, formatPercent, parseCurrency, parsePercent } from '../utils/formatters';
import { clamp, isValidNumber, decimalToPercent, percentToDecimal } from '../utils/mathUtils';

/**
 * NumberField - Basic number input with validation
 */
export const NumberField = forwardRef(({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  helpText,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  
  const handleChange = (e) => {
    const rawValue = e.target.value;
    if (rawValue === '' || rawValue === '-') {
      onChange(0);
      return;
    }

    const numValue = parseFloat(rawValue);
    if (!isValidNumber(numValue)) return;

    // Clamp to range using centralized utility
    const minBound = min !== undefined ? min : -Infinity;
    const maxBound = max !== undefined ? max : Infinity;
    onChange(clamp(numValue, minBound, maxBound));
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <Input
        ref={ref}
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        error={error}
        helpText={helpText}
        leftIcon={Hash}
        size="default"
        {...props}
      />
    </div>
  );
});

NumberField.displayName = 'NumberField';

/**
 * MoneyField - Currency input with formatting
 */
export const MoneyField = forwardRef(({
  label,
  value,
  onChange,
  currency = 'USD',
  helpText,
  error,
  required = false,
  disabled = false,
  allowNegative = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Format value for display when not focused
  useEffect(() => {
    if (!isFocused && typeof value === 'number') {
      setDisplayValue(value.toLocaleString('en-US', { maximumFractionDigits: 0 }));
    }
  }, [value, isFocused]);
  
  const handleChange = (e) => {
    const rawValue = e.target.value;
    setDisplayValue(rawValue);
    
    // Parse and update
    const numValue = parseCurrency(rawValue);
    if (!allowNegative && numValue < 0) return;
    onChange(numValue);
  };
  
  const handleFocus = (e) => {
    setIsFocused(true);
    // Show raw number when focused
    if (typeof value === 'number' && value !== 0) {
      setDisplayValue(value.toString());
    }
    e.target.select();
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    // Format on blur
    if (typeof value === 'number') {
      setDisplayValue(value.toLocaleString('en-US', { maximumFractionDigits: 0 }));
    }
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        error={error}
        helpText={helpText || `Currency: ${currency}`}
        leftIcon={DollarSign}
        size="default"
        {...props}
      />
    </div>
  );
});

MoneyField.displayName = 'MoneyField';

/**
 * PctField - Percentage input with decimal conversion
 * User enters whole numbers (e.g., 12 for 12%)
 * Value is stored as decimal (e.g., 0.12)
 */
export const PctField = forwardRef(({
  label,
  value, // Stored as decimal (0.12)
  onChange,
  min = -100,
  max = 100,
  step = 0.1,
  decimals = 2,
  helpText,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Convert decimal to percentage for display
  useEffect(() => {
    if (!isFocused && typeof value === 'number') {
      setDisplayValue(decimalToPercent(value).toFixed(decimals));
    }
  }, [value, isFocused, decimals]);

  const handleChange = (e) => {
    const rawValue = e.target.value;
    setDisplayValue(rawValue);

    // Convert percentage to decimal using centralized utilities
    const numValue = parseFloat(rawValue);
    if (isValidNumber(numValue)) {
      const clamped = clamp(numValue, min, max);
      onChange(percentToDecimal(clamped)); // Store as decimal
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Validate and format on blur
    const numValue = parseFloat(displayValue);
    if (isValidNumber(numValue)) {
      const clamped = clamp(numValue, min, max);
      setDisplayValue(clamped.toFixed(decimals));
      onChange(percentToDecimal(clamped));
    } else {
      // Reset to current value
      setDisplayValue(decimalToPercent(value).toFixed(decimals));
    }
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="number"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          step={step}
          disabled={disabled}
          error={error}
          helpText={helpText || 'Enter whole number (e.g., 12 for 12%)'}
          leftIcon={Percent}
          size="default"
          {...props}
        />
      </div>
    </div>
  );
});

PctField.displayName = 'PctField';

/**
 * YearField - Year input with validation
 */
export const YearField = forwardRef(({
  label,
  value,
  onChange,
  minYear = 1900,
  maxYear = 2100,
  helpText,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  
  const handleChange = (e) => {
    const numValue = parseInt(e.target.value, 10);
    if (isValidNumber(numValue)) {
      onChange(clamp(numValue, minYear, maxYear));
    }
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <Input
        ref={ref}
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
        min={minYear}
        max={maxYear}
        disabled={disabled}
        error={error}
        helpText={helpText}
        leftIcon={Calendar}
        size="default"
        {...props}
      />
    </div>
  );
});

YearField.displayName = 'YearField';

/**
 * RatioField - For entering financial ratios (e.g., 1.5x)
 */
export const RatioField = forwardRef(({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  helpText,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  
  const handleChange = (e) => {
    const numValue = parseFloat(e.target.value);
    if (isValidNumber(numValue)) {
      onChange(clamp(numValue, min, max));
    }
  };
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <div className="flex items-center gap-2">
        <Input
          ref={ref}
          id={id}
          type="number"
          value={value}
          onChange={handleChange}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          error={error}
          size="default"
          className="flex-1"
          {...props}
        />
        <span className="text-neutral-500 dark:text-neutral-400 font-medium">×</span>
      </div>
      {helpText && !error && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{helpText}</p>
      )}
    </div>
  );
});

RatioField.displayName = 'RatioField';

/**
 * SelectField - Dropdown select with styling
 */
export const SelectField = forwardRef(({
  label,
  value,
  onChange,
  options, // Array of { value, label } or strings
  placeholder = 'Select...',
  helpText,
  error,
  required = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const id = useId();
  
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
  
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={id} required={required} error={!!error}>
          {label}
        </Label>
      )}
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full h-10 px-3 text-base
          bg-white dark:bg-neutral-800
          border rounded-input
          transition-all duration-fast
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-neutral-100 dark:disabled:bg-neutral-900
          disabled:cursor-not-allowed
          ${error 
            ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500' 
            : 'border-neutral-300 dark:border-neutral-600 focus:ring-primary-500 focus:border-primary-500'
          }
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{helpText}</p>
      )}
    </div>
  );
});

SelectField.displayName = 'SelectField';

/**
 * FieldGroup - Group related fields together
 */
export function FieldGroup({ 
  label, 
  children, 
  columns = 1, // 1 | 2 | 3 | 4
  className = '' 
}) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };
  
  return (
    <fieldset className={`space-y-4 ${className}`}>
      {label && (
        <legend className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          {label}
        </legend>
      )}
      <div className={`grid gap-4 ${columnClasses[columns]}`}>
        {children}
      </div>
    </fieldset>
  );
}

// Re-export for convenience
export { Input, Label };

export default {
  NumberField,
  MoneyField,
  PctField,
  YearField,
  RatioField,
  SelectField,
  FieldGroup,
};
