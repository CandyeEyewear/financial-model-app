/**
 * CENTRALIZED DEBT CALCULATION SERVICE
 * =====================================
 *
 * This is the SINGLE SOURCE OF TRUTH for all debt calculations.
 * ALL components must use this service - NO local debt calculations allowed.
 *
 * Key Principles:
 * 1. Toggle OFF = Existing debt is ZERO everywhere
 * 2. When only new facility exists, use NEW facility params (rate, tenor)
 * 3. When only existing debt exists, use EXISTING params (rate, tenor)
 * 4. When both exist, calculate EACH separately and SUM
 */

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate annual debt service using PMT formula
 * This is the fundamental building block - all debt service flows through here
 *
 * @param {number} principal - Loan principal
 * @param {number} annualRate - Annual interest rate (decimal, e.g., 0.12 for 12%)
 * @param {number} tenorYears - Loan tenor in years
 * @param {string} amortizationType - 'amortizing', 'interest_only', 'interestOnly', or 'bullet'
 * @returns {number} Annual debt service payment
 */
export function calculatePMT(principal, annualRate, tenorYears, amortizationType = 'amortizing') {
  // Validate inputs
  if (!principal || principal <= 0) return 0;
  if (!tenorYears || tenorYears <= 0) return 0;

  // Interest-only: just pay interest each year
  if (amortizationType === 'interest_only' || amortizationType === 'interestOnly' || amortizationType === 'interest-only') {
    return principal * (annualRate || 0);
  }

  // Bullet: interest only, principal at end (for annual service, just interest)
  if (amortizationType === 'bullet') {
    return principal * (annualRate || 0);
  }

  // Zero rate: just divide principal by years
  if (!annualRate || annualRate === 0) {
    return principal / tenorYears;
  }

  // Standard amortizing loan - PMT formula
  // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
  const r = annualRate;
  const n = tenorYears;
  const numerator = r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;

  return principal * (numerator / denominator);
}

/**
 * Determine the debt scenario based on toggle and amounts
 *
 * @param {Object} params - The financial model parameters
 * @returns {'new_only'|'existing_only'|'both'|'none'} The debt scenario
 */
export function getDebtScenario(params) {
  if (!params) return 'none';

  // Check toggle state
  const toggleOn = params.hasExistingDebt === true;

  // Check amounts (with fallbacks)
  const existingAmount = params.existingDebtAmount || params.openingDebt || 0;
  const newAmount = params.requestedLoanAmount || 0;

  // Effective existing (respects toggle)
  const effectiveExisting = toggleOn ? existingAmount : 0;

  // Determine scenario
  const hasEffectiveExisting = effectiveExisting > 0;
  const hasNew = newAmount > 0;

  if (hasNew && hasEffectiveExisting) return 'both';
  if (hasNew && !hasEffectiveExisting) return 'new_only';
  if (!hasNew && hasEffectiveExisting) return 'existing_only';
  return 'none';
}

/**
 * Extract and normalize parameters for existing debt
 *
 * @param {Object} params - The financial model parameters
 * @returns {Object} Normalized existing debt parameters
 */
function getExistingDebtParams(params) {
  return {
    principal: params.existingDebtAmount || params.openingDebt || 0,
    rate: normalizeRate(params.existingDebtRate || params.openingDebtRate || 0.10),
    tenor: params.existingDebtTenor || params.openingDebtTenor || params.existingDebtRemainingTenor || 5,
    amortizationType: params.existingDebtAmortizationType || params.openingDebtAmortizationType || 'amortizing',
    name: 'Existing Debt',
  };
}

/**
 * Extract and normalize parameters for new facility
 *
 * @param {Object} params - The financial model parameters
 * @returns {Object} Normalized new facility parameters
 */
function getNewFacilityParams(params) {
  return {
    principal: params.requestedLoanAmount || 0,
    rate: normalizeRate(params.proposedPricing || params.interestRate || params.newFacilityRate || 0.12),
    tenor: params.proposedTenor || params.debtTenorYears || params.newFacilityTenor || 5,
    amortizationType: params.facilityAmortizationType || params.amortizationType || params.newFacilityAmortizationType || 'amortizing',
    interestOnlyYears: params.interestOnlyPeriod || params.interestOnlyYears || 0,
    name: 'New Facility',
  };
}

/**
 * Normalize rate to decimal (handle both 0.12 and 12 formats)
 *
 * @param {number} rate - Interest rate (could be 0.12 or 12)
 * @returns {number} Rate as decimal (0.12)
 */
function normalizeRate(rate) {
  if (!rate) return 0;
  // If rate > 1, assume it's a percentage (e.g., 12 means 12%)
  if (rate > 1) return rate / 100;
  return rate;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * MASTER FUNCTION: Calculate ALL debt metrics
 * This is what every component should call
 *
 * @param {Object} params - The financial model parameters
 * @param {number} ebitda - EBITDA for ratio calculations (optional, defaults from params)
 * @returns {Object} Complete debt calculation results
 */
export function calculateAllDebtMetrics(params, ebitda = null) {
  // Get EBITDA from params if not provided
  const effectiveEbitda = ebitda || params?.ebitda || params?.annualEbitda || 0;

  // Determine scenario
  const scenario = getDebtScenario(params);

  // Initialize result object
  const result = {
    // Scenario info
    scenario,
    hasExistingDebtToggle: params?.hasExistingDebt === true,

    // Raw amounts from params
    rawExistingDebt: params?.existingDebtAmount || params?.openingDebt || 0,
    rawNewFacility: params?.requestedLoanAmount || 0,

    // Effective amounts (respecting toggle)
    effectiveExistingDebt: 0,
    effectiveNewFacility: 0,
    totalDebt: 0,

    // Debt service
    existingDebtService: 0,
    newFacilityService: 0,
    totalDebtService: 0,

    // Interest (for ICR)
    existingInterest: 0,
    newFacilityInterest: 0,
    totalInterest: 0,

    // Ratios
    dscr: 0,
    icr: 0,
    leverage: 0,

    // Parameters used (for transparency)
    existingParams: null,
    newFacilityParams: null,

    // Tranches for multi-tranche display
    tranches: [],

    // Blended rate (when both exist)
    blendedRate: 0,

    // EBITDA used
    ebitda: effectiveEbitda,

    // Capacity calculations
    maxSustainableDebt: 0,
    availableCapacity: 0,
    excessDebt: 0,
    capacityUtilization: 0,
    isWithinCapacity: true,
  };

  // Handle each scenario
  switch (scenario) {
    case 'new_only':
      calculateNewFacilityOnly(params, result);
      break;
    case 'existing_only':
      calculateExistingDebtOnly(params, result);
      break;
    case 'both':
      calculateBothDebts(params, result);
      break;
    case 'none':
    default:
      // No debt - all values stay at 0
      break;
  }

  // Calculate ratios (same logic for all scenarios)
  calculateRatios(result, effectiveEbitda);

  // Calculate capacity
  calculateCapacity(result, effectiveEbitda, params);

  // Add formatted values for display
  result.formatted = formatValues(result);

  // Log for debugging (can be disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    logCalculation(result);
  }

  return result;
}

// ============================================
// SCENARIO HANDLERS
// ============================================

/**
 * Calculate debt metrics when only new facility exists
 */
function calculateNewFacilityOnly(params, result) {
  const newParams = getNewFacilityParams(params);

  result.newFacilityParams = newParams;
  result.effectiveNewFacility = newParams.principal;
  result.totalDebt = newParams.principal;

  // Calculate debt service
  result.newFacilityService = calculatePMT(
    newParams.principal,
    newParams.rate,
    newParams.tenor,
    newParams.amortizationType
  );
  result.totalDebtService = result.newFacilityService;

  // Calculate interest
  result.newFacilityInterest = newParams.principal * newParams.rate;
  result.totalInterest = result.newFacilityInterest;

  // Blended rate is just the new facility rate
  result.blendedRate = newParams.rate;

  // Single tranche
  result.tranches = [{
    name: newParams.name,
    principal: newParams.principal,
    rate: newParams.rate,
    tenor: newParams.tenor,
    amortizationType: newParams.amortizationType,
    annualService: result.newFacilityService,
    annualInterest: result.newFacilityInterest,
  }];
}

/**
 * Calculate debt metrics when only existing debt exists
 */
function calculateExistingDebtOnly(params, result) {
  const existingParams = getExistingDebtParams(params);

  result.existingParams = existingParams;
  result.effectiveExistingDebt = existingParams.principal;
  result.totalDebt = existingParams.principal;

  // Calculate debt service
  result.existingDebtService = calculatePMT(
    existingParams.principal,
    existingParams.rate,
    existingParams.tenor,
    existingParams.amortizationType
  );
  result.totalDebtService = result.existingDebtService;

  // Calculate interest
  result.existingInterest = existingParams.principal * existingParams.rate;
  result.totalInterest = result.existingInterest;

  // Blended rate is just the existing debt rate
  result.blendedRate = existingParams.rate;

  // Single tranche
  result.tranches = [{
    name: existingParams.name,
    principal: existingParams.principal,
    rate: existingParams.rate,
    tenor: existingParams.tenor,
    amortizationType: existingParams.amortizationType,
    annualService: result.existingDebtService,
    annualInterest: result.existingInterest,
  }];
}

/**
 * Calculate debt metrics when both existing and new debt exist
 */
function calculateBothDebts(params, result) {
  const existingParams = getExistingDebtParams(params);
  const newParams = getNewFacilityParams(params);

  result.existingParams = existingParams;
  result.newFacilityParams = newParams;

  result.effectiveExistingDebt = existingParams.principal;
  result.effectiveNewFacility = newParams.principal;
  result.totalDebt = existingParams.principal + newParams.principal;

  // Calculate EACH debt service separately
  result.existingDebtService = calculatePMT(
    existingParams.principal,
    existingParams.rate,
    existingParams.tenor,
    existingParams.amortizationType
  );

  result.newFacilityService = calculatePMT(
    newParams.principal,
    newParams.rate,
    newParams.tenor,
    newParams.amortizationType
  );

  // SUM for total
  result.totalDebtService = result.existingDebtService + result.newFacilityService;

  // Calculate interest
  result.existingInterest = existingParams.principal * existingParams.rate;
  result.newFacilityInterest = newParams.principal * newParams.rate;
  result.totalInterest = result.existingInterest + result.newFacilityInterest;

  // Blended rate (weighted average)
  if (result.totalDebt > 0) {
    result.blendedRate =
      ((existingParams.principal * existingParams.rate) +
       (newParams.principal * newParams.rate)) / result.totalDebt;
  }

  // Two tranches
  result.tranches = [
    {
      name: existingParams.name,
      principal: existingParams.principal,
      rate: existingParams.rate,
      tenor: existingParams.tenor,
      amortizationType: existingParams.amortizationType,
      annualService: result.existingDebtService,
      annualInterest: result.existingInterest,
    },
    {
      name: newParams.name,
      principal: newParams.principal,
      rate: newParams.rate,
      tenor: newParams.tenor,
      amortizationType: newParams.amortizationType,
      annualService: result.newFacilityService,
      annualInterest: result.newFacilityInterest,
    }
  ];
}

// ============================================
// RATIO CALCULATIONS
// ============================================

/**
 * Calculate DSCR, ICR, and Leverage ratios
 */
function calculateRatios(result, ebitda) {
  // DSCR = EBITDA / Total Debt Service
  if (result.totalDebtService > 0 && ebitda > 0) {
    result.dscr = ebitda / result.totalDebtService;
  } else if (result.totalDebtService === 0) {
    result.dscr = 999; // No debt service = infinite coverage
  }

  // ICR = EBITDA / Total Interest
  if (result.totalInterest > 0 && ebitda > 0) {
    result.icr = ebitda / result.totalInterest;
  } else if (result.totalInterest === 0) {
    result.icr = 999;
  }

  // Leverage = Total Debt / EBITDA
  if (ebitda > 0 && result.totalDebt > 0) {
    result.leverage = result.totalDebt / ebitda;
  }
}

// ============================================
// CAPACITY CALCULATIONS
// ============================================

/**
 * Calculate debt capacity metrics
 */
function calculateCapacity(result, ebitda, params) {
  const targetDSCR = params?.targetDSCR || params?.dscrThreshold || params?.minDSCR || 1.30;

  // Use the active rate and tenor for capacity calculation
  const rate = result.blendedRate || 0.12;
  const tenor = result.newFacilityParams?.tenor || result.existingParams?.tenor || 5;

  if (ebitda > 0 && rate > 0 && tenor > 0) {
    // Max debt service = EBITDA / Target DSCR
    const maxDebtService = ebitda / targetDSCR;

    // Reverse PMT to get max principal
    // Principal = PMT / [(r(1+r)^n) / ((1+r)^n - 1)]
    const r = rate;
    const n = tenor;
    const paymentFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

    result.maxSustainableDebt = maxDebtService / paymentFactor;
  }

  // Available capacity = Max - Existing obligations
  result.availableCapacity = Math.max(0, result.maxSustainableDebt - result.effectiveExistingDebt);

  // Excess debt = How much over capacity
  result.excessDebt = Math.max(0, result.effectiveNewFacility - result.availableCapacity);

  // Capacity utilization
  if (result.availableCapacity > 0) {
    result.capacityUtilization = (result.effectiveNewFacility / result.availableCapacity) * 100;
  } else if (result.effectiveNewFacility > 0) {
    result.capacityUtilization = 999; // Over capacity
  }

  // Is within capacity?
  result.isWithinCapacity = result.effectiveNewFacility <= result.availableCapacity;
}

// ============================================
// FORMATTING
// ============================================

/**
 * Format values for display
 */
function formatValues(result) {
  const fmt = (value) => `J$${(value / 1000000).toFixed(1)}M`;
  const fmtRate = (rate) => `${(rate * 100).toFixed(2)}%`;
  const fmtRatio = (ratio) => ratio >= 100 ? 'N/A' : `${ratio.toFixed(2)}x`;

  return {
    existingDebt: fmt(result.effectiveExistingDebt),
    newFacility: fmt(result.effectiveNewFacility),
    totalDebt: fmt(result.totalDebt),

    existingDebtService: fmt(result.existingDebtService),
    newFacilityService: fmt(result.newFacilityService),
    totalDebtService: fmt(result.totalDebtService),

    dscr: fmtRatio(result.dscr),
    icr: fmtRatio(result.icr),
    leverage: fmtRatio(result.leverage),

    blendedRate: fmtRate(result.blendedRate),

    maxSustainableDebt: fmt(result.maxSustainableDebt),
    availableCapacity: fmt(result.availableCapacity),
    excessDebt: fmt(result.excessDebt),
    capacityUtilization: `${Math.min(result.capacityUtilization, 999).toFixed(0)}%`,
  };
}

// ============================================
// DEBUG LOGGING
// ============================================

/**
 * Log calculation results for debugging
 */
function logCalculation(result) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('CENTRALIZED DEBT CALCULATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Scenario:', result.scenario);
  console.log('Toggle ON:', result.hasExistingDebtToggle);
  console.log('───────────────────────────────────────────────────────────');
  console.log('Effective Existing Debt:', result.formatted.existingDebt);
  console.log('Effective New Facility:', result.formatted.newFacility);
  console.log('Total Debt:', result.formatted.totalDebt);
  console.log('───────────────────────────────────────────────────────────');
  console.log('Existing Debt Service:', result.formatted.existingDebtService);
  console.log('New Facility Service:', result.formatted.newFacilityService);
  console.log('TOTAL Debt Service:', result.formatted.totalDebtService);
  console.log('───────────────────────────────────────────────────────────');
  console.log('DSCR:', result.formatted.dscr);
  console.log('ICR:', result.formatted.icr);
  console.log('Leverage:', result.formatted.leverage);
  console.log('───────────────────────────────────────────────────────────');
  console.log('Tranches:', result.tranches.length);
  result.tranches.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.name}: ${(t.principal/1e6).toFixed(1)}M @ ${(t.rate*100).toFixed(1)}% for ${t.tenor}yr = ${(t.annualService/1e6).toFixed(2)}M/yr`);
  });
  console.log('═══════════════════════════════════════════════════════════');
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

/**
 * Get total debt from params
 * @param {Object} params - The financial model parameters
 * @returns {number} Total debt amount
 */
export const getTotalDebt = (params) => calculateAllDebtMetrics(params).totalDebt;

/**
 * Get total debt service from params
 * @param {Object} params - The financial model parameters
 * @returns {number} Total annual debt service
 */
export const getTotalDebtService = (params) => calculateAllDebtMetrics(params).totalDebtService;

/**
 * Get DSCR from params and EBITDA
 * @param {Object} params - The financial model parameters
 * @param {number} ebitda - EBITDA value
 * @returns {number} DSCR ratio
 */
export const getDSCR = (params, ebitda) => calculateAllDebtMetrics(params, ebitda).dscr;

/**
 * Get ICR from params and EBITDA
 * @param {Object} params - The financial model parameters
 * @param {number} ebitda - EBITDA value
 * @returns {number} ICR ratio
 */
export const getICR = (params, ebitda) => calculateAllDebtMetrics(params, ebitda).icr;

/**
 * Get leverage from params and EBITDA
 * @param {Object} params - The financial model parameters
 * @param {number} ebitda - EBITDA value
 * @returns {number} Leverage ratio
 */
export const getLeverage = (params, ebitda) => calculateAllDebtMetrics(params, ebitda).leverage;

/**
 * Get effective existing debt (respects toggle)
 * @param {Object} params - The financial model parameters
 * @returns {number} Effective existing debt amount
 */
export const getEffectiveExistingDebt = (params) => calculateAllDebtMetrics(params).effectiveExistingDebt;

/**
 * Get new facility amount
 * @param {Object} params - The financial model parameters
 * @returns {number} New facility amount
 */
export const getNewFacilityAmount = (params) => calculateAllDebtMetrics(params).effectiveNewFacility;

// For backward compatibility with old function names
export const getTotalDebtFromParams = getTotalDebt;
export const getDebtSummary = calculateAllDebtMetrics;

// ============================================
// ADDITIONAL HELPER FUNCTIONS
// ============================================

/**
 * Check if any debt is configured
 * @param {Object} params - The financial model parameters
 * @returns {boolean} True if any debt exists
 */
export function hasAnyDebt(params) {
  const scenario = getDebtScenario(params);
  return scenario !== 'none';
}

/**
 * Check if existing debt is active (toggle ON and amount > 0)
 * @param {Object} params - The financial model parameters
 * @returns {boolean} True if existing debt is active
 */
export function hasExistingDebt(params) {
  if (!params) return false;
  if (params.hasExistingDebt !== true) return false;
  const amount = params.existingDebtAmount || params.openingDebt || 0;
  return amount > 0;
}

/**
 * Check if new facility is configured
 * @param {Object} params - The financial model parameters
 * @returns {boolean} True if new facility exists
 */
export function hasNewFacility(params) {
  if (!params) return false;
  return (params.requestedLoanAmount || 0) > 0;
}

/**
 * Calculate annual debt service using standard PMT formula
 * Exported for backward compatibility with debtHelpers
 * @param {number} principal - Loan principal
 * @param {number} rate - Annual interest rate (decimal)
 * @param {number} tenorYears - Loan tenor in years
 * @returns {number} Annual debt service payment
 */
export function calculateAnnualDebtService(principal, rate, tenorYears) {
  return calculatePMT(principal, rate, tenorYears, 'amortizing');
}

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
  const debtMetrics = calculateAllDebtMetrics(params, ebitda);

  return Math.max(0, maxDebt - debtMetrics.effectiveExistingDebt);
}
