/**
 * Shared debt helper functions
 *
 * This file now re-exports from the centralized debtCalculationService.js
 * for backward compatibility. All new code should import directly from
 * debtCalculationService.js instead.
 *
 * CRITICAL PRINCIPLES:
 * 1. "Current Request" = ONLY the new facility being requested (requestedLoanAmount)
 * 2. When hasExistingDebt toggle is OFF, treat existing debt as 0 everywhere
 * 3. When hasExistingDebt toggle is ON, include existing debt in ALL ratio calculations
 * 4. Total Debt = Effective Existing Debt + New Facility
 */

// Re-export from the centralized service
export {
  // Main calculation function
  calculateAllDebtMetrics,
  getDebtSummary,

  // Scenario detection
  getDebtScenario,

  // Core debt calculations
  calculatePMT,
  calculateAnnualDebtService,

  // Toggle-aware getters
  getEffectiveExistingDebt,
  getNewFacilityAmount,

  // Total debt functions (note: getTotalDebt is defined locally with projection support)
  getTotalDebtFromParams,

  // Debt service functions
  getTotalDebtService,

  // Capacity calculations
  calculateMaxSustainableDebt,
  getAvailableDebtCapacity,

  // Boolean checks
  hasAnyDebt,
  hasExistingDebt,
  hasNewFacility,
} from './debtCalculationService';

// ============================================================================
// ADDITIONAL LEGACY FUNCTIONS
// These are kept for backward compatibility with existing code
// ============================================================================

import {
  calculateAllDebtMetrics,
  calculatePMT,
  getDebtScenario,
} from './debtCalculationService';

/**
 * Get total debt from projection and params
 * Legacy function - now uses centralized service
 *
 * @param {Object} projection - The projection data with multiTrancheInfo, finalDebt, etc.
 * @param {Object} params - The params object with debt configuration
 * @returns {number} Total debt amount
 */
export function getTotalDebt(projection, params) {
  // PRIORITY 1: Use multiTrancheInfo from projection (most accurate for multi-tranche)
  // But we still need to respect toggle for existing debt component
  if (projection?.multiTrancheInfo?.totalDebt > 0) {
    // If toggle is OFF, we need to subtract existing debt portion
    if (params && params.hasExistingDebt !== true) {
      const existingInTranches = projection.multiTrancheInfo.tranches
        ?.filter(t => t.isOpeningDebt || t.name?.toLowerCase().includes('existing'))
        ?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      return projection.multiTrancheInfo.totalDebt - existingInTranches;
    }
    return projection.multiTrancheInfo.totalDebt;
  }

  // PRIORITY 2: Use finalDebt from projection (but adjust for toggle)
  if (projection?.finalDebt > 0) {
    if (params && params.hasExistingDebt !== true) {
      // Subtract any existing debt since toggle is OFF
      const existingDebtValue = (params.openingDebt || 0) || (params.existingDebtAmount || 0);
      return Math.max(0, projection.finalDebt - existingDebtValue);
    }
    return projection.finalDebt;
  }

  // PRIORITY 3: Calculate from params using centralized service
  return calculateAllDebtMetrics(params).totalDebt;
}

/**
 * Get existing debt service (RESPECTS toggle)
 * Legacy function - now uses centralized service
 *
 * @param {Object} params - The params object
 * @returns {number} Annual debt service for existing debt
 */
export function getExistingDebtService(params) {
  return calculateAllDebtMetrics(params).existingDebtService;
}

/**
 * Get new facility debt service
 * Legacy function - now uses centralized service
 *
 * @param {Object} params - The params object
 * @returns {number} Annual debt service for new facility
 */
export function getNewFacilityDebtService(params) {
  return calculateAllDebtMetrics(params).newFacilityService;
}

/**
 * Calculate DSCR using TOTAL debt service
 * Legacy function - now uses centralized service
 *
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} DSCR (or 999 if no debt service)
 */
export function calculateDSCR(ebitda, params) {
  return calculateAllDebtMetrics(params, ebitda).dscr;
}

/**
 * Calculate ICR using TOTAL interest
 * Legacy function - now uses centralized service
 *
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} ICR (or 999 if no interest)
 */
export function calculateICR(ebitda, params) {
  return calculateAllDebtMetrics(params, ebitda).icr;
}

/**
 * Calculate Leverage using TOTAL debt
 * Legacy function - now uses centralized service
 *
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} Leverage ratio
 */
export function calculateLeverage(ebitda, params) {
  return calculateAllDebtMetrics(params, ebitda).leverage;
}

/**
 * Get existing debt amount (LEGACY - does NOT respect toggle)
 * This function does NOT respect toggle for backwards compatibility
 *
 * @param {Object} params - The params object
 * @returns {number} Raw existing debt amount
 */
export function getExistingDebtAmount(params) {
  if (!params) return 0;
  // NOTE: This is the RAW value, not toggle-aware
  // Use getEffectiveExistingDebt() for toggle-aware version
  return (params.openingDebt || 0) || (params.existingDebtAmount || 0);
}
