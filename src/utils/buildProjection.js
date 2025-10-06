import { validateParams } from "./calculations.js";

/**
 * Build Financial Projection with DCF Valuation
 * 
 * Generates year-by-year projections of P&L, cash flows, debt service, and credit metrics.
 * Computes Enterprise Value using FCFF discounting and derives Equity Value.
 * 
 * @param {Object} inputParams - Projection parameters
 * @param {number} inputParams.startYear - Starting year
 * @param {number} inputParams.years - Number of projection years
 * @param {number} inputParams.baseRevenue - Revenue in year 0
 * @param {number} inputParams.growth - Annual revenue growth rate
 * @param {number} inputParams.cogsPct - COGS as % of revenue
 * @param {number} inputParams.opexPct - OpEx as % of revenue
 * @param {number} inputParams.capexPct - CapEx as % of revenue
 * @param {number} inputParams.daPctOfPPE - D&A as % of PP&E
 * @param {number} inputParams.wcPctOfRev - Working capital as % of revenue
 * @param {number} inputParams.openingDebt - Initial debt balance
 * @param {number} inputParams.interestRate - Nominal annual interest rate
 * @param {number} inputParams.taxRate - Corporate tax rate
 * @param {number} inputParams.wacc - Weighted average cost of capital
 * @param {number} inputParams.terminalGrowth - Perpetual growth rate
 * @param {number} [inputParams.debtTenorYears=5] - Debt maturity in years
 * @param {number} [inputParams.interestOnlyYears=0] - Interest-only period
 * @param {number} [inputParams.minDSCR=1.2] - Minimum required DSCR
 * @param {number} [inputParams.maxNDToEBITDA=3.5] - Maximum leverage covenant
 * @param {number} [inputParams.targetICR=2.0] - Target interest coverage
 * @param {number} [inputParams.equityContribution=0] - Initial equity investment
 * @param {number} [inputParams.entryMultiple=8.0] - Entry EV/EBITDA multiple
 * @param {string} [inputParams.paymentFrequency='Quarterly'] - Payment frequency
 * @param {number} [inputParams.balloonPercentage=0] - Balloon payment %
 * @param {number[]} [inputParams.customAmortization=null] - Custom amortization %s
 * @param {string} [inputParams.dayCountConvention='Actual/365'] - Day count convention
 * @param {number} [inputParams.cashAtValuation=0] - Cash on hand at valuation date
 * @param {number} [inputParams.associatesValue=0] - Value of associates/JVs
 * @param {number} [inputParams.minorityInterest=0] - Minority interest
 * @param {boolean} [inputParams.useBalloonPayment=false] - Apply balloon only when true and frequency is "Balloon"
 * @param {number[]|null} [inputParams.customAmortizationIntervals=null] - Four interval %s (must total ~100)
 * @param {Object} [opts={}] - Optional settings
 * @param {boolean} [opts.debug=false] - Enable detailed logging
 * @param {Function} [opts.logger=console.debug] - Custom logger
 * @param {number} [opts.precision=6] - Decimal precision for logs
 * @returns {Object} Projection results with valuation
 */
export function buildProjection(inputParams, opts = {}) {
  const { debug = false, logger = console.debug, precision = 6 } = opts;
  const log = (...args) => debug && logger(...args);
  const df = (n) => typeof n === 'number' ? n.toFixed(precision) : 'N/A';
  
  log('=== PROJECTION BUILD START ===');
  
  // Extract and set defaults
  const params = {
    startYear: inputParams.startYear,
    years: inputParams.years,
    baseRevenue: inputParams.baseRevenue,
    growth: inputParams.growth,
    cogsPct: inputParams.cogsPct,
    opexPct: inputParams.opexPct,
    capexPct: inputParams.capexPct,
    daPctOfPPE: inputParams.daPctOfPPE,
    wcPctOfRev: inputParams.wcPctOfRev,
    openingDebt: inputParams.openingDebt,
    interestRate: inputParams.interestRate,
    taxRate: inputParams.taxRate,
    wacc: inputParams.wacc,
    terminalGrowth: inputParams.terminalGrowth,
    debtTenorYears: inputParams.debtTenorYears || 5,
    interestOnlyYears: inputParams.interestOnlyYears || 0,
    minDSCR: inputParams.minDSCR || 1.2,
    maxNDToEBITDA: inputParams.maxNDToEBITDA || 3.5,
    targetICR: inputParams.targetICR || 2.0,
    equityContribution: inputParams.equityContribution || 0,
    entryMultiple: inputParams.entryMultiple || 8.0,
    paymentFrequency: inputParams.paymentFrequency || "Quarterly",
    balloonPercentage: inputParams.balloonPercentage || 0,
    customAmortization: inputParams.customAmortization || null,
    useBalloonPayment: inputParams.useBalloonPayment ?? false,
    customAmortizationIntervals: inputParams.customAmortizationIntervals ?? null,
    dayCountConvention: inputParams.dayCountConvention || "Actual/365",
    
    // NEW: Equity bridge parameters (optional, default to 0)
    // For proper valuation comparison with Path A
    cashAtValuation: inputParams.cashAtValuation ?? 0,
    associatesValue: inputParams.associatesValue ?? 0,
    minorityInterest: inputParams.minorityInterest ?? 0,
  };
  
 const MIN_WACC = 0.01; // 1% minimum
  if (params.wacc < MIN_WACC) {
    console.warn(`WACC of ${(params.wacc * 100).toFixed(2)}% is below minimum. Using ${(MIN_WACC * 100).toFixed(2)}% floor.`);
    params.wacc = MIN_WACC;
  }
  // Validate critical inputs
  if (typeof params.years !== 'number' || params.years < 1 || params.years > 50) {
    throw new Error(`Invalid projection years: ${params.years}. Must be between 1-50.`);
  }
  if (typeof params.wacc !== 'number' || params.wacc <= 0) {
    throw new Error(`Invalid WACC: ${params.wacc}. Must be positive.`);
  }
  if (typeof params.terminalGrowth !== 'number') {
    throw new Error(`Invalid terminal growth: ${params.terminalGrowth}. Must be a number.`);
  }
  
  // CRITICAL: Terminal value guard (Issue #3 from audit)
  if (params.wacc <= params.terminalGrowth) {
    throw new Error(
      `WACC (${(params.wacc * 100).toFixed(2)}%) must exceed terminal growth (${(params.terminalGrowth * 100).toFixed(2)}%) for Gordon TV. ` +
      `Current spread: ${((params.wacc - params.terminalGrowth) * 100).toFixed(4)}%`
    );
  }
  
  if (params.taxRate < 0 || params.taxRate > 1) {
    throw new Error(`Invalid tax rate: ${params.taxRate}. Must be between 0 and 1.`);
  }
  
  log('Input Parameters:', {
    years: params.years,
    baseRevenue: df(params.baseRevenue),
    growth: df(params.growth),
    wacc: df(params.wacc),
    terminalGrowth: df(params.terminalGrowth),
    openingDebt: df(params.openingDebt),
    cashAtValuation: df(params.cashAtValuation),
    interestRate: df(params.interestRate),
    dayCountConvention: params.dayCountConvention,
  });
  
  // Warn if cashAtValuation not provided (backwards compatibility)
  if (params.cashAtValuation === 0 && params.openingDebt > 0) {
    log('⚠️  WARNING: cashAtValuation not provided. Using 0.');
    log('   For accurate equity valuation, specify cash on hand at valuation date.');
  }

  // Calculate effective annual rate considering day count convention
  const effectiveAnnualRate = calculateEffectiveRate(
    params.interestRate, 
    params.dayCountConvention
  );
  
  log('Effective Annual Rate:', df(effectiveAnnualRate), `(convention: ${params.dayCountConvention})`);

  // Calculate payments per year based on frequency
  const paymentsPerYear = getPaymentsPerYear(params.paymentFrequency);
  
  // Initialize state variables
  let ppe = params.baseRevenue * params.capexPct;
  let debt = params.openingDebt;
  const rows = [];
  let revenue = params.baseRevenue;

  // Calculate amortization schedule with proper conditional logic
  const projectionYears = Math.min(params.debtTenorYears, params.years);

  // Only apply balloon when frequency is "Balloon" AND checkbox is checked
  const effectiveBalloonPct = 
    (params.paymentFrequency === "Balloon" && params.useBalloonPayment) 
      ? (params.balloonPercentage || 0) 
      : 0;

  // If customAmortization frequency selected, expand 4 intervals to per-year array
  let effectiveCustomAmort = null;
  if (params.paymentFrequency === "customAmortization" && 
      Array.isArray(params.customAmortizationIntervals)) {
    effectiveCustomAmort = expand4IntervalsToPerYear(
      projectionYears,
      params.interestOnlyYears,
      params.customAmortizationIntervals
    );
  }

  // Fallback to explicit per-year array if provided (backward compatibility)
  if (!effectiveCustomAmort && Array.isArray(params.customAmortization)) {
    effectiveCustomAmort = params.customAmortization;
  }

  const amortSchedule = calculateAmortizationSchedule(
    params.openingDebt,
    projectionYears,
    params.interestOnlyYears,
    effectiveBalloonPct,
    effectiveCustomAmort
  );
  
  log('Payment Structure:', {
    frequency: params.paymentFrequency,
    paymentsPerYear,
    balloonPct: df(effectiveBalloonPct),
    useBalloonPayment: params.useBalloonPayment,
    hasCustomIntervals: !!effectiveCustomAmort,
  });
  
  log('Amortization Schedule:', amortSchedule.map(df));

  // ===== YEARLY PROJECTION LOOP =====
  for (let i = 1; i <= params.years; i++) {
    const year = params.startYear + i - 1;
    if (i > 1) revenue = revenue * (1 + params.growth);

    // P&L calculations
    const cogs = revenue * params.cogsPct;
    const opex = revenue * params.opexPct;
    const ebitda = revenue - cogs - opex;
    const capex = revenue * params.capexPct;
    const da = ppe * params.daPctOfPPE;
    ppe = ppe + capex - da;
    const ebit = ebitda - da;

    // Debt service calculations
    const principal = (i <= amortSchedule.length) ? amortSchedule[i - 1] : 0;
    const interest = debt * effectiveAnnualRate;
    const debtService = interest + principal;
    const endingDebt = Math.max(0, debt - principal);

    // Tax calculations
    const ebt = ebit - interest;
    const tax = Math.max(0, ebt) * params.taxRate;
    const netIncome = ebt - tax;

    // Working capital
    const wc = revenue * params.wcPctOfRev;
    const prevWc = i === 1 ? params.baseRevenue * params.wcPctOfRev : rows[i - 2].wc;
    const deltaWc = wc - prevWc;

    // Free cash flow calculations
    const nopat = ebit * (1 - params.taxRate);
    const fcf = nopat + da - capex - deltaWc;  // FCFF (Free Cash Flow to Firm)
    const fcfToEquity = fcf - debtService;     // FCFE (Free Cash Flow to Equity)

    // Credit metrics with robust handling
    const icr = interest > 0 ? ebitda / interest : 999;
    const dscr = debtService > 0 ? (ebitda - capex - deltaWc) / debtService : 999;
    const ndToEbitda = ebitda > 0 ? endingDebt / ebitda : 0;

    // Discounting
    const discountFactor = 1 / Math.pow(1 + params.wacc, i);
    const pvFCF = fcf * discountFactor;

    // Payment schedule detail (for display/debugging)
    const paymentSchedule = calculatePaymentSchedule(
      debt,
      principal,
      interest,
      paymentsPerYear,
      effectiveAnnualRate
    );

    // Cumulative cash tracking
    const cashBalance = i === 1 ? 0 : rows[i - 2].cashBalance + fcfToEquity;

    rows.push({
      year, revenue, cogs, opex, ebitda, da, ebit, interest, tax, netIncome,
      capex, wc, deltaWc, fcf, fcfToEquity, discountFactor, pvFCF,
      principal, debtService, endingDebt, icr, dscr, ndToEbitda,
      icrBreach: icr < params.targetICR,
      dscrBreach: dscr < params.minDSCR,
      ndBreach: ndToEbitda > params.maxNDToEBITDA,
      paymentsPerYear,
      paymentSchedule,
      cashBalance,
      nopat, // Add for transparency
      ppe,   // Add for transparency
    });
    
    // Log each year's calculations
    if (debug) {
      log(`--- Year ${i} (${year}) ---`, {
        revenue: df(revenue),
        ebitda: df(ebitda),
        da: df(da),
        ebit: df(ebit),
        interest: df(interest),
        tax: df(tax),
        nopat: df(nopat),
        capex: df(capex),
        deltaWc: df(deltaWc),
        fcf: df(fcf),
        fcfToEquity: df(fcfToEquity),
        discountFactor: df(discountFactor),
        pvFCF: df(pvFCF),
        principal: df(principal),
        debtService: df(debtService),
        endingDebt: df(endingDebt),
        icr: df(icr),
        dscr: df(dscr),
        ndToEbitda: df(ndToEbitda),
      });
    }

    debt = endingDebt;
  }

  log('=== PROJECTION COMPLETE, COMPUTING VALUATION ===');

  // ===== TERMINAL VALUE & ENTERPRISE VALUE =====
  const last = rows[rows.length - 1];
  const fcfNext = last.fcf * (1 + params.terminalGrowth);
  const tv = fcfNext / (params.wacc - params.terminalGrowth);
  const tvPV = tv / Math.pow(1 + params.wacc, params.years);
  const sumPvFCF = rows.reduce((sum, row) => sum + row.pvFCF, 0);
  const enterpriseValue = sumPvFCF + tvPV;
  
  log('Terminal Value Inputs:', {
    lastFCF: df(last.fcf),
    terminalGrowth: df(params.terminalGrowth),
    wacc: df(params.wacc),
    fcfNext: df(fcfNext),
  });
  
  log('Terminal Value:', df(tv));
  log('PV of Terminal Value:', df(tvPV), `(discounted ${params.years} periods)`);
  log('Sum of PV(FCF):', df(sumPvFCF));
  log('Enterprise Value:', df(enterpriseValue), '(PV FCFs + PV TV)');
  
  // ===== EQUITY VALUE BRIDGE (CRITICAL FIX - Issue #2) =====
  // CORRECT: Use net debt AT VALUATION DATE (t=0), not ending debt (t=n)
  // Net Debt at Valuation = Opening Debt - Cash at Valuation
  const netDebtAtValuation = params.openingDebt - params.cashAtValuation;
  
  // Equity Value = EV - Net Debt (t=0) + Associates - Minority Interest
  const equityValue = enterpriseValue - netDebtAtValuation + params.associatesValue - params.minorityInterest;
  
  log('Equity Bridge:', {
    enterpriseValue: df(enterpriseValue),
    openingDebt: df(params.openingDebt),
    cashAtValuation: df(params.cashAtValuation),
    netDebtAtValuation: df(netDebtAtValuation),
    associatesValue: df(params.associatesValue),
    minorityInterest: df(params.minorityInterest),
    equityValue: df(equityValue),
  });
  
  // Validate results
  if (!isFinite(enterpriseValue) || !isFinite(equityValue)) {
    throw new Error('Valuation resulted in non-finite values. Check inputs.');
  }
  
  if (equityValue < 0) {
    log('WARNING: Equity value is negative. Company may be insolvent or inputs incorrect.');
  }
  
  // ===== RETURNS CALCULATIONS =====
  const totalDebtPaid = params.openingDebt - (last.endingDebt || 0);
  
  // Terminal equity value for IRR/MOIC (what investor gets at exit)
  const terminalEquityValue = equityValue; // Or could use exit multiple approach
  
  // MOIC = Total value returned / Initial investment
  const moic = params.equityContribution > 0 
    ? (terminalEquityValue + rows.reduce((sum, r) => sum + Math.max(0, r.fcfToEquity), 0)) / params.equityContribution
    : 0;
  
  // IRR with proper cash flows
  const irr = params.equityContribution > 0 
    ? calculateIRR(params.equityContribution, rows, terminalEquityValue) 
    : 0;
  
  log('Returns:', {
    moic: df(moic),
    irr: df(irr * 100) + '%',
  });

  // ===== CREDIT STATISTICS =====
  const validDSCRs = rows.map(r => r.dscr).filter(v => Number.isFinite(v) && v < 999);
  const validICRs = rows.map(r => r.icr).filter(v => Number.isFinite(v) && v < 999);
  const validLeverages = rows.map(r => r.ndToEbitda).filter(v => Number.isFinite(v));
  
  const minDSCR = validDSCRs.length > 0 ? Math.min(...validDSCRs) : 0;
  const minICR = validICRs.length > 0 ? Math.min(...validICRs) : 0;
  const maxLeverage = validLeverages.length > 0 ? Math.max(...validLeverages) : 0;
  const avgDSCR = validDSCRs.length > 0 
    ? validDSCRs.reduce((sum, v) => sum + v, 0) / validDSCRs.length 
    : 0;
  
  const breaches = {
    dscrBreaches: rows.filter(r => r.dscrBreach).length,
    icrBreaches: rows.filter(r => r.icrBreach).length,
    ndBreaches: rows.filter(r => r.ndBreach).length,
  };

  const creditStats = {
    minDSCR,
    minICR,
    maxLeverage,
    avgDSCR,
  };
  
  log('Credit Stats:', creditStats);
  log('Covenant Breaches:', breaches);

  // Cash at maturity for balloon analysis
  const cashAtMaturity = rows[Math.min(params.debtTenorYears - 1, rows.length - 1)]?.cashBalance || 0;

  log('=== PROJECTION BUILD COMPLETE ===\n');

  return { 
    // Core results (always returned - backwards compatible)
    rows, 
    enterpriseValue, 
    equityValue, 
    tv, 
    tvPV, 
    moic, 
    irr,
    creditStats,
    breaches,
    cashAtMaturity,
    endingDebtBalance: last.endingDebt || 0,
    totalDebtPaid,
    paymentStructure: {
      frequency: params.paymentFrequency,
      paymentsPerYear,
      balloonPercentage: effectiveBalloonPct,
      dayCountConvention: params.dayCountConvention,
      effectiveAnnualRate,
    },
    
    // Extended diagnostics (always safe to return, won't break existing code)
    netDebtAtValuation,
    wacc: params.wacc,
    terminalGrowth: params.terminalGrowth,
    
    // Optional equity bridge components (only if provided)
    ...(params.cashAtValuation !== undefined && params.cashAtValuation !== 0 && {
      cashAtValuation: params.cashAtValuation,
    }),
    ...(params.associatesValue !== undefined && params.associatesValue !== 0 && {
      associatesValue: params.associatesValue,
    }),
    ...(params.minorityInterest !== undefined && params.minorityInterest !== 0 && {
      minorityInterest: params.minorityInterest,
    }),
    openingDebt: params.openingDebt,
  };
}

/**
 * Calculate effective annual rate based on day count convention
 * 
 * @param {number} nominalRate - Nominal annual rate
 * @param {string} convention - Day count convention
 * @returns {number} Effective annual rate
 */
function calculateEffectiveRate(nominalRate, convention) {
  if (typeof nominalRate !== 'number' || nominalRate < 0) {
    throw new Error(`Invalid nominal rate: ${nominalRate}`);
  }
  
  switch (convention) {
    case "Actual/360":
      // Actual/360: Annual rate is quoted assuming 360-day year
      // Over 365 actual days, effective rate is higher
      return nominalRate * (365 / 360);
    
    case "30/360":
      // 30/360: Assumes 30-day months and 360-day years
      // For annual calculations, approximates Actual/365
      return nominalRate;
    
    case "Actual/365":
    default:
      return nominalRate;
  }
}

/**
 * Expand 4 custom intervals (% per bucket) into per-year % array
 * @param {number} tenorYears - Total tenor
 * @param {number} interestOnlyYears - IO period
 * @param {number[]} intervals - [interval1%, interval2%, interval3%, interval4%]
 * @returns {number[]} Per-year percentages that sum to ~100
 */
function expand4IntervalsToPerYear(tenorYears, interestOnlyYears, intervals) {
  if (!Array.isArray(intervals) || intervals.length !== 4) {
    return null;
  }
  
  const ioYrs = Math.max(0, Math.min(tenorYears, interestOnlyYears || 0));
  const amortYears = Math.max(tenorYears - ioYrs, 1);
  const base = Math.floor(amortYears / 4);
  const rem = amortYears % 4;
  
  const perYear = [];
  
  // Interest-only years: 0% principal
  for (let y = 0; y < ioYrs; y++) {
    perYear.push(0);
  }
  
  // Distribute each interval across its bucket
  for (let k = 0; k < 4; k++) {
    const bucketYears = base + (k < rem ? 1 : 0);
    const pctPerYear = bucketYears > 0 ? (intervals[k] || 0) / bucketYears : 0;
    for (let y = 0; y < bucketYears; y++) {
      perYear.push(pctPerYear);
    }
  }
  
  // Pad to tenor length
  while (perYear.length < tenorYears) {
    perYear.push(0);
  }
  
  // Normalize to 100% (handle floating point drift)
  const sum = perYear.reduce((s, v) => s + v, 0);
  if (Math.abs(sum - 100) > 0.01 && sum > 0) {
    for (let i = perYear.length - 1; i >= ioYrs; i--) {
      if (perYear[i] > 0) {
        perYear[i] += (100 - sum);
        break;
      }
    }
  }
  
  return perYear;
}

/**
 * Calculate amortization schedule with proper logic
 * 
 * @param {number} principalAmount - Initial loan principal
 * @param {number} projectionYears - Number of years in projection
 * @param {number} interestOnlyYears - Years with no principal payment
 * @param {number} balloonPct - Balloon payment as % of original principal
 * @param {number[]|null} customAmortization - Custom amortization percentages
 * @returns {number[]} Annual principal payments
 */
function calculateAmortizationSchedule(
  principalAmount, 
  projectionYears,
  interestOnlyYears, 
  balloonPct, 
  customAmortization
) {
  if (typeof principalAmount !== 'number' || principalAmount < 0) {
    throw new Error(`Invalid principal amount: ${principalAmount}`);
  }
  if (typeof projectionYears !== 'number' || projectionYears < 1) {
    throw new Error(`Invalid projection years: ${projectionYears}`);
  }
  if (typeof interestOnlyYears !== 'number' || interestOnlyYears < 0) {
    throw new Error(`Invalid interest-only years: ${interestOnlyYears}`);
  }
  if (interestOnlyYears >= projectionYears) {
    console.warn(`Interest-only period (${interestOnlyYears}) >= projection period (${projectionYears}). No amortization will occur.`);
  }
  
  const schedule = [];
  
  // If custom amortization provided and valid, use it
  if (customAmortization && Array.isArray(customAmortization) && customAmortization.length > 0) {
    const totalPct = customAmortization.reduce((sum, pct) => sum + pct, 0);
    // Allow 1% tolerance for rounding
    if (Math.abs(totalPct - 100) < 1) {
      return customAmortization.map(pct => (pct / 100) * principalAmount);
    } else {
      console.warn(`Custom amortization percentages sum to ${totalPct.toFixed(2)}%, expected 100%. Ignoring custom schedule.`);
    }
  }
  
  // Calculate balloon and amortizing portions
  const balloonAmount = (balloonPct / 100) * principalAmount;
  const amortizingAmount = principalAmount - balloonAmount;
  
  // Amortization years = period between IO end and maturity
  const amortYears = Math.max(1, projectionYears - interestOnlyYears);
  const annualPrincipal = amortYears > 0 ? amortizingAmount / amortYears : 0;
  
  for (let year = 1; year <= projectionYears; year++) {
    if (year <= interestOnlyYears) {
      // Interest-only period: no principal payment
      schedule.push(0);
    } else if (year === projectionYears && balloonPct > 0) {
      // Final year with balloon: regular amortization + balloon
      schedule.push(annualPrincipal + balloonAmount);
    } else if (year > interestOnlyYears) {
      // Regular amortization years
      schedule.push(annualPrincipal);
    } else {
      schedule.push(0);
    }
  }
  
  // Validate total equals principal (allowing for floating point errors)
  const totalScheduled = schedule.reduce((sum, p) => sum + p, 0);
  if (Math.abs(totalScheduled - principalAmount) > 0.01) {
    console.warn(`Amortization schedule total (${totalScheduled.toFixed(2)}) != principal (${principalAmount.toFixed(2)})`);
  }
  
  return schedule;
}

/**
 * Calculate actual payment schedule for sub-annual periods
 * NOTE: This is illustrative. For true amortizing loans, use PMT formula.
 * 
 * @param {number} beginningBalance - Debt balance at start of year
 * @param {number} annualPrincipal - Total principal to pay this year
 * @param {number} annualInterest - Total interest for the year
 * @param {number} paymentsPerYear - Number of payments per year
 * @param {number} annualRate - Annual interest rate
 * @returns {Object[]} Payment schedule by period
 */
function calculatePaymentSchedule(beginningBalance, annualPrincipal, annualInterest, paymentsPerYear, annualRate) {
  if (!paymentsPerYear || paymentsPerYear <= 1) {
    // Annual payments - simple case
    return [{
      period: 1,
      principal: annualPrincipal,
      interest: annualInterest,
      total: annualPrincipal + annualInterest,
      endingBalance: beginningBalance - annualPrincipal,
    }];
  }

  // For sub-annual payments, simulate declining balance
  // NOTE: This is NOT a true amortizing schedule (constant PMT)
  // It linearly distributes principal and recalculates interest each period
  const periodicRate = annualRate / paymentsPerYear;
  const principalPerPeriod = annualPrincipal / paymentsPerYear;
  
  const schedule = [];
  let remainingBalance = beginningBalance;
  
  for (let period = 1; period <= paymentsPerYear; period++) {
    const periodInterest = remainingBalance * periodicRate;
    const periodPrincipal = principalPerPeriod;
    
    schedule.push({
      period,
      principal: periodPrincipal,
      interest: periodInterest,
      total: periodPrincipal + periodInterest,
      endingBalance: Math.max(0, remainingBalance - periodPrincipal),
    });
    
    remainingBalance = Math.max(0, remainingBalance - periodPrincipal);
}
  
  return schedule;
}

/**
 * Get number of payments per year based on frequency
 * 
 * @param {string} frequency - Payment frequency
 * @returns {number} Payments per year
 */
function getPaymentsPerYear(frequency) {
  const frequencyMap = {
    Monthly: 12,
    Quarterly: 4,
    "Semi-Annually": 2,
    Annually: 1,
    Bullet: 1,                // treat as annual to avoid divide-by-zero
    Balloon: 12,              // monthly display by default
    customAmortization: 12,   // monthly display by default
  };

  const payments = frequencyMap[frequency];
  if (payments === undefined) {
    console.warn(`Unknown payment frequency: ${frequency}. Defaulting to Quarterly.`);
    return 4;
  }
  return payments;
}

/**
 * Calculate IRR using Newton-Raphson method
 * 
 * @param {number} initialInvestment - Upfront equity investment (positive number)
 * @param {Object[]} rows - Projection rows
 * @param {number} terminalEquityValue - Exit equity value
 * @returns {number} Internal rate of return (decimal)
 */
function calculateIRR(initialInvestment, rows, terminalEquityValue) {
  if (typeof initialInvestment !== 'number' || initialInvestment <= 0) {
    throw new Error(`Invalid initial investment: ${initialInvestment}. Must be positive.`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Rows array is empty or invalid.');
  }
  if (typeof terminalEquityValue !== 'number') {
    throw new Error(`Invalid terminal equity value: ${terminalEquityValue}`);
  }
  
  // Build cash flow array: -Initial investment, then annual FCFE, then FCFE + exit value in last year
  const cashFlows = [-initialInvestment];
  
  rows.forEach((row, idx) => {
    if (idx === rows.length - 1) {
      // Last year: add FCFE + terminal equity value (exit proceeds)
      cashFlows.push(row.fcfToEquity + terminalEquityValue);
    } else {
      cashFlows.push(row.fcfToEquity);
    }
  });
  
  // Newton-Raphson iteration
  let irr = 0.1; // Initial guess: 10%
  const maxIterations = 100;
  const tolerance = 0.0001;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let npv = 0;
    let dnpv = 0; // Derivative of NPV w.r.t. IRR
    
    for (let i = 0; i < cashFlows.length; i++) {
      const discountFactor = Math.pow(1 + irr, i);
      npv += cashFlows[i] / discountFactor;
      
      // Derivative: d/dr [CF / (1+r)^i] = -i * CF / (1+r)^(i+1)
      if (i > 0) {
        dnpv -= i * cashFlows[i] / Math.pow(1 + irr, i + 1);
      }
    }
    
    // Check convergence
    if (Math.abs(npv) < tolerance) break;
    
    // Prevent division by zero
    if (Math.abs(dnpv) < 1e-10) {
      console.warn('IRR calculation: derivative near zero. Stopping iteration.');
      break;
    }
    
    // Newton-Raphson step
    irr = irr - npv / dnpv;
    
    // Keep IRR in reasonable bounds to prevent runaway
    if (irr < -0.99) irr = -0.99;
    if (irr > 10) irr = 10;
  }
  
  // Final validation
  if (!isFinite(irr)) {
    console.warn('IRR calculation resulted in non-finite value. Returning 0.');
    return 0;
  }
  
  return irr;
}

export function periodsPerYear(freq) {
  return getPaymentsPerYear(freq);
}