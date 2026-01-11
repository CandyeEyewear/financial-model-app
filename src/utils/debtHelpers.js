/**
 * Shared debt helper functions
 *
 * Use these functions EVERYWHERE debt totals are needed to ensure consistency
 * across all components (stress testing, credit analysis, etc.)
 *
 * CRITICAL PRINCIPLES:
 * 1. "Current Request" = ONLY the new facility being requested (requestedLoanAmount)
 * 2. When hasExistingDebt toggle is OFF, treat existing debt as 0 everywhere
 * 3. When hasExistingDebt toggle is ON, include existing debt in ALL ratio calculations
 * 4. Total Debt = Effective Existing Debt + New Facility
 */

// ============================================================================
// CORE TOGGLE-AWARE FUNCTIONS
// ============================================================================

/**
 * Get effective existing debt (RESPECTS hasExistingDebt toggle)
 * If toggle is OFF, returns 0 regardless of field values
 * @param {Object} params - The params object with debt configuration
 * @returns {number} Effective existing debt amount
 */
export function getEffectiveExistingDebt(params) {
  if (!params) return 0;

  // CRITICAL: If toggle is OFF, existing debt is ZERO
  if (params.hasExistingDebt !== true) {
    return 0;
  }

  // Return the existing debt amount (prefer openingDebt, fall back to existingDebtAmount)
  return (params.openingDebt || 0) || (params.existingDebtAmount || 0);
}

/**
 * Get the new facility amount (requested loan)
 * This is ALWAYS just the new facility, never includes existing debt
 * This is what "Current Request" should display
 * @param {Object} params - The params object
 * @returns {number} New facility amount
 */
export function getNewFacilityAmount(params) {
  if (!params) return 0;
  return params.requestedLoanAmount || 0;
}

/**
 * Get total debt (existing + new, respecting toggle)
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

  // PRIORITY 3: Calculate from params (toggle-aware)
  return getTotalDebtFromParams(params);
}

/**
 * Get total debt from params only (when projection not available)
 * RESPECTS hasExistingDebt toggle
 * @param {Object} params - The params object with debt configuration
 * @returns {number} Total debt amount
 */
export function getTotalDebtFromParams(params) {
  if (!params) return 0;

  // Multi-tranche mode - but still respect toggle
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    let total = 0;
    for (const tranche of params.debtTranches) {
      // Skip existing debt tranches if toggle is OFF
      if (params.hasExistingDebt !== true &&
          (tranche.isOpeningDebt || tranche.name?.toLowerCase().includes('existing'))) {
        continue;
      }
      total += tranche.amount || 0;
    }
    return total;
  }

  // Single/dual debt - use toggle-aware helpers
  const existingDebt = getEffectiveExistingDebt(params);
  const newFacility = getNewFacilityAmount(params);

  return existingDebt + newFacility;
}

// ============================================================================
// DEBT SERVICE CALCULATIONS
// ============================================================================

/**
 * Calculate annual debt service for a loan using standard amortization formula
 * @param {number} principal - Loan principal
 * @param {number} rate - Annual interest rate (decimal, e.g., 0.12 for 12%)
 * @param {number} tenorYears - Loan tenor in years
 * @returns {number} Annual debt service payment
 */
export function calculateAnnualDebtService(principal, rate, tenorYears) {
  if (principal <= 0 || tenorYears <= 0) return 0;
  if (rate === 0) return principal / tenorYears;

  const r = rate;
  const n = tenorYears;
  const paymentFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return principal * paymentFactor;
}

/**
 * Get existing debt service (RESPECTS toggle)
 * @param {Object} params - The params object
 * @returns {number} Annual debt service for existing debt
 */
export function getExistingDebtService(params) {
  // If toggle is OFF, existing debt service is ZERO
  if (!params || params.hasExistingDebt !== true) {
    return 0;
  }

  const principal = getEffectiveExistingDebt(params);
  if (principal <= 0) return 0;

  const rate = params.existingDebtRate || params.interestRate || 0.10;
  const tenor = params.existingDebtTenor || params.debtTenorYears || 5;

  return calculateAnnualDebtService(principal, rate, tenor);
}

/**
 * Get new facility debt service
 * @param {Object} params - The params object
 * @returns {number} Annual debt service for new facility
 */
export function getNewFacilityDebtService(params) {
  if (!params) return 0;

  const principal = getNewFacilityAmount(params);
  if (principal <= 0) return 0;

  const rate = params.proposedPricing || params.interestRate || 0.12;
  const tenor = params.proposedTenor || params.debtTenorYears || 5;

  return calculateAnnualDebtService(principal, rate, tenor);
}

/**
 * Get TOTAL debt service (existing + new, RESPECTS toggle)
 * @param {Object} params - The params object
 * @returns {number} Total annual debt service
 */
export function getTotalDebtService(params) {
  const existingService = getExistingDebtService(params);
  const newService = getNewFacilityDebtService(params);
  return existingService + newService;
}

// ============================================================================
// RATIO CALCULATIONS (using TOTAL debt)
// ============================================================================

/**
 * Calculate DSCR using TOTAL debt service
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} DSCR (or 999 if no debt service)
 */
export function calculateDSCR(ebitda, params) {
  const totalDebtService = getTotalDebtService(params);
  if (totalDebtService <= 0) return 999; // No debt = infinite coverage
  return ebitda / totalDebtService;
}

/**
 * Calculate ICR using TOTAL interest
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} ICR (or 999 if no interest)
 */
export function calculateICR(ebitda, params) {
  if (!params) return 999;

  const existingDebt = getEffectiveExistingDebt(params);
  const newFacility = getNewFacilityAmount(params);

  const existingRate = params.existingDebtRate || params.interestRate || 0.10;
  const newRate = params.proposedPricing || params.interestRate || 0.12;

  const totalInterest = (existingDebt * existingRate) + (newFacility * newRate);

  if (totalInterest <= 0) return 999;
  return ebitda / totalInterest;
}

/**
 * Calculate Leverage using TOTAL debt
 * @param {number} ebitda - EBITDA for the period
 * @param {Object} params - The params object
 * @returns {number} Leverage ratio
 */
export function calculateLeverage(ebitda, params) {
  const totalDebt = getTotalDebtFromParams(params);
  if (ebitda <= 0) return 999;
  return totalDebt / ebitda;
}

// ============================================================================
// DEBT CAPACITY CALCULATIONS
// ============================================================================

/**
 * Calculate maximum sustainable debt at target DSCR
 * @param {number} ebitda - EBITDA
 * @param {number} targetDSCR - Target DSCR (e.g., 1.30)
 * @param {number} rate - Interest rate
 * @param {number} tenorYears - Loan tenor
 * @returns {number} Maximum debt principal
 */
export function calculateMaxSustainableDebt(ebitda, targetDSCR, rate, tenorYears) {
  if (ebitda <= 0 || targetDSCR <= 0 || tenorYears <= 0) return 0;

  const maxDebtService = ebitda / targetDSCR;

  // Reverse the debt service formula to get principal
  if (rate === 0) return maxDebtService * tenorYears;

  const r = rate;
  const n = tenorYears;
  const paymentFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  return maxDebtService / paymentFactor;
}

/**
 * Calculate available debt capacity (max minus existing obligations)
 * @param {number} ebitda - EBITDA
 * @param {number} targetDSCR - Target DSCR
 * @param {number} rate - Interest rate for new debt
 * @param {number} tenorYears - Tenor for new debt
 * @param {Object} params - The params object
 * @returns {number} Available capacity for NEW debt
 */
export function getAvailableDebtCapacity(ebitda, targetDSCR, rate, tenorYears, params) {
  const maxDebt = calculateMaxSustainableDebt(ebitda, targetDSCR, rate, tenorYears);
  const existingDebt = getEffectiveExistingDebt(params);

  return Math.max(0, maxDebt - existingDebt);
}

// ============================================================================
// COMPREHENSIVE DEBT SUMMARY
// ============================================================================

/**
 * Get complete debt summary object (toggle-aware)
 * Use this for comprehensive debt analysis in components
 * @param {Object} params - The params object
 * @param {number} ebitda - Current EBITDA
 * @param {number} targetDSCR - Target DSCR (default 1.30)
 * @returns {Object} Complete debt summary
 */
export function getDebtSummary(params, ebitda, targetDSCR = 1.30) {
  const existingDebt = getEffectiveExistingDebt(params);
  const newFacility = getNewFacilityAmount(params);
  const totalDebt = existingDebt + newFacility;

  const existingService = getExistingDebtService(params);
  const newService = getNewFacilityDebtService(params);
  const totalService = existingService + newService;

  const rate = params?.proposedPricing || params?.interestRate || 0.12;
  const tenor = params?.proposedTenor || params?.debtTenorYears || 5;

  const maxSustainable = calculateMaxSustainableDebt(ebitda, targetDSCR, rate, tenor);
  const availableCapacity = Math.max(0, maxSustainable - existingDebt);
  const excessDebt = Math.max(0, newFacility - availableCapacity);
  const capacityUtilization = availableCapacity > 0
    ? (newFacility / availableCapacity) * 100
    : (newFacility > 0 ? 999 : 0);

  return {
    // Toggle status
    hasExistingDebt: params?.hasExistingDebt === true,

    // Amounts (toggle-aware)
    existingDebt,           // Effective existing debt (0 if toggle OFF)
    newFacility,            // This is "Current Request" - ALWAYS just new facility
    totalDebt,              // Combined for ratio calculations

    // Debt Service
    existingDebtService: existingService,
    newFacilityService: newService,
    totalDebtService: totalService,

    // Capacity Analysis
    maxSustainableDebt: maxSustainable,
    availableCapacity,
    excessDebt,
    capacityUtilization,

    // Ratios (using TOTAL debt where applicable)
    dscr: totalService > 0 ? ebitda / totalService : 999,
    icr: calculateICR(ebitda, params),
    leverage: ebitda > 0 ? totalDebt / ebitda : 0,

    // Status flags
    isWithinCapacity: newFacility <= availableCapacity,

    // Formatted for display
    formatted: {
      existingDebt: `J$${(existingDebt / 1000000).toFixed(1)}M`,
      newFacility: `J$${(newFacility / 1000000).toFixed(1)}M`,
      totalDebt: `J$${(totalDebt / 1000000).toFixed(1)}M`,
      maxSustainable: `J$${(maxSustainable / 1000000).toFixed(1)}M`,
      availableCapacity: `J$${(availableCapacity / 1000000).toFixed(1)}M`,
      excessDebt: `J$${(excessDebt / 1000000).toFixed(1)}M`,
    }
  };
}

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================================================

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

  // Check params - but respect toggle for existing debt
  if (params) {
    // New facility always counts
    if ((params.requestedLoanAmount || 0) > 0) return true;

    // Existing debt only counts if toggle is ON
    if (params.hasExistingDebt === true) {
      if ((params.openingDebt || 0) > 0) return true;
      if ((params.existingDebtAmount || 0) > 0) return true;
    }

    // Multi-tranche - check if any tranches exist
    if (params.debtTranches?.some(t => (t.amount || 0) > 0)) return true;
  }

  return false;
}

/**
 * Check if existing debt is configured (RESPECTS toggle)
 * @param {Object} params - The params object
 * @returns {boolean} True if existing debt is active
 */
export function hasExistingDebt(params) {
  if (!params) return false;
  // CRITICAL: Only return true if toggle is ON and there's actual debt
  if (params.hasExistingDebt !== true) return false;
  if ((params.openingDebt || 0) > 0) return true;
  if ((params.existingDebtAmount || 0) > 0) return true;
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
 * Get existing debt amount (LEGACY - use getEffectiveExistingDebt for toggle-aware version)
 * This function does NOT respect toggle for backwards compatibility
 * @param {Object} params - The params object
 * @returns {number} Raw existing debt amount
 */
export function getExistingDebtAmount(params) {
  if (!params) return 0;
  // NOTE: This is the RAW value, not toggle-aware
  // Use getEffectiveExistingDebt() for toggle-aware version
  return (params.openingDebt || 0) || (params.existingDebtAmount || 0);
}
