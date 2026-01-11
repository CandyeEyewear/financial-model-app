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
