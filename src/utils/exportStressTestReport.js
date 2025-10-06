import { currencyFmtMM, numFmt, pctFmt } from "./formatters";

 // Enhanced comprehensive export function for DebtStressTesting.jsx
export function exportComprehensiveStressTestReport(
  stressTestResults, 
  params, 
  historicalAnalysis, 
  historicalLiquidityMetrics,
  selectedScenarios,
  ccy
) {  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `stress_test_report_${timestamp}.csv`;
  
  // Build comprehensive CSV with multiple sections
  const sections = [];
  
  // SECTION 1: Report Header
  sections.push([
    ['DEBT STRESS TESTING REPORT'],
    ['Generated:', new Date().toLocaleString()],
    ['Currency:', ccy],
    ['']
  ]);
  
  // SECTION 2: Facility Overview
  sections.push([
    ['FACILITY OVERVIEW'],
    ['Parameter', 'Existing Debt', 'Proposed New Facility'],
    ['Amount', currencyFmtMM(params.openingDebt, ccy), currencyFmtMM(params.requestedLoanAmount, ccy)],
    ['Interest Rate', pctFmt(params.interestRate), pctFmt(params.proposedPricing)],
    ['Tenor (Years)', params.debtTenorYears, params.proposedTenor],
    ['Payment Frequency', 'Quarterly', params.paymentFrequency],
    ['Balloon Payment', 'None', params.balloonPercentage ? `${params.balloonPercentage}%` : 'None'],
    ['Day Count Convention', 'Actual/365', params.dayCountConvention],
    ['Interest-Only Period', `${params.interestOnlyYears} years`, `${params.interestOnlyYears} years`],
    ['Facility Type', 'Existing', params.facilityType],
    ['']
  ]);
  
  // SECTION 3: Covenant Thresholds
  sections.push([
    ['COVENANT THRESHOLDS'],
    ['Covenant', 'Threshold', 'Direction'],
    ['Minimum DSCR', numFmt(params.minDSCR), 'Must exceed'],
    ['Maximum Net Debt/EBITDA', numFmt(params.maxNDToEBITDA), 'Must not exceed'],
    ['Minimum ICR', numFmt(params.targetICR), 'Must exceed'],
    ['LTV Warning Level', '75%', 'Warning above'],
    ['']
  ]);
  
  // SECTION 4: Historical Context (if available)
  if (historicalAnalysis) {
    sections.push([
      ['HISTORICAL ANALYSIS'],
      ['Metric', 'Value', 'Observation'],
      ['Years of Historical Data', historicalAnalysis.yearsWithMonthlyData || historicalData.length, ''],
      ['Average Monthly Burn Rate', currencyFmtMM(historicalAnalysis.avgMonthlyBurn, ccy), ''],
      ['Maximum Monthly Burn Rate', currencyFmtMM(historicalAnalysis.maxMonthlyBurn, ccy), ''],
      ['Burn Rate Volatility', pctFmt(historicalAnalysis.burnVolatility), historicalAnalysis.burnVolatility > 0.3 ? 'High volatility' : 'Stable'],
      ['Average Cash Balance', currencyFmtMM(historicalLiquidityMetrics.avgCashBalance, ccy), ''],
      ['Minimum Cash Balance', currencyFmtMM(historicalLiquidityMetrics.minCashBalance, ccy), ''],
      ['Cash Balance Volatility', pctFmt(historicalLiquidityMetrics.cashVolatility), ''],
      ['Working Capital Efficiency', pctFmt(historicalLiquidityMetrics.workingCapitalEfficiency), ''],
      ['']
    ]);
  }
  
  // SECTION 5: Scenario Results Summary
  sections.push([
    ['STRESS TEST SCENARIOS SUMMARY'],
    [
      'Scenario',
      'Description',
      'Risk Level',
      'Min DSCR',
      'DSCR vs Covenant',
      'Max Leverage',
      'Leverage vs Covenant',
      'Min ICR',
      'ICR vs Covenant',
      'Total Breaches',
      'Liquidity Runway (months)',
      'Equity Value',
      'Value Loss %',
      'IRR',
      'MOIC',
      'Data Source'
    ]
  ]);
  
  // Add data for each scenario
  Object.entries(stressTestResults).forEach(([key, result]) => {
    const baseEquity = stressTestResults.base.equityValue;
    const valueLoss = ((baseEquity - result.equityValue) / baseEquity) * 100;
    
    sections[sections.length - 1].push([
      result.name,
      result.description,
      result.riskLevel,
      numFmt(result.minDSCR),
      result.dscrCushion >= 0 ? `+${numFmt(result.dscrCushion)}` : numFmt(result.dscrCushion),
      numFmt(result.maxLeverage),
      result.leverageCushion >= 0 ? `+${numFmt(result.leverageCushion)}` : numFmt(result.leverageCushion),
      numFmt(result.minICR),
      result.icrCushion >= 0 ? `+${numFmt(result.icrCushion)}` : numFmt(result.icrCushion),
      result.totalBreaches,
      result.liquidityRunway === Infinity ? 'Infinite' : numFmt(result.liquidityRunway),
      currencyFmtMM(result.equityValue, ccy),
      key === 'base' ? '0.00%' : numFmt(Math.abs(valueLoss)) + '%',
      pctFmt(result.irr),
      numFmt(result.equityMOIC) + 'x',
      result.usesHistoricalData ? 'Historical + Projected' : 'Projected Only'
    ]);
  });
  sections[sections.length - 1].push(['']);
  
  // SECTION 6: Year-by-Year Covenant Compliance (for selected scenarios)
  selectedScenarios.forEach(scenarioKey => {
    const result = stressTestResults[scenarioKey];
    const projection = result.projection;
    
    sections.push([
      [`SCENARIO: ${result.name.toUpperCase()} - YEAR-BY-YEAR ANALYSIS`],
      [
        'Year',
        'Revenue',
        'EBITDA',
        'DSCR',
        'DSCR Status',
        'ICR', 
        'ICR Status',
        'Net Debt/EBITDA',
        'Leverage Status',
        'Debt Service',
        'Cash Flow to Equity',
        'Ending Debt',
        'Overall Status'
      ]
    ]);
    
    projection.rows.forEach(row => {
      sections[sections.length - 1].push([
        row.year,
        currencyFmtMM(row.revenue, ccy),
        currencyFmtMM(row.ebitda, ccy),
        numFmt(row.dscr),
        row.dscr >= params.minDSCR ? 'PASS' : 'BREACH',
        numFmt(row.icr),
        row.icr >= params.targetICR ? 'PASS' : 'BREACH',
        numFmt(row.ndToEbitda),
        row.ndToEbitda <= params.maxNDToEBITDA ? 'PASS' : 'BREACH',
        currencyFmtMM(row.debtService, ccy),
        currencyFmtMM(row.fcfToEquity, ccy),
        currencyFmtMM(row.endingDebt, ccy),
        (row.dscrBreach || row.icrBreach || row.ndBreach) ? 'BREACH' : 'PASS'
      ]);
    });
    
    sections[sections.length - 1].push(['']);
  });
  
  // SECTION 7: Payment Structure Risk Analysis
  if (params.requestedLoanAmount > 0) {
    sections.push([
      ['PAYMENT STRUCTURE RISK ANALYSIS'],
      ['Risk Factor', 'Value', 'Impact', 'Mitigation Required']
    ]);
    
    // Balloon payment risk
    if (params.balloonPercentage > 0) {
      const balloonAmount = params.requestedLoanAmount * (params.balloonPercentage / 100);
      sections[sections.length - 1].push([
        'Balloon Payment',
        currencyFmtMM(balloonAmount, ccy),
        `Due in Year ${params.proposedTenor}`,
        'Refinancing plan required 18 months prior'
      ]);
      
      // Check refinancing feasibility under each scenario
      selectedScenarios.forEach(scenarioKey => {
        const result = stressTestResults[scenarioKey];
        const finalYearMetrics = result.projection.rows[params.proposedTenor - 1];
        const refinanceable = finalYearMetrics && finalYearMetrics.dscr > 1.2 && finalYearMetrics.ndToEbitda < 4.0;
        
        sections[sections.length - 1].push([
          `  - ${result.name} Refinancing`,
          refinanceable ? 'Feasible' : 'Challenging',
          `DSCR: ${numFmt(finalYearMetrics?.dscr || 0)}`,
          refinanceable ? 'Monitor market conditions' : 'Early refinancing recommended'
        ]);
      });
    }
    
    // Payment frequency risk
    const paymentsPerYear = getPaymentsPerYear(params.paymentFrequency);
    const paymentAmount = (params.requestedLoanAmount * params.proposedPricing) / paymentsPerYear;
    sections[sections.length - 1].push([
      'Payment Frequency',
      params.paymentFrequency,
      `${paymentsPerYear} payments/year of ${currencyFmtMM(paymentAmount, ccy)}`,
      paymentsPerYear > 4 ? 'Maintain 3-month payment buffer' : 'Standard monitoring'
    ]);
    
    // Day count convention impact
    if (params.dayCountConvention === 'Actual/360') {
      const additionalInterest = params.requestedLoanAmount * params.proposedPricing * (365/360 - 1);
      sections[sections.length - 1].push([
        'Day Count Convention',
        params.dayCountConvention,
        `+${currencyFmtMM(additionalInterest, ccy)}/year additional interest`,
        'Factor into cash flow projections'
      ]);
    }
    
    sections[sections.length - 1].push(['']);
  }
  
  // SECTION 8: Critical Risk Indicators
  sections.push([
    ['CRITICAL RISK INDICATORS'],
    ['Indicator', 'Status', 'Details', 'Action Required']
  ]);
  
  const breachScenarios = Object.values(stressTestResults).filter(r => r.totalBreaches > 0);
  sections[sections.length - 1].push([
    'Covenant Breach Risk',
    breachScenarios.length > 0 ? 'HIGH' : 'LOW',
    `${breachScenarios.length} of ${Object.keys(stressTestResults).length} scenarios breach`,
    breachScenarios.length > 0 ? 'Reduce leverage or negotiate covenant relief' : 'Continue monitoring'
  ]);
  
  const liquidityRiskScenarios = Object.values(stressTestResults).filter(r => r.liquidityRunway < 6);
  sections[sections.length - 1].push([
    'Liquidity Risk',
    liquidityRiskScenarios.length > 0 ? 'ELEVATED' : 'LOW',
    `${liquidityRiskScenarios.length} scenarios < 6 months runway`,
    liquidityRiskScenarios.length > 0 ? 'Establish credit facility or raise cash' : 'Maintain reserves'
  ]);
  
  const worstCaseDSCR = Math.min(...Object.values(stressTestResults).map(r => r.minDSCR));
  sections[sections.length - 1].push([
    'Debt Service Risk',
    worstCaseDSCR < 1.0 ? 'CRITICAL' : worstCaseDSCR < 1.2 ? 'HIGH' : 'MANAGEABLE',
    `Worst case DSCR: ${numFmt(worstCaseDSCR)}`,
    worstCaseDSCR < 1.2 ? 'Restructure debt or improve operations' : 'Standard monitoring'
  ]);
  
  sections[sections.length - 1].push(['']);
  
  // SECTION 9: Recommendations
  sections.push([
    ['RECOMMENDATIONS'],
    ['Priority', 'Action', 'Rationale', 'Timeline']
  ]);
  
  // Generate dynamic recommendations based on results
  const recommendations = generateDynamicRecommendations(stressTestResults, params, historicalAnalysis);
  recommendations.forEach((rec, index) => {
    sections[sections.length - 1].push([
      index + 1,
      rec.action,
      rec.rationale,
      rec.timeline
    ]);
  });
  
  // Convert sections to CSV string
  const csvContent = sections.map(section => 
    section.map(row => row.map(cell => 
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(',')).join('\n')
  ).join('\n');
  
  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Helper function to generate dynamic recommendations
function generateDynamicRecommendations(stressTestResults, params, historicalAnalysis) {
  const recommendations = [];
  
  // Check for covenant breaches
  const breachCount = Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length;
  if (breachCount > Object.keys(stressTestResults).length * 0.3) {
    recommendations.push({
      action: 'Reduce leverage by 10-20% through equity injection',
      rationale: `${breachCount} scenarios show covenant breaches`,
      timeline: 'Immediate (0-3 months)'
    });
  }
  
  // Check for liquidity issues
  const liquidityIssues = Object.values(stressTestResults).filter(r => r.liquidityRunway < 6).length;
  if (liquidityIssues > 0) {
    recommendations.push({
      action: 'Establish revolving credit facility equal to 6 months debt service',
      rationale: `${liquidityIssues} scenarios show < 6 months liquidity`,
      timeline: 'Near-term (3-6 months)'
    });
  }
  
  // Check for balloon payment risk
  if (params.balloonPercentage > 30) {
    recommendations.push({
      action: 'Begin refinancing discussions 18-24 months before maturity',
      rationale: `${params.balloonPercentage}% balloon payment creates refinancing risk`,
      timeline: `Year ${Math.max(1, (params.proposedTenor || 5) - 2)}`
    });
  }
  
  // Check for operational improvements needed
  const worstCaseDSCR = Math.min(...Object.values(stressTestResults).map(r => r.minDSCR));
  if (worstCaseDSCR < 1.5) {
    recommendations.push({
      action: 'Implement cost reduction program targeting 5% EBITDA improvement',
      rationale: `Worst case DSCR of ${numFmt(worstCaseDSCR)} provides limited cushion`,
      timeline: 'Ongoing (start immediately)'
    });
  }
  
  // Add historical volatility recommendation
  if (historicalAnalysis?.burnVolatility > 0.3) {
    recommendations.push({
      action: 'Improve working capital management to reduce cash flow volatility',
      rationale: `Historical volatility of ${pctFmt(historicalAnalysis.burnVolatility)} increases risk`,
      timeline: 'Near-term (3-6 months)'
    });
  }
  
  // Interest rate hedging
  const rateShockScenarios = Object.entries(stressTestResults)
    .filter(([key]) => key.includes('rate'))
    .filter(([_, result]) => result.totalBreaches > 0);
  
  if (rateShockScenarios.length > 0) {
    recommendations.push({
      action: 'Consider interest rate hedging for 50-75% of debt',
      rationale: 'Rate increases cause covenant breaches in stress scenarios',
      timeline: 'Near-term (3-6 months)'
    });
  }
  
  return recommendations;
}

// Helper function for payment frequency
function getPaymentsPerYear(frequency) {
  const frequencyMap = {
    "Monthly": 12,
    "Quarterly": 4,
    "Semi-Annually": 2,
    "Annually": 1,
    "Bullet": 0
  };
  return frequencyMap[frequency] || 4;
}