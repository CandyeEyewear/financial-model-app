/**
 * Shared debt helper functions
 *
 * Use these functions EVERYWHERE debt totals are needed to ensure consistency
 * across all components (stress testing, credit analysis, etc.)
 */

/**
 * Get total debt from projection (preferred) or params (fallback)
 * @param {Object} projection - The projection data with multiTrancheInfo, finalDebt, etc.
 * @param {Object} params - The params object with debt configuration
 * @returns {number} Total debt amount
 */
export function getTotalDebt(projection, params) {
  // PRIORITY 1: Use multiTrancheInfo from projection (most accurate)
  if (projection?.multiTrancheInfo?.totalDebt > 0) {
    return projection.multiTrancheInfo.totalDebt;
  }

  // PRIORITY 2: Use finalDebt from projection
  if (projection?.finalDebt > 0) {
    return projection.finalDebt;
  }

  // PRIORITY 3: Calculate from params (fallback)
  return getTotalDebtFromParams(params);
}

/**
 * Get total debt from params only (when projection not available)
 * @param {Object} params - The params object with debt configuration
 * @returns {number} Total debt amount
 */
export function getTotalDebtFromParams(params) {
  if (!params) return 0;

  // Multi-tranche mode
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    return params.debtTranches.reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  // Single debt - check ALL possible field names
  // Note: Must use parentheses to avoid operator precedence bugs
  const existingDebt = (params.openingDebt || 0) + (params.existingDebtAmount || 0);
  const newFacility = params.requestedLoanAmount || 0;

  // If openingDebt and existingDebtAmount are the same field (just named differently),
  // prefer openingDebt
  const finalExistingDebt = params.openingDebt > 0 ? params.openingDebt : (params.existingDebtAmount || 0);

  return finalExistingDebt + newFacility;
}

/**
 * Check if there's ANY debt configured
 * @param {Object} projection - The projection data
 * @param {Object} params - The params object
 * @returns {boolean} True if any debt exists
 */
export function hasAnyDebt(projection, params) {
  // Check projection first
  if (projection) {
    if ((projection.multiTrancheInfo?.totalDebt || 0) > 0) return true;
    if ((projection.finalDebt || 0) > 0) return true;
    if (projection.rows?.some(r => (r.grossDebt || r.debtBalance || 0) > 0)) return true;
  }

  // Check params
  if (params) {
    if ((params.openingDebt || 0) > 0) return true;
    if ((params.existingDebtAmount || 0) > 0) return true;
    if ((params.requestedLoanAmount || 0) > 0) return true;
    if (params.hasExistingDebt === true) return true;
    if (params.debtTranches?.some(t => (t.amount || 0) > 0)) return true;
  }

  return false;
}

/**
 * Check if existing debt is configured
 * @param {Object} params - The params object
 * @returns {boolean} True if existing debt is configured
 */
export function hasExistingDebt(params) {
  if (!params) return false;
  // Check ALL possible existing debt indicators
  if ((params.openingDebt || 0) > 0) return true;
  if ((params.existingDebtAmount || 0) > 0) return true;
  if (params.hasExistingDebt === true) return true;
  return false;
}

/**
 * Check if new facility is configured
 * @param {Object} params - The params object
 * @returns {boolean} True if new facility is configured
 */
export function hasNewFacility(params) {
  if (!params) return false;
  return (params.requestedLoanAmount || 0) > 0;
}

/**
 * Get existing debt amount (not including new facility)
 * @param {Object} params - The params object
 * @returns {number} Existing debt amount
 */
export function getExistingDebtAmount(params) {
  if (!params) return 0;
  // Prefer openingDebt, fall back to existingDebtAmount
  return (params.openingDebt || 0) || (params.existingDebtAmount || 0);
}

/**
 * Get new facility amount
 * @param {Object} params - The params object
 * @returns {number} New facility amount
 */
export function getNewFacilityAmount(params) {
  if (!params) return 0;
  return params.requestedLoanAmount || 0;
}
