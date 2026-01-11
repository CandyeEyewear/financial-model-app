// ============================================================================
// buildProjection.js - IFRS-Compliant Financial Projection Model
// ============================================================================
// Enhanced with proper accounting standards:
// - IAS 1: Presentation of Financial Statements
// - IAS 7: Statement of Cash Flows
// - IFRS 9: Financial Instruments (debt amortization)
// - IAS 12: Income Taxes
// ============================================================================

import { calculateIRR, calculateMOIC, safeDivide } from './financialCalculations';

/**
 * Calculate interest based on day count convention
 * @param {number} principal - Loan principal
 * @param {number} annualRate - Annual interest rate (decimal)
 * @param {number} days - Number of days in period
 * @param {string} convention - Day count convention
 * @returns {number} - Interest amount
 */
function calculateInterestWithDayCount(principal, annualRate, days, convention = 'Actual/360') {
  switch (convention) {
    case 'Actual/360':
      return principal * annualRate * (days / 360);
    case 'Actual/365':
      return principal * annualRate * (days / 365);
    case '30/360':
      // Assumes 30 days per month, 360 days per year
      return principal * annualRate * (days / 360);
    case 'Actual/Actual':
      // For simplicity, use actual days / actual days in year
      return principal * annualRate * (days / 365.25);
    default:
      // Default to Actual/360 (common in commercial lending)
      return principal * annualRate * (days / 360);
  }
}

/**
 * Get the last day of a given year
 * @param {number} year - The year
 * @returns {string} - ISO date string (YYYY-MM-DD)
 */
function getYearEndDate(year) {
  // December 31st of the given year
  return `${year}-12-31`;
}

/**
 * Helper function to determine payments per year based on frequency
 */
function getPaymentsPerYear(frequency) {
  const frequencies = {
    'Monthly': 12,
    'Quarterly': 4,
    'Semi-Annually': 2,
    'Annually': 1,
    'Bullet': 0,
    'Balloon': 4,
    'customAmortization': 4
  };
  return frequencies[frequency] || 4;
}

/**
 /**
 * Calculate debt amortization schedule with support for multiple amortization types
 * Supports: Amortizing, Interest-Only, Bullet
 * 
 * @param {Object} params - Debt parameters
 * @returns {Array} Amortization schedule by year
 */
function buildAmortizationSchedule(params) {
  const schedule = [];

  // CRITICAL: Respect hasExistingDebt toggle - if OFF, ignore existing debt fields
  const existingDebtAmount = (params.hasExistingDebt === true) ? (params.openingDebt || 0) : 0;
  const newFacilityAmount = params.requestedLoanAmount || 0;
  const principal = existingDebtAmount + newFacilityAmount;
  
  // No debt - return empty schedule
  if (principal === 0) {
    return Array(params.years).fill({
      principal: 0,
      interest: 0,
      totalPayment: 0,
      endingBalance: 0,
      paymentsInYear: 0
    });
  }

  // Determine the appropriate rate based on what debt exists
  // CRITICAL: Respect hasExistingDebt toggle for rate selection too
  const hasOpeningDebt = (params.hasExistingDebt === true) && (params.openingDebt || 0) > 0;
  const hasNewFacility = (params.requestedLoanAmount || 0) > 0;

  let annualRate;
  if (hasOpeningDebt && !hasNewFacility) {
    // Only existing debt - use existing debt rate
    annualRate = params.existingDebtRate || params.interestRate || 0;
  } else if (!hasOpeningDebt && hasNewFacility) {
    // Only new facility - use proposed pricing
    annualRate = params.proposedPricing || params.interestRate || 0;
  } else if (hasOpeningDebt && hasNewFacility) {
    // Both exist - use blended rate or fall back to general interestRate
    annualRate = params.interestRate || params.proposedPricing || 0;
  } else {
    // Neither - use the general interestRate
    annualRate = params.interestRate || 0;
  }
  const tenorYears = params.debtTenorYears || params.proposedTenor || 5;
  const interestOnlyYears = params.interestOnlyYears || params.interestOnlyPeriod || 0;

  // Get amortization type - prefer new facility type when toggle is OFF
  const amortizationType = hasOpeningDebt
    ? (params.openingDebtAmortizationType || 'amortizing')
    : (params.facilityAmortizationType || params.amortizationType || 'amortizing');
  
  // Calculate maturity year relative to start year
  // CRITICAL: Only use openingDebtMaturityDate when existing debt toggle is ON
  const startYear = params.startYear;
  const maturityYear = (hasOpeningDebt && params.openingDebtMaturityDate)
    ? new Date(params.openingDebtMaturityDate).getFullYear()
    : startYear + tenorYears;
  
  let remainingBalance = principal;

  for (let i = 0; i < params.years; i++) {
    const currentYear = startYear + i;
    const yearsRemaining = maturityYear - currentYear;
    
    // If debt has matured or fully repaid, zero out everything
    if (yearsRemaining <= 0 || remainingBalance <= 0) {
      schedule.push({
        principal: 0,
        interest: 0,
        totalPayment: 0,
        endingBalance: 0,
        paymentsInYear: 0
      });
      continue;
    }

    // Calculate interest payment using day count convention
    // For annual projections, assume 365 days per year
    const dayCountConvention = params.dayCountConvention || 'Actual/365';
    const interestPayment = calculateInterestWithDayCount(remainingBalance, annualRate, 365, dayCountConvention);
    
    // Calculate principal payment based on amortization type
    let principalPayment = 0;
    
    switch(amortizationType) {
      case 'amortizing':
        // Regular amortization with interest-only period support
        const amortizationYears = Math.max(1, tenorYears - interestOnlyYears);
        const yearsSinceAmortizationStart = Math.max(0, i - interestOnlyYears);
        const remainingAmortizationYears = Math.max(1, amortizationYears - yearsSinceAmortizationStart);
        
        if (i < interestOnlyYears) {
          // Still in interest-only period
          principalPayment = 0;
        } else {
          // In amortization period - equal principal payments
          principalPayment = remainingBalance / remainingAmortizationYears;
        }
        break;
        
      case 'interest-only':
        // No principal payment until maturity
        if (yearsRemaining === 1) {
          // Last year before maturity - pay off all remaining principal
          principalPayment = remainingBalance;
        } else {
          principalPayment = 0;
        }
        break;
        
      case 'bullet':
        // Everything due at maturity (no interim payments)
        if (yearsRemaining === 1) {
          principalPayment = remainingBalance;
        } else {
          principalPayment = 0;
        }
        break;
        
      default:
        // Fallback to amortizing
        const defaultAmortYears = Math.max(1, tenorYears - interestOnlyYears);
        principalPayment = i >= interestOnlyYears 
          ? remainingBalance / (defaultAmortYears - (i - interestOnlyYears))
          : 0;
    }
    
    // Ensure principal payment doesn't exceed remaining balance
    principalPayment = Math.min(principalPayment, remainingBalance);
    
    // Calculate total payment and update balance
    const totalPayment = interestPayment + principalPayment;
    remainingBalance = Math.max(0, remainingBalance - principalPayment);

    // Determine number of payments per year
    const paymentsInYear = getPaymentsPerYear(params.paymentFrequency || params.openingDebtPaymentFrequency || 'Quarterly');

    schedule.push({
      principal: principalPayment,
      interest: interestPayment,
      totalPayment: totalPayment,
      endingBalance: remainingBalance,
      paymentsInYear: paymentsInYear
    });
  }

  return schedule;
}

/**
 * Build multi-tranche debt schedule by aggregating individual tranches
 * 
 * @param {Object} params - Model parameters with debtTranches array
 * @returns {Array} Aggregated amortization schedule by year
 */
function buildMultiTrancheSchedule(params) {
  // Check if we have multiple tranches enabled
  if (!params.hasMultipleTranches || !params.debtTranches?.length) {
    // Fall back to single debt calculation
    return buildAmortizationSchedule(params);
  }
  
  // Calculate each tranche separately
  const trancheSchedules = params.debtTranches.map(tranche => {
    // Create params object for this specific tranche
    // IMPORTANT: Clear requestedLoanAmount to prevent double-counting when
    // buildAmortizationSchedule adds openingDebt + requestedLoanAmount
    const trancheParams = {
      ...params,
      hasExistingDebt: true, // CRITICAL: Must be true so buildAmortizationSchedule processes openingDebt
      openingDebt: tranche.amount,
      requestedLoanAmount: 0, // Clear to prevent double-counting with tranche.amount
      interestRate: tranche.rate,
      debtTenorYears: tranche.tenorYears,
      openingDebtMaturityDate: tranche.maturityDate,
      openingDebtAmortizationType: tranche.amortizationType,
      openingDebtPaymentFrequency: tranche.paymentFrequency || 'Quarterly',
      interestOnlyYears: tranche.interestOnlyYears || 0,
      openingDebtStartDate: params.startYear.toString() + '-01-01' // Use projection start year
    };
    
    return {
      tranche: tranche,
      schedule: buildAmortizationSchedule(trancheParams)
    };
  });
  
  // Aggregate by year
  const aggregatedSchedule = [];
  for (let year = 0; year < params.years; year++) {
    const yearData = {
      year,
      interest: 0,
      principal: 0,
      totalPayment: 0,
      endingBalance: 0,
      paymentsInYear: 0,
      trancheDetails: []
    };
    
    trancheSchedules.forEach(({ tranche, schedule }) => {
      const trancheYear = schedule[year] || { 
        interest: 0, 
        principal: 0, 
        totalPayment: 0, 
        endingBalance: 0,
        paymentsInYear: 0
      };
      
      yearData.interest += trancheYear.interest;
      yearData.principal += trancheYear.principal;
      yearData.totalPayment += trancheYear.totalPayment;
      yearData.endingBalance += trancheYear.endingBalance;
      
      // Take the max payments in year (for display purposes)
      yearData.paymentsInYear = Math.max(yearData.paymentsInYear, trancheYear.paymentsInYear);
      
      yearData.trancheDetails.push({
        name: tranche.name,
        seniority: tranche.seniority,
        amount: tranche.amount,
        rate: tranche.rate,
        interest: trancheYear.interest,
        principal: trancheYear.principal,
        totalPayment: trancheYear.totalPayment,
        endingBalance: trancheYear.endingBalance
      });
    });
    
    aggregatedSchedule.push(yearData);
  }
  
  return aggregatedSchedule;
}

/**
 * Build financial projection with full three-statement model
 * Compliant with IAS 1 (Presentation of Financial Statements)
 * 
 * @param {Object} params - Model parameters
 * @returns {Object} Complete financial projection
 */
export function buildProjection(params) {
  // ============================================================================
  // DEBUG: Log debt-related params
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('buildProjection CALLED with debt params:');
  console.log('  hasExistingDebt toggle:', params.hasExistingDebt);
  console.log('  openingDebt:', params.openingDebt);
  console.log('  requestedLoanAmount:', params.requestedLoanAmount);
  console.log('  proposedPricing:', params.proposedPricing);
  console.log('  proposedTenor:', params.proposedTenor);
  console.log('═══════════════════════════════════════════════════════════');

  // ============================================================================
  // PARAMETER VALIDATION
  // ============================================================================
  
  if (!params.baseRevenue || params.baseRevenue <= 0) {
    console.warn('⚠️ Base revenue must be positive');
  }
  
  if (params.wacc <= params.terminalGrowth) {
    console.warn(`⚠️ WACC (${(params.wacc*100).toFixed(2)}%) must exceed terminal growth (${(params.terminalGrowth*100).toFixed(2)}%)`);
  }
  
  // ============================================================================
  // INITIALIZE VARIABLES
  // ============================================================================
  
  const rows = [];
  
  // Balance sheet items (IAS 1: Statement of Financial Position)
let accumulatedPPE = 0;  // Property, Plant & Equipment (gross)
let accumulatedDepreciation = 0;  // Accumulated depreciation (contra-asset)
let prevWorkingCapital = 0;  // Previous year working capital
let cumulativeCash = params.openingCash || 0;  // Cash and cash equivalents (IAS 7) - starts with opening balance
let retainedEarnings = 0;  // Accumulated retained earnings

// ============================================================================
// AUTO-EXTEND PROJECTION PERIOD TO COVER ALL DEBT MATURITIES
// ============================================================================
// Auto-extend if needed
// ============================================================================

// ============================================================================
// CALCULATE DEBT AMORTIZATION SCHEDULE
// ============================================================================
// Support both single debt and multi-tranche structures
const debtSchedule = (() => {
  // CRITICAL: Respect hasExistingDebt toggle
  const hasOpeningDebt = (params.hasExistingDebt === true) && (params.openingDebt || 0) > 0;
  const hasNewFacility = (params.requestedLoanAmount || 0) > 0;

  // Explicit multi-tranche mode - but also check for standalone debt amounts
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    // Start with user-defined tranches
    let allTranches = [...params.debtTranches];

    // Check if opening debt is already represented in tranches
    const existingDebtInTranches = params.debtTranches.some(t =>
      t.name === 'Existing Debt' || t.name === 'Opening Debt' || t.isOpeningDebt
    );

    // Check if new facility is already represented in tranches
    const newFacilityInTranches = params.debtTranches.some(t =>
      t.name === 'New Facility' || t.name === 'Requested Loan' || t.isNewFacility
    );

    // Add opening debt as a tranche if it exists and isn't already included
    if (hasOpeningDebt && !existingDebtInTranches) {
      allTranches.unshift({
        name: 'Existing Debt',
        amount: params.openingDebt,
        rate: params.existingDebtRate || params.interestRate,
        tenorYears: params.existingDebtTenor || params.debtTenorYears,
        maturityDate: params.openingDebtMaturityDate,
        amortizationType: params.existingDebtAmortizationType || 'amortizing',
        paymentFrequency: params.openingDebtPaymentFrequency || 'Quarterly',
        interestOnlyYears: 0,
        seniority: 'Senior',
        isOpeningDebt: true
      });
    }

    // Add new facility as a tranche if it exists and isn't already included
    if (hasNewFacility && !newFacilityInTranches) {
      allTranches.push({
        name: 'New Facility',
        amount: params.requestedLoanAmount,
        rate: params.proposedPricing || params.interestRate,
        tenorYears: params.proposedTenor || params.debtTenorYears,
        maturityDate: calculateMaturityDate(params.startYear, params.proposedTenor || params.debtTenorYears),
        amortizationType: params.facilityAmortizationType || 'amortizing',
        paymentFrequency: params.paymentFrequency || 'Quarterly',
        interestOnlyYears: params.interestOnlyPeriod || 0,
        seniority: 'Senior',
        isNewFacility: true
      });
    }

    const mergedParams = {
      ...params,
      debtTranches: allTranches
    };
    return buildMultiTrancheSchedule(mergedParams);
  }

  // Auto-create tranches when both existing AND new debt exist
  if (hasOpeningDebt && hasNewFacility) {
    const autoTranches = {
      ...params,
      hasMultipleTranches: true,
      debtTranches: [
        {
          name: 'Existing Debt',
          amount: params.openingDebt,
          rate: params.existingDebtRate || params.interestRate,
          tenorYears: params.existingDebtTenor || params.debtTenorYears,
          maturityDate: params.openingDebtMaturityDate,
          amortizationType: params.existingDebtAmortizationType || 'amortizing',
          paymentFrequency: params.openingDebtPaymentFrequency || 'Quarterly',
          interestOnlyYears: 0,
          seniority: 'Senior',
          isOpeningDebt: true
        },
        {
          name: 'New Facility',
          amount: params.requestedLoanAmount,
          rate: params.proposedPricing || params.interestRate,
          tenorYears: params.proposedTenor || params.debtTenorYears,
          maturityDate: calculateMaturityDate(params.startYear, params.proposedTenor || params.debtTenorYears),
          amortizationType: params.facilityAmortizationType || 'amortizing',
          paymentFrequency: params.paymentFrequency || 'Quarterly',
          interestOnlyYears: params.interestOnlyPeriod || 0,
          seniority: 'Senior',
          isNewFacility: true
        }
      ]
    };
    return buildMultiTrancheSchedule(autoTranches);
  }

  // Single debt source only (either existing OR new, not both)
  return buildAmortizationSchedule(params);
})();

// Helper function for calculating maturity date
function calculateMaturityDate(startYear, tenorYears) {
  const maturityYear = startYear + tenorYears;
  return new Date(maturityYear, 11, 31).toISOString().split('T')[0];
}
  
  // ============================================================================
  // ANNUAL PROJECTIONS
  // ============================================================================
  
  for (let i = 0; i < params.years; i++) {
    const year = params.startYear + i;
    
    // ==========================================================================
    // INCOME STATEMENT (IAS 1: Profit or Loss)
    // ==========================================================================
    
    // Revenue recognition (IFRS 15: Revenue from Contracts with Customers)
    const revenue = params.baseRevenue * Math.pow(1 + params.growth, i);
    
    // Cost of sales (IAS 2: Inventories)
    const cogs = revenue * params.cogsPct;
    
    // Gross profit
    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
    
    // Operating expenses (IAS 1: by function classification)
    const opex = revenue * params.opexPct;
    
    // EBITDA (Earnings Before Interest, Tax, Depreciation & Amortization)
    // Non-GAAP metric but widely used for credit analysis
    const ebitda = grossProfit - opex;
    const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
    
    // Capital expenditure (IAS 16: Property, Plant and Equipment)
    const capex = revenue * params.capexPct;
    accumulatedPPE += capex;
    
    // Depreciation expense (IAS 16: systematic allocation)
    const depreciation = accumulatedPPE * params.daPctOfPPE;
    accumulatedDepreciation += depreciation;
    
    // EBIT (Operating Profit/Loss) - IAS 1 required line item
    const ebit = ebitda - depreciation;
    const ebitMargin = revenue > 0 ? ebit / revenue : 0;
    
    // ==========================================================================
    // DEBT SERVICE (IFRS 9: Financial Instruments)
    // ==========================================================================
    
    const debtYear = debtSchedule[i] || { 
      principal: 0, 
      interest: 0, 
      totalPayment: 0, 
      endingBalance: 0,
      paymentsInYear: 0,
      trancheDetails: []
    };
    
    // Finance costs (IAS 1: separate disclosure required)
    const interestExpense = debtYear.interest;
    const principalPayment = debtYear.principal;
    const totalDebtService = debtYear.totalPayment;
    
    // Profit before tax (IAS 1 required line item)
    const ebt = ebit - interestExpense;
    
    // Income tax expense (IAS 12: Income Taxes)
    // Using effective tax rate on positive profits only
    const tax = ebt > 0 ? ebt * params.taxRate : 0;
    
    // Profit for the period (IAS 1 required line item)
    const netIncome = ebt - tax;
    const netMargin = revenue > 0 ? netIncome / revenue : 0;
    
    // ==========================================================================
    // BALANCE SHEET ITEMS (IAS 1: Statement of Financial Position)
    // ==========================================================================
    
    // Working capital (IAS 1: Current assets - Current liabilities)
    const workingCapital = revenue * params.wcPctOfRev;
    const wcDelta = workingCapital - prevWorkingCapital;
    prevWorkingCapital = workingCapital;
    
    // Cash and cash equivalents (IAS 7: Cash Flow Statement)
    const operatingCashFlow = ebitda - tax - wcDelta;
    const freeCashFlowBeforeDebt = operatingCashFlow - capex;

    // Cash balance (accumulated, net of dividends/distributions)
    // Cash retention rate can be:
    // 1. Explicitly set via params.cashRetentionRate
    // 2. Calculated from historicals (passed through params)
    // 3. Default to 10% if not provided
    const cashRetentionRate = params.cashRetentionRate ?? 0.10;
    const cashRetention = netIncome > 0 ? netIncome * cashRetentionRate : netIncome;
    cumulativeCash = Math.max(0, cumulativeCash + cashRetention);
    
    // Retained earnings (IAS 1: Equity component)
    retainedEarnings += netIncome;
    
    // Net debt (credit metric, not IFRS)
    const grossDebt = debtYear.endingBalance;
    const netDebt = Math.max(0, grossDebt - cumulativeCash);
    
    // Net PPE (IAS 16: Carrying amount)
    const netPPE = accumulatedPPE - accumulatedDepreciation;
    
    // ==========================================================================
    // COVENANT RATIOS (Credit Analysis - Industry Standard)
    // ==========================================================================

    // Debt Service Coverage Ratio (DSCR) - uses EBITDA
    // = EBITDA / Total Debt Service
    // Returns null when no debt service (more accurate than 999 for "N/A" display)
    const hasDebtService = totalDebtService > 0;
    const rawDscr = hasDebtService ? ebitda / totalDebtService : null;
    // Cap at 99 for display purposes, but keep null for N/A cases
    const dscr = rawDscr === null ? null : (rawDscr > 99 ? 99 : rawDscr);
    // Legacy compatibility: use 999 marker for very high/no debt cases in filtering
    const dscrForFiltering = rawDscr === null ? 999 : (rawDscr > 99 ? 999 : rawDscr);

    // Interest Coverage Ratio (ICR) - uses EBIT (not EBITDA)
    // = EBIT / Interest Expense
    const hasInterestExpense = interestExpense > 0;
    const rawIcr = hasInterestExpense ? ebit / interestExpense : null;
    const icr = rawIcr === null ? null : (rawIcr > 99 ? 99 : rawIcr);
    const icrForFiltering = rawIcr === null ? 999 : (rawIcr > 99 ? 999 : rawIcr);
    
    // Leverage Ratio - uses EBITDA
    // = Net Debt / EBITDA
    const ndToEbitda = ebitda > 0 ? netDebt / ebitda : 0;
    
    // Fixed Charge Coverage Ratio
    const fixedChargeCoverage = (totalDebtService + capex) > 0 
      ? ebitda / (totalDebtService + capex) 
      : 999;
    
    // ==========================================================================
    // CASH FLOW STATEMENT (IAS 7: Statement of Cash Flows)
    // ==========================================================================
    
    // Operating activities
    const cashFromOperations = netIncome + depreciation - wcDelta;
    
    // Investing activities
    const cashFromInvesting = -capex;
    
    // Financing activities
    // Dividends are the complement of cash retention (1 - retention rate)
    const dividends = netIncome > 0 ? netIncome * (1 - cashRetentionRate) : 0;
    const cashFromFinancing = -principalPayment - dividends;
    
    // Free Cash Flow (non-GAAP but standard in valuation)
    const fcf = netIncome + depreciation - capex - wcDelta - principalPayment;
    
    // Unlevered Free Cash Flow (for enterprise valuation)
    const unleveredFCF = ebit * (1 - params.taxRate) + depreciation - capex - wcDelta;
    
    // ==========================================================================
    // STORE ROW DATA
    // ==========================================================================
    
    rows.push({
      // Identification
      year,
      period: i + 1,
      
      // Income Statement (IAS 1)
      revenue,
      cogs,
      grossProfit,
      grossMargin,
      opex,
      ebitda,
      ebitdaMargin,
      depreciation,
      ebit,
      ebitMargin,
      interestExpense,
      ebt,
      tax,
      netIncome,
      netMargin,
      
      // Balance Sheet (IAS 1)
      grossPPE: accumulatedPPE,
      accumulatedDepreciation,
      netPPE,
      workingCapital,
      wcDelta,
      cash: cumulativeCash,
      grossDebt,
      netDebt,
      retainedEarnings,
      
      // Cash Flow Statement (IAS 7)
      cashFromOperations,
      cashFromInvesting,
      cashFromFinancing,
      capex,
      fcf,
      unleveredFCF,
      operatingCashFlow,
      
      // Debt Schedule (IFRS 9)
      principalPayment,
      debtService: totalDebtService,
      debtBalance: debtYear.endingBalance,
      debtPayments: debtYear.paymentsInYear,
      
      // Multi-Tranche Details (if applicable)
      trancheDetails: debtYear.trancheDetails || [],
      
      // Covenant Ratios
      dscr,
      icr,
      ndToEbitda,
      fixedChargeCoverage,
      cashAvailableForDebtService: ebitda - tax - capex - wcDelta,

      // DSCR/ICR metadata for N/A handling
      hasDebtService,
      hasInterestExpense,
      dscrForFiltering,
      icrForFiltering,
      
      // Additional metrics
      debtToEquity: (params.equityContribution + retainedEarnings) > 0 
        ? grossDebt / (params.equityContribution + retainedEarnings) 
        : 0,
      returnOnEquity: (params.equityContribution + retainedEarnings) > 0 
        ? netIncome / (params.equityContribution + retainedEarnings) 
        : 0
    });
  }
  
  // ============================================================================
  // CREDIT STATISTICS (Summary metrics for covenant monitoring)
  // ============================================================================
  
  // Use forFiltering values to get valid numeric values for stats calculation
  const dscrValues = rows.map(r => r.dscrForFiltering).filter(v => isFinite(v) && v < 999 && v !== null);
  const icrValues = rows.map(r => r.icrForFiltering).filter(v => isFinite(v) && v < 999 && v !== null);
  const leverageValues = rows.map(r => r.ndToEbitda).filter(v => isFinite(v));
  
  const creditStats = {
    minDSCR: dscrValues.length > 0 ? Math.min(...dscrValues) : 0,
    avgDSCR: dscrValues.length > 0 ? dscrValues.reduce((a, b) => a + b, 0) / dscrValues.length : 0,
    maxDSCR: dscrValues.length > 0 ? Math.max(...dscrValues) : 0,
    
    minICR: icrValues.length > 0 ? Math.min(...icrValues) : 0,
    avgICR: icrValues.length > 0 ? icrValues.reduce((a, b) => a + b, 0) / icrValues.length : 0,
    maxICR: icrValues.length > 0 ? Math.max(...icrValues) : 0,
    
    minLeverage: leverageValues.length > 0 ? Math.min(...leverageValues) : 0,
    maxLeverage: leverageValues.length > 0 ? Math.max(...leverageValues) : 0,
    avgLeverage: leverageValues.length > 0 ? leverageValues.reduce((a, b) => a + b, 0) / leverageValues.length : 0,
    
    avgEBITDAMargin: rows.reduce((sum, r) => sum + r.ebitdaMargin, 0) / rows.length,
    avgNetMargin: rows.reduce((sum, r) => sum + r.netMargin, 0) / rows.length,
    totalFCFGenerated: rows.reduce((sum, r) => sum + r.fcf, 0),
    avgCashConversion: rows.reduce((sum, r) => sum + (r.revenue > 0 ? r.operatingCashFlow / r.revenue : 0), 0) / rows.length
  };
  
  // ============================================================================
  // COVENANT BREACH ANALYSIS
  // ============================================================================
  
  const breaches = {
    dscrBreaches: rows.filter(r => r.dscr < params.minDSCR).length,
    icrBreaches: rows.filter(r => r.icr < params.targetICR).length,
    ndBreaches: rows.filter(r => r.ndToEbitda > params.maxNDToEBITDA).length,
    
    dscrBreachYears: rows.filter(r => r.dscr < params.minDSCR).map(r => r.year),
    icrBreachYears: rows.filter(r => r.icr < params.targetICR).map(r => r.year),
    leverageBreachYears: rows.filter(r => r.ndToEbitda > params.maxNDToEBITDA).map(r => r.year),
    
    worstDSCRYear: dscrValues.length > 0 ? rows[dscrValues.indexOf(Math.min(...dscrValues))].year : null,
    worstICRYear: icrValues.length > 0 ? rows[icrValues.indexOf(Math.min(...icrValues))].year : null,
    worstLeverageYear: leverageValues.length > 0 ? rows[leverageValues.indexOf(Math.max(...leverageValues))].year : null
  };
  
  // ============================================================================
  // DCF VALUATION (Enterprise Value)
  // ============================================================================
  
  const terminalYear = rows[rows.length - 1];
  const terminalFCF = terminalYear.unleveredFCF * (1 + params.terminalGrowth);
  
  // Validate WACC > terminal growth (silent - validation should happen in UI)
  const isWACCValid = params.wacc > params.terminalGrowth;
  
  const validWACC = params.wacc > params.terminalGrowth ? params.wacc : params.terminalGrowth + 0.02;
  
  // Terminal Value (Gordon Growth Model)
  const terminalValue = terminalFCF / (validWACC - params.terminalGrowth);
  
  // Present Value of projected cash flows
  let pvProjectedCashFlows = 0;
  rows.forEach((row, i) => {
    const discountFactor = Math.pow(1 + validWACC, i + 1);
    pvProjectedCashFlows += row.unleveredFCF / discountFactor;
  });
  
  // Present Value of Terminal Value
  const pvTerminal = terminalValue / Math.pow(1 + validWACC, params.years);
  
  // Enterprise Value
  const enterpriseValue = pvProjectedCashFlows + pvTerminal;
  
  // Equity Value
  const finalDebt = rows[rows.length - 1].grossDebt;
  const finalCash = rows[rows.length - 1].cash;
  const equityValue = enterpriseValue - finalDebt + finalCash;
  
  // ============================================================================
  // INVESTMENT RETURNS (Using proper IRR calculation)
  // ============================================================================

  // Only calculate MOIC and IRR if there's an actual equity investment
  // If equityContribution is 0 or not set, these metrics are not applicable
  const totalInvested = params.equityContribution || 0;

  let moic = null;
  let irr = null;

  if (totalInvested > 0) {
    // MOIC: Exit Value / Entry Investment
    moic = calculateMOIC(equityValue, totalInvested);

    // Build cash flow series for IRR calculation
    // Initial investment (negative), followed by interim distributions (if any), then exit value
    const cashFlowsForIRR = [-totalInvested];

    // Add any dividend payments as interim cash flows
    rows.forEach((row) => {
      // Assume dividends are distributed to equity holders
      cashFlowsForIRR.push(row.dividends || 0);
    });

    // Add exit value to the final year
    if (cashFlowsForIRR.length > 1) {
      cashFlowsForIRR[cashFlowsForIRR.length - 1] += Math.max(0, equityValue);
    }

    // Calculate IRR using Newton-Raphson method
    irr = calculateIRR(cashFlowsForIRR);
  }
  
  const entryEV = params.entryMultiple * rows[0].ebitda;
  const exitEV = enterpriseValue;
  const exitMultiple = safeDivide(exitEV, terminalYear.ebitda, 0);
  
  // ============================================================================
  // MULTI-TRANCHE SUMMARY (if applicable)
  // ============================================================================
  
  let multiTrancheInfo = null;
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    const totalDebt = params.debtTranches.reduce((sum, t) => sum + t.amount, 0);
    const weightedRate = params.debtTranches.reduce((sum, t) => sum + (t.amount / totalDebt) * t.rate, 0);
    
    multiTrancheInfo = {
      totalTranches: params.debtTranches.length,
      totalDebt: totalDebt,
      blendedRate: weightedRate,
      tranches: params.debtTranches.map(t => ({
        name: t.name,
        amount: t.amount,
        rate: t.rate,
        seniority: t.seniority,
        maturityDate: t.maturityDate,
        amortizationType: t.amortizationType
      }))
    };
  }
  
  // ============================================================================
  // RETURN PROJECTION OBJECT
  // ============================================================================
  
  return {
    // Financial statements
    rows,
    
    // Credit analysis
    creditStats,
    breaches,
    
    // Valuation
    enterpriseValue,
    equityValue,
    terminalValue,
    pvTerminal,
    pvProjectedCashFlows,
    
    // Returns
    moic,
    irr,
    entryMultiple: params.entryMultiple,
    exitMultiple,
    
    // Debt analysis
    totalDebtRepaid: debtSchedule.reduce((sum, year) => sum + year.principal, 0),
    totalInterestPaid: debtSchedule.reduce((sum, year) => sum + year.interest, 0),
    finalCash,
    finalDebt,
    finalNetDebt: finalDebt - finalCash,
    
    // Multi-tranche info
    multiTrancheInfo,
    debtSchedule, // Include full schedule for detailed analysis
    
    // Validation flags
    hasCovenantBreaches: breaches.dscrBreaches + breaches.icrBreaches + breaches.ndBreaches > 0,
    isWACCValid: params.wacc > params.terminalGrowth,
    
    // Metadata
    projectionYears: params.years,
    startYear: params.startYear,
    endYear: params.startYear + params.years - 1,
    hasMultipleTranches: params.hasMultipleTranches || false
  };
}

// Export helper function
export function periodsPerYear(freq) {
  return getPaymentsPerYear(freq);
}