/**
 * Economic Data Fetcher
 * Fetches real-time economic indicators via web search
 * to provide context for AI credit analysis
 */

// Default search queries by country
const ECONOMIC_QUERIES = {
  jamaica: {
    interestRate: 'Bank of Jamaica BOJ policy interest rate current 2026',
    inflation: 'Jamaica inflation rate CPI latest STATIN',
    gdpGrowth: 'Jamaica GDP growth rate forecast 2026',
    exchangeRate: 'Jamaica JMD USD exchange rate today',
    economicOutlook: 'Jamaica economic outlook forecast 2026',
    recession: 'Caribbean recession risk economic conditions 2026',
  },
  usa: {
    interestRate: 'Federal Reserve fed funds rate current 2026',
    inflation: 'US inflation rate CPI latest',
    gdpGrowth: 'US GDP growth forecast 2026',
    exchangeRate: 'USD index DXY today',
    economicOutlook: 'US economic outlook forecast 2026',
    recession: 'US recession probability forecast 2026',
  },
  uk: {
    interestRate: 'Bank of England base rate current 2026',
    inflation: 'UK inflation rate CPI latest',
    gdpGrowth: 'UK GDP growth forecast 2026',
    exchangeRate: 'GBP USD exchange rate today',
    economicOutlook: 'UK economic outlook forecast 2026',
    recession: 'UK recession probability forecast 2026',
  },
  canada: {
    interestRate: 'Bank of Canada overnight rate current 2026',
    inflation: 'Canada inflation rate CPI latest',
    gdpGrowth: 'Canada GDP growth forecast 2026',
    exchangeRate: 'CAD USD exchange rate today',
    economicOutlook: 'Canada economic outlook forecast 2026',
    recession: 'Canada recession probability forecast 2026',
  },
  caribbean: {
    interestRate: 'Caribbean central bank interest rates 2026',
    inflation: 'Caribbean region inflation rate latest',
    gdpGrowth: 'Caribbean GDP growth forecast 2026',
    exchangeRate: 'Caribbean currencies USD exchange rates',
    economicOutlook: 'Caribbean economic outlook IMF forecast 2026',
    recession: 'Caribbean recession risk economic conditions 2026',
  },
};

// Industry-specific queries
const INDUSTRY_QUERIES = {
  retail: '{country} retail sector outlook consumer spending 2026',
  manufacturing: '{country} manufacturing sector PMI industrial production 2026',
  tourism: '{country} tourism sector arrivals hospitality outlook 2026',
  agriculture: '{country} agriculture sector commodity prices outlook 2026',
  technology: '{country} technology sector growth digital economy 2026',
  construction: '{country} construction sector real estate development 2026',
  healthcare: '{country} healthcare sector spending outlook 2026',
  financial: '{country} financial services banking sector outlook 2026',
  energy: '{country} energy sector oil gas prices outlook 2026',
  transportation: '{country} transportation logistics sector outlook 2026',
  telecommunications: '{country} telecommunications sector 5G digital infrastructure 2026',
  mining: '{country} mining sector commodity extraction outlook 2026',
  hospitality: '{country} hospitality hotel restaurant sector outlook 2026',
  education: '{country} education sector spending trends 2026',
  entertainment: '{country} entertainment media sector outlook 2026',
};

// Central bank names by country for display
const CENTRAL_BANKS = {
  jamaica: 'Bank of Jamaica (BOJ)',
  usa: 'Federal Reserve (Fed)',
  uk: 'Bank of England (BoE)',
  canada: 'Bank of Canada (BoC)',
  caribbean: 'Regional Central Banks',
};

/**
 * Build search queries for a given country and industry
 * @param {string} country - Country to fetch data for
 * @param {string|null} industry - Industry sector for additional context
 * @returns {Array<{type: string, query: string}>} - Array of search queries
 */
export function buildEconomicQueries(country = 'jamaica', industry = null) {
  const countryLower = country.toLowerCase();
  const queries = ECONOMIC_QUERIES[countryLower] || ECONOMIC_QUERIES.jamaica;

  const searchQueries = [
    { type: 'interestRate', query: queries.interestRate },
    { type: 'inflation', query: queries.inflation },
    { type: 'gdpGrowth', query: queries.gdpGrowth },
    { type: 'economicOutlook', query: queries.economicOutlook },
  ];

  // Add industry-specific query if provided
  if (industry) {
    const industryLower = industry.toLowerCase();
    if (INDUSTRY_QUERIES[industryLower]) {
      const industryQuery = INDUSTRY_QUERIES[industryLower]
        .replace('{country}', country);
      searchQueries.push({ type: 'industryOutlook', query: industryQuery });
    }
  }

  return searchQueries;
}

/**
 * Parse economic data from search results
 * Extracts key numbers and trends from search result text
 * @param {Object} searchResults - Raw search results by type
 * @returns {Object} - Parsed economic data
 */
export function parseEconomicData(searchResults) {
  const parsed = {
    interestRate: null,
    inflation: null,
    gdpGrowth: null,
    exchangeRate: null,
    outlook: null,
    recessionRisk: null,
    industryOutlook: null,
    rawData: searchResults,
    fetchedAt: new Date().toISOString(),
  };

  // Extract interest rate (look for patterns like "7.0%" or "7 percent")
  if (searchResults.interestRate) {
    const rateMatch = searchResults.interestRate.match(/(\d+\.?\d*)\s*(%|percent)/i);
    if (rateMatch) {
      parsed.interestRate = {
        value: parseFloat(rateMatch[1]),
        unit: '%',
        source: 'web search',
      };
    }
  }

  // Extract inflation rate
  if (searchResults.inflation) {
    const inflationMatch = searchResults.inflation.match(/(\d+\.?\d*)\s*(%|percent)/i);
    if (inflationMatch) {
      parsed.inflation = {
        value: parseFloat(inflationMatch[1]),
        unit: '%',
        source: 'web search',
      };
    }
  }

  // Extract GDP growth (can be negative)
  if (searchResults.gdpGrowth) {
    const gdpMatch = searchResults.gdpGrowth.match(/(-?\d+\.?\d*)\s*(%|percent)/i);
    if (gdpMatch) {
      parsed.gdpGrowth = {
        value: parseFloat(gdpMatch[1]),
        unit: '%',
        source: 'web search',
      };
    }
  }

  // Extract exchange rate (for JMD/USD)
  if (searchResults.exchangeRate) {
    const fxMatch = searchResults.exchangeRate.match(/(\d+\.?\d*)/);
    if (fxMatch) {
      parsed.exchangeRate = {
        value: parseFloat(fxMatch[1]),
        source: 'web search',
      };
    }
  }

  // Store outlook text
  if (searchResults.economicOutlook) {
    parsed.outlook = searchResults.economicOutlook.substring(0, 500);
  }

  // Store industry outlook
  if (searchResults.industryOutlook) {
    parsed.industryOutlook = searchResults.industryOutlook.substring(0, 500);
  }

  return parsed;
}

/**
 * Format economic context for display in UI
 * @param {Object} economicData - Parsed economic data
 * @param {string} country - Country name
 * @returns {string} - Formatted context string in markdown
 */
export function formatEconomicContext(economicData, country = 'Jamaica') {
  const { interestRate, inflation, gdpGrowth, exchangeRate, industryOutlook, fetchedAt } = economicData;
  const countryLower = country.toLowerCase();
  const centralBank = CENTRAL_BANKS[countryLower] || 'Central Bank';

  let context = `**Economic Context (${country}, ${new Date(fetchedAt).toLocaleDateString()})**\n\n`;

  if (interestRate) {
    context += `- **${centralBank} Rate:** ${interestRate.value}%\n`;
  }
  if (inflation) {
    context += `- **Inflation:** ${inflation.value}% YoY\n`;
  }
  if (gdpGrowth) {
    const gdpTrend = gdpGrowth.value > 0 ? 'growth' : 'contraction';
    context += `- **GDP ${gdpTrend.charAt(0).toUpperCase() + gdpTrend.slice(1)}:** ${gdpGrowth.value > 0 ? '+' : ''}${gdpGrowth.value}%\n`;
  }
  if (exchangeRate && countryLower === 'jamaica') {
    context += `- **JMD/USD Rate:** ${exchangeRate.value}\n`;
  }
  if (industryOutlook) {
    context += `- **Industry Outlook:** ${industryOutlook.substring(0, 150)}...\n`;
  }

  return context;
}

/**
 * Compare proposed rate to central bank rate
 * @param {number} proposedRate - Proposed interest rate (decimal, e.g., 0.115 for 11.5%)
 * @param {number} centralBankRate - Central bank rate (percentage, e.g., 7.0)
 * @returns {Object|null} - Spread analysis or null if no central bank rate
 */
export function analyzeRateSpread(proposedRate, centralBankRate) {
  if (!centralBankRate || centralBankRate <= 0) return null;

  // Convert proposed rate to percentage if it's in decimal form
  const proposedPct = proposedRate < 1 ? proposedRate * 100 : proposedRate;
  const spread = proposedPct - centralBankRate;
  const spreadBps = Math.round(spread * 100);

  let assessment = '';
  let riskLevel = '';

  if (spreadBps < 200) {
    assessment = 'Tight spread - may not adequately compensate for credit risk';
    riskLevel = 'warning';
  } else if (spreadBps < 400) {
    assessment = 'Reasonable spread for investment-grade credit';
    riskLevel = 'good';
  } else if (spreadBps < 600) {
    assessment = 'Adequate spread for moderate credit risk';
    riskLevel = 'good';
  } else if (spreadBps < 800) {
    assessment = 'Wide spread - appropriate for higher-risk credit';
    riskLevel = 'good';
  } else {
    assessment = 'Very wide spread - reflects elevated credit risk premium';
    riskLevel = 'caution';
  }

  return {
    proposedRate: proposedPct,
    centralBankRate,
    spreadBps,
    spreadPercent: spread,
    assessment,
    riskLevel,
  };
}

/**
 * Generate macro risk factors based on economic data
 * @param {Object} economicData - Parsed economic data
 * @param {Object} params - Loan parameters (optional)
 * @returns {Array<Object>} - Array of identified macro risks
 */
export function identifyMacroRisks(economicData, params = {}) {
  const risks = [];

  // High inflation risk
  if (economicData.inflation?.value > 6) {
    risks.push({
      type: 'inflation',
      severity: economicData.inflation.value > 10 ? 'critical' : 'elevated',
      description: `Inflation at ${economicData.inflation.value}% may pressure borrower margins and input costs`,
      recommendation: 'Consider inflation-adjustment clauses in covenants; monitor gross margin trends',
      icon: 'TrendingUp',
    });
  }

  // Interest rate environment risk
  if (economicData.interestRate?.value > 8) {
    risks.push({
      type: 'rates',
      severity: economicData.interestRate.value > 12 ? 'critical' : 'elevated',
      description: `High interest rate environment (${economicData.interestRate.value}%) increases refinancing risk`,
      recommendation: 'Lock in fixed rate; avoid floating rate exposure; ensure debt service cushion',
      icon: 'Percent',
    });
  }

  // Low growth / recession risk
  if (economicData.gdpGrowth?.value < 1) {
    risks.push({
      type: 'recession',
      severity: economicData.gdpGrowth.value < 0 ? 'critical' : 'high',
      description: economicData.gdpGrowth.value < 0
        ? `Economy in contraction (${economicData.gdpGrowth.value}%) - elevated default risk`
        : `Low GDP growth (${economicData.gdpGrowth.value}%) signals economic weakness`,
      recommendation: economicData.gdpGrowth.value < 0
        ? 'Require personal guarantees; tighten monitoring; consider covenant relief provisions'
        : 'Increase covenant cushions; require additional collateral coverage',
      icon: 'TrendingDown',
    });
  }

  // High exchange rate volatility (for Jamaica specifically)
  if (economicData.exchangeRate?.value > 160) {
    risks.push({
      type: 'currency',
      severity: 'moderate',
      description: `JMD depreciation (rate at ${economicData.exchangeRate.value}) may impact USD-linked costs`,
      recommendation: 'Include FX covenant for USD-denominated expenses; monitor currency exposure',
      icon: 'DollarSign',
    });
  }

  // Rate mismatch risk (if we have both central bank rate and proposed rate)
  if (params.interestRate && economicData.interestRate?.value) {
    const spread = analyzeRateSpread(params.interestRate, economicData.interestRate.value);
    if (spread && spread.spreadBps < 200) {
      risks.push({
        type: 'spread',
        severity: 'elevated',
        description: `Proposed spread (${spread.spreadBps}bps) may be insufficient for credit risk`,
        recommendation: 'Consider increasing rate or requiring additional credit enhancement',
        icon: 'AlertTriangle',
      });
    }
  }

  return risks;
}

/**
 * Generate economic context summary for AI prompt
 * @param {Object} economicData - Parsed economic data
 * @param {string} country - Country name
 * @param {string|null} industry - Industry sector
 * @returns {string} - Formatted summary for AI consumption
 */
export function generateEconomicSummaryForAI(economicData, country = 'Jamaica', industry = null) {
  const { interestRate, inflation, gdpGrowth, outlook, industryOutlook, fetchedAt } = economicData;

  let summary = `
CURRENT ECONOMIC CONDITIONS (${country}, as of ${new Date(fetchedAt).toLocaleDateString()}):

`;

  if (interestRate) {
    summary += `- Central Bank Policy Rate: ${interestRate.value}%\n`;
  }
  if (inflation) {
    summary += `- Current Inflation Rate: ${inflation.value}% YoY\n`;
  }
  if (gdpGrowth) {
    summary += `- GDP Growth Rate: ${gdpGrowth.value > 0 ? '+' : ''}${gdpGrowth.value}%\n`;
  }
  if (outlook) {
    summary += `- Economic Outlook: ${outlook.substring(0, 200)}\n`;
  }
  if (industry && industryOutlook) {
    summary += `- ${industry} Sector Outlook: ${industryOutlook.substring(0, 200)}\n`;
  }

  // Add interpretation guidance
  summary += `
RATE ANALYSIS GUIDANCE:
- Typical investment-grade spread: 200-400 bps over central bank rate
- Non-investment grade spread: 400-700 bps over central bank rate
- High-yield/distressed: 700+ bps over central bank rate

MACRO RISK ASSESSMENT:
`;

  const macroRisks = identifyMacroRisks(economicData, {});
  if (macroRisks.length === 0) {
    summary += '- No significant macro risks identified\n';
  } else {
    macroRisks.forEach(risk => {
      summary += `- [${risk.severity.toUpperCase()}] ${risk.description}\n`;
    });
  }

  return summary;
}

/**
 * Create economic context object for AI tool response
 * @param {Object} economicData - Parsed economic data
 * @param {string} country - Country name
 * @param {string|null} industry - Industry sector
 * @returns {Object} - Structured response object
 */
export function createEconomicContextResponse(economicData, country = 'Jamaica', industry = null) {
  return {
    success: true,
    data: economicData,
    summary: formatEconomicContext(economicData, country),
    aiContext: generateEconomicSummaryForAI(economicData, country, industry),
    macroRisks: identifyMacroRisks(economicData),
    fetchedAt: economicData.fetchedAt,
    country,
    industry,
  };
}

export default {
  buildEconomicQueries,
  parseEconomicData,
  formatEconomicContext,
  analyzeRateSpread,
  identifyMacroRisks,
  generateEconomicSummaryForAI,
  createEconomicContextResponse,
  ECONOMIC_QUERIES,
  INDUSTRY_QUERIES,
  CENTRAL_BANKS,
};
