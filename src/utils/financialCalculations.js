/**
 * ============================================================================
 * Financial Calculations Module
 * Professional-grade financial calculation functions
 * ============================================================================
 */

/**
 * Calculate Internal Rate of Return (IRR) using Newton-Raphson method
 * This is the industry-standard approach for IRR calculation
 * 
 * @param {number[]} cashFlows - Array of cash flows, starting with initial investment (negative)
 * @param {number} guess - Initial guess for IRR (default 0.1 = 10%)
 * @param {number} tolerance - Convergence tolerance (default 0.0001)
 * @param {number} maxIterations - Maximum iterations before giving up (default 100)
 * @returns {number|null} - IRR as decimal, or null if doesn't converge
 * 
 * @example
 * // Investment of $100,000 with cash flows over 5 years
 * const cashFlows = [-100000, 25000, 30000, 35000, 40000, 50000];
 * const irr = calculateIRR(cashFlows); // Returns ~0.22 (22%)
 */
export function calculateIRR(cashFlows, guess = 0.1, tolerance = 0.0001, maxIterations = 100) {
  // Validate inputs
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    return null;
  }

  // Check if there's at least one positive and one negative cash flow
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  
  if (!hasPositive || !hasNegative) {
    return null; // IRR undefined without both positive and negative cash flows
  }

  let rate = guess;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let npv = 0;
    let derivative = 0;

    // Calculate NPV and its derivative at current rate
    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      
      // Derivative of NPV with respect to rate
      if (t > 0) {
        derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
      }
    }

    // Check for convergence
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Avoid division by zero
    if (Math.abs(derivative) < 1e-10) {
      // Try a different starting point
      rate = rate + 0.1;
      continue;
    }

    // Newton-Raphson update
    const newRate = rate - npv / derivative;

    // Check for convergence based on rate change
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;

    // Bound the rate to reasonable values
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10; // 1000% max
  }

  // If Newton-Raphson doesn't converge, try bisection method
  return calculateIRRBisection(cashFlows, tolerance, maxIterations);
}

/**
 * Fallback IRR calculation using bisection method
 * More robust but slower than Newton-Raphson
 */
function calculateIRRBisection(cashFlows, tolerance = 0.0001, maxIterations = 1000) {
  let lower = -0.99;
  let upper = 10;
  
  const npvAtRate = (rate) => {
    return cashFlows.reduce((npv, cf, t) => npv + cf / Math.pow(1 + rate, t), 0);
  };

  // Check if solution exists in range
  const npvLower = npvAtRate(lower);
  const npvUpper = npvAtRate(upper);
  
  if (npvLower * npvUpper > 0) {
    return null; // No solution in this range
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lower + upper) / 2;
    const npvMid = npvAtRate(mid);

    if (Math.abs(npvMid) < tolerance || Math.abs(upper - lower) < tolerance) {
      return mid;
    }

    if (npvMid * npvLower < 0) {
      upper = mid;
    } else {
      lower = mid;
    }
  }

  return (lower + upper) / 2;
}

/**
 * Calculate Net Present Value (NPV)
 * 
 * @param {number[]} cashFlows - Array of cash flows
 * @param {number} discountRate - Discount rate as decimal (e.g., 0.10 for 10%)
 * @returns {number} - Net Present Value
 */
export function calculateNPV(cashFlows, discountRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    return 0;
  }

  return cashFlows.reduce((npv, cf, t) => {
    return npv + cf / Math.pow(1 + discountRate, t);
  }, 0);
}

/**
 * Calculate Modified Internal Rate of Return (MIRR)
 * 
 * @param {number[]} cashFlows - Array of cash flows
 * @param {number} financeRate - Cost of financing (for negative cash flows)
 * @param {number} reinvestRate - Rate at which positive cash flows are reinvested
 * @returns {number|null} - MIRR as decimal
 */
export function calculateMIRR(cashFlows, financeRate, reinvestRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    return null;
  }

  const n = cashFlows.length - 1;
  
  // Calculate present value of negative cash flows (discounted at finance rate)
  let pvNegative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] < 0) {
      pvNegative += Math.abs(cashFlows[t]) / Math.pow(1 + financeRate, t);
    }
  }

  // Calculate future value of positive cash flows (compounded at reinvest rate)
  let fvPositive = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    if (cashFlows[t] > 0) {
      fvPositive += cashFlows[t] * Math.pow(1 + reinvestRate, n - t);
    }
  }

  if (pvNegative === 0) {
    return null;
  }

  // MIRR formula
  return Math.pow(fvPositive / pvNegative, 1 / n) - 1;
}

/**
 * Calculate Payback Period
 * 
 * @param {number[]} cashFlows - Array of cash flows, starting with initial investment (negative)
 * @returns {number|null} - Payback period in years, null if never recovered
 */
export function calculatePaybackPeriod(cashFlows) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    return null;
  }

  let cumulativeCashFlow = 0;

  for (let t = 0; t < cashFlows.length; t++) {
    cumulativeCashFlow += cashFlows[t];

    if (cumulativeCashFlow >= 0) {
      // Calculate exact payback period using linear interpolation
      if (t === 0) {
        return 0;
      }
      const previousCumulative = cumulativeCashFlow - cashFlows[t];
      const fraction = Math.abs(previousCumulative) / cashFlows[t];
      return (t - 1) + fraction;
    }
  }

  return null; // Investment never paid back
}

/**
 * Calculate Discounted Payback Period
 * 
 * @param {number[]} cashFlows - Array of cash flows
 * @param {number} discountRate - Discount rate
 * @returns {number|null} - Discounted payback period in years
 */
export function calculateDiscountedPaybackPeriod(cashFlows, discountRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
    return null;
  }

  let cumulativeNPV = 0;

  for (let t = 0; t < cashFlows.length; t++) {
    const discountedCF = cashFlows[t] / Math.pow(1 + discountRate, t);
    cumulativeNPV += discountedCF;

    if (cumulativeNPV >= 0) {
      if (t === 0) {
        return 0;
      }
      const previousCumulative = cumulativeNPV - discountedCF;
      const fraction = Math.abs(previousCumulative) / discountedCF;
      return (t - 1) + fraction;
    }
  }

  return null;
}

/**
 * Calculate Profitability Index (PI)
 * 
 * @param {number[]} cashFlows - Array of cash flows
 * @param {number} discountRate - Discount rate
 * @returns {number} - Profitability Index
 */
export function calculateProfitabilityIndex(cashFlows, discountRate) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    return 0;
  }

  const initialInvestment = Math.abs(cashFlows[0]);
  const pvFutureCashFlows = cashFlows.slice(1).reduce((pv, cf, t) => {
    return pv + cf / Math.pow(1 + discountRate, t + 1);
  }, 0);

  if (initialInvestment === 0) {
    return 0;
  }

  return pvFutureCashFlows / initialInvestment;
}

/**
 * Calculate MOIC (Multiple on Invested Capital)
 * 
 * @param {number} totalDistributions - Total distributions received
 * @param {number} totalInvested - Total amount invested
 * @returns {number} - MOIC
 */
export function calculateMOIC(totalDistributions, totalInvested) {
  if (totalInvested <= 0) {
    return 0;
  }
  return totalDistributions / totalInvested;
}

/**
 * Calculate DPI (Distributions to Paid-In)
 * 
 * @param {number} realizedDistributions - Distributions actually received
 * @param {number} paidIn - Capital paid in
 * @returns {number} - DPI ratio
 */
export function calculateDPI(realizedDistributions, paidIn) {
  if (paidIn <= 0) {
    return 0;
  }
  return realizedDistributions / paidIn;
}

/**
 * Calculate RVPI (Residual Value to Paid-In)
 * 
 * @param {number} residualValue - Current unrealized value
 * @param {number} paidIn - Capital paid in
 * @returns {number} - RVPI ratio
 */
export function calculateRVPI(residualValue, paidIn) {
  if (paidIn <= 0) {
    return 0;
  }
  return residualValue / paidIn;
}

/**
 * Calculate TVPI (Total Value to Paid-In)
 * 
 * @param {number} realizedDistributions - Distributions received
 * @param {number} residualValue - Current unrealized value
 * @param {number} paidIn - Capital paid in
 * @returns {number} - TVPI ratio
 */
export function calculateTVPI(realizedDistributions, residualValue, paidIn) {
  if (paidIn <= 0) {
    return 0;
  }
  return (realizedDistributions + residualValue) / paidIn;
}

/**
 * Calculate Terminal Value using Gordon Growth Model
 * 
 * @param {number} finalYearFCF - Final year free cash flow
 * @param {number} growthRate - Terminal growth rate
 * @param {number} discountRate - Discount rate (WACC)
 * @returns {number|null} - Terminal value, or null if invalid
 */
export function calculateTerminalValue(finalYearFCF, growthRate, discountRate) {
  if (discountRate <= growthRate) {
    // Silent return - validation should be handled in UI layer
    return null;
  }

  const terminalFCF = finalYearFCF * (1 + growthRate);
  return terminalFCF / (discountRate - growthRate);
}

/**
 * Calculate Enterprise Value from DCF
 * 
 * @param {number[]} freeCashFlows - Array of projected free cash flows
 * @param {number} terminalValue - Terminal value at end of projection
 * @param {number} discountRate - WACC
 * @returns {number} - Enterprise Value
 */
export function calculateEnterpriseValue(freeCashFlows, terminalValue, discountRate) {
  const n = freeCashFlows.length;
  
  // PV of projected cash flows
  const pvCashFlows = freeCashFlows.reduce((pv, cf, t) => {
    return pv + cf / Math.pow(1 + discountRate, t + 1);
  }, 0);

  // PV of terminal value
  const pvTerminal = terminalValue / Math.pow(1 + discountRate, n);

  return pvCashFlows + pvTerminal;
}

/**
 * Calculate Equity Value from Enterprise Value
 * 
 * @param {number} enterpriseValue - Enterprise Value
 * @param {number} debt - Total debt
 * @param {number} cash - Cash and cash equivalents
 * @param {number} minorityInterest - Minority interest (default 0)
 * @param {number} preferredEquity - Preferred equity (default 0)
 * @returns {number} - Equity Value
 */
export function calculateEquityValue(enterpriseValue, debt, cash, minorityInterest = 0, preferredEquity = 0) {
  return enterpriseValue - debt + cash - minorityInterest - preferredEquity;
}

/**
 * Calculate WACC (Weighted Average Cost of Capital)
 * 
 * @param {number} costOfEquity - Cost of equity (as decimal)
 * @param {number} costOfDebt - Pre-tax cost of debt (as decimal)
 * @param {number} taxRate - Corporate tax rate (as decimal)
 * @param {number} equityWeight - Weight of equity in capital structure (0-1)
 * @param {number} debtWeight - Weight of debt in capital structure (0-1)
 * @returns {number} - WACC as decimal
 */
export function calculateWACC(costOfEquity, costOfDebt, taxRate, equityWeight, debtWeight) {
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
  return (costOfEquity * equityWeight) + (afterTaxCostOfDebt * debtWeight);
}

/**
 * Calculate Cost of Equity using CAPM
 * 
 * @param {number} riskFreeRate - Risk-free rate (as decimal)
 * @param {number} beta - Equity beta
 * @param {number} marketRiskPremium - Market risk premium (as decimal)
 * @returns {number} - Cost of equity as decimal
 */
export function calculateCostOfEquity(riskFreeRate, beta, marketRiskPremium) {
  return riskFreeRate + (beta * marketRiskPremium);
}

/**
 * Calculate Unlevered Beta
 * 
 * @param {number} leveredBeta - Levered beta
 * @param {number} taxRate - Tax rate
 * @param {number} debtToEquity - Debt to equity ratio
 * @returns {number} - Unlevered beta
 */
export function calculateUnleveredBeta(leveredBeta, taxRate, debtToEquity) {
  return leveredBeta / (1 + (1 - taxRate) * debtToEquity);
}

/**
 * Calculate Levered Beta
 * 
 * @param {number} unleveredBeta - Unlevered beta
 * @param {number} taxRate - Tax rate
 * @param {number} debtToEquity - Debt to equity ratio
 * @returns {number} - Levered beta
 */
export function calculateLeveredBeta(unleveredBeta, taxRate, debtToEquity) {
  return unleveredBeta * (1 + (1 - taxRate) * debtToEquity);
}

/**
 * Calculate simple CAGR
 * 
 * @param {number} beginningValue - Starting value
 * @param {number} endingValue - Ending value
 * @param {number} years - Number of years
 * @returns {number} - CAGR as decimal
 */
export function calculateCAGR(beginningValue, endingValue, years) {
  if (beginningValue <= 0 || years <= 0) {
    return 0;
  }
  return Math.pow(endingValue / beginningValue, 1 / years) - 1;
}

/**
 * Safe division helper
 * 
 * @param {number} numerator 
 * @param {number} denominator 
 * @param {number} fallback - Value to return if division is invalid
 * @returns {number}
 */
export function safeDivide(numerator, denominator, fallback = 0) {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Clamp a value between min and max
 * 
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round to specified decimal places
 * 
 * @param {number} value 
 * @param {number} decimals 
 * @returns {number}
 */
export function roundTo(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Check if a value is a valid finite number
 * 
 * @param {*} value 
 * @returns {boolean}
 */
export function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Get safe numeric value with fallback
 * 
 * @param {*} value 
 * @param {number} fallback 
 * @returns {number}
 */
export function safeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
