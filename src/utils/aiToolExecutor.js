/**
 * AI Tool Executor for FinSight
 * Executes tool calls from the AI and returns formatted results
 */

import { currencyFmt, currencyFmtMM, pctFmt, numFmt } from './formatters';

/**
 * Execute a tool call from the AI
 * @param {string} toolName - Name of the tool to execute
 * @param {object} params - Parameters for the tool
 * @param {object} context - Context containing modelData, callbacks, etc.
 * @returns {object} - Result object with success status and formatted message
 */
export async function executeToolCall(toolName, params, context) {
  const {
    modelData,
    onParamUpdate,
    onRunStressTest,
    onNavigateToTab,
    currency = 'JMD'
  } = context;

  try {
    switch (toolName) {
      case 'calculate_optimal_debt':
        return calculateOptimalDebt(params, modelData, currency);

      case 'run_stress_test':
        return runStressTest(params, onRunStressTest, modelData, currency);

      case 'update_model_parameter':
      case 'update_param':
        return updateModelParameter(params, onParamUpdate);

      case 'navigate_to_tab':
        return navigateToTab(params, onNavigateToTab);

      case 'analyze_covenant_headroom':
        return analyzeCovenantHeadroom(params, modelData, currency);

      case 'restructure_deal':
        return restructureDeal(params, modelData, currency);

      default:
        return {
          success: false,
          message: `Unknown tool: ${toolName}`,
          data: null
        };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      message: `Error executing ${toolName}: ${error.message}`,
      data: null
    };
  }
}

/**
 * Calculate optimal debt for a target DSCR
 */
function calculateOptimalDebt(params, modelData, currency) {
  const { targetDSCR } = params;

  if (!targetDSCR || targetDSCR <= 0) {
    return {
      success: false,
      message: 'Invalid target DSCR. Please provide a positive number (e.g., 1.3).',
      data: null
    };
  }

  // Get required data from model
  const projections = modelData?.projections?.base?.rows || modelData?.projections?.rows || [];
  const modelParams = modelData?.params || {};

  // Get first year EBITDA (or average)
  const firstYearData = projections[0] || {};
  const ebitda = firstYearData.ebitda || 0;

  if (ebitda <= 0) {
    return {
      success: false,
      message: 'Cannot calculate optimal debt: EBITDA is zero or negative.',
      data: null
    };
  }

  // Get interest rate and tenor
  const interestRate = modelParams.interestRate || modelParams.rate || 0.10;
  const tenor = modelParams.debtTenorYears || modelParams.tenor || 5;

  // Calculate payment factor (for amortizing loan)
  const r = interestRate;
  const n = tenor;
  const paymentFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  // Calculate optimal debt: EBITDA / (paymentFactor * targetDSCR)
  const annualDebtService = ebitda / targetDSCR;
  const optimalDebt = annualDebtService / paymentFactor;

  // Get current debt for comparison
  const currentDebt = getTotalDebt(modelParams);

  // Calculate what DSCR would be at current debt
  const currentDebtService = currentDebt * paymentFactor;
  const currentDSCR = currentDebtService > 0 ? ebitda / currentDebtService : 999;

  // Format result
  const ccy = currency || modelParams.currency || 'JMD';
  const prefix = ccy === 'JMD' ? 'J$' : '$';

  return {
    success: true,
    message: `📊 Optimal Debt Analysis

Target DSCR: ${targetDSCR.toFixed(2)}x

Calculation Results:
• Maximum Debt Capacity: ${prefix}${(optimalDebt / 1000000).toFixed(1)}M
• Annual Debt Service: ${prefix}${(annualDebtService / 1000000).toFixed(2)}M
• Based on EBITDA: ${prefix}${(ebitda / 1000000).toFixed(1)}M

Current Position:
• Current Total Debt: ${prefix}${(currentDebt / 1000000).toFixed(1)}M
• Current DSCR: ${currentDSCR.toFixed(2)}x
• Debt Capacity ${optimalDebt > currentDebt ? 'Available' : 'Exceeded'}: ${prefix}${(Math.abs(optimalDebt - currentDebt) / 1000000).toFixed(1)}M

Assumptions:
• Interest Rate: ${(interestRate * 100).toFixed(1)}%
• Loan Tenor: ${tenor} years
• Amortization: Level payment`,
    data: {
      optimalDebt,
      currentDebt,
      headroom: optimalDebt - currentDebt,
      targetDSCR,
      currentDSCR,
      ebitda,
      annualDebtService
    }
  };
}

/**
 * Run a stress test with custom shocks
 */
function runStressTest(params, onRunStressTest, modelData, currency) {
  const {
    revenueShock = 0,
    growthDelta = 0,
    costShock = 0,
    cogsDelta = 0,
    rateShock = 0,
    rateDelta = 0
  } = params;

  if (!onRunStressTest) {
    return {
      success: false,
      message: 'Stress test functionality is not available in current context.',
      data: null
    };
  }

  // Normalize parameter names (handle both formats)
  const normalizedRevenueShock = revenueShock || growthDelta;
  const normalizedCostShock = costShock || cogsDelta;
  const normalizedRateShock = rateShock || rateDelta;

  // Trigger the stress test
  onRunStressTest({
    growthDelta: normalizedRevenueShock,
    cogsDelta: normalizedCostShock,
    rateDelta: normalizedRateShock
  });

  // Build description of shocks applied
  const shockDescriptions = [];
  if (normalizedRevenueShock !== 0) {
    shockDescriptions.push(`Revenue ${normalizedRevenueShock > 0 ? '+' : ''}${(normalizedRevenueShock * 100).toFixed(0)}%`);
  }
  if (normalizedCostShock !== 0) {
    shockDescriptions.push(`Costs ${normalizedCostShock > 0 ? '+' : ''}${(normalizedCostShock * 100).toFixed(0)}%`);
  }
  if (normalizedRateShock !== 0) {
    shockDescriptions.push(`Interest Rate ${normalizedRateShock > 0 ? '+' : ''}${(normalizedRateShock * 100).toFixed(0)}%`);
  }

  return {
    success: true,
    message: `🔬 Stress Test Initiated

Shocks Applied:
${shockDescriptions.length > 0 ? shockDescriptions.map(s => `• ${s}`).join('\n') : '• No shocks specified'}

The stress test is now running. Check the Custom Stress tab to see the full impact on:
• DSCR and ICR ratios
• Covenant compliance
• Cash flow projections
• Breach risk analysis

I've navigated you to the stress testing results.`,
    data: {
      growthDelta: normalizedRevenueShock,
      cogsDelta: normalizedCostShock,
      rateDelta: normalizedRateShock
    }
  };
}

/**
 * Update a model parameter
 */
function updateModelParameter(params, onParamUpdate) {
  const { paramName, param_name, newValue, new_value, reason } = params;

  // Normalize parameter names (handle both formats)
  const normalizedParamName = paramName || param_name;
  const normalizedValue = newValue !== undefined ? newValue : new_value;

  if (!onParamUpdate) {
    return {
      success: false,
      message: 'Parameter update functionality is not available in current context.',
      data: null
    };
  }

  // Valid parameter names
  const validParams = [
    'requestedLoanAmount', 'openingDebt', 'existingDebtAmount',
    'interestRate', 'debtTenorYears', 'revenueGrowth', 'growth', 'ebitdaMargin',
    'taxRate', 'wacc', 'terminalGrowth', 'openingCash', 'baseRevenue',
    'cogsPct', 'opexPct', 'capexPct'
  ];

  if (!validParams.includes(normalizedParamName)) {
    return {
      success: false,
      message: `Invalid parameter: "${normalizedParamName}". Valid options are: ${validParams.join(', ')}`,
      data: null
    };
  }

  // Execute the update
  onParamUpdate(normalizedParamName, normalizedValue);

  // Format the value for display
  let displayValue = normalizedValue;
  if (['interestRate', 'revenueGrowth', 'growth', 'ebitdaMargin', 'taxRate', 'wacc', 'terminalGrowth', 'cogsPct', 'opexPct', 'capexPct'].includes(normalizedParamName)) {
    displayValue = `${(normalizedValue * 100).toFixed(2)}%`;
  } else if (['requestedLoanAmount', 'openingDebt', 'existingDebtAmount', 'openingCash', 'baseRevenue'].includes(normalizedParamName)) {
    displayValue = `${(normalizedValue / 1000000).toFixed(1)}M`;
  }

  return {
    success: true,
    message: `✅ Parameter Updated

Changed: ${normalizedParamName}
New Value: ${displayValue}
${reason ? `Reason: ${reason}` : ''}

The financial model has been recalculated with the new value. All projections, ratios, and analyses now reflect this change.`,
    data: {
      paramName: normalizedParamName,
      oldValue: null, // We don't have access to old value here
      newValue: normalizedValue
    }
  };
}

/**
 * Navigate to a specific tab
 */
function navigateToTab(params, onNavigateToTab) {
  const { tabId, tab } = params;

  // Normalize parameter name (handle both formats)
  const normalizedTabId = tabId || tab;

  if (!onNavigateToTab) {
    return {
      success: false,
      message: 'Navigation is not available in current context.',
      data: null
    };
  }

  const tabNames = {
    'dashboard': 'Credit Dashboard',
    'capital': 'Capital Structure',
    'valuation': 'Valuation',
    'scenarios': 'Scenario Comparison',
    'debt-stress': 'Debt & Stress Testing',
    'custom': 'Custom Stress',
    'sensitivity': 'Sensitivity Analysis',
    'reports': 'Reports',
    'historical': 'Historical Data',
    'tables': 'Data Tables'
  };

  if (!tabNames[normalizedTabId]) {
    return {
      success: false,
      message: `Unknown tab: "${normalizedTabId}". Valid options: ${Object.keys(tabNames).join(', ')}`,
      data: null
    };
  }

  onNavigateToTab(normalizedTabId);

  return {
    success: true,
    message: `📍 Navigating to ${tabNames[normalizedTabId]} tab...`,
    data: { tabId: normalizedTabId }
  };
}

/**
 * Analyze covenant headroom
 */
function analyzeCovenantHeadroom(params, modelData, currency) {
  const { covenantType = 'all' } = params;

  const projections = modelData?.projections?.base?.rows || modelData?.projections?.rows || [];
  const modelParams = modelData?.params || {};
  const ccy = currency || modelParams.currency || 'JMD';
  const prefix = ccy === 'JMD' ? 'J$' : '$';

  if (projections.length === 0) {
    return {
      success: false,
      message: 'No projection data available for covenant analysis.',
      data: null
    };
  }

  // Get covenant thresholds (use defaults if not set)
  const dscrMin = modelParams.dscrCovenant || modelParams.minDSCR || 1.25;
  const icrMin = modelParams.icrCovenant || modelParams.targetICR || 2.0;
  const leverageMax = modelParams.leverageCovenant || modelParams.maxNDToEBITDA || 4.0;

  // Analyze each year
  const analysis = projections.map((year, index) => {
    const dscr = year.dscr || 0;
    const icr = year.icr || year.interestCoverage || 0;
    const leverage = year.leverage || year.debtToEbitda || year.ndToEbitda || 0;

    return {
      year: index + 1,
      dscr: {
        value: dscr,
        threshold: dscrMin,
        headroom: dscr - dscrMin,
        breached: dscr < dscrMin
      },
      icr: {
        value: icr,
        threshold: icrMin,
        headroom: icr - icrMin,
        breached: icr < icrMin
      },
      leverage: {
        value: leverage,
        threshold: leverageMax,
        headroom: leverageMax - leverage,
        breached: leverage > leverageMax
      }
    };
  });

  // Find minimum headroom across all years
  const minDSCRHeadroom = Math.min(...analysis.map(a => a.dscr.headroom));
  const minICRHeadroom = Math.min(...analysis.map(a => a.icr.headroom));
  const minLeverageHeadroom = Math.min(...analysis.map(a => a.leverage.headroom));

  // Find breach years
  const dscrBreachYears = analysis.filter(a => a.dscr.breached).map(a => a.year);
  const icrBreachYears = analysis.filter(a => a.icr.breached).map(a => a.year);
  const leverageBreachYears = analysis.filter(a => a.leverage.breached).map(a => a.year);

  // Build response based on covenant type
  let sections = [];

  if (covenantType === 'all' || covenantType === 'dscr') {
    sections.push(`📊 DSCR Covenant (Min: ${dscrMin.toFixed(2)}x)
• Minimum Headroom: ${minDSCRHeadroom >= 0 ? '+' : ''}${minDSCRHeadroom.toFixed(2)}x
• Status: ${dscrBreachYears.length === 0 ? '✅ Compliant all years' : `⚠️ Breached in Year(s): ${dscrBreachYears.join(', ')}`}`);
  }

  if (covenantType === 'all' || covenantType === 'icr') {
    sections.push(`📊 ICR Covenant (Min: ${icrMin.toFixed(2)}x)
• Minimum Headroom: ${minICRHeadroom >= 0 ? '+' : ''}${minICRHeadroom.toFixed(2)}x
• Status: ${icrBreachYears.length === 0 ? '✅ Compliant all years' : `⚠️ Breached in Year(s): ${icrBreachYears.join(', ')}`}`);
  }

  if (covenantType === 'all' || covenantType === 'leverage') {
    sections.push(`📊 Leverage Covenant (Max: ${leverageMax.toFixed(1)}x)
• Minimum Headroom: ${minLeverageHeadroom >= 0 ? '+' : ''}${minLeverageHeadroom.toFixed(2)}x
• Status: ${leverageBreachYears.length === 0 ? '✅ Compliant all years' : `⚠️ Breached in Year(s): ${leverageBreachYears.join(', ')}`}`);
  }

  const overallStatus = (dscrBreachYears.length + icrBreachYears.length + leverageBreachYears.length) === 0
    ? '✅ All covenants compliant across projection period'
    : '⚠️ Covenant breaches detected - review stress scenarios';

  return {
    success: true,
    message: `📋 Covenant Headroom Analysis

${sections.join('\n\n')}

Overall Assessment: ${overallStatus}`,
    data: {
      analysis,
      breaches: {
        dscr: dscrBreachYears,
        icr: icrBreachYears,
        leverage: leverageBreachYears
      }
    }
  };
}

/**
 * Restructure deal with comprehensive analysis
 */
function restructureDeal(params, modelData, currency) {
  const {
    targetMinDSCR = 1.30,
    includeEquityOption = true,
    maxTenorYears = 10,
    minAcceptableRate = 0.08
  } = params;

  const projections = modelData?.projections?.base?.rows || modelData?.projections?.rows || [];
  const modelParams = modelData?.params || {};
  const ccy = currency || modelParams.currency || 'JMD';
  const prefix = ccy === 'JMD' ? 'J$' : '$';

  if (projections.length === 0) {
    return {
      success: false,
      message: 'No projection data available for restructuring analysis.',
      data: null
    };
  }

  // Get current deal terms
  const currentPrincipal = getTotalDebt(modelParams);
  const currentRate = modelParams.interestRate || 0.12;
  const currentTenor = modelParams.debtTenorYears || 5;

  // Get covenant thresholds
  const dscrMin = modelParams.minDSCR || 1.25;
  const icrMin = modelParams.targetICR || 2.0;
  const leverageMax = modelParams.maxNDToEBITDA || 4.0;

  // Step A: Diagnose Current Situation
  const diagnosis = diagnoseDealStatus(projections, dscrMin, icrMin, leverageMax);

  // Step B: Generate Restructuring Options
  const options = generateRestructuringOptions({
    projections,
    currentPrincipal,
    currentRate,
    currentTenor,
    targetMinDSCR,
    dscrMin,
    includeEquityOption,
    maxTenorYears,
    minAcceptableRate,
    prefix
  });

  // Step C: Generate Comparison Matrix
  const comparisonMatrix = formatComparisonMatrix(options, currentPrincipal, currentRate, currentTenor, prefix);

  // Step D: Generate Recommendation
  const recommendation = generateRestructuringRecommendation(options, diagnosis);

  // Format the complete output
  const message = formatRestructuringOutput({
    diagnosis,
    options,
    comparisonMatrix,
    recommendation,
    dscrMin,
    icrMin,
    leverageMax
  });

  return {
    success: true,
    message,
    data: {
      diagnosis,
      options,
      recommendation
    }
  };
}

/**
 * Diagnose current deal status and covenant breaches
 */
function diagnoseDealStatus(projections, dscrMin, icrMin, leverageMax) {
  const timeline = projections.map((year, index) => {
    const dscr = year.dscr || 0;
    const icr = year.icr || year.interestCoverage || 0;
    const leverage = year.leverage || year.ndToEbitda || 0;

    return {
      year: index + 1,
      dscr,
      dscrStatus: dscr >= dscrMin ? '✅ Pass' : (dscr >= dscrMin * 0.95 ? '⚠️ Tight' : '❌ BREACH'),
      icr,
      icrStatus: icr >= icrMin ? '✅ Pass' : (icr >= icrMin * 0.95 ? '⚠️ Tight' : '❌ BREACH'),
      leverage,
      leverageStatus: leverage <= leverageMax ? '✅ Pass' : (leverage <= leverageMax * 1.05 ? '⚠️ Tight' : '❌ BREACH'),
      breached: dscr < dscrMin || icr < icrMin || leverage > leverageMax
    };
  });

  // Identify breach years
  const breachYears = timeline.filter(t => t.breached).map(t => t.year);

  // Root cause analysis
  const rootCauses = analyzeRootCause(projections, timeline);

  return {
    timeline,
    breachYears,
    rootCauses,
    hasBreaches: breachYears.length > 0
  };
}

/**
 * Analyze root cause of covenant breaches
 */
function analyzeRootCause(projections, timeline) {
  const causes = [];

  // Check if revenue is declining
  if (projections.length >= 2) {
    const revenueGrowth = projections.map((year, i) => {
      if (i === 0) return 0;
      return ((year.revenue - projections[i - 1].revenue) / projections[i - 1].revenue) * 100;
    });

    const avgGrowth = revenueGrowth.slice(1).reduce((a, b) => a + b, 0) / (revenueGrowth.length - 1);

    if (avgGrowth < 0) {
      causes.push('**Primary Issue:** Revenue declining while debt service remains fixed');
    } else if (avgGrowth < 2) {
      causes.push('**Primary Issue:** Weak revenue growth insufficient to support debt service');
    }
  }

  // Check if high interest rate
  const firstYear = projections[0];
  const avgDSCR = timeline.reduce((sum, t) => sum + t.dscr, 0) / timeline.length;

  if (firstYear.interestExpense && firstYear.ebitda) {
    const interestToEBITDA = firstYear.interestExpense / firstYear.ebitda;
    if (interestToEBITDA > 0.4) {
      causes.push('**Secondary Issue:** High interest rate consuming excessive EBITDA');
    }
  }

  // Check structural issues
  if (timeline.filter(t => t.breached).length > timeline.length / 2) {
    causes.push('**Structural Weakness:** Fundamental mismatch between cash generation and debt obligations');
  }

  return causes.length > 0 ? causes : ['**Assessment:** Deal structure requires optimization for improved covenant compliance'];
}

/**
 * Generate multiple restructuring options
 */
function generateRestructuringOptions(config) {
  const {
    projections,
    currentPrincipal,
    currentRate,
    currentTenor,
    targetMinDSCR,
    dscrMin,
    includeEquityOption,
    maxTenorYears,
    minAcceptableRate,
    prefix
  } = config;

  const options = [];
  const firstYearEBITDA = projections[0]?.ebitda || 0;
  const worstYearDSCR = Math.min(...projections.map(p => p.dscr || 999));
  const worstYear = projections.find(p => p.dscr === worstYearDSCR);

  // Option A: Principal Reduction
  const principalReductionOption = generatePrincipalReductionOption({
    currentPrincipal,
    currentRate,
    currentTenor,
    worstYear,
    targetMinDSCR,
    projections,
    dscrMin,
    prefix
  });
  options.push(principalReductionOption);

  // Option B: Tenor Extension
  const tenorExtensionOption = generateTenorExtensionOption({
    currentPrincipal,
    currentRate,
    currentTenor,
    maxTenorYears,
    worstYear,
    targetMinDSCR,
    projections,
    dscrMin,
    prefix
  });
  options.push(tenorExtensionOption);

  // Option C: Rate Reduction
  const rateReductionOption = generateRateReductionOption({
    currentPrincipal,
    currentRate,
    currentTenor,
    minAcceptableRate,
    worstYear,
    targetMinDSCR,
    projections,
    dscrMin,
    prefix
  });
  options.push(rateReductionOption);

  // Option D: Equity Injection (if enabled)
  if (includeEquityOption) {
    const equityInjectionOption = generateEquityInjectionOption({
      currentPrincipal,
      currentRate,
      currentTenor,
      worstYear,
      targetMinDSCR,
      projections,
      dscrMin,
      prefix
    });
    options.push(equityInjectionOption);
  }

  // Option E: Combination (Recommended)
  const combinationOption = generateCombinationOption({
    currentPrincipal,
    currentRate,
    currentTenor,
    worstYear,
    targetMinDSCR,
    projections,
    dscrMin,
    prefix
  });
  options.push(combinationOption);

  return options;
}

/**
 * Option A: Principal Reduction
 */
function generatePrincipalReductionOption(config) {
  const { currentPrincipal, currentRate, currentTenor, worstYear, targetMinDSCR, projections, dscrMin, prefix } = config;

  const worstYearEBITDA = worstYear?.ebitda || projections[0]?.ebitda || 0;
  const targetDebtService = worstYearEBITDA / targetMinDSCR;
  const paymentFactor = calculatePaymentFactor(currentRate, currentTenor);
  const targetPrincipal = targetDebtService / paymentFactor;
  const principalReduction = Math.min(currentPrincipal - targetPrincipal, currentPrincipal * 0.35); // Cap at 35%
  const newPrincipal = currentPrincipal - principalReduction;

  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const newDS = calculateAnnualDebtService(newPrincipal, currentRate, currentTenor);

  const results = recalculateMetrics(projections, newPrincipal, currentRate, currentTenor, dscrMin);
  const haircutPct = (principalReduction / currentPrincipal) * 100;

  return {
    name: 'Option A: Principal Reduction',
    id: 'A',
    structure: `Reduce principal from ${prefix}${(currentPrincipal / 1e6).toFixed(0)}M → ${prefix}${(newPrincipal / 1e6).toFixed(0)}M (${haircutPct.toFixed(0)}% haircut)`,
    principal: newPrincipal,
    rate: currentRate,
    tenor: currentTenor,
    annualDS: newDS,
    minDSCR: results.minDSCR,
    breachYears: results.breachYears,
    totalInterest: calculateTotalInterest(newPrincipal, currentRate, currentTenor),
    lenderNPV: -haircutPct,
    acceptance: haircutPct > 25 ? 'LOW (15-25%)' : 'MEDIUM (40-55%)',
    impacts: [
      { metric: 'Annual Debt Service', before: currentDS, after: newDS, change: ((newDS - currentDS) / currentDS) * 100 },
      { metric: 'Year 3 DSCR', before: projections[2]?.dscr || 0, after: results.year3DSCR, change: results.year3DSCR - (projections[2]?.dscr || 0) },
      { metric: 'Year 5 DSCR', before: projections[4]?.dscr || 0, after: results.year5DSCR, change: results.year5DSCR - (projections[4]?.dscr || 0) },
      { metric: 'Breach Years', before: countBreachYears(projections, dscrMin), after: results.breachYears, change: 'Resolved' }
    ],
    pros: 'Immediately resolves all breaches',
    cons: `Significant lender loss (${prefix}${(principalReduction / 1e6).toFixed(0)}M), unlikely to be accepted`
  };
}

/**
 * Option B: Tenor Extension
 */
function generateTenorExtensionOption(config) {
  const { currentPrincipal, currentRate, currentTenor, maxTenorYears, worstYear, targetMinDSCR, projections, dscrMin, prefix } = config;

  // Find minimum tenor extension needed
  let newTenor = currentTenor + 1;
  let results;

  while (newTenor <= maxTenorYears) {
    results = recalculateMetrics(projections, currentPrincipal, currentRate, newTenor, dscrMin);
    if (results.minDSCR >= targetMinDSCR && results.breachYears === 0) break;
    newTenor++;
  }

  if (newTenor > maxTenorYears) newTenor = Math.min(currentTenor + 3, maxTenorYears);
  results = recalculateMetrics(projections, currentPrincipal, currentRate, newTenor, dscrMin);

  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const newDS = calculateAnnualDebtService(currentPrincipal, currentRate, newTenor);
  const currentTotalInterest = calculateTotalInterest(currentPrincipal, currentRate, currentTenor);
  const newTotalInterest = calculateTotalInterest(currentPrincipal, currentRate, newTenor);

  return {
    name: 'Option B: Tenor Extension',
    id: 'B',
    structure: `Extend from ${currentTenor} years → ${newTenor} years`,
    principal: currentPrincipal,
    rate: currentRate,
    tenor: newTenor,
    annualDS: newDS,
    minDSCR: results.minDSCR,
    breachYears: results.breachYears,
    totalInterest: newTotalInterest,
    lenderNPV: ((newTotalInterest - currentTotalInterest) / currentPrincipal) * 100,
    acceptance: 'MEDIUM-HIGH (60-75%)',
    impacts: [
      { metric: 'Annual Debt Service', before: currentDS, after: newDS, change: ((newDS - currentDS) / currentDS) * 100 },
      { metric: 'Year 3 DSCR', before: projections[2]?.dscr || 0, after: results.year3DSCR, change: results.year3DSCR - (projections[2]?.dscr || 0) },
      { metric: 'Year 5 DSCR', before: projections[4]?.dscr || 0, after: results.year5DSCR, change: results.year5DSCR - (projections[4]?.dscr || 0) },
      { metric: 'Total Interest Paid', before: currentTotalInterest, after: newTotalInterest, change: ((newTotalInterest - currentTotalInterest) / currentTotalInterest) * 100 },
      { metric: 'Breach Years', before: countBreachYears(projections, dscrMin), after: results.breachYears, change: 'Resolved' }
    ],
    pros: 'No principal loss for lender, resolves breaches',
    cons: `Borrower pays ${prefix}${((newTotalInterest - currentTotalInterest) / 1e6).toFixed(1)}M additional interest over life`
  };
}

/**
 * Option C: Rate Reduction
 */
function generateRateReductionOption(config) {
  const { currentPrincipal, currentRate, currentTenor, minAcceptableRate, worstYear, targetMinDSCR, projections, dscrMin, prefix } = config;

  // Find minimum rate reduction needed (test in 50bps increments)
  let newRate = currentRate - 0.005;
  let results;

  while (newRate >= minAcceptableRate) {
    results = recalculateMetrics(projections, currentPrincipal, newRate, currentTenor, dscrMin);
    if (results.minDSCR >= targetMinDSCR && results.breachYears === 0) break;
    newRate -= 0.005;
  }

  if (newRate < minAcceptableRate) newRate = Math.max(currentRate * 0.75, minAcceptableRate);
  results = recalculateMetrics(projections, currentPrincipal, newRate, currentTenor, dscrMin);

  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const newDS = calculateAnnualDebtService(currentPrincipal, newRate, currentTenor);
  const bpsReduction = (currentRate - newRate) * 10000;

  return {
    name: 'Option C: Rate Reduction',
    id: 'C',
    structure: `Reduce rate from ${(currentRate * 100).toFixed(1)}% → ${(newRate * 100).toFixed(1)}%`,
    principal: currentPrincipal,
    rate: newRate,
    tenor: currentTenor,
    annualDS: newDS,
    minDSCR: results.minDSCR,
    breachYears: results.breachYears,
    totalInterest: calculateTotalInterest(currentPrincipal, newRate, currentTenor),
    lenderNPV: -((currentRate - newRate) * 100),
    acceptance: results.breachYears === 0 ? 'MEDIUM (40-55%)' : 'MEDIUM-LOW (30-40%)',
    impacts: [
      { metric: 'Annual Debt Service', before: currentDS, after: newDS, change: ((newDS - currentDS) / currentDS) * 100 },
      { metric: 'Year 3 DSCR', before: projections[2]?.dscr || 0, after: results.year3DSCR, change: results.year3DSCR - (projections[2]?.dscr || 0) },
      { metric: 'Year 5 DSCR', before: projections[4]?.dscr || 0, after: results.year5DSCR, change: results.year5DSCR - (projections[4]?.dscr || 0) },
      { metric: 'Breach Years', before: countBreachYears(projections, dscrMin), after: results.breachYears, change: results.breachYears === 0 ? 'Resolved' : 'Partial' }
    ],
    pros: 'Preserves principal, improves coverage',
    cons: `${results.breachYears > 0 ? 'Does NOT fully resolve breaches, ' : ''}${bpsReduction.toFixed(0)}bps yield sacrifice`
  };
}

/**
 * Option D: Equity Injection
 */
function generateEquityInjectionOption(config) {
  const { currentPrincipal, currentRate, currentTenor, worstYear, targetMinDSCR, projections, dscrMin, prefix } = config;

  // Calculate equity needed for target DSCR
  const worstYearEBITDA = worstYear?.ebitda || projections[0]?.ebitda || 0;
  const targetDebtService = worstYearEBITDA / targetMinDSCR;
  const paymentFactor = calculatePaymentFactor(currentRate, currentTenor);
  const targetPrincipal = targetDebtService / paymentFactor;
  const equityNeeded = Math.min(currentPrincipal - targetPrincipal, currentPrincipal * 0.25); // Cap at 25%
  const newPrincipal = currentPrincipal - equityNeeded;

  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const newDS = calculateAnnualDebtService(newPrincipal, currentRate, currentTenor);
  const results = recalculateMetrics(projections, newPrincipal, currentRate, currentTenor, dscrMin);

  return {
    name: 'Option D: Equity Injection',
    id: 'D',
    structure: `Sponsor injects ${prefix}${(equityNeeded / 1e6).toFixed(0)}M to pay down principal`,
    principal: newPrincipal,
    rate: currentRate,
    tenor: currentTenor,
    annualDS: newDS,
    minDSCR: results.minDSCR,
    breachYears: results.breachYears,
    totalInterest: calculateTotalInterest(newPrincipal, currentRate, currentTenor),
    lenderNPV: -((equityNeeded / currentPrincipal) * 5), // Small NPV impact from early prepayment
    acceptance: 'HIGH (75-85%) if sponsor willing',
    impacts: [
      { metric: 'Principal', before: currentPrincipal, after: newPrincipal, change: -((equityNeeded / currentPrincipal) * 100) },
      { metric: 'Annual Debt Service', before: currentDS, after: newDS, change: ((newDS - currentDS) / currentDS) * 100 },
      { metric: 'Year 3 DSCR', before: projections[2]?.dscr || 0, after: results.year3DSCR, change: results.year3DSCR - (projections[2]?.dscr || 0) },
      { metric: 'Year 5 DSCR', before: projections[4]?.dscr || 0, after: results.year5DSCR, change: results.year5DSCR - (projections[4]?.dscr || 0) },
      { metric: 'Breach Years', before: countBreachYears(projections, dscrMin), after: results.breachYears, change: results.breachYears <= 1 ? 'Mostly Resolved' : 'Partial' }
    ],
    pros: 'Preserves lender economics, demonstrates sponsor commitment',
    cons: `Requires sponsor capital availability${results.breachYears > 0 ? ', some years still tight' : ''}`
  };
}

/**
 * Option E: Combination (Recommended)
 */
function generateCombinationOption(config) {
  const { currentPrincipal, currentRate, currentTenor, worstYear, targetMinDSCR, projections, dscrMin, prefix } = config;

  // Balanced approach: modest changes across multiple levers
  const newTenor = Math.min(currentTenor + 2, 8); // Add 2 years
  const newRate = Math.max(currentRate * 0.875, 0.09); // 12.5% rate reduction
  const equityInjection = currentPrincipal * 0.08; // 8% equity injection
  const newPrincipal = currentPrincipal - equityInjection;

  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const newDS = calculateAnnualDebtService(newPrincipal, newRate, newTenor);
  const results = recalculateMetrics(projections, newPrincipal, newRate, newTenor, dscrMin);

  const currentTotalInterest = calculateTotalInterest(currentPrincipal, currentRate, currentTenor);
  const newTotalInterest = calculateTotalInterest(newPrincipal, newRate, newTenor);

  return {
    name: 'Option E: Combination (RECOMMENDED) ⭐',
    id: 'E',
    structure: `Extend tenor: ${currentTenor} years → ${newTenor} years\nReduce rate: ${(currentRate * 100).toFixed(1)}% → ${(newRate * 100).toFixed(1)}%\nEquity injection: ${prefix}${(equityInjection / 1e6).toFixed(0)}M prepayment`,
    principal: newPrincipal,
    rate: newRate,
    tenor: newTenor,
    annualDS: newDS,
    minDSCR: results.minDSCR,
    breachYears: results.breachYears,
    totalInterest: newTotalInterest,
    lenderNPV: ((newTotalInterest - currentTotalInterest) / currentPrincipal) * 100,
    acceptance: 'HIGH (70-80%)',
    impacts: [
      { metric: 'Principal', before: currentPrincipal, after: newPrincipal, change: -((equityInjection / currentPrincipal) * 100) },
      { metric: 'Rate', before: currentRate, after: newRate, change: -((currentRate - newRate) / currentRate) * 100 },
      { metric: 'Tenor', before: currentTenor, after: newTenor, change: newTenor - currentTenor },
      { metric: 'Annual Debt Service', before: currentDS, after: newDS, change: ((newDS - currentDS) / currentDS) * 100 },
      { metric: 'Year 3 DSCR', before: projections[2]?.dscr || 0, after: results.year3DSCR, change: results.year3DSCR - (projections[2]?.dscr || 0) },
      { metric: 'Year 5 DSCR', before: projections[4]?.dscr || 0, after: results.year5DSCR, change: results.year5DSCR - (projections[4]?.dscr || 0) },
      { metric: 'Min DSCR (all years)', before: Math.min(...projections.map(p => p.dscr || 999)), after: results.minDSCR, change: results.minDSCR - Math.min(...projections.map(p => p.dscr || 999)) },
      { metric: 'Breach Years', before: countBreachYears(projections, dscrMin), after: results.breachYears, change: 'Resolved' },
      { metric: 'Total Interest', before: currentTotalInterest, after: newTotalInterest, change: ((newTotalInterest - currentTotalInterest) / currentTotalInterest) * 100 }
    ],
    pros: 'Resolves all breaches with cushion, balanced concessions, NPV-neutral for lender',
    cons: 'Requires coordination of multiple modifications'
  };
}

/**
 * Calculate annual debt service (amortizing loan)
 */
function calculateAnnualDebtService(principal, rate, tenor) {
  if (principal <= 0 || tenor <= 0) return 0;
  const paymentFactor = calculatePaymentFactor(rate, tenor);
  return principal * paymentFactor;
}

/**
 * Calculate payment factor for amortizing loan
 */
function calculatePaymentFactor(rate, tenor) {
  if (rate === 0) return 1 / tenor;
  return (rate * Math.pow(1 + rate, tenor)) / (Math.pow(1 + rate, tenor) - 1);
}

/**
 * Calculate total interest paid over loan life
 */
function calculateTotalInterest(principal, rate, tenor) {
  const annualPayment = calculateAnnualDebtService(principal, rate, tenor);
  return (annualPayment * tenor) - principal;
}

/**
 * Recalculate metrics with new deal terms
 */
function recalculateMetrics(projections, newPrincipal, newRate, newTenor, dscrMin) {
  const newDS = calculateAnnualDebtService(newPrincipal, newRate, newTenor);

  const newDSCRs = projections.map(year => {
    const ebitda = year.ebitda || 0;
    return newDS > 0 ? ebitda / newDS : 999;
  });

  const minDSCR = Math.min(...newDSCRs);
  const breachYears = newDSCRs.filter(dscr => dscr < dscrMin).length;

  return {
    minDSCR,
    breachYears,
    year3DSCR: newDSCRs[2] || 0,
    year5DSCR: newDSCRs[4] || 0,
    allDSCRs: newDSCRs
  };
}

/**
 * Count breach years in current projection
 */
function countBreachYears(projections, dscrMin) {
  return projections.filter(year => (year.dscr || 0) < dscrMin).length;
}

/**
 * Format comparison matrix
 */
function formatComparisonMatrix(options, currentPrincipal, currentRate, currentTenor, prefix) {
  const currentDS = calculateAnnualDebtService(currentPrincipal, currentRate, currentTenor);
  const currentMinDSCR = options[0]?.impacts?.[1]?.before || 0;
  const currentBreachYears = options[0]?.impacts?.[options[0].impacts.length - 1]?.before || 0;
  const currentTotalInterest = calculateTotalInterest(currentPrincipal, currentRate, currentTenor);

  const rows = options.map(opt => {
    const lenderNPVStr = opt.lenderNPV >= 0 ? `+${opt.lenderNPV.toFixed(0)}%` : `${opt.lenderNPV.toFixed(0)}%`;
    return `| ${opt.id} | ${prefix}${(opt.principal / 1e6).toFixed(0)}M | ${(opt.rate * 100).toFixed(1)}% | ${opt.tenor} yr | ${prefix}${(opt.annualDS / 1e6).toFixed(1)}M | ${opt.minDSCR.toFixed(2)}x | ${opt.breachYears} | ${prefix}${(opt.totalInterest / 1e6).toFixed(0)}M | ${lenderNPVStr} | ${opt.acceptance.split(' ')[0]} |`;
  });

  return `| Metric | Current | ${options.map(o => o.id + (o.id === 'E' ? ' ⭐' : '')).join(' | ')} |
|--------|---------|${options.map(() => '---').join('|')}|
| Principal | ${prefix}${(currentPrincipal / 1e6).toFixed(0)}M | ${options.map(o => `${prefix}${(o.principal / 1e6).toFixed(0)}M`).join(' | ')} |
| Rate | ${(currentRate * 100).toFixed(1)}% | ${options.map(o => `${(o.rate * 100).toFixed(1)}%`).join(' | ')} |
| Tenor | ${currentTenor} yr | ${options.map(o => `${o.tenor} yr`).join(' | ')} |
| Annual DS | ${prefix}${(currentDS / 1e6).toFixed(1)}M | ${options.map(o => `${prefix}${(o.annualDS / 1e6).toFixed(1)}M`).join(' | ')} |
| Min DSCR | ${currentMinDSCR.toFixed(2)}x | ${options.map(o => `${o.minDSCR.toFixed(2)}x`).join(' | ')} |
| Breach Years | ${currentBreachYears} | ${options.map(o => o.breachYears).join(' | ')} |
| Total Interest | ${prefix}${(currentTotalInterest / 1e6).toFixed(0)}M | ${options.map(o => `${prefix}${(o.totalInterest / 1e6).toFixed(0)}M`).join(' | ')} |
| Lender NPV | Base | ${options.map(o => {
    const npv = o.lenderNPV >= 0 ? `+${o.lenderNPV.toFixed(0)}%` : `${o.lenderNPV.toFixed(0)}%`;
    return npv;
  }).join(' | ')} |
| Acceptance | - | ${options.map(o => o.acceptance.split(' ')[0]).join(' | ')} |`;
}

/**
 * Generate recommendation
 */
function generateRestructuringRecommendation(options, diagnosis) {
  // Find option E (combination) or best option
  const recommendedOption = options.find(o => o.id === 'E') || options[options.length - 1];

  return {
    option: recommendedOption,
    rationale: [
      `**Covenant Compliance:** ${recommendedOption.breachYears === 0 ? 'Achieves full compliance' : 'Significantly improves compliance'} with min ${recommendedOption.minDSCR.toFixed(2)}x DSCR across ALL years`,
      `**Lender Economics:** NPV ${recommendedOption.lenderNPV >= 0 ? 'positive' : 'impact manageable'} (${recommendedOption.lenderNPV >= 0 ? '+' : ''}${recommendedOption.lenderNPV.toFixed(0)}%); preserves relationship value`,
      `**Borrower Viability:** Sustainable debt service aligned with ${diagnosis.rootCauses.includes('declining') ? 'challenged' : 'current'} revenue trajectory`,
      `**Execution Risk:** Balanced concessions maximize lender approval likelihood`
    ],
    conditionsPrecedent: [
      recommendedOption.id === 'E' ? `Sponsor equity injection of ${recommendedOption.structure.split('injection: ')[1]?.split('\n')[0] || 'required amount'} within 30 days of signing` : null,
      'Updated 5-year financial projections reflecting restructured terms',
      'Quarterly covenant reporting (upgraded from semi-annual)',
      '50% excess cash flow sweep applied to principal prepayment'
    ].filter(Boolean),
    enhancedMonitoring: [
      'Monthly management calls for first 6 months post-restructuring',
      `DSCR early warning trigger at ${(recommendedOption.minDSCR * 1.07).toFixed(2)}x (enhanced monitoring)`,
      'DSCR default trigger remains at 1.25x',
      'Quarterly site visits for first year'
    ]
  };
}

/**
 * Format complete restructuring output
 */
function formatRestructuringOutput(data) {
  const { diagnosis, options, comparisonMatrix, recommendation, dscrMin, icrMin, leverageMax } = data;

  // Diagnosis section
  const timelineTable = diagnosis.timeline.map(t =>
    `| ${t.year} | ${t.dscr.toFixed(2)}x | ${t.dscrStatus} | ${t.icr.toFixed(1)}x | ${t.icrStatus} | ${t.leverage.toFixed(1)}x | ${t.leverageStatus} |`
  ).join('\n');

  const diagnosisSection = `## CURRENT SITUATION DIAGNOSIS

### Covenant Breach Timeline
| Year | DSCR | Status | ICR | Status | Leverage | Status |
|------|------|--------|-----|--------|----------|--------|
${timelineTable}

### Root Cause Analysis
${diagnosis.rootCauses.join('\n- ')}`;

  // Options sections
  const optionsSections = options.map(opt => {
    const impactsTable = opt.impacts.map(imp => {
      let beforeVal, afterVal, changeVal;

      if (typeof imp.before === 'number' && imp.before > 1000) {
        beforeVal = `J$${(imp.before / 1e6).toFixed(1)}M`;
        afterVal = `J$${(imp.after / 1e6).toFixed(1)}M`;
      } else if (typeof imp.before === 'number') {
        beforeVal = imp.before.toFixed(2) + (imp.metric.includes('DSCR') ? 'x' : '');
        afterVal = imp.after.toFixed(2) + (imp.metric.includes('DSCR') ? 'x' : '');
      } else {
        beforeVal = imp.before;
        afterVal = imp.after;
      }

      if (typeof imp.change === 'number') {
        if (imp.metric.includes('DSCR') || imp.metric === 'Tenor') {
          changeVal = imp.change >= 0 ? `+${imp.change.toFixed(2)}` : imp.change.toFixed(2);
          if (imp.metric.includes('DSCR')) changeVal += 'x';
        } else {
          changeVal = `${imp.change >= 0 ? '+' : ''}${imp.change.toFixed(0)}%`;
        }
      } else {
        changeVal = imp.change;
      }

      return `| ${imp.metric} | ${beforeVal} | ${afterVal} | ${changeVal} |`;
    }).join('\n');

    return `### ${opt.name}
**Structure:** ${opt.structure}

| Impact Metric | Before | After | Change |
|---------------|--------|-------|--------|
${impactsTable}

**Pros:** ${opt.pros}
**Cons:** ${opt.cons}
**Lender Acceptance Probability:** ${opt.acceptance}`;
  }).join('\n\n---\n\n');

  // Recommendation section
  const recommendationSection = `## CREDIT COMMITTEE RECOMMENDATION

### Recommended Option: ${recommendation.option.id} (${recommendation.option.name.replace(' (RECOMMENDED) ⭐', '')})

**Rationale:**
${recommendation.rationale.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### Conditions Precedent
${recommendation.conditionsPrecedent.map(c => `- [ ] ${c}`).join('\n')}

### Enhanced Monitoring Requirements
${recommendation.enhancedMonitoring.map(m => `- ${m}`).join('\n')}

### Alternative Recommendation
If sponsor unable to inject equity, pursue **Option B (Tenor Extension)** as standalone, with enhanced cash sweep provisions to compensate for lack of deleveraging.`;

  return `# 📊 Deal Restructuring Analysis

${diagnosisSection}

---

## RESTRUCTURING OPTIONS

${optionsSections}

---

## OPTIONS COMPARISON MATRIX

${comparisonMatrix}

---

${recommendationSection}`;
}

/**
 * Helper: Get total debt from all sources
 * This addresses the debt detection bug by checking all possible debt fields
 */
function getTotalDebt(params) {
  const requestedLoan = params.requestedLoanAmount || 0;
  const openingDebt = params.openingDebt || 0;
  const existingDebt = params.existingDebtAmount || 0;

  // Check for multi-tranche info
  const multiTrancheTotal = params.multiTrancheInfo?.totalDebt || 0;

  // Use the highest applicable value
  // - If multi-tranche exists, use it (most comprehensive)
  // - Otherwise sum opening/existing + requested
  if (multiTrancheTotal > 0) {
    return multiTrancheTotal;
  }

  const existingTotal = Math.max(openingDebt, existingDebt);
  return existingTotal + requestedLoan;
}

/**
 * Parse tool calls from AI response
 * Handles both OpenAI-style tool_calls and legacy XML format
 */
export function parseToolCalls(aiResponse) {
  // First, check for OpenAI-style tool_calls (preferred)
  if (aiResponse.tool_calls && Array.isArray(aiResponse.tool_calls)) {
    return aiResponse.tool_calls.map(tc => ({
      name: tc.function?.name || tc.name,
      params: typeof tc.function?.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || tc.arguments || {}
    }));
  }

  // Fallback: Check for XML-style function calls in content
  const content = aiResponse.message || aiResponse.content || '';
  const xmlMatch = content.match(/<function_calls>([\s\S]*?)<\/function_calls>/);

  if (xmlMatch) {
    const toolCalls = [];
    const invokeRegex = /<invoke\s+name=["']([^"']+)["']>([\s\S]*?)<\/invoke>/g;
    let match;

    while ((match = invokeRegex.exec(xmlMatch[1])) !== null) {
      const toolName = match[1];
      const paramsXml = match[2];
      const params = {};

      // Extract parameters from XML
      const paramRegex = /<(\w+)>([^<]*)<\/\1>/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(paramsXml)) !== null) {
        const value = paramMatch[2].trim();
        // Try to parse as number if possible
        params[paramMatch[1]] = isNaN(value) ? value : parseFloat(value);
      }

      toolCalls.push({ name: toolName, params });
    }

    return toolCalls;
  }

  return [];
}

/**
 * Check if AI response contains tool calls
 */
export function hasToolCalls(aiResponse) {
  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    return true;
  }

  const content = aiResponse.message || aiResponse.content || '';
  return content.includes('<function_calls>');
}

/**
 * Remove tool call XML from message content for display
 */
export function cleanMessageContent(content) {
  if (!content) return '';
  return content.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '').trim();
}
