// src/utils/debtCapacityAnalyzer.js
// Lender-focused debt capacity and structure optimization

/**
 * Calculate maximum sustainable debt based on EBITDA and target DSCR
 * Industry-standard approach using Cash Flow Available for Debt Service (CFADS)
 */
export function calculateDebtCapacity(params, projection) {
  // Get EBITDA from projection or estimate from revenue
  const ebitda = projection?.rows?.[0]?.ebitda || params.baseRevenue * 0.20;
  
  // Get total assets from params (should come from historical financials) or estimate
  const totalAssets = params.totalAssets || (projection?.rows?.[0]?.grossPPE || 0) + 
                      (projection?.rows?.[0]?.workingCapital || 0) + 
                      (projection?.rows?.[0]?.cash || 0);
  
  // Covenant thresholds
  const targetDSCR = params.minDSCR || 1.25;
  const safetyBuffer = 1.20; // 20% cushion above covenant for "safe" debt level
  const targetDSCRWithBuffer = targetDSCR * safetyBuffer;
  
  // Loan parameters
  const avgInterestRate = params.interestRate || 0.10;
  const tenorYears = params.debtTenorYears || 5;
  
  // Calculate annual payment factor for amortizing loan
  // PMT factor = r(1+r)^n / ((1+r)^n - 1) where r = annual rate, n = years
  let annualPaymentFactor;
  if (avgInterestRate <= 0 || tenorYears <= 0) {
    annualPaymentFactor = 1 / tenorYears; // Simple payback if no interest
  } else {
    annualPaymentFactor = (avgInterestRate * Math.pow(1 + avgInterestRate, tenorYears)) / 
                          (Math.pow(1 + avgInterestRate, tenorYears) - 1);
  }
  
  // Calculate maximum sustainable debt levels at different DSCR targets
  // Formula: Max Debt = EBITDA / (Annual Payment Factor × Target DSCR)
  const maxSustainableDebt = ebitda / (annualPaymentFactor * targetDSCR);
  const safeDebt = ebitda / (annualPaymentFactor * targetDSCRWithBuffer);
  const aggressiveDebt = ebitda / (annualPaymentFactor * 1.10); // Minimum 1.10x DSCR (aggressive)
  
  // Current debt position
  const currentDebtRequest = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
  
  // Calculate available capacity or excess debt
  // Positive = over capacity (excess debt), Negative = under capacity (available room)
  const debtGap = currentDebtRequest - maxSustainableDebt;
  const availableCapacity = Math.max(0, maxSustainableDebt - currentDebtRequest);
  const excessDebt = Math.max(0, debtGap);
  
  // Also calculate excess over SAFE debt level (for Executive Summary display)
  const excessOverSafe = Math.max(0, currentDebtRequest - safeDebt);
  
  // Utilization percentage (100% = at max sustainable, >100% = over capacity)
  const utilizationPct = maxSustainableDebt > 0 ? (currentDebtRequest / maxSustainableDebt) * 100 : 0;
  
  // Calculate actual DSCR with current debt
  const annualDebtService = currentDebtRequest * annualPaymentFactor;
  const impliedDSCR = annualDebtService > 0 ? ebitda / annualDebtService : 999;
  
  // Calculate leverage metrics
  const leverage = ebitda > 0 ? currentDebtRequest / ebitda : 0;
  const maxLeverage = params.maxNDToEBITDA || 3.0;
  
  // LTV calculation if collateral is provided
  const collateralValue = params.collateralValue || 0;
  const ltv = collateralValue > 0 ? (currentDebtRequest / collateralValue) * 100 : 0;
  
  // Determine recommendation based on multiple factors
  let recommendation = 'APPROVE';
  let riskLevel = 'LOW';
  const riskFactors = [];
  
  // Check DSCR
  if (impliedDSCR < targetDSCR) {
    recommendation = 'REDUCE DEBT';
    riskLevel = 'HIGH';
    riskFactors.push(`DSCR ${impliedDSCR.toFixed(2)}x below minimum ${targetDSCR}x`);
  } else if (impliedDSCR < targetDSCRWithBuffer) {
    if (recommendation !== 'REDUCE DEBT') {
      recommendation = 'APPROVE WITH CONDITIONS';
      riskLevel = 'MEDIUM';
    }
    riskFactors.push(`DSCR ${impliedDSCR.toFixed(2)}x below safe threshold ${targetDSCRWithBuffer.toFixed(2)}x`);
  }
  
  // Check leverage
  if (leverage > maxLeverage) {
    if (riskLevel !== 'HIGH') {
      recommendation = recommendation === 'APPROVE' ? 'APPROVE WITH CONDITIONS' : recommendation;
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
    }
    riskFactors.push(`Leverage ${leverage.toFixed(2)}x exceeds maximum ${maxLeverage}x`);
  }
  
  // Check LTV if collateral is specified
  const maxLTV = 75; // Industry standard max LTV
  if (collateralValue > 0 && ltv > maxLTV) {
    if (riskLevel !== 'HIGH') {
      recommendation = recommendation === 'APPROVE' ? 'APPROVE WITH CONDITIONS' : recommendation;
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
    }
    riskFactors.push(`LTV ${ltv.toFixed(0)}% exceeds maximum ${maxLTV}%`);
  }
  
  return {
    // Core metrics
    ebitda,
    totalAssets,
    
    // Debt capacity levels
    maxSustainableDebt,
    safeDebt,
    aggressiveDebt,
    currentDebtRequest,
    
    // Gap analysis - FIXED: now properly calculates available capacity
    availableCapacity,  // How much more debt could be supported
    excessDebt,         // How much current debt exceeds max sustainable
    excessOverSafe,     // How much current debt exceeds SAFE level (for display)
    debtGap,            // Raw difference (positive = over, negative = under)
    
    // Ratios
    utilizationPct,
    impliedDSCR,
    leverage,
    ltv,
    
    // Recommendation
    recommendation,
    riskLevel,
    riskFactors,
    
    // Calculation inputs
    targetDSCR,
    targetDSCRWithBuffer,
    annualPaymentFactor,
    annualDebtService,
    collateralValue
  };
}

/**
 * Generate alternative capital structures
 * Industry-standard approach considering DSCR, leverage, and LTV constraints
 */
export function generateAlternativeStructures(params, projection, debtCapacity) {
  const currentDebt = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
  const currentEquity = params.equityContribution || 0;
  const totalCapital = currentDebt + currentEquity;
  const ebitda = projection?.rows?.[0]?.ebitda || params.baseRevenue * 0.20;
  const collateralValue = params.collateralValue || 0;
  const rate = params.interestRate || 0.10;
  const baseTenor = params.debtTenorYears || 5;
  
  // Helper to calculate payment factor
  const getPaymentFactor = (r, n) => {
    if (r <= 0 || n <= 0) return 1 / n;
    return (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };
  
  // Covenant thresholds
  const minDSCR = params.minDSCR || 1.25;
  const maxLeverage = params.maxNDToEBITDA || 3.0;
  const targetDSCRWithBuffer = minDSCR * 1.20; // 1.50x for safe level
  
  // ============================================================================
  // Alternative 1: Reduce Debt to Safe Level (1.50x DSCR with buffer)
  // ============================================================================
  // Calculate debt level that achieves safe DSCR (1.50x)
  const paymentFactor = getPaymentFactor(rate, baseTenor);
  const alt1_debt = Math.min(debtCapacity.safeDebt, currentDebt); // Can't exceed current
  // Equity increase needed = current debt reduction
  const alt1_equityIncrease = currentDebt - alt1_debt;
  const alt1_equity = currentEquity + alt1_equityIncrease;
  const alt1_totalCapital = alt1_debt + alt1_equity;
  
  // ============================================================================
  // Alternative 2: Optimize to Target Leverage (industry standard)
  // ============================================================================
  // Target 3.0x Net Debt/EBITDA as industry standard
  const targetLeverage = maxLeverage; 
  const alt2_debt = Math.min(ebitda * targetLeverage, currentDebt); // Can't exceed current
  const alt2_equityIncrease = currentDebt - alt2_debt;
  const alt2_equity = currentEquity + alt2_equityIncrease;
  const alt2_totalCapital = alt2_debt + alt2_equity;
  
  // ============================================================================
  // Alternative 3: Extend Tenor (reduce annual debt service burden)
  // ============================================================================
  const alt3_tenor = baseTenor + 2; // Add 2 years
  const alt3_debt = currentDebt;
  const alt3_equity = currentEquity;
  
  // Calculate impact for each alternative
  const calculateImpact = (debt, equity, tenor, altTotalCapital) => {
    const pf = getPaymentFactor(rate, tenor);
    const annualDebtService = debt * pf;
    const dscr = annualDebtService > 0 ? ebitda / annualDebtService : 999;
    const leverage = ebitda > 0 ? debt / ebitda : 0;
    const ltv = collateralValue > 0 ? (debt / collateralValue) * 100 : 0;
    const effectiveTotalCapital = altTotalCapital || (debt + equity);
    
    return {
      debt,
      equity,
      tenor,
      debtPct: effectiveTotalCapital > 0 ? (debt / effectiveTotalCapital) * 100 : 0,
      equityPct: effectiveTotalCapital > 0 ? (equity / effectiveTotalCapital) * 100 : 0,
      annualDebtService,
      dscr: Math.min(dscr, 999), // Cap at 999 to avoid infinity display issues
      leverage,
      ltv,
      covenantCompliant: dscr >= minDSCR && leverage <= maxLeverage && (collateralValue === 0 || ltv <= 75)
    };
  };
  
  // Helper to format change description
  // Uses Math.abs to ensure we always show positive values in the change description
  const formatChange = (debtChange, equityChange, currency = 'USD') => {
    const parts = [];
    const absDebtChange = Math.abs(debtChange);
    const absEquityChange = Math.abs(equityChange);
    
    if (absDebtChange > 1000) {
      const action = debtChange < 0 ? 'Reduce' : 'Increase';
      // Always use absolute value to avoid negative signs
      const formattedAmount = (absDebtChange / 1_000_000).toFixed(1);
      parts.push(`${action} debt by ${formattedAmount}M`);
    }
    if (absEquityChange > 1000) {
      const action = equityChange > 0 ? 'increase' : 'decrease';
      // Always use absolute value to avoid negative signs
      const formattedAmount = (absEquityChange / 1_000_000).toFixed(1);
      parts.push(`${action} equity by ${formattedAmount}M`);
    }
    return parts.length > 0 ? parts.join(', ') : 'No changes required';
  };
  
  const currentImpact = calculateImpact(currentDebt, currentEquity, baseTenor, totalCapital);
  const alt1Impact = calculateImpact(alt1_debt, alt1_equity, baseTenor, alt1_totalCapital);
  const alt2Impact = calculateImpact(alt2_debt, alt2_equity, baseTenor, alt2_totalCapital);
  const alt3Impact = calculateImpact(alt3_debt, alt3_equity, alt3_tenor, totalCapital);
  
  return {
    current: {
      name: 'Current Structure',
      description: 'As proposed in deal terms',
      ...currentImpact
    },
    alternative1: {
      name: 'Reduce Debt to Safe Level',
      description: `Lower debt to maintain ${targetDSCRWithBuffer.toFixed(2)}x DSCR with buffer`,
      ...alt1Impact,
      changes: alt1_debt < currentDebt 
        ? formatChange(alt1_debt - currentDebt, alt1_equityIncrease)
        : 'Current structure already at safe level'
    },
    alternative2: {
      name: 'Optimize Debt/Equity Mix',
      description: `Target ${targetLeverage.toFixed(1)}x leverage (industry standard)`,
      ...alt2Impact,
      changes: alt2_debt < currentDebt
        ? formatChange(alt2_debt - currentDebt, alt2_equityIncrease)
        : 'Current leverage within target range'
    },
    alternative3: {
      name: 'Extend Loan Tenor',
      description: `Extend from ${baseTenor} to ${alt3_tenor} years`,
      ...alt3Impact,
      changes: `Add ${alt3_tenor - baseTenor} years to tenor, reduce annual payments`
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