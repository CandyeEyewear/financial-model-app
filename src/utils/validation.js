/**
 * Centralized validation utilities
 * All validation logic for financial inputs, model parameters, and business rules
 */

/**
 * Validate tranche names are unique
 */
export function validateTrancheNames(tranches) {
  const errors = [];
  const warnings = [];

  if (!tranches || tranches.length === 0) {
    return { isValid: true, errors, warnings };
  }

  const names = tranches.map(t => t.name?.toLowerCase().trim());
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)];
    errors.push(`Duplicate tranche names found: ${uniqueDuplicates.join(', ')}. Each tranche must have a unique name.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate individual tranche before adding
 */
export function validateTranche(tranche) {
  const errors = [];

  if (!tranche.name || tranche.name.trim() === '') {
    errors.push('Tranche name is required');
  }

  if (!tranche.amount || tranche.amount <= 0) {
    errors.push('Tranche amount must be greater than zero');
  }

  if (!tranche.rate || tranche.rate <= 0) {
    errors.push('Tranche interest rate must be greater than zero');
  }

  if (!tranche.tenorYears || tranche.tenorYears <= 0) {
    errors.push('Tranche tenor must be greater than zero');
  }

  if (tranche.interestOnlyYears && tranche.interestOnlyYears >= tranche.tenorYears) {
    errors.push('Interest-only period cannot exceed or equal total tenor');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate historical financial data inputs
 */
export function validateFinancialInputs(inputs) {
  const errors = [];
  const { revenue, cogs, opex, year } = inputs;

  if (!year || year === "") {
    errors.push("Year is required");
  }

  if (!revenue || revenue <= 0) {
    errors.push("Revenue must be greater than zero");
  }

  if (cogs > revenue) {
    errors.push("COGS cannot exceed revenue");
  }

  if (cogs + opex >= revenue) {
    errors.push("COGS + OpEx cannot equal or exceed revenue (EBITDA would be zero or negative)");
  }

  // Check for unusual margins
  const grossMargin = revenue > 0 ? (revenue - cogs) / revenue : 0;
  const ebitdaMargin = revenue > 0 ? (revenue - cogs - opex) / revenue : 0;

  if (grossMargin < 0 || grossMargin > 1) {
    errors.push("Gross margin appears unusual. Please check COGS.");
  }

  if (ebitdaMargin < -0.5 || ebitdaMargin > 0.9) {
    errors.push("EBITDA margin appears unusual. Please verify inputs.");
  }

  return errors;
}

/**
 * Validate model projection parameters
 */
export function validateModelParams(params) {
  const errors = [];
  
  // Revenue validation
  if (!params.baseRevenue || params.baseRevenue <= 0) {
    errors.push("Base revenue must be positive");
  }
  
  // Margin validation
  if (params.cogsPct + params.opexPct >= 1) {
    errors.push("COGS + OpEx must be less than 100% of revenue");
  }
  
  if (params.cogsPct < 0 || params.cogsPct > 1) {
    errors.push("COGS percentage must be between 0% and 100%");
  }
  
  if (params.opexPct < 0 || params.opexPct > 1) {
    errors.push("OpEx percentage must be between 0% and 100%");
  }
  
  // Discount rate validation
  if (params.wacc <= params.terminalGrowth) {
    errors.push("WACC must be greater than terminal growth rate");
  }
  
  if (params.wacc <= 0 || params.wacc > 1) {
    errors.push("WACC must be between 0% and 100%");
  }
  
  if (params.terminalGrowth < 0 || params.terminalGrowth > 0.1) {
    errors.push("Terminal growth rate should typically be between 0% and 10%");
  }
  
  // Debt structure validation
  if (params.balloonPercentage < 0 || params.balloonPercentage > 100) {
    errors.push("Balloon percentage must be between 0 and 100");
  }
  
  if (params.interestOnlyYears > params.debtTenorYears) {
    errors.push("Interest-only period cannot exceed debt tenor");
  }
  
  if (params.debtTenorYears <= 0) {
    errors.push("Debt tenor must be positive");
  }
  
  if (params.interestRate < 0 || params.interestRate > 1) {
    errors.push("Interest rate must be between 0% and 100%");
  }
  
  // Covenant validation
  if (params.minDSCR < 1.0) {
    errors.push("Minimum DSCR should typically be at least 1.0x");
  }
  
  if (params.targetICR < 1.0) {
    errors.push("Target ICR should typically be at least 1.0x");
  }
  
  if (params.maxNDToEBITDA <= 0) {
    errors.push("Maximum Net Debt/EBITDA must be positive");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate facility/deal terms
 */
export function validateFacilityTerms(params) {
  const errors = [];
  
  if (!params.requestedLoanAmount || params.requestedLoanAmount <= 0) {
    errors.push("Loan amount must be positive");
  }
  
  if (!params.proposedPricing || params.proposedPricing <= 0) {
    errors.push("Interest rate must be positive");
  }
  
  if (params.proposedPricing > 0.5) {
    errors.push("Interest rate appears unusually high (>50%)");
  }
  
  if (!params.proposedTenor || params.proposedTenor <= 0) {
    errors.push("Tenor must be positive");
  }
  
  if (params.proposedTenor > 30) {
    errors.push("Tenor exceeds typical maximum of 30 years");
  }
  
  if (params.balloonPercentage > 50) {
    errors.push("Warning: Balloon payment exceeds 50% of loan amount");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check covenant breaches
 */
export function checkCovenantBreaches(metrics, covenants) {
  const breaches = {
    dscr: [],
    icr: [],
    leverage: [],
    ltv: [],
  };
  
  metrics.forEach((yearMetrics, index) => {
    const year = yearMetrics.year || index + 1;
    
    // DSCR breach
    if (yearMetrics.dscr < covenants.minDSCR) {
      breaches.dscr.push({
        year,
        actual: yearMetrics.dscr,
        required: covenants.minDSCR,
        shortfall: covenants.minDSCR - yearMetrics.dscr,
      });
    }
    
    // ICR breach
    if (yearMetrics.icr < covenants.targetICR) {
      breaches.icr.push({
        year,
        actual: yearMetrics.icr,
        required: covenants.targetICR,
        shortfall: covenants.targetICR - yearMetrics.icr,
      });
    }
    
    // Leverage breach
    if (yearMetrics.ndToEbitda > covenants.maxNDToEBITDA) {
      breaches.leverage.push({
        year,
        actual: yearMetrics.ndToEbitda,
        maximum: covenants.maxNDToEBITDA,
        excess: yearMetrics.ndToEbitda - covenants.maxNDToEBITDA,
      });
    }
    
    // LTV breach (if applicable)
    if (covenants.maxLTV && yearMetrics.ltv > covenants.maxLTV) {
      breaches.ltv.push({
        year,
        actual: yearMetrics.ltv,
        maximum: covenants.maxLTV,
        excess: yearMetrics.ltv - covenants.maxLTV,
      });
    }
  });
  
  return {
    hasBreaches: Object.values(breaches).some(b => b.length > 0),
    breaches,
    totalBreaches: breaches.dscr.length + breaches.icr.length + breaches.leverage.length + breaches.ltv.length,
  };
}

/**
 * Validate data quality for historical analysis
 */
export function validateDataQuality(historicalData) {
  const issues = [];
  const warnings = [];
  
  if (!historicalData || historicalData.length === 0) {
    issues.push("No historical data available");
    return { isValid: false, issues, warnings };
  }
  
  const validYears = historicalData.filter(d => d.revenue > 0);
  
  if (validYears.length < 2) {
    issues.push("At least 2 years of historical data required for trend analysis");
  }
  
  // Check for missing key fields
  validYears.forEach(year => {
    if (!year.ebitda && year.ebitda !== 0) {
      warnings.push(`Year ${year.year}: Missing EBITDA data`);
    }
    
    if (!year.netIncome && year.netIncome !== 0) {
      warnings.push(`Year ${year.year}: Missing net income data`);
    }
    
    if (!year.totalAssets && year.totalAssets !== 0) {
      warnings.push(`Year ${year.year}: Missing total assets data`);
    }
  });
  
  // Check for data consistency
  validYears.forEach(year => {
    const ebitdaMargin = year.revenue > 0 ? year.ebitda / year.revenue : 0;
    
    if (ebitdaMargin < -1 || ebitdaMargin > 1) {
      warnings.push(`Year ${year.year}: EBITDA margin (${(ebitdaMargin * 100).toFixed(1)}%) appears unusual`);
    }
    
    if (year.workingCapital && year.revenue > 0) {
      const wcPct = year.workingCapital / year.revenue;
      if (Math.abs(wcPct) > 1) {
        warnings.push(`Year ${year.year}: Working capital as % of revenue (${(wcPct * 100).toFixed(1)}%) appears unusual`);
      }
    }
  });
  
  // Check for year-over-year consistency
  if (validYears.length >= 2) {
    const sorted = [...validYears].sort((a, b) => a.year - b.year);
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      
      const revenueGrowth = (curr.revenue - prev.revenue) / prev.revenue;
      
      if (Math.abs(revenueGrowth) > 2) {
        warnings.push(
          `Years ${prev.year}-${curr.year}: Revenue changed by ${(revenueGrowth * 100).toFixed(0)}% - verify this is correct`
        );
      }
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    dataYears: validYears.length,
  };
}

/**
 * Validate credit assessment inputs
 */
export function validateCreditAssessment(params) {
  const errors = [];
  const warnings = [];
  
  if (!params.totalAssets || params.totalAssets <= 0) {
    errors.push("Total assets must be positive");
  }
  
  if (params.collateralValue > params.totalAssets) {
    warnings.push("Collateral value exceeds total assets - verify this is correct");
  }
  
  if (params.businessAge < 0) {
    errors.push("Business age cannot be negative");
  }
  
  if (params.businessAge < 2) {
    warnings.push("Business is less than 2 years old - higher credit risk");
  }
  
  if (params.openingDebt > params.totalAssets) {
    warnings.push("Debt exceeds total assets - highly leveraged");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate monthly cash flow data
 */
export function validateMonthlyCashFlow(monthlyCashFlows) {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(monthlyCashFlows) || monthlyCashFlows.length !== 12) {
    errors.push("Monthly cash flow must contain exactly 12 months");
    return { isValid: false, errors, warnings };
  }
  
  const monthsWithData = monthlyCashFlows.filter(
    m => m.operatingCashFlow !== null && m.operatingCashFlow !== undefined
  ).length;
  
  if (monthsWithData > 0 && monthsWithData < 3) {
    warnings.push("Less than 3 months of cash flow data - consider adding more");
  }
  
  const burnMonths = monthlyCashFlows.filter(m => m.operatingCashFlow < 0).length;
  
  if (burnMonths === 12) {
    warnings.push("Company burns cash every month - verify sustainability");
  }
  
  if (burnMonths > 9) {
    warnings.push("Company burns cash in most months - liquidity risk");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    monthsWithData,
    burnMonths,
  };
}

/**
 * Comprehensive validation for entire model
 */
export function validateEntireModel(params, historicalData) {
  const results = {
    isValid: true,
    sections: {},
  };
  
  // Validate model parameters
  results.sections.modelParams = validateModelParams(params);
  
  // Validate facility terms
  results.sections.facilityTerms = validateFacilityTerms(params);
  
  // Validate credit assessment
  results.sections.creditAssessment = validateCreditAssessment(params);
  
  // Validate historical data quality
  results.sections.dataQuality = validateDataQuality(historicalData);
  
  // Overall validity
  results.isValid = Object.values(results.sections).every(section => section.isValid);
  
  // Collect all errors
  results.allErrors = Object.entries(results.sections)
    .filter(([_, section]) => section.errors?.length > 0)
    .flatMap(([name, section]) => 
      section.errors.map(error => `${name}: ${error}`)
    );
  
  // Collect all warnings
  results.allWarnings = Object.entries(results.sections)
    .filter(([_, section]) => section.warnings?.length > 0)
    .flatMap(([name, section]) => 
      section.warnings.map(warning => `${name}: ${warning}`)
    );
  
  return results;
}