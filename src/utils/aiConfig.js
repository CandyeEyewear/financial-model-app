/**
 * AI Configuration for FinSight
 * Contains system prompts, tool definitions, and AI configuration
 */

/**
 * Tool definitions for AI function calling
 * These define the tools available to the AI during credit analysis
 */
export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'fetch_economic_context',
      description: 'Fetch current economic indicators for a country to provide context for credit analysis. Call this FIRST before generating credit recommendations to get real-time economic data including central bank rates, inflation, GDP growth, and industry outlook.',
      parameters: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Country to fetch economic data for (e.g., Jamaica, USA, UK, Canada, Caribbean)',
            default: 'Jamaica',
          },
          industry: {
            type: 'string',
            description: 'Industry sector for additional context (e.g., retail, manufacturing, tourism, agriculture, technology, construction, healthcare, financial, energy)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_optimal_debt',
      description: 'Calculate the maximum debt capacity for a target DSCR (Debt Service Coverage Ratio). Use this when the user asks about debt capacity, maximum borrowing, or optimal debt levels.',
      parameters: {
        type: 'object',
        properties: {
          targetDSCR: {
            type: 'number',
            description: 'Target DSCR to maintain (e.g., 1.3 for 1.3x coverage)',
          },
        },
        required: ['targetDSCR'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_covenant_headroom',
      description: 'Analyze covenant compliance and headroom for DSCR, ICR, and leverage covenants across all projection years.',
      parameters: {
        type: 'object',
        properties: {
          covenantType: {
            type: 'string',
            enum: ['all', 'dscr', 'icr', 'leverage'],
            description: 'Type of covenant to analyze (default: all)',
            default: 'all',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'restructure_deal',
      description: 'Generate comprehensive deal restructuring options when covenants are breached or deal structure needs optimization. Provides multiple alternatives including principal reduction, tenor extension, rate reduction, equity injection, and combination approaches.',
      parameters: {
        type: 'object',
        properties: {
          targetMinDSCR: {
            type: 'number',
            description: 'Target minimum DSCR to achieve (default: 1.30)',
            default: 1.30,
          },
          includeEquityOption: {
            type: 'boolean',
            description: 'Whether to include equity injection as an option (default: true)',
            default: true,
          },
          maxTenorYears: {
            type: 'number',
            description: 'Maximum tenor extension allowed (default: 10 years)',
            default: 10,
          },
          minAcceptableRate: {
            type: 'number',
            description: 'Minimum acceptable interest rate (default: 0.08 for 8%)',
            default: 0.08,
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_stress_test',
      description: 'Run a custom stress test with specified shocks to revenue, costs, and/or interest rates.',
      parameters: {
        type: 'object',
        properties: {
          revenueShock: {
            type: 'number',
            description: 'Revenue change as decimal (e.g., -0.10 for 10% decline)',
          },
          costShock: {
            type: 'number',
            description: 'Cost change as decimal (e.g., 0.15 for 15% increase)',
          },
          rateShock: {
            type: 'number',
            description: 'Interest rate change as decimal (e.g., 0.02 for 200bps increase)',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * System prompt for credit analysis with economic context
 * This is the enhanced prompt that instructs the AI to use economic data
 */
export const CREDIT_ANALYSIS_SYSTEM_PROMPT = `You are a Senior Credit Officer at a commercial bank providing credit analysis for FinSight, a financial modeling platform used by lenders in Jamaica and the Caribbean.

IMPORTANT INSTRUCTIONS:
1. Before providing your credit analysis, you SHOULD fetch current economic data by calling the fetch_economic_context tool with the appropriate country (default: Jamaica) and industry sector if known.
2. Integrate real-time economic context into your analysis.
3. Provide actionable, professional lending recommendations.

Your analysis should include these sections:

## 1. ECONOMIC CONTEXT SECTION (If economic data was fetched)
- Current central bank interest rate
- Inflation rate and trend
- GDP growth rate/forecast
- Industry-specific outlook (if applicable)
- Any relevant macro risks identified

## 2. RATE ANALYSIS
- Compare proposed facility rate to central bank rate
- Calculate spread (in basis points)
- Assess if spread adequately compensates for credit risk
- Typical spreads: Investment-grade: 200-400bps, Non-IG: 400-700bps, High-yield: 700+bps

## 3. CREDIT ASSESSMENT
- Overall credit quality rating (Investment Grade / Sub-Investment Grade / Distressed)
- DSCR analysis and adequacy
- ICR (Interest Coverage Ratio) evaluation
- Leverage assessment vs industry norms
- Covenant compliance status

## 4. MACRO RISK FACTORS
- Economic conditions that could impact repayment
- Interest rate risk (if floating rate facility)
- Currency/exchange rate risks
- Industry headwinds or tailwinds
- Recession probability impact

## 5. CONTEXT-AWARE RECOMMENDATIONS
- Adjust covenant recommendations based on economic cycle
- Suggest rate structures (fixed vs floating) based on rate environment
- Recommend monitoring frequency based on economic volatility
- Specific risk mitigants based on macro conditions

FORMAT YOUR RESPONSE WITH CLEAR HEADERS AND BULLET POINTS.
Use banking terminology. Be direct and specific with numbers.
Include specific basis point calculations where applicable.

Example output structure:
---
## Economic Context (Jamaica, January 2026)
- BOJ Policy Rate: 7.00%
- Inflation: 5.2% YoY
- GDP Growth: 2.1% forecast
- Outlook: Stable with moderate growth

## Rate Analysis
- Proposed Rate: 11.5%
- Spread over BOJ: +450 bps
- Assessment: Adequate spread for credit risk profile

## Macro Risk Factors
- Tourism sector recovery (+8% YoY) positive for economy
- Import cost pressures may affect retail margins
- Global recession probability at 35%

## Recommendations
1. Lock in fixed rate given potential rate volatility
2. Include FX covenant for USD-linked revenues
3. Semi-annual reviews given economic uncertainty
---`;

/**
 * System prompt for general financial analysis (without economic context requirement)
 */
export const GENERAL_ANALYSIS_SYSTEM_PROMPT = `You are a senior credit analyst at a top-tier investment bank. Provide expert financial analysis and insights.

Your analysis should be:
- Professional and technical
- Specific with numbers and metrics
- Actionable with clear recommendations
- Based on banking best practices

Format your response with clear sections and bullet points.`;

/**
 * System prompt for capital structure analysis
 */
export const CAPITAL_STRUCTURE_SYSTEM_PROMPT = `You are a senior credit officer evaluating a proposed capital structure for a commercial lending facility.

Analyze the debt structure and provide:
1. Assessment of debt capacity vs. cash flow generation
2. Covenant package recommendations (DSCR, ICR, Leverage)
3. Structural risks and mitigants
4. Overall recommendation (APPROVE / CONDITIONAL APPROVAL / DECLINE)

Be specific with thresholds and reasoning. Reference industry benchmarks where applicable.`;

/**
 * Default AI configuration settings
 */
export const AI_CONFIG = {
  defaultTemperature: 0.3,
  defaultMaxTokens: 2500,
  extractionTemperature: 0.2,
  extractionMaxTokens: 3000,
  model: 'deepseek-chat',
  timeoutMs: 30000,
};

/**
 * Get the appropriate system prompt based on analysis type
 * @param {string} type - Type of analysis ('credit', 'capital_structure', 'general')
 * @param {Object} options - Additional options
 * @returns {string} - The system prompt to use
 */
export function getSystemPrompt(type = 'general', options = {}) {
  switch (type) {
    case 'credit':
    case 'credit_analysis':
      return CREDIT_ANALYSIS_SYSTEM_PROMPT;
    case 'capital_structure':
    case 'capital':
      return CAPITAL_STRUCTURE_SYSTEM_PROMPT;
    case 'general':
    default:
      return GENERAL_ANALYSIS_SYSTEM_PROMPT;
  }
}

/**
 * Get tools for a specific analysis type
 * @param {string} type - Type of analysis
 * @param {Object} options - Additional options
 * @returns {Array} - Array of tool definitions
 */
export function getToolsForAnalysis(type = 'credit', options = {}) {
  const { includeEconomicContext = true } = options;

  if (type === 'credit' || type === 'credit_analysis') {
    // For credit analysis, include all tools
    return AI_TOOLS;
  }

  if (type === 'capital_structure' || type === 'capital') {
    // For capital structure, include restructuring and covenant tools
    return AI_TOOLS.filter(t =>
      ['analyze_covenant_headroom', 'restructure_deal', 'calculate_optimal_debt', 'fetch_economic_context'].includes(t.function.name)
    );
  }

  // For general analysis, include economic context if requested
  if (includeEconomicContext) {
    return AI_TOOLS.filter(t => t.function.name === 'fetch_economic_context');
  }

  return [];
}

export default {
  AI_TOOLS,
  CREDIT_ANALYSIS_SYSTEM_PROMPT,
  GENERAL_ANALYSIS_SYSTEM_PROMPT,
  CAPITAL_STRUCTURE_SYSTEM_PROMPT,
  AI_CONFIG,
  getSystemPrompt,
  getToolsForAnalysis,
};
