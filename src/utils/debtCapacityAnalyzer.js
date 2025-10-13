// src/utils/debtCapacityAnalyzer.js
// Lender-focused debt capacity and structure optimization

/**
 * Calculate maximum sustainable debt based on EBITDA and target DSCR
 */
export function calculateDebtCapacity(params, projection) {
  const ebitda = projection?.rows?.[0]?.ebitda || params.baseRevenue * 0.20;
  const targetDSCR = params.minDSCR || 1.25;
  const safetyBuffer = 1.20; // 20% cushion above covenant
  const targetDSCRWithBuffer = targetDSCR * safetyBuffer;
  
  const avgInterestRate = params.interestRate || 0.10;
  const tenorYears = params.debtTenorYears || 5;
  
  // Annual debt service = Principal Payment + Interest
  // For amortizing loan: Annual Payment = Debt × (r(1+r)^n) / ((1+r)^n - 1)
  const annualPaymentFactor = (avgInterestRate * Math.pow(1 + avgInterestRate, tenorYears)) / 
                              (Math.pow(1 + avgInterestRate, tenorYears) - 1);
  
  // Maximum debt where EBITDA / Debt Service = Target DSCR
  const maxSustainableDebt = ebitda / (annualPaymentFactor * targetDSCR);
  const safeDebt = ebitda / (annualPaymentFactor * targetDSCRWithBuffer);
  const aggressiveDebt = ebitda / (annualPaymentFactor * 1.15); // Minimum 1.15x DSCR
  
  const currentDebtRequest = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
  const excessDebt = Math.max(0, currentDebtRequest - maxSustainableDebt);
  const utilizationPct = maxSustainableDebt > 0 ? (currentDebtRequest / maxSustainableDebt) * 100 : 0;
  
  // Determine recommendation
  let recommendation = 'APPROVE';
  let riskLevel = 'LOW';
  
  if (currentDebtRequest > maxSustainableDebt) {
    recommendation = 'REDUCE DEBT';
    riskLevel = 'HIGH';
  } else if (currentDebtRequest > safeDebt) {
    recommendation = 'APPROVE WITH CONDITIONS';
    riskLevel = 'MEDIUM';
  }
  
  return {
    ebitda,
    maxSustainableDebt,
    safeDebt,
    aggressiveDebt,
    currentDebtRequest,
    excessDebt,
    utilizationPct,
    recommendation,
    riskLevel,
    targetDSCR,
    targetDSCRWithBuffer,
    annualPaymentFactor
  };
}

/**
 * Generate alternative capital structures
 */
export function generateAlternativeStructures(params, projection, debtCapacity) {
  const currentDebt = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
  const currentEquity = params.equityContribution || 0;
  const totalCapital = currentDebt + currentEquity;
  
  // Alternative 1: Reduce Debt to Safe Level
  const alt1_debt = debtCapacity.safeDebt;
  const alt1_equity = totalCapital - alt1_debt;
  const alt1_leverage = projection?.rows?.[0]?.ebitda > 0 ? 
    alt1_debt / projection.rows[0].ebitda : 0;
  
  // Alternative 2: Increase Equity (maintain total capital)
  const alt2_targetLeverage = 3.0; // Industry standard
  const alt2_debt = projection?.rows?.[0]?.ebitda * alt2_targetLeverage || currentDebt * 0.85;
  const alt2_equity = totalCapital - alt2_debt;
  
  // Alternative 3: Extend Tenor (reduce annual payments)
  const alt3_debt = currentDebt;
  const alt3_tenor = params.debtTenorYears + 2; // Add 2 years
  const alt3_equity = currentEquity;
  
  // Calculate impact for each alternative
  const calculateImpact = (debt, equity, tenor = params.debtTenorYears) => {
    const ebitda = projection?.rows?.[0]?.ebitda || params.baseRevenue * 0.20;
    const rate = params.interestRate || 0.10;
    const paymentFactor = (rate * Math.pow(1 + rate, tenor)) / 
                         (Math.pow(1 + rate, tenor) - 1);
    const annualDebtService = debt * paymentFactor;
    const dscr = ebitda / annualDebtService;
    const leverage = ebitda > 0 ? debt / ebitda : 0;
    const ltv = params.collateralValue > 0 ? (debt / params.collateralValue) * 100 : 0;
    
    return {
      debt,
      equity,
      tenor,
      debtPct: totalCapital > 0 ? (debt / totalCapital) * 100 : 0,
      equityPct: totalCapital > 0 ? (equity / totalCapital) * 100 : 0,
      annualDebtService,
      dscr,
      leverage,
      ltv,
      covenantCompliant: dscr >= (params.minDSCR || 1.25) && leverage <= (params.maxNDToEBITDA || 4.0)
    };
  };
  
  return {
    current: {
      name: 'Current Structure',
      description: 'As proposed in deal terms',
      ...calculateImpact(currentDebt, currentEquity, params.debtTenorYears)
    },
    alternative1: {
      name: 'Reduce Debt to Safe Level',
      description: 'Lower debt to maintain 1.50x DSCR with buffer',
      ...calculateImpact(alt1_debt, alt1_equity, params.debtTenorYears),
      changes: `Reduce debt by $${((currentDebt - alt1_debt) / 1_000_000).toFixed(1)}M, increase equity by $${((alt1_equity - currentEquity) / 1_000_000).toFixed(1)}M`
    },
    alternative2: {
      name: 'Optimize Debt/Equity Mix',
      description: 'Target 3.0x leverage (industry standard)',
      ...calculateImpact(alt2_debt, alt2_equity, params.debtTenorYears),
      changes: `Reduce debt by $${((currentDebt - alt2_debt) / 1_000_000).toFixed(1)}M, increase equity by $${((alt2_equity - currentEquity) / 1_000_000).toFixed(1)}M`
    },
    alternative3: {
      name: 'Extend Loan Tenor',
      description: `Extend from ${params.debtTenorYears} to ${alt3_tenor} years`,
      ...calculateImpact(alt3_debt, alt3_equity, alt3_tenor),
      changes: `Add ${alt3_tenor - params.debtTenorYears} years to tenor, reduce annual payments`
    }
  };
}

/**
 * Calculate sensitivity of debt capacity to key assumptions
 */
export function calculateSensitivity(params, projection, variable, range) {
  const results = [];
  const baseEBITDA = projection?.rows?.[0]?.ebitda || params.baseRevenue * 0.20;
  const baseRate = params.interestRate || 0.10;
  const baseTenor = params.debtTenorYears || 5;
  
  range.forEach(value => {
    let ebitda = baseEBITDA;
    let rate = baseRate;
    let tenor = baseTenor;
    
    // Adjust the variable
    if (variable === 'ebitda') ebitda = baseEBITDA * (1 + value);
    if (variable === 'rate') rate = baseRate + value;
    if (variable === 'tenor') tenor = baseTenor + value;
    
    // Calculate capacity at this point
    const targetDSCR = (params.minDSCR || 1.25) * 1.20;
    const paymentFactor = (rate * Math.pow(1 + rate, tenor)) / 
                         (Math.pow(1 + rate, tenor) - 1);
    const capacity = ebitda / (paymentFactor * targetDSCR);
    
    results.push({
      variable: value,
      capacity: capacity / 1_000_000, // in millions
      label: variable === 'ebitda' ? `${(value * 100).toFixed(0)}%` :
             variable === 'rate' ? `${(value * 100).toFixed(0)}bps` :
             `${value > 0 ? '+' : ''}${value}yr`
    });
  });
  
  return results;
}

/**
 * Get industry benchmarks for comparison
 */
export function getIndustryBenchmarks(industry) {
  const benchmarks = {
    'Manufacturing': { medianLeverage: 3.0, medianDSCR: 1.8, medianDebtPct: 65, medianEquityPct: 35 },
    'Technology': { medianLeverage: 2.0, medianDSCR: 2.5, medianDebtPct: 50, medianEquityPct: 50 },
    'Retail': { medianLeverage: 3.5, medianDSCR: 1.6, medianDebtPct: 70, medianEquityPct: 30 },
    'Healthcare': { medianLeverage: 2.8, medianDSCR: 2.0, medianDebtPct: 60, medianEquityPct: 40 },
    'Real Estate': { medianLeverage: 5.0, medianDSCR: 1.4, medianDebtPct: 80, medianEquityPct: 20 },
    'Services': { medianLeverage: 2.5, medianDSCR: 2.2, medianDebtPct: 55, medianEquityPct: 45 },
    'default': { medianLeverage: 3.0, medianDSCR: 1.8, medianDebtPct: 65, medianEquityPct: 35 }
  };
  
  return benchmarks[industry] || benchmarks['default'];
}