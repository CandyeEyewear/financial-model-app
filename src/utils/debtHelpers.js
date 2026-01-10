// src/utils/debtHelpers.js
// Shared debt calculation utilities for consistency across all credit analysis components

/**
 * Safe number helper - returns default if value is not a finite number
 * @param {any} value - Value to check
 * @param {number} defaultValue - Default value if not valid
 * @returns {number}
 */
export function safe(value, defaultValue = 0) {
  return Number.isFinite(value) ? value : defaultValue;
}

/**
 * Calculate total debt from params (handles single and multi-tranche modes)
 *
 * Business Rules:
 * - Single mode: Total Debt = Existing Debt (openingDebt) + New Facility (requestedLoanAmount)
 * - Multi-tranche mode: Total Debt = Sum of all tranche amounts
 *
 * @param {Object} params - Financial parameters object
 * @returns {number} Total debt amount
 */
export function getTotalDebt(params) {
  if (!params) return 0;

  // Multi-tranche mode takes precedence
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    return params.debtTranches.reduce((sum, tranche) => sum + safe(tranche.amount, 0), 0);
  }

  // Single debt mode: openingDebt + requestedLoanAmount (ADDITIVE)
  return safe(params.openingDebt, 0) + safe(params.requestedLoanAmount, 0);
}

/**
 * Check if any debt exists in the params
 * Checks for: existing debt, new facility, or multi-tranche configuration
 *
 * @param {Object} params - Financial parameters object
 * @returns {boolean} True if any debt exists
 */
export function hasAnyDebt(params) {
  if (!params) return false;
  return getTotalDebt(params) > 0;
}

/**
 * Get detailed debt breakdown
 * @param {Object} params - Financial parameters object
 * @returns {Object} Debt breakdown details
 */
export function getDebtBreakdown(params) {
  if (!params) {
    return {
      hasExistingDebt: false,
      hasNewFacility: false,
      hasMultipleTranches: false,
      hasAnyDebt: false,
      existingDebt: 0,
      newFacility: 0,
      totalDebt: 0,
      trancheCount: 0
    };
  }

  const existingDebt = safe(params.openingDebt, 0);
  const newFacility = safe(params.requestedLoanAmount, 0);
  const hasMultipleTranches = !!(params.hasMultipleTranches && params.debtTranches?.length > 0);
  const trancheCount = hasMultipleTranches ? params.debtTranches.length : 0;
  const totalDebt = getTotalDebt(params);

  return {
    hasExistingDebt: existingDebt > 0,
    hasNewFacility: newFacility > 0,
    hasMultipleTranches,
    hasAnyDebt: totalDebt > 0,
    existingDebt,
    newFacility,
    totalDebt,
    trancheCount
  };
}

/**
 * Get blended interest rate (handles single and multi-tranche modes)
 *
 * @param {Object} params - Financial parameters object
 * @returns {number} Blended interest rate (decimal, e.g., 0.08 for 8%)
 */
export function getBlendedRate(params) {
  if (!params) return 0;

  // Multi-tranche mode: weighted average of tranche rates
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    const totalDebt = params.debtTranches.reduce((sum, t) => sum + safe(t.amount, 0), 0);
    if (totalDebt === 0) return 0;

    const weightedRate = params.debtTranches.reduce((sum, t) => {
      return sum + safe(t.amount, 0) * safe(t.rate, 0);
    }, 0);

    return weightedRate / totalDebt;
  }

  // Single debt mode: weighted average of existing and new debt rates
  const existingDebt = safe(params.openingDebt, 0);
  const newFacility = safe(params.requestedLoanAmount, 0);
  const totalDebt = existingDebt + newFacility;

  if (totalDebt === 0) return 0;

  // Get appropriate rates
  // existingDebtRate is the rate on existing debt
  // proposedPricing or interestRate is the rate on new facility
  const existingRate = safe(params.existingDebtRate, safe(params.interestRate, 0));
  const newRate = safe(params.proposedPricing, safe(params.interestRate, 0));

  // If only one type of debt, return that rate
  if (existingDebt === 0) return newRate;
  if (newFacility === 0) return existingRate;

  // Weighted average
  return (existingDebt * existingRate + newFacility * newRate) / totalDebt;
}

/**
 * Calculate net debt
 * Net Debt = Total Debt - Cash
 *
 * @param {Object} params - Financial parameters object
 * @param {number} cash - Cash balance (optional, defaults to params.openingCash or 0)
 * @returns {number} Net debt amount
 */
export function getNetDebt(params, cash = null) {
  if (!params) return 0;

  const totalDebt = getTotalDebt(params);
  const cashBalance = cash !== null ? cash : safe(params.openingCash, 0);

  return totalDebt - cashBalance;
}

/**
 * Get the appropriate interest rate for calculations based on debt type
 * Handles: existing only, new only, both, and multi-tranche scenarios
 *
 * @param {Object} params - Financial parameters object
 * @returns {Object} Rate information { rate, source, description }
 */
export function getApplicableRate(params) {
  if (!params) return { rate: 0, source: 'none', description: 'No parameters available' };

  const breakdown = getDebtBreakdown(params);

  if (!breakdown.hasAnyDebt) {
    return { rate: 0, source: 'none', description: 'No debt configured' };
  }

  if (breakdown.hasMultipleTranches) {
    const blendedRate = getBlendedRate(params);
    return {
      rate: blendedRate,
      source: 'multi-tranche',
      description: `Blended rate across ${breakdown.trancheCount} tranches`
    };
  }

  if (breakdown.hasExistingDebt && breakdown.hasNewFacility) {
    const blendedRate = getBlendedRate(params);
    return {
      rate: blendedRate,
      source: 'blended',
      description: 'Weighted average of existing and new facility rates'
    };
  }

  if (breakdown.hasExistingDebt) {
    const rate = safe(params.existingDebtRate, safe(params.interestRate, 0));
    return {
      rate,
      source: 'existing',
      description: 'Existing debt rate'
    };
  }

  // Only new facility
  const rate = safe(params.proposedPricing, safe(params.interestRate, 0));
  return {
    rate,
    source: 'new-facility',
    description: 'Proposed new facility rate'
  };
}

/**
 * Check if projection has meaningful debt (uses projection data, not params)
 * This is useful for checking debt in specific rows/years
 *
 * @param {Object} projection - Projection object with rows array
 * @returns {boolean} True if any year has debt
 */
export function projectionHasDebt(projection) {
  if (!projection?.rows || projection.rows.length === 0) return false;

  // Check if any year has debt balance > 0
  const hasPositiveDebt = projection.rows.some(row =>
    safe(row.grossDebt, 0) > 0 ||
    safe(row.debtBalance, 0) > 0 ||
    safe(row.endingBalance, 0) > 0
  );

  // Check if total debt repaid or interest paid > 0
  const hasDebtActivity =
    safe(projection.totalDebtRepaid, 0) > 0 ||
    safe(projection.totalInterestPaid, 0) > 0;

  return hasPositiveDebt || hasDebtActivity;
}

/**
 * Safe division to prevent Infinity and NaN
 *
 * @param {number} numerator - Numerator
 * @param {number} denominator - Denominator
 * @param {number} defaultValue - Value to return if division not possible
 * @returns {number}
 */
export function safeDivide(numerator, denominator, defaultValue = 0) {
  const num = safe(numerator, 0);
  const denom = safe(denominator, 0);

  if (denom === 0) return defaultValue;

  const result = num / denom;
  return Number.isFinite(result) ? result : defaultValue;
}
