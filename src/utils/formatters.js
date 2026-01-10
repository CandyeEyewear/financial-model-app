/**
 * ============================================================================
 * Unified Formatters Module
 * Consistent number, currency, and percentage formatting for financial apps
 * ============================================================================
 */

// ============================================================================
// CURRENCY SYMBOLS & CONFIGURATION
// ============================================================================

/**
 * Abbreviated currency symbols for compact display
 * Uses short symbols like "J$" instead of "JMD" for mobile-friendly display
 */
const CURRENCY_SYMBOLS = {
  JMD: 'J$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  TTD: 'TT$',
  BBD: 'BD$',
  XCD: 'EC$',
  KYD: 'KY$',
  BSD: 'B$',
  BZD: 'BZ$',
  GYD: 'G$',
  SRD: 'SR$',
  HTG: 'G',
  DOP: 'RD$',
  CUP: 'CU$',
  MXN: 'MX$',
  CNY: '¥',
  JPY: '¥',
  INR: '₹',
  KRW: '₩',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  BRL: 'R$',
  ARS: 'AR$',
  CLP: 'CL$',
  COP: 'CO$',
  PEN: 'S/',
  ZAR: 'R',
  NGN: '₦',
  KES: 'KSh',
  GHS: 'GH₵',
  EGP: 'E£',
  AED: 'د.إ',
  SAR: 'SR',
  ILS: '₪',
  TRY: '₺',
  RUB: '₽',
  UAH: '₴',
  THB: '฿',
  VND: '₫',
  MYR: 'RM',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  PHP: '₱',
  IDR: 'Rp',
  PKR: '₨',
  BDT: '৳',
  LKR: 'Rs',
};

/**
 * Get the abbreviated symbol for a currency
 * @param {string} currency - Currency code (e.g., 'USD', 'JMD')
 * @returns {string} - Abbreviated symbol (e.g., 'US$', 'J$')
 */
export function getCurrencySymbol(currency = 'USD') {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
}

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

/**
 * Format a number as currency
 *
 * @param {number} value - The value to format
 * @param {string} currency - Currency code (e.g., 'USD', 'JMD', 'EUR')
 * @param {Object} options - Additional options
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(value, currency = 'USD', options = {}) {
  if (!Number.isFinite(value)) {
    return options.fallback || '—';
  }

  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    showSign = false,
    compact = false,
    useShortSymbol = true, // Use abbreviated symbols (J$, US$) by default
  } = options;

  // Use abbreviated symbol for compact, mobile-friendly display
  if (useShortSymbol) {
    const symbol = getCurrencySymbol(currency);
    const sign = value < 0 ? '-' : (showSign && value > 0 ? '+' : '');
    const absValue = Math.abs(value);

    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits,
      maximumFractionDigits,
      notation: compact ? 'compact' : 'standard',
    }).format(absValue);

    return `${sign}${symbol}${formatted}`;
  }

  // Fall back to Intl currency formatting for full names
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
      notation: compact ? 'compact' : 'standard',
      signDisplay: showSign ? 'exceptZero' : 'auto',
    });
    return formatter.format(value);
  } catch {
    // Fallback for unsupported currencies
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
    return `${currency} ${formatted}`;
  }
}

/**
 * Format a number as currency in millions (e.g., J$1.5M)
 * Standard format for investment banking
 *
 * @param {number} value - The value to format (in actual units, not millions)
 * @param {string} currency - Currency code
 * @param {Object} options - Additional options
 * @returns {string} - Formatted currency string with 'M' suffix
 */
export function formatCurrencyMM(value, currency = 'USD', options = {}) {
  if (!Number.isFinite(value)) {
    return options.fallback || '—';
  }

  const millions = value / 1_000_000;
  const {
    minimumFractionDigits = 1,
    maximumFractionDigits = 1,
    showSign = false,
    useShortSymbol = true,
  } = options;

  // Use abbreviated symbol for compact, mobile-friendly display
  const symbol = getCurrencySymbol(currency);
  const sign = millions < 0 ? '-' : (showSign && millions > 0 ? '+' : '');
  const absMillions = Math.abs(millions);

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(absMillions);

  return `${sign}${symbol}${formatted}M`;
}

/**
 * Format a number as currency in thousands (e.g., J$150K)
 *
 * @param {number} value - The value to format
 * @param {string} currency - Currency code
 * @returns {string}
 */
export function formatCurrencyK(value, currency = 'USD') {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const thousands = value / 1_000;
  const symbol = getCurrencySymbol(currency);
  const sign = thousands < 0 ? '-' : '';
  const absThousands = Math.abs(thousands);

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(absThousands);

  return `${sign}${symbol}${formatted}K`;
}

/**
 * Format a number as currency in billions (e.g., US$1.5B)
 *
 * @param {number} value - The value to format
 * @param {string} currency - Currency code
 * @returns {string}
 */
export function formatCurrencyB(value, currency = 'USD') {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const billions = value / 1_000_000_000;
  const symbol = getCurrencySymbol(currency);
  const sign = billions < 0 ? '-' : '';
  const absBillions = Math.abs(billions);

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(absBillions);

  return `${sign}${symbol}${formatted}B`;
}

/**
 * Smart currency formatter that picks the right suffix based on magnitude
 * 
 * @param {number} value - The value to format
 * @param {string} currency - Currency code
 * @returns {string}
 */
export function formatCurrencyAuto(value, currency = 'USD') {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return formatCurrencyB(value, currency);
  } else if (absValue >= 1_000_000) {
    return formatCurrencyMM(value, currency);
  } else if (absValue >= 10_000) {
    return formatCurrencyK(value, currency);
  } else {
    return formatCurrency(value, currency);
  }
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format a number with specified decimal places
 * 
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @param {Object} options - Additional options
 * @returns {string}
 */
export function formatNumber(value, decimals = 2, options = {}) {
  if (!Number.isFinite(value)) {
    return options.fallback || '0.00';
  }

  const {
    showSign = false,
    useGrouping = true,
  } = options;

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: showSign ? 'exceptZero' : 'auto',
    useGrouping,
  }).format(value);
}

/**
 * Format a number with thousands separators
 * 
 * @param {number} value - The value to format
 * @returns {string}
 */
export function formatWithCommas(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return new Intl.NumberFormat(undefined).format(value);
}

/**
 * Format a number as a ratio (e.g., 1.25x)
 * 
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @param {Object} options - Additional options
 * @returns {string}
 */
export function formatRatio(value, decimals = 2, options = {}) {
  if (!Number.isFinite(value)) {
    return options.fallback || '—';
  }

  // Handle infinity-like values
  if (value > 999) {
    return '>999x';
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return `${formatted}x`;
}

/**
 * Format a number as a multiple (same as ratio but for financial context)
 * 
 * @param {number} value 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatMultiple(value, decimals = 1) {
  return formatRatio(value, decimals);
}

// ============================================================================
// PERCENTAGE FORMATTING
// ============================================================================

/**
 * Format a decimal as a percentage
 * 
 * @param {number} value - The value as decimal (e.g., 0.15 for 15%)
 * @param {number} decimals - Number of decimal places
 * @param {Object} options - Additional options
 * @returns {string}
 */
export function formatPercent(value, decimals = 1, options = {}) {
  if (!Number.isFinite(value)) {
    return options.fallback || '0.0%';
  }

  const {
    showSign = false,
  } = options;

  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: showSign ? 'exceptZero' : 'auto',
  }).format(value);
}

/**
 * Format a basis points value (e.g., 150 bps)
 * 
 * @param {number} bps - Value in basis points
 * @returns {string}
 */
export function formatBasisPoints(bps) {
  if (!Number.isFinite(bps)) {
    return '0 bps';
  }

  return `${Math.round(bps)} bps`;
}

/**
 * Convert decimal to basis points and format
 * 
 * @param {number} decimal - Decimal value (e.g., 0.015 = 150 bps)
 * @returns {string}
 */
export function formatAsBasisPoints(decimal) {
  if (!Number.isFinite(decimal)) {
    return '0 bps';
  }

  return formatBasisPoints(decimal * 10000);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format a date for display
 * 
 * @param {Date|string} date - The date to format
 * @param {string} style - 'short', 'medium', 'long', 'full'
 * @returns {string}
 */
export function formatDate(date, style = 'medium') {
  if (!date) return '—';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '—';
    }

    const styles = {
      short: { year: '2-digit', month: 'numeric', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    };

    return new Intl.DateTimeFormat(undefined, styles[style] || styles.medium).format(dateObj);
  } catch {
    return '—';
  }
}

/**
 * Format a date as ISO string (YYYY-MM-DD)
 * 
 * @param {Date|string} date 
 * @returns {string}
 */
export function formatDateISO(date) {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format relative time (e.g., "2 days ago")
 * 
 * @param {Date|string} date 
 * @returns {string}
 */
export function formatRelativeTime(date) {
  if (!date) return '—';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '—';
  }
}

// ============================================================================
// LEGACY ALIASES (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use formatCurrency instead
 */
export const currencyFmt = (value, currency = 'JMD') => formatCurrency(value, currency);

/**
 * @deprecated Use formatCurrencyMM instead
 */
export const currencyFmtMM = (value, currency = 'JMD') => formatCurrencyMM(value, currency);

/**
 * @deprecated Use formatNumber instead
 */
export const numFmt = (value, decimals = 2) => formatNumber(value, decimals);

/**
 * @deprecated Use formatPercent instead
 */
export const pctFmt = (value) => formatPercent(value, 1);

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Parse a formatted currency string back to a number
 * 
 * @param {string} value - Formatted currency string
 * @returns {number}
 */
export function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  // Remove currency symbols, commas, spaces, and suffix letters
  const cleaned = value
    .replace(/[^0-9.-]/g, '')
    .replace(/,/g, '');

  // Check for M/K/B suffix
  const upperValue = value.toUpperCase();
  let multiplier = 1;
  
  if (upperValue.includes('B')) {
    multiplier = 1_000_000_000;
  } else if (upperValue.includes('M')) {
    multiplier = 1_000_000;
  } else if (upperValue.includes('K')) {
    multiplier = 1_000;
  }

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

/**
 * Parse a percentage string to decimal
 * 
 * @param {string} value - Percentage string (e.g., "15%")
 * @returns {number} - Decimal value (e.g., 0.15)
 */
export function parsePercent(value) {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);

  // Check if the original had a % sign (meaning it's already in percentage form)
  if (value.includes('%')) {
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  }

  return Number.isFinite(parsed) ? parsed : 0;
}

// ============================================================================
// CONDITIONAL FORMATTING
// ============================================================================

/**
 * Get CSS class for positive/negative values
 * 
 * @param {number} value 
 * @param {boolean} invertColors - If true, negative is good (e.g., for costs)
 * @returns {string}
 */
export function getValueColorClass(value, invertColors = false) {
  if (!Number.isFinite(value) || value === 0) {
    return 'text-neutral-600 dark:text-neutral-400';
  }

  const isPositive = invertColors ? value < 0 : value > 0;
  
  return isPositive
    ? 'text-success-600 dark:text-success-400'
    : 'text-danger-600 dark:text-danger-400';
}

/**
 * Get status color based on value relative to thresholds
 * 
 * @param {number} value 
 * @param {number} warningThreshold 
 * @param {number} dangerThreshold 
 * @param {boolean} higherIsBetter 
 * @returns {'success'|'warning'|'danger'}
 */
export function getStatusFromValue(value, warningThreshold, dangerThreshold, higherIsBetter = true) {
  if (!Number.isFinite(value)) return 'warning';

  if (higherIsBetter) {
    if (value >= warningThreshold) return 'success';
    if (value >= dangerThreshold) return 'warning';
    return 'danger';
  } else {
    if (value <= warningThreshold) return 'success';
    if (value <= dangerThreshold) return 'warning';
    return 'danger';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Currency
  formatCurrency,
  formatCurrencyMM,
  formatCurrencyK,
  formatCurrencyB,
  formatCurrencyAuto,
  getCurrencySymbol,

  // Numbers
  formatNumber,
  formatWithCommas,
  formatRatio,
  formatMultiple,

  // Percentages
  formatPercent,
  formatBasisPoints,
  formatAsBasisPoints,

  // Dates
  formatDate,
  formatDateISO,
  formatRelativeTime,

  // Parsing
  parseCurrency,
  parsePercent,

  // Utilities
  getValueColorClass,
  getStatusFromValue,

  // Legacy aliases
  currencyFmt,
  currencyFmtMM,
  numFmt,
  pctFmt,
};
