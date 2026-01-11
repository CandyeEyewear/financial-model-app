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