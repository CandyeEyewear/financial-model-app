/**
 * Financial statement calculations
 * All formulas for income statement, balance sheet, and cash flow metrics
 */

/**
 * Calculate income statement metrics from inputs
 */
export function calculateIncomeStatement(inputs) {
  const {
    revenue = 0,
    cogs = 0,
    opex = 0,
    depreciation = 0,
    interestExpense = 0,
    taxExpense = 0,
  } = inputs;

  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;
  
  const ebitda = revenue - cogs - opex;
  const ebitdaMargin = revenue > 0 ? ebitda / revenue : 0;
  
  const ebit = ebitda - depreciation;
  const ebitMargin = revenue > 0 ? ebit / revenue : 0;
  
  const ebt = ebit - interestExpense;
  const netIncome = ebt - taxExpense;
  const netMargin = revenue > 0 ? netIncome / revenue : 0;
  
  const impliedTaxRate = ebt > 0 ? taxExpense / ebt : 0;

  return {
    grossProfit,
    grossMargin,
    ebitda,
    ebitdaMargin,
    ebit,
    ebitMargin,
    ebt,
    netIncome,
    netMargin,
    impliedTaxRate,
  };
}

/**
 * Calculate balance sheet metrics
 */
export function calculateBalanceSheet(inputs) {
  const {
    cash = 0,
    receivables = 0,
    inventory = 0,
    otherCurrentAssets = 0,
    ppe = 0,
    accountsPayable = 0,
    accruedExp = 0,
    shortTermDebt = 0,
    longTermDebt = 0,
  } = inputs;

  const currentAssets = cash + receivables + inventory + otherCurrentAssets;
  const totalAssets = currentAssets + ppe;
  
  // Working capital excludes short-term debt (operating liabilities only)
  const currentOperatingLiabilities = accountsPayable + accruedExp;
  const workingCapital = currentAssets - currentOperatingLiabilities;
  
  const currentRatio = currentOperatingLiabilities > 0 
    ? currentAssets / currentOperatingLiabilities 
    : 0;
  
  const totalDebt = shortTermDebt + longTermDebt;

  return {
    currentAssets,
    totalAssets,
    currentOperatingLiabilities,
    workingCapital,
    currentRatio,
    totalDebt,
  };
}

/**
 * Calculate leverage and debt metrics
 */
export function calculateLeverageMetrics(balanceSheet, incomeStatement) {
  const { totalDebt, totalAssets } = balanceSheet;
  const { ebitda } = incomeStatement;

  const debtToAssets = totalAssets > 0 ? totalDebt / totalAssets : 0;
  const debtToEBITDA = ebitda > 0 ? totalDebt / ebitda : 0;

  return {
    debtToAssets,
    debtToEBITDA,
  };
}

/**
 * Calculate cash flow metrics
 */
export function calculateCashFlowMetrics(inputs) {
  const {
    revenue = 0,
    opCashFlow = 0,
    capex = 0,
  } = inputs;

  const freeCashFlow = opCashFlow - Math.abs(capex);
  const fcfMargin = revenue > 0 ? freeCashFlow / revenue : 0;

  return {
    freeCashFlow,
    fcfMargin,
  };
}

/**
 * Calculate all financial metrics at once
 */
export function calculateAllFinancialMetrics(inputs) {
  const incomeStatement = calculateIncomeStatement(inputs);
  const balanceSheet = calculateBalanceSheet(inputs);
  const leverageMetrics = calculateLeverageMetrics(balanceSheet, incomeStatement);
  const cashFlowMetrics = calculateCashFlowMetrics(inputs);

  return {
    ...incomeStatement,
    ...balanceSheet,
    ...leverageMetrics,
    ...cashFlowMetrics,
  };
}

/**
 * Calculate monthly cash flow summary
 */
export function calculateMonthlyCashFlowSummary(monthlyCashFlows) {
  if (!Array.isArray(monthlyCashFlows) || monthlyCashFlows.length === 0) {
    return {
      hasMonthlyData: false,
      monthsWithData: 0,
      totalMonthlyRevenue: 0,
      totalMonthlyOpCashFlow: 0,
      avgMonthlyBurn: 0,
      minMonthlyCashFlow: 0,
    };
  }

  const monthsWithData = monthlyCashFlows.filter(
    m => m.operatingCashFlow !== null && m.operatingCashFlow !== undefined
  ).length;

  const hasMonthlyData = monthsWithData > 0;

  const totalMonthlyRevenue = monthlyCashFlows.reduce(
    (sum, month) => sum + (month.revenue || 0), 
    0
  );

  const totalMonthlyOpCashFlow = monthlyCashFlows.reduce(
    (sum, month) => sum + (month.operatingCashFlow || 0), 
    0
  );

  // Calculate monthly burn (negative cash flow months)
  const monthlyBurns = monthlyCashFlows
    .map(m => m.operatingCashFlow || 0)
    .filter(cf => cf < 0);

  const totalAnnualBurn = monthlyBurns.reduce(
    (sum, cf) => sum + Math.abs(cf), 
    0
  );

  // Annualized average burn rate
  const avgMonthlyBurn = totalAnnualBurn / 12;

  const minMonthlyCashFlow = hasMonthlyData
    ? Math.min(...monthlyCashFlows
        .map(m => m.operatingCashFlow)
        .filter(cf => cf !== null && cf !== undefined))
    : 0;

  return {
    hasMonthlyData,
    monthsWithData,
    totalMonthlyRevenue,
    totalMonthlyOpCashFlow,
    avgMonthlyBurn,
    minMonthlyCashFlow,
  };
}

