// utils/valuationCalculations.js

/**
 * Calculate Cost of Equity using CAPM
 * Cost of Equity = Risk-Free Rate + Beta × (Market Risk Premium)
 * 
 * @param {number} riskFreeRate - Risk-free rate (e.g., 0.03 for 3%)
 * @param {number} beta - Stock's beta coefficient
 * @param {number} marketRiskPremium - Market risk premium (e.g., 0.06 for 6%)
 * @returns {number} Cost of equity as a decimal
 * @throws {Error} If inputs are invalid
 */
export function calculateCostOfEquity(riskFreeRate, beta, marketRiskPremium) {
  if (typeof riskFreeRate !== 'number' || riskFreeRate < 0) {
    throw new Error(`Invalid riskFreeRate: ${riskFreeRate}. Must be a non-negative number.`);
  }
  if (typeof beta !== 'number') {
    throw new Error(`Invalid beta: ${beta}. Must be a number.`);
  }
  if (typeof marketRiskPremium !== 'number' || marketRiskPremium < 0) {
    throw new Error(`Invalid marketRiskPremium: ${marketRiskPremium}. Must be a non-negative number.`);
  }
  
  return riskFreeRate + (beta * marketRiskPremium);
}

/**
 * Calculate After-Tax Cost of Debt
 * After-Tax Cost of Debt = Interest Rate × (1 - Tax Rate)
 * 
 * @param {number} interestRate - Pre-tax cost of debt
 * @param {number} taxRate - Corporate tax rate (e.g., 0.21 for 21%)
 * @returns {number} After-tax cost of debt
 * @throws {Error} If inputs are invalid
 */
export function calculateAfterTaxCostOfDebt(interestRate, taxRate) {
  if (typeof interestRate !== 'number' || interestRate < 0) {
    throw new Error(`Invalid interestRate: ${interestRate}. Must be a non-negative number.`);
  }
  if (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 1) {
    throw new Error(`Invalid taxRate: ${taxRate}. Must be between 0 and 1.`);
  }
  
  return interestRate * (1 - taxRate);
}

/**
 * Calculate WACC (Weighted Average Cost of Capital)
 * WACC = (E/V × Cost of Equity) + (D/V × After-Tax Cost of Debt)
 * Where: E = Market value of equity, D = Market value of debt, V = E + D
 * 
 * @param {Object} params - WACC calculation parameters
 * @param {number} params.equityValue - Market value of equity
 * @param {number} params.debtValue - Market value of debt
 * @param {number} params.costOfEquity - Cost of equity (decimal)
 * @param {number} params.afterTaxCostOfDebt - After-tax cost of debt (decimal)
 * @returns {number} WACC as a decimal
 * @throws {Error} If inputs are invalid
 */
export function calculateWACC(params) {
  const {
    equityValue,
    debtValue,
    costOfEquity,
    afterTaxCostOfDebt
  } = params;
  
  // Validation
  if (typeof equityValue !== 'number' || equityValue < 0) {
    throw new Error(`Invalid equityValue: ${equityValue}. Must be non-negative.`);
  }
  if (typeof debtValue !== 'number' || debtValue < 0) {
    throw new Error(`Invalid debtValue: ${debtValue}. Must be non-negative.`);
  }
  if (typeof costOfEquity !== 'number' || costOfEquity < 0) {
    throw new Error(`Invalid costOfEquity: ${costOfEquity}. Must be non-negative.`);
  }
  if (typeof afterTaxCostOfDebt !== 'number' || afterTaxCostOfDebt < 0) {
    throw new Error(`Invalid afterTaxCostOfDebt: ${afterTaxCostOfDebt}. Must be non-negative.`);
  }
  
  const totalValue = equityValue + debtValue;
  
  if (totalValue === 0) {
    console.warn('WACC: Total capital value is zero. Returning 0.');
    return 0;
  }
  
  const equityWeight = equityValue / totalValue;
  const debtWeight = debtValue / totalValue;
  
  return (equityWeight * costOfEquity) + (debtWeight * afterTaxCostOfDebt);
}

/**
 * Calculate Terminal Value using Perpetuity Growth Method (Gordon Growth Model)
 * Terminal Value = FCF(final year) × (1 + g) / (WACC - g)
 * 
 * @param {number} finalYearFCF - Free cash flow in final projection year
 * @param {number} wacc - Weighted average cost of capital
 * @param {number} terminalGrowthRate - Perpetual growth rate (must be < WACC)
 * @returns {number} Terminal value
 * @throws {Error} If WACC <= growth rate or inputs invalid
 */
export function calculateTerminalValuePerpetual(finalYearFCF, wacc, terminalGrowthRate) {
  // Validation
  if (typeof finalYearFCF !== 'number') {
    throw new Error(`Invalid finalYearFCF: ${finalYearFCF}. Must be a number.`);
  }
  if (typeof wacc !== 'number' || wacc <= 0) {
    throw new Error(`Invalid wacc: ${wacc}. Must be positive.`);
  }
  if (typeof terminalGrowthRate !== 'number') {
    throw new Error(`Invalid terminalGrowthRate: ${terminalGrowthRate}. Must be a number.`);
  }
  
  // Critical: WACC must exceed growth rate
  if (wacc <= terminalGrowthRate) {
    throw new Error(
      `WACC (${(wacc * 100).toFixed(2)}%) must be greater than terminal growth rate (${(terminalGrowthRate * 100).toFixed(2)}%). ` +
      `Current difference: ${((wacc - terminalGrowthRate) * 100).toFixed(4)}%`
    );
  }
  
  // Warn if growth rate seems unrealistic
  if (terminalGrowthRate > 0.05) {
    console.warn(`Terminal growth rate of ${(terminalGrowthRate * 100).toFixed(2)}% seems high. Consider using < 5%.`);
  }
  if (terminalGrowthRate < 0) {
    console.warn(`Negative terminal growth rate: ${(terminalGrowthRate * 100).toFixed(2)}%. Ensure this is intentional.`);
  }
  
  const terminalValue = (finalYearFCF * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
  
  // Sanity check
  if (!isFinite(terminalValue)) {
    throw new Error('Terminal value calculation resulted in non-finite number.');
  }
  
  return terminalValue;
}

/**
 * Calculate Terminal Value using Exit Multiple Method
 * Terminal Value = Final Year EBITDA × Exit Multiple
 * 
 * @param {number} finalYearEBITDA - EBITDA in final projection year
 * @param {number} exitMultiple - EV/EBITDA exit multiple
 * @returns {number} Terminal value
 * @throws {Error} If inputs are invalid
 */
export function calculateTerminalValueMultiple(finalYearEBITDA, exitMultiple) {
  if (typeof finalYearEBITDA !== 'number') {
    throw new Error(`Invalid finalYearEBITDA: ${finalYearEBITDA}. Must be a number.`);
  }
  if (typeof exitMultiple !== 'number' || exitMultiple <= 0) {
    throw new Error(`Invalid exitMultiple: ${exitMultiple}. Must be positive.`);
  }
  
  // Warn if multiple seems unusual
  if (exitMultiple > 20) {
    console.warn(`Exit multiple of ${exitMultiple.toFixed(1)}x seems high. Verify assumption.`);
  }
  if (exitMultiple < 3) {
    console.warn(`Exit multiple of ${exitMultiple.toFixed(1)}x seems low. Verify assumption.`);
  }
  
  return finalYearEBITDA * exitMultiple;
}

/**
 * Calculate Present Value of a single cash flow
 * PV = FV / (1 + r)^n
 * 
 * @param {number} futureValue - Future cash flow
 * @param {number} discountRate - Discount rate per period
 * @param {number} periods - Number of periods in the future
 * @returns {number} Present value
 * @throws {Error} If inputs are invalid
 */
export function presentValue(futureValue, discountRate, periods) {
  if (typeof futureValue !== 'number') {
    throw new Error(`Invalid futureValue: ${futureValue}. Must be a number.`);
  }
  if (typeof discountRate !== 'number' || discountRate < -1) {
    throw new Error(`Invalid discountRate: ${discountRate}. Must be > -1.`);
  }
  if (typeof periods !== 'number' || periods < 0) {
    throw new Error(`Invalid periods: ${periods}. Must be non-negative.`);
  }
  if (!Number.isInteger(periods) && periods !== Math.floor(periods)) {
    console.warn(`Non-integer periods (${periods}) may indicate an error.`);
  }
  
  const pv = futureValue / Math.pow(1 + discountRate, periods);
  
  if (!isFinite(pv)) {
    throw new Error(`PV calculation resulted in non-finite value. Check inputs: FV=${futureValue}, r=${discountRate}, n=${periods}`);
  }
  
  return pv;
}

/**
 * Calculate NPV of a series of cash flows
 * Discounts each cash flow assuming end-of-period timing
 * 
 * @param {number[]} cashFlows - Array of cash flows (must be FCFF for DCF)
 * @param {number} discountRate - Discount rate per period
 * @returns {number} Net present value
 * @throws {Error} If inputs are invalid
 */
export function calculateNPV(cashFlows, discountRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    throw new Error('cashFlows must be a non-empty array.');
  }
  if (cashFlows.some(cf => typeof cf !== 'number')) {
    throw new Error('All cash flows must be numbers.');
  }
  if (typeof discountRate !== 'number' || discountRate < -1) {
    throw new Error(`Invalid discountRate: ${discountRate}. Must be > -1.`);
  }
  
  const npv = cashFlows.reduce((total, cf, index) => {
    return total + presentValue(cf, discountRate, index + 1);
  }, 0);
  
  if (!isFinite(npv)) {
    throw new Error('NPV calculation resulted in non-finite value.');
  }
  
  return npv;
}

/**
 * Main DCF Valuation Function
 * Computes Enterprise Value and Equity Value using Discounted Cash Flow methodology
 * 
 * @param {Object} params - DCF parameters
 * @param {number[]} params.projectedFCFs - Array of projected Free Cash Flows to the Firm (FCFF)
 * @param {number} params.wacc - Weighted Average Cost of Capital (decimal)
 * @param {number} params.terminalGrowthRate - Perpetual growth rate (decimal, must be < WACC)
 * @param {number} [params.finalYearEBITDA] - EBITDA in final year (required if useMultiple=true)
 * @param {boolean} [params.useMultiple=false] - Use exit multiple method for terminal value
 * @param {number} [params.exitMultiple=8.0] - EV/EBITDA exit multiple (if useMultiple=true)
 * @param {number} params.netDebt - Net debt at valuation date (Debt - Cash)
 * @param {number} [params.associatesValue=0] - Value of associates/JVs (add to equity)
 * @param {number} [params.minorityInterest=0] - Minority interest (subtract from equity)
 * @param {Object} [opts={}] - Optional settings
 * @param {boolean} [opts.debug=false] - Enable detailed logging
 * @param {Function} [opts.logger=console.debug] - Custom logger function
 * @param {number} [opts.precision=6] - Decimal precision for logs
 * @returns {Object} DCF valuation results
 * @throws {Error} If inputs are invalid or calculation fails
 */
export function calculateDCF(params, opts = {}) {
  const { debug = false, logger = console.debug, precision = 6 } = opts;
  const log = (...args) => debug && logger(...args);
  const df = (n) => typeof n === 'number' ? n.toFixed(precision) : 'N/A';
  
  // Extract and validate parameters
  const {
    projectedFCFs,
    wacc,
    terminalGrowthRate,
    finalYearEBITDA,
    useMultiple = false,
    exitMultiple = 8.0,
    netDebt,
    associatesValue = 0,
    minorityInterest = 0
  } = params;
  
  log('=== DCF CALCULATION START ===');
  log('Input Parameters:', {
    projectionYears: projectedFCFs?.length,
    wacc: df(wacc),
    terminalGrowthRate: df(terminalGrowthRate),
    useMultiple,
    exitMultiple: useMultiple ? df(exitMultiple) : 'N/A',
    netDebt: df(netDebt),
    associatesValue: df(associatesValue),
    minorityInterest: df(minorityInterest)
  });
  
  // Validate required inputs
  if (!Array.isArray(projectedFCFs) || projectedFCFs.length === 0) {
    throw new Error('projectedFCFs must be a non-empty array of FCFF values.');
  }
  if (projectedFCFs.some(fcf => typeof fcf !== 'number')) {
    throw new Error('All projectedFCFs must be numbers (FCFF, not FCFE).');
  }
  if (typeof wacc !== 'number' || wacc <= 0) {
    throw new Error(`Invalid wacc: ${wacc}. Must be positive.`);
  }
  if (!useMultiple && typeof terminalGrowthRate !== 'number') {
    throw new Error('terminalGrowthRate is required when not using exit multiple method.');
  }
  if (typeof netDebt !== 'number') {
    throw new Error(`Invalid netDebt: ${netDebt}. Must be a number (Debt - Cash).`);
  }
  if (useMultiple && typeof finalYearEBITDA !== 'number') {
    throw new Error('finalYearEBITDA is required when using exit multiple method.');
  }
  
  log('Projected FCFs (FCFF):', projectedFCFs.map(df));
  
  // Calculate discount factors and PVs for each year
  const discountFactors = projectedFCFs.map((_, i) => 1 / Math.pow(1 + wacc, i + 1));
  const pvByYear = projectedFCFs.map((fcf, i) => presentValue(fcf, wacc, i + 1));
  
  log('Discount Factors:', discountFactors.map(df));
  log('PV by Year:', pvByYear.map(df));
  
  // Calculate PV of projected FCFs
  const pvOfProjectedFCFs = calculateNPV(projectedFCFs, wacc);
  log('PV of Projected FCFs (sum):', df(pvOfProjectedFCFs));
  
  // Calculate terminal value
  let terminalValue;
  const finalYearFCF = projectedFCFs[projectedFCFs.length - 1];
  
  if (useMultiple) {
    log('Using Exit Multiple Method for Terminal Value');
    log('TV Inputs:', { finalYearEBITDA: df(finalYearEBITDA), exitMultiple: df(exitMultiple) });
    terminalValue = calculateTerminalValueMultiple(finalYearEBITDA, exitMultiple);
  } else {
    log('Using Perpetuity Growth Method for Terminal Value');
    log('TV Inputs:', { 
      finalYearFCF: df(finalYearFCF), 
      wacc: df(wacc), 
      terminalGrowthRate: df(terminalGrowthRate),
      spread: df(wacc - terminalGrowthRate)
    });
    terminalValue = calculateTerminalValuePerpetual(finalYearFCF, wacc, terminalGrowthRate);
  }
  
  log('Terminal Value:', df(terminalValue));
  
  // Discount terminal value to present
  const terminalDiscountPeriods = projectedFCFs.length;
  const pvOfTerminalValue = presentValue(terminalValue, wacc, terminalDiscountPeriods);
  log('PV of Terminal Value:', df(pvOfTerminalValue), `(discounted ${terminalDiscountPeriods} periods)`);
  
  // Calculate enterprise value
  const enterpriseValue = pvOfProjectedFCFs + pvOfTerminalValue;
  log('Enterprise Value:', df(enterpriseValue), `(PV FCFs + PV TV)`);
  
  // Bridge to equity value
  // CRITICAL FIX: netDebt already equals (Debt - Cash), so we do NOT add cash again
  // Formula: Equity = EV - Net Debt + Associates - Minority Interest
  const equityValue = enterpriseValue - netDebt + associatesValue - minorityInterest;
  
  log('Equity Bridge:', {
    enterpriseValue: df(enterpriseValue),
    netDebt: df(netDebt),
    associatesValue: df(associatesValue),
    minorityInterest: df(minorityInterest),
    equityValue: df(equityValue)
  });
  
  // Validation checks
  if (!isFinite(enterpriseValue) || !isFinite(equityValue)) {
    throw new Error('Valuation calculation resulted in non-finite values. Check inputs.');
  }
  
  if (equityValue < 0) {
    console.warn(`Equity value is negative (${df(equityValue)}). Company may be insolvent or inputs incorrect.`);
  }
  
  log('=== DCF CALCULATION COMPLETE ===\n');
  
  return {
    pvOfProjectedFCFs,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    breakdownByYear: projectedFCFs.map((fcf, i) => ({
      year: i + 1,
      fcf,
      discountFactor: discountFactors[i],
      presentValue: pvByYear[i]
    }))
  };
}

/**
 * Generate Sensitivity Analysis Matrix
 * Shows how equity valuation changes with different WACC and growth rate assumptions
 * 
 * @param {Object} baseParams - Base DCF parameters
 * @param {number[]} waccRange - Array of WACC values to test
 * @param {number[]} growthRange - Array of growth rate values to test
 * @returns {(number|null)[][]} Matrix of equity values (null for invalid combinations)
 */
export function generateSensitivityMatrix(baseParams, waccRange, growthRange) {
  if (!Array.isArray(waccRange) || !Array.isArray(growthRange)) {
    throw new Error('waccRange and growthRange must be arrays.');
  }
  
  const matrix = [];
  
  for (const wacc of waccRange) {
    const row = [];
    for (const growth of growthRange) {
      // Skip invalid combinations where WACC <= growth
      if (wacc <= growth) {
        row.push(null);
        continue;
      }
      
      try {
        const result = calculateDCF({
          ...baseParams,
          wacc,
          terminalGrowthRate: growth
        });
        row.push(result.equityValue);
      } catch (error) {
        console.warn(`Sensitivity calc failed for WACC=${wacc}, Growth=${growth}:`, error.message);
        row.push(null);
      }
    }
    matrix.push(row);
  }
  
  return matrix;
}

/**
 * Calculate implied valuation multiples from DCF results
 * 
 * @param {number} equityValue - DCF-derived equity value
 * @param {number} enterpriseValue - DCF-derived enterprise value
 * @param {Object} financials - Current financial metrics
 * @param {number} financials.currentRevenue - Current revenue
 * @param {number} financials.currentEBITDA - Current EBITDA
 * @param {number} financials.currentEBIT - Current EBIT
 * @param {number} financials.currentNetIncome - Current net income
 * @param {number} [financials.sharesOutstanding=1] - Number of shares
 * @returns {Object} Implied multiples
 */
export function calculateImpliedMultiples(equityValue, enterpriseValue, financials) {
  const {
    currentRevenue,
    currentEBITDA,
    currentEBIT,
    currentNetIncome,
    sharesOutstanding = 1
  } = financials;
  
  if (typeof equityValue !== 'number' || typeof enterpriseValue !== 'number') {
    throw new Error('equityValue and enterpriseValue must be numbers.');
  }
  if (typeof sharesOutstanding !== 'number' || sharesOutstanding <= 0) {
    throw new Error('sharesOutstanding must be positive.');
  }

  return {
    evToRevenue: currentRevenue > 0 ? enterpriseValue / currentRevenue : null,
    evToEBITDA: currentEBITDA > 0 ? enterpriseValue / currentEBITDA : null,
    evToEBIT: currentEBIT > 0 ? enterpriseValue / currentEBIT : null,
    peRatio: currentNetIncome > 0 ? equityValue / currentNetIncome : null,
    pricePerShare: equityValue / sharesOutstanding
  };
}

/**
 * Helper to create WACC and growth rate ranges for sensitivity analysis
 * 
 * @param {number} baseValue - Center value for the range
 * @param {number} [steps=5] - Number of steps (should be odd for symmetric range)
 * @param {number} [stepSize=0.01] - Size of each step (e.g., 0.01 = 1%)
 * @returns {number[]} Array of values centered around baseValue
 */
export function createSensitivityRanges(baseValue, steps = 5, stepSize = 0.01) {
  if (typeof baseValue !== 'number') {
    throw new Error('baseValue must be a number.');
  }
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error('steps must be a positive integer.');
  }
  if (typeof stepSize !== 'number' || stepSize <= 0) {
    throw new Error('stepSize must be positive.');
  }

  const range = [];
  const halfSteps = Math.floor(steps / 2);

  for (let i = -halfSteps; i <= halfSteps; i++) {
    range.push(baseValue + (i * stepSize));
  }

  return range;
}

// ============================================================================
// PHASE 1 ENHANCEMENTS - NEW CONSTANTS AND FUNCTIONS
// ============================================================================

/**
 * Country Risk Premiums (Damodaran methodology)
 * Updated for Caribbean and key markets
 * Source: Damodaran Online, Sovereign CDS spreads
 */
export const COUNTRY_RISK_PREMIUMS = {
  // Caribbean
  'JM': { name: 'Jamaica', crp: 0.045, rating: 'B+', lastUpdated: '2025-01' },
  'TT': { name: 'Trinidad & Tobago', crp: 0.025, rating: 'BBB-', lastUpdated: '2025-01' },
  'BB': { name: 'Barbados', crp: 0.055, rating: 'B-', lastUpdated: '2025-01' },
  'BS': { name: 'Bahamas', crp: 0.035, rating: 'BB-', lastUpdated: '2025-01' },
  'GY': { name: 'Guyana', crp: 0.040, rating: 'B+', lastUpdated: '2025-01' },
  'SR': { name: 'Suriname', crp: 0.080, rating: 'CCC', lastUpdated: '2025-01' },
  'BZ': { name: 'Belize', crp: 0.065, rating: 'CCC+', lastUpdated: '2025-01' },

  // Major markets (for reference/comparison)
  'US': { name: 'United States', crp: 0.000, rating: 'AAA', lastUpdated: '2025-01' },
  'GB': { name: 'United Kingdom', crp: 0.005, rating: 'AA', lastUpdated: '2025-01' },
  'CA': { name: 'Canada', crp: 0.000, rating: 'AAA', lastUpdated: '2025-01' },

  // Latin America
  'MX': { name: 'Mexico', crp: 0.020, rating: 'BBB', lastUpdated: '2025-01' },
  'BR': { name: 'Brazil', crp: 0.035, rating: 'BB-', lastUpdated: '2025-01' },
  'CO': { name: 'Colombia', crp: 0.030, rating: 'BB+', lastUpdated: '2025-01' },
  'CL': { name: 'Chile', crp: 0.010, rating: 'A', lastUpdated: '2025-01' },
  'PA': { name: 'Panama', crp: 0.020, rating: 'BBB', lastUpdated: '2025-01' },
};

/**
 * Size Premiums (Duff & Phelps methodology)
 * Based on market capitalization deciles
 */
export const SIZE_PREMIUMS = [
  { decile: 1, maxCapUSD: 2e9, premium: 0.0350, label: 'Micro-cap' },
  { decile: 2, maxCapUSD: 5e9, premium: 0.0250, label: 'Small-cap' },
  { decile: 3, maxCapUSD: 10e9, premium: 0.0150, label: 'Mid-cap (small)' },
  { decile: 4, maxCapUSD: 25e9, premium: 0.0100, label: 'Mid-cap' },
  { decile: 5, maxCapUSD: 50e9, premium: 0.0050, label: 'Mid-cap (large)' },
  { decile: 6, maxCapUSD: 100e9, premium: 0.0025, label: 'Large-cap' },
  { decile: 7, maxCapUSD: Infinity, premium: 0.0000, label: 'Mega-cap' },
];

/**
 * Industry Unlevered Betas (Damodaran)
 * Use these when company-specific beta unavailable
 */
export const INDUSTRY_BETAS = {
  'financial-services': { unlevered: 0.65, typical_de: 2.5 },
  'banking': { unlevered: 0.55, typical_de: 3.0 },
  'insurance': { unlevered: 0.70, typical_de: 0.5 },
  'real-estate': { unlevered: 0.75, typical_de: 1.0 },
  'utilities': { unlevered: 0.35, typical_de: 1.2 },
  'telecommunications': { unlevered: 0.70, typical_de: 0.8 },
  'retail': { unlevered: 0.85, typical_de: 0.5 },
  'consumer-goods': { unlevered: 0.80, typical_de: 0.3 },
  'healthcare': { unlevered: 0.90, typical_de: 0.2 },
  'technology': { unlevered: 1.10, typical_de: 0.1 },
  'manufacturing': { unlevered: 0.85, typical_de: 0.4 },
  'energy': { unlevered: 1.05, typical_de: 0.6 },
  'agriculture': { unlevered: 0.75, typical_de: 0.4 },
  'hospitality': { unlevered: 1.00, typical_de: 0.6 },
  'transportation': { unlevered: 0.85, typical_de: 0.7 },
  'construction': { unlevered: 0.95, typical_de: 0.5 },
  'general': { unlevered: 0.85, typical_de: 0.5 },
};

/**
 * Jamaica-specific defaults
 */
export const JAMAICA_DEFAULTS = {
  riskFreeRate: 0.08,        // GOJ 10-year bond yield (~8%)
  usRiskFreeRate: 0.045,     // US 10-year Treasury (~4.5%)
  countryRiskPremium: 0.045, // Jamaica CRP
  equityRiskPremium: 0.055,  // Global ERP
  defaultTaxRate: 0.25,      // Jamaica corporate tax rate
  longTermGDPGrowth: 0.02,   // Jamaica long-term growth expectation
  fxRateToUSD: 155,          // JMD per USD (update regularly)
};

// ============================================================================
// BETA CALCULATIONS
// ============================================================================

/**
 * Unlever beta (remove leverage effect)
 * Hamada equation: βu = βl / [1 + (1-T)(D/E)]
 *
 * @param {number} leveredBeta - Observed/comparable company beta
 * @param {number} taxRate - Corporate tax rate
 * @param {number} debtToEquity - D/E ratio of the comparable company
 * @returns {number} Unlevered (asset) beta
 */
export function unleverBeta(leveredBeta, taxRate, debtToEquity) {
  if (debtToEquity < 0) {
    console.warn('unleverBeta: Negative D/E ratio, returning levered beta');
    return leveredBeta;
  }
  return leveredBeta / (1 + (1 - taxRate) * debtToEquity);
}

/**
 * Relever beta (apply target leverage)
 * Hamada equation: βl = βu × [1 + (1-T)(D/E)]
 *
 * @param {number} unleveredBeta - Asset beta
 * @param {number} taxRate - Corporate tax rate
 * @param {number} targetDebtToEquity - Target D/E ratio
 * @returns {number} Relevered (equity) beta
 */
export function releverBeta(unleveredBeta, taxRate, targetDebtToEquity) {
  if (targetDebtToEquity < 0) {
    console.warn('releverBeta: Negative target D/E ratio, returning unlevered beta');
    return unleveredBeta;
  }
  return unleveredBeta * (1 + (1 - taxRate) * targetDebtToEquity);
}

/**
 * Adjusted Beta (Bloomberg convention)
 * Adjusts raw beta toward market beta of 1.0
 * Formula: Adjusted β = (0.67 × Raw β) + (0.33 × 1.0)
 *
 * @param {number} rawBeta - Observed raw beta
 * @returns {number} Adjusted beta
 */
export function adjustedBeta(rawBeta) {
  return (0.67 * rawBeta) + (0.33 * 1.0);
}

/**
 * Get industry beta and relever for subject company
 *
 * @param {string} industry - Industry key
 * @param {number} taxRate - Subject company tax rate
 * @param {number} targetDebtToEquity - Subject company target D/E
 * @returns {object} Beta details
 */
export function getIndustryBeta(industry, taxRate, targetDebtToEquity) {
  const industryKey = industry?.toLowerCase().replace(/\s+/g, '-') || 'general';
  const industryData = INDUSTRY_BETAS[industryKey] || INDUSTRY_BETAS['general'];

  const releveredBeta = releverBeta(
    industryData.unlevered,
    taxRate,
    targetDebtToEquity
  );

  return {
    industry: industryKey,
    unleveredBeta: industryData.unlevered,
    typicalDebtToEquity: industryData.typical_de,
    targetDebtToEquity,
    releveredBeta,
    adjustedBeta: adjustedBeta(releveredBeta)
  };
}

// ============================================================================
// COST OF EQUITY (ENHANCED CAPM)
// ============================================================================

/**
 * Calculate Cost of Equity using Enhanced Modified CAPM
 * Ke = Rf + β(ERP) + CRP + SP + α
 *
 * @param {object} params - CAPM parameters
 * @returns {object} Cost of equity breakdown
 */
export function calculateCostOfEquityEnhanced({
  riskFreeRate,
  beta,
  equityRiskPremium = 0.055,
  countryRiskPremium = 0,
  sizePremium = 0,
  companySpecificPremium = 0
}) {
  // Base CAPM
  const baseCAPM = riskFreeRate + (beta * equityRiskPremium);

  // Total cost of equity
  const total = baseCAPM + countryRiskPremium + sizePremium + companySpecificPremium;

  return {
    total,
    components: {
      riskFreeRate,
      beta,
      equityRiskPremium,
      baseCAPM,
      countryRiskPremium,
      sizePremium,
      companySpecificPremium
    },
    formula: `Ke = ${(riskFreeRate*100).toFixed(2)}% + ${beta.toFixed(2)} × ${(equityRiskPremium*100).toFixed(2)}% + ${(countryRiskPremium*100).toFixed(2)}% + ${(sizePremium*100).toFixed(2)}% + ${(companySpecificPremium*100).toFixed(2)}% = ${(total*100).toFixed(2)}%`
  };
}

/**
 * Get country risk premium
 *
 * @param {string} countryCode - ISO country code
 * @returns {object} CRP data
 */
export function getCountryRiskPremium(countryCode = 'JM') {
  const data = COUNTRY_RISK_PREMIUMS[countryCode?.toUpperCase()];

  if (!data) {
    console.warn(`Country code ${countryCode} not found, defaulting to Jamaica`);
    return COUNTRY_RISK_PREMIUMS['JM'];
  }

  return data;
}

/**
 * Get size premium based on market cap
 *
 * @param {number} marketCapLocal - Market cap in local currency
 * @param {number} fxRateToUSD - Local currency per USD
 * @returns {object} Size premium data
 */
export function getSizePremium(marketCapLocal, fxRateToUSD = 155) {
  const marketCapUSD = marketCapLocal / fxRateToUSD;

  for (const bucket of SIZE_PREMIUMS) {
    if (marketCapUSD <= bucket.maxCapUSD) {
      return {
        premium: bucket.premium,
        decile: bucket.decile,
        label: bucket.label,
        marketCapUSD,
        marketCapLocal
      };
    }
  }

  return {
    premium: 0,
    decile: 7,
    label: 'Mega-cap',
    marketCapUSD,
    marketCapLocal
  };
}

// ============================================================================
// DISCOUNTING FUNCTIONS - MID-YEAR CONVENTION
// ============================================================================

/**
 * Calculate present value with mid-year convention
 * PV = FV / (1 + r)^(n - 0.5) for mid-year
 *
 * @param {number} futureValue - Future cash flow
 * @param {number} discountRate - Discount rate per period
 * @param {number} year - Year number (1, 2, 3, etc.)
 * @returns {number} Present value using mid-year convention
 */
export function presentValueMidYear(futureValue, discountRate, year) {
  if (typeof futureValue !== 'number') {
    throw new Error(`Invalid futureValue: ${futureValue}. Must be a number.`);
  }
  if (typeof discountRate !== 'number' || discountRate < -1) {
    throw new Error(`Invalid discountRate: ${discountRate}. Must be > -1.`);
  }

  // Mid-year convention: period = year - 0.5
  const period = year - 0.5;
  const pv = futureValue / Math.pow(1 + discountRate, period);

  if (!isFinite(pv)) {
    throw new Error(`PV calculation resulted in non-finite value.`);
  }

  return pv;
}

/**
 * Calculate NPV of cash flows using mid-year convention
 * Industry standard for DCF - assumes cash flows occur mid-year
 *
 * @param {number[]} cashFlows - Array of cash flows
 * @param {number} discountRate - Discount rate per period
 * @returns {number} NPV using mid-year convention
 */
export function calculateNPVMidYear(cashFlows, discountRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    throw new Error('cashFlows must be a non-empty array.');
  }
  if (cashFlows.some(cf => typeof cf !== 'number')) {
    throw new Error('All cash flows must be numbers.');
  }
  if (typeof discountRate !== 'number' || discountRate < -1) {
    throw new Error(`Invalid discountRate: ${discountRate}. Must be > -1.`);
  }

  const npv = cashFlows.reduce((total, cf, index) => {
    return total + presentValueMidYear(cf, discountRate, index + 1);
  }, 0);

  if (!isFinite(npv)) {
    throw new Error('NPV calculation resulted in non-finite value.');
  }

  return npv;
}

/**
 * Calculate discount factor with mid-year convention option
 *
 * @param {number} wacc - Discount rate
 * @param {number} year - Year number (1, 2, 3, etc.)
 * @param {boolean} useMidYear - Use mid-year convention (default: true)
 * @returns {number} Discount factor
 */
export function getDiscountFactor(wacc, year, useMidYear = true) {
  // Mid-year convention: Cash flows assumed at middle of year
  // Period = year - 0.5 for mid-year, year for end-of-year
  const period = useMidYear ? year - 0.5 : year;
  return 1 / Math.pow(1 + wacc, period);
}

/**
 * Discount an array of cash flows with detailed breakdown
 *
 * @param {number[]} cashFlows - Array of cash flows by year
 * @param {number} wacc - Discount rate
 * @param {boolean} useMidYear - Use mid-year convention
 * @returns {object[]} Array of discounted cash flow details
 */
export function discountCashFlows(cashFlows, wacc, useMidYear = true) {
  return cashFlows.map((fcf, index) => {
    const year = index + 1;
    const period = useMidYear ? year - 0.5 : year;
    const discountFactor = getDiscountFactor(wacc, year, useMidYear);
    const presentValue = fcf * discountFactor;

    return {
      year,
      period,
      fcf,
      discountFactor,
      presentValue,
      convention: useMidYear ? 'mid-year' : 'end-of-year'
    };
  });
}

// ============================================================================
// SANITY CHECKS
// ============================================================================

/**
 * Run comprehensive valuation sanity checks
 *
 * @param {object} params - Valuation results to check
 * @returns {object[]} Array of sanity check results
 */
export function runValuationSanityChecks({
  enterpriseValue,
  equityValue,
  pvProjectedFCFs,
  pvTerminalValue,
  terminalGrowth,
  wacc,
  impliedMultiples,
  longTermGDPGrowth = 0.025
}) {
  const checks = [];

  // 1. Negative Equity Value
  if (equityValue <= 0) {
    checks.push({
      id: 'NEGATIVE_EQUITY',
      type: 'critical',
      title: 'Negative Equity Value',
      message: `Equity value is ${formatCurrencySimple(equityValue)}. This indicates a distressed situation where debt exceeds enterprise value.`,
      value: equityValue,
      recommendation: 'Review debt levels, verify projections, or consider restructuring analysis.'
    });
  }

  // 2. Negative Projected FCFs
  if (pvProjectedFCFs < 0) {
    checks.push({
      id: 'NEGATIVE_FCF',
      type: 'critical',
      title: 'Negative Projected Cash Flows',
      message: `PV of projected FCFs is ${formatCurrencySimple(pvProjectedFCFs)}. The business is projected to burn cash during the explicit forecast period.`,
      value: pvProjectedFCFs,
      recommendation: 'Verify this represents a growth-phase investment. Review revenue growth, margins, and capex assumptions.'
    });
  }

  // 3. Terminal Value Dominance
  const totalValue = Math.abs(pvProjectedFCFs) + pvTerminalValue;
  const tvPercent = totalValue > 0 ? pvTerminalValue / totalValue : 0;

  if (tvPercent > 0.85) {
    checks.push({
      id: 'TV_DOMINATES',
      type: 'critical',
      title: 'Terminal Value Dominates Valuation',
      message: `Terminal value represents ${(tvPercent*100).toFixed(0)}% of total value. This indicates heavy reliance on long-term assumptions.`,
      value: tvPercent,
      recommendation: 'Extend projection period to 7-10 years, or review near-term growth/margin assumptions.'
    });
  } else if (tvPercent > 0.75) {
    checks.push({
      id: 'TV_HIGH',
      type: 'warning',
      title: 'High Terminal Value Weight',
      message: `Terminal value represents ${(tvPercent*100).toFixed(0)}% of total value. Industry norm is 50-75%.`,
      value: tvPercent,
      recommendation: 'Consider extending projection period or validating terminal assumptions.'
    });
  }

  // 4. Terminal Growth vs GDP
  if (terminalGrowth > longTermGDPGrowth) {
    checks.push({
      id: 'HIGH_TERMINAL_GROWTH',
      type: 'warning',
      title: 'Terminal Growth Exceeds GDP',
      message: `Terminal growth of ${(terminalGrowth*100).toFixed(1)}% exceeds long-term GDP growth of ${(longTermGDPGrowth*100).toFixed(1)}%.`,
      value: terminalGrowth,
      recommendation: 'No company can grow faster than GDP indefinitely. Consider reducing to 2-3%.'
    });
  }

  // 5. Implied Multiples Reasonableness
  if (impliedMultiples?.evToEBITDA) {
    const multiple = impliedMultiples.evToEBITDA;
    if (multiple < 3) {
      checks.push({
        id: 'LOW_EBITDA_MULTIPLE',
        type: 'warning',
        title: 'Low Implied EV/EBITDA',
        message: `Implied EV/EBITDA of ${multiple.toFixed(1)}x is below typical ranges (5-12x).`,
        value: multiple,
        recommendation: 'Verify the company is not undervalued or if there are structural issues.'
      });
    } else if (multiple > 15) {
      checks.push({
        id: 'HIGH_EBITDA_MULTIPLE',
        type: 'warning',
        title: 'High Implied EV/EBITDA',
        message: `Implied EV/EBITDA of ${multiple.toFixed(1)}x is above typical ranges (5-12x).`,
        value: multiple,
        recommendation: 'Verify growth assumptions support this premium valuation.'
      });
    }
  }

  // 6. WACC Reasonableness
  if (wacc < 0.06) {
    checks.push({
      id: 'LOW_WACC',
      type: 'warning',
      title: 'Low Discount Rate',
      message: `WACC of ${(wacc*100).toFixed(2)}% appears low, especially for emerging markets.`,
      value: wacc,
      recommendation: 'Verify country risk premium, size premium, and company-specific risks are included.'
    });
  } else if (wacc > 0.25) {
    checks.push({
      id: 'HIGH_WACC',
      type: 'warning',
      title: 'High Discount Rate',
      message: `WACC of ${(wacc*100).toFixed(2)}% is very high and will heavily discount future cash flows.`,
      value: wacc,
      recommendation: 'Verify risk premiums are not double-counted.'
    });
  }

  return checks;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Simple currency format for sanity check messages
 */
function formatCurrencySimple(value, ccy = 'JMD') {
  if (value === null || value === undefined || !isFinite(value)) return '—';

  const millions = value / 1_000_000;
  return `${ccy} ${millions.toFixed(1)}M`;
}

/**
 * Format currency for display (not in millions)
 */
export function formatCurrency(value, ccy = 'JMD', decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return '—';

  return `${ccy} ${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

/**
 * Format currency in millions
 */
export function formatCurrencyMM(value, ccy = 'JMD') {
  if (value === null || value === undefined || !isFinite(value)) return '—';

  const millions = value / 1_000_000;
  return `${ccy} ${millions.toFixed(1)}M`;
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return '—';

  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format multiple
 */
export function formatMultiple(value, decimals = 2) {
  if (value === null || value === undefined || !isFinite(value)) return '—';

  return `${value.toFixed(decimals)}x`;
}

// ============================================================================
// TOTAL DEBT HELPERS (for consistency across app)
// ============================================================================

/**
 * Calculate total debt from params (handles single and multi-tranche)
 *
 * @param {object} params - Financial parameters
 * @returns {number} Total debt
 */
export function getTotalDebt(params) {
  if (!params) return 0;

  // Multi-tranche mode
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    return params.debtTranches.reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  // Single debt mode: existing + new facility
  return (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
}

/**
 * Get blended interest rate (handles single and multi-tranche)
 *
 * @param {object} params - Financial parameters
 * @returns {number} Blended rate
 */
export function getBlendedRate(params) {
  if (!params) return 0;

  // Multi-tranche mode
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    const totalDebt = getTotalDebt(params);
    if (totalDebt === 0) return 0;

    const weightedRate = params.debtTranches.reduce((sum, t) => {
      return sum + (t.amount || 0) * (t.rate || 0);
    }, 0);

    return weightedRate / totalDebt;
  }

  // Single debt mode - weighted average
  const existingDebt = params.openingDebt || 0;
  const newFacility = params.requestedLoanAmount || 0;
  const totalDebt = existingDebt + newFacility;

  if (totalDebt === 0) return 0;

  const existingRate = params.existingDebtRate || params.interestRate || 0;
  const newRate = params.proposedPricing || params.interestRate || 0;

  return (existingDebt * existingRate + newFacility * newRate) / totalDebt;
}

/**
 * Check if any debt exists
 *
 * @param {object} params - Financial parameters
 * @returns {boolean}
 */
export function hasAnyDebt(params) {
  return getTotalDebt(params) > 0;
}