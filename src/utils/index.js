/**
 * Utilities Index
 * Central export file for all utility functions
 */

// Formatters
export {
  formatCurrency,
  formatCurrencyMM,
  formatCurrencyK,
  formatCurrencyB,
  formatCurrencyAuto,
  formatNumber,
  formatWithCommas,
  formatRatio,
  formatMultiple,
  formatPercent,
  formatBasisPoints,
  formatAsBasisPoints,
  formatDate,
  formatDateISO,
  formatRelativeTime,
  parseCurrency,
  parsePercent,
  getValueColorClass,
  getStatusFromValue,
  // Legacy aliases
  currencyFmt,
  currencyFmtMM,
  numFmt,
  pctFmt,
} from './formatters';

// Financial Calculations
export {
  calculateIRR,
  calculateNPV,
  calculateMIRR,
  calculatePaybackPeriod,
  calculateDiscountedPaybackPeriod,
  calculateProfitabilityIndex,
  calculateMOIC,
  calculateDPI,
  calculateRVPI,
  calculateTVPI,
  calculateTerminalValue,
  calculateEnterpriseValue,
  calculateEquityValue,
  calculateWACC,
  calculateCostOfEquity,
  calculateUnleveredBeta,
  calculateLeveredBeta,
  calculateCAGR,
  safeDivide,
  clamp,
  roundTo,
  isValidNumber,
  safeNumber,
} from './financialCalculations';

// Logging
export { default as logger, createLogger, safeStringify, withErrorLogging } from './logger';

// Validation
export {
  validateFinancialInputs,
  validateModelParams,
  validateFacilityTerms,
  checkCovenantBreaches,
  validateDataQuality,
  validateEntireModel,
} from './validation';

// Projections
export { default as buildProjection, periodsPerYear } from './buildProjection';
export { default as applyShocks } from './applyShocks';
