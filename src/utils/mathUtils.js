/**
 * ============================================================================
 * Centralized Math Utilities
 *
 * This module provides a single source of truth for all basic mathematical
 * helper functions used throughout the application. Import from here to
 * ensure consistency.
 * ============================================================================
 */

/**
 * Clamp a value between min and max bounds
 * Handles non-finite values by treating them as 0
 *
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} - Clamped value
 *
 * @example
 * clamp(150, 0, 100) // Returns 100
 * clamp(-5, 0, 100)  // Returns 0
 * clamp(NaN, 0, 100) // Returns 0
 */
export function clamp(value, min, max) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return Math.min(max, Math.max(min, safeValue));
}

/**
 * Safe number conversion with fallback
 * Converts any value to a number, returning 0 for empty/null/undefined
 *
 * @param {*} value - Value to convert
 * @returns {number} - Numeric value or 0
 *
 * @example
 * num("123")     // Returns 123
 * num("")        // Returns 0
 * num(null)      // Returns 0
 * num(undefined) // Returns 0
 */
export function num(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

/**
 * Safe division that handles zero denominators and non-finite values
 *
 * @param {number} numerator - The numerator
 * @param {number} denominator - The denominator
 * @param {number} [fallback=0] - Value to return if division is invalid
 * @returns {number} - Result of division or fallback
 *
 * @example
 * safeDivide(10, 2)     // Returns 5
 * safeDivide(10, 0)     // Returns 0
 * safeDivide(10, 0, -1) // Returns -1
 */
export function safeDivide(numerator, denominator, fallback = 0) {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Round a number to a specified number of decimal places
 *
 * @param {number} value - The value to round
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {number} - Rounded value
 *
 * @example
 * roundTo(3.14159, 2)  // Returns 3.14
 * roundTo(3.14159, 4)  // Returns 3.1416
 * roundTo(3.14159)     // Returns 3.14 (default 2 decimals)
 */
export function roundTo(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Check if a value is a valid finite number
 *
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a finite number
 *
 * @example
 * isValidNumber(42)        // Returns true
 * isValidNumber(Infinity)  // Returns false
 * isValidNumber(NaN)       // Returns false
 * isValidNumber("42")      // Returns false
 */
export function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Get a safe numeric value with fallback
 * Attempts to parse non-numeric values, returns fallback if invalid
 *
 * @param {*} value - Value to convert
 * @param {number} [fallback=0] - Fallback value if conversion fails
 * @returns {number} - Numeric value or fallback
 *
 * @example
 * safeNumber(42)          // Returns 42
 * safeNumber("42")        // Returns 42
 * safeNumber("invalid")   // Returns 0
 * safeNumber(null, -1)    // Returns -1
 */
export function safeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Calculate the sum of an array of numbers
 * Ignores non-numeric values
 *
 * @param {number[]} values - Array of numbers to sum
 * @returns {number} - Sum of values
 *
 * @example
 * sum([1, 2, 3, 4])     // Returns 10
 * sum([1, null, 3])     // Returns 4
 */
export function sum(values) {
  if (!Array.isArray(values)) {
    return 0;
  }
  return values.reduce((acc, val) => {
    return acc + (isValidNumber(val) ? val : 0);
  }, 0);
}

/**
 * Calculate the average of an array of numbers
 * Ignores non-numeric values
 *
 * @param {number[]} values - Array of numbers
 * @returns {number} - Average value, or 0 if no valid numbers
 *
 * @example
 * average([1, 2, 3, 4])  // Returns 2.5
 * average([])            // Returns 0
 */
export function average(values) {
  if (!Array.isArray(values)) {
    return 0;
  }
  const validValues = values.filter(isValidNumber);
  if (validValues.length === 0) {
    return 0;
  }
  return sum(validValues) / validValues.length;
}

/**
 * Convert a percentage to a decimal
 *
 * @param {number} percent - Percentage value (e.g., 25 for 25%)
 * @returns {number} - Decimal value (e.g., 0.25)
 *
 * @example
 * percentToDecimal(25)  // Returns 0.25
 * percentToDecimal(100) // Returns 1
 */
export function percentToDecimal(percent) {
  return safeDivide(percent, 100);
}

/**
 * Convert a decimal to a percentage
 *
 * @param {number} decimal - Decimal value (e.g., 0.25)
 * @returns {number} - Percentage value (e.g., 25)
 *
 * @example
 * decimalToPercent(0.25) // Returns 25
 * decimalToPercent(1)    // Returns 100
 */
export function decimalToPercent(decimal) {
  return decimal * 100;
}
