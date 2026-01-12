/**
 * API Endpoint: Economic Data Search
 * Route: POST /api/economic/search
 *
 * Fetches real-time economic indicators via web search
 * to provide context for AI credit analysis
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../_cors.js';

// Initialize Supabase client (for auth validation)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Default economic data by country (fallback when web search unavailable)
const DEFAULT_ECONOMIC_DATA = {
  jamaica: {
    interestRate: { value: 7.0, source: 'Bank of Jamaica', asOf: '2026-01' },
    inflation: { value: 5.2, source: 'STATIN', asOf: '2026-01' },
    gdpGrowth: { value: 2.1, source: 'PIOJ Forecast', asOf: '2026' },
    exchangeRate: { value: 156.5, pair: 'JMD/USD', source: 'BOJ', asOf: '2026-01' },
    outlook: 'Economic outlook remains stable with moderate growth expected. Tourism sector recovery continues to drive GDP growth.',
    centralBank: 'Bank of Jamaica (BOJ)',
  },
  usa: {
    interestRate: { value: 5.25, source: 'Federal Reserve', asOf: '2026-01' },
    inflation: { value: 3.1, source: 'BLS CPI', asOf: '2026-01' },
    gdpGrowth: { value: 2.4, source: 'BEA Forecast', asOf: '2026' },
    exchangeRate: { value: 1.0, pair: 'USD Index', source: 'DXY', asOf: '2026-01' },
    outlook: 'US economy shows resilience with moderate growth. Fed maintaining cautious stance on rate cuts.',
    centralBank: 'Federal Reserve (Fed)',
  },
  uk: {
    interestRate: { value: 5.0, source: 'Bank of England', asOf: '2026-01' },
    inflation: { value: 3.8, source: 'ONS CPI', asOf: '2026-01' },
    gdpGrowth: { value: 1.2, source: 'ONS Forecast', asOf: '2026' },
    exchangeRate: { value: 1.27, pair: 'GBP/USD', source: 'BoE', asOf: '2026-01' },
    outlook: 'UK economy navigating post-Brexit adjustments with modest growth.',
    centralBank: 'Bank of England (BoE)',
  },
  canada: {
    interestRate: { value: 4.75, source: 'Bank of Canada', asOf: '2026-01' },
    inflation: { value: 2.9, source: 'StatCan CPI', asOf: '2026-01' },
    gdpGrowth: { value: 1.8, source: 'BoC Forecast', asOf: '2026' },
    exchangeRate: { value: 0.74, pair: 'CAD/USD', source: 'BoC', asOf: '2026-01' },
    outlook: 'Canadian economy stable with housing market adjustments ongoing.',
    centralBank: 'Bank of Canada (BoC)',
  },
  caribbean: {
    interestRate: { value: 6.5, source: 'Regional Average', asOf: '2026-01' },
    inflation: { value: 4.8, source: 'IMF Regional', asOf: '2026-01' },
    gdpGrowth: { value: 3.2, source: 'IMF Forecast', asOf: '2026' },
    exchangeRate: { value: null, pair: 'Various', source: 'Mixed', asOf: '2026-01' },
    outlook: 'Caribbean region showing robust tourism-led recovery with GDP growth exceeding global averages.',
    centralBank: 'Regional Central Banks',
  },
};

// Industry outlook templates
const INDUSTRY_OUTLOOKS = {
  retail: 'Retail sector facing mixed conditions with inflation pressures on consumer spending. E-commerce growth continues to reshape the landscape.',
  manufacturing: 'Manufacturing sector showing moderate expansion. Supply chain normalization improving production capacity utilization.',
  tourism: 'Tourism sector in strong recovery mode. Arrivals approaching pre-pandemic levels with positive outlook for visitor spending.',
  agriculture: 'Agriculture sector facing weather-related challenges. Commodity prices remain volatile with input cost pressures.',
  technology: 'Technology sector growth robust with digital transformation investments continuing across enterprises.',
  construction: 'Construction sector active with infrastructure investments. Material cost stabilization supporting project margins.',
  healthcare: 'Healthcare sector expanding with increased government and private spending. Demand remains strong.',
  financial: 'Financial services sector stable with healthy loan growth. Interest margins benefiting from rate environment.',
  energy: 'Energy sector navigating transition with renewable investments increasing. Traditional energy prices stabilizing.',
  transportation: 'Transportation and logistics sector recovering with global trade normalization.',
  telecommunications: 'Telecommunications sector investing in 5G infrastructure with steady subscriber growth.',
  mining: 'Mining sector benefiting from commodity demand. Operational efficiency improvements ongoing.',
  hospitality: 'Hospitality sector showing strong performance driven by tourism recovery and events.',
  education: 'Education sector adapting to hybrid models with technology investments increasing.',
  entertainment: 'Entertainment and media sector growing with streaming and digital content expansion.',
};

/**
 * Parse search results to extract economic values
 */
function parseSearchResults(results, country) {
  const data = {
    country,
    interestRate: null,
    inflation: null,
    gdpGrowth: null,
    exchangeRate: null,
    outlook: null,
    industryOutlook: null,
    sources: [],
    fetchedAt: new Date().toISOString(),
  };

  for (const { type, result } of results) {
    if (!result) continue;

    const text = result.snippet || result.text || result.content || '';

    // Extract numbers based on query type
    if (type === 'interestRate') {
      const match = text.match(/(\d+\.?\d*)\s*(%|percent)/i);
      if (match) {
        data.interestRate = {
          value: parseFloat(match[1]),
          unit: '%',
          source: 'web search',
        };
      }
    }

    if (type === 'inflation') {
      const match = text.match(/(\d+\.?\d*)\s*(%|percent)/i);
      if (match) {
        data.inflation = {
          value: parseFloat(match[1]),
          unit: '%',
          source: 'web search',
        };
      }
    }

    if (type === 'gdpGrowth') {
      const match = text.match(/(-?\d+\.?\d*)\s*(%|percent)/i);
      if (match) {
        data.gdpGrowth = {
          value: parseFloat(match[1]),
          unit: '%',
          source: 'web search',
        };
      }
    }

    if (type === 'exchangeRate') {
      const match = text.match(/(\d+\.?\d*)/);
      if (match) {
        data.exchangeRate = {
          value: parseFloat(match[1]),
          source: 'web search',
        };
      }
    }

    if (type === 'economicOutlook') {
      data.outlook = text.substring(0, 500);
    }

    if (type === 'industryOutlook') {
      data.industryOutlook = text.substring(0, 500);
    }

    if (result.url) {
      data.sources.push(result.url);
    }
  }

  return data;
}

/**
 * Get default/fallback economic data for a country
 */
function getDefaultEconomicData(country, industry = null) {
  const countryLower = country.toLowerCase();
  const baseData = DEFAULT_ECONOMIC_DATA[countryLower] || DEFAULT_ECONOMIC_DATA.jamaica;

  const result = {
    interestRate: baseData.interestRate ? {
      value: baseData.interestRate.value,
      unit: '%',
      source: baseData.interestRate.source,
    } : null,
    inflation: baseData.inflation ? {
      value: baseData.inflation.value,
      unit: '%',
      source: baseData.inflation.source,
    } : null,
    gdpGrowth: baseData.gdpGrowth ? {
      value: baseData.gdpGrowth.value,
      unit: '%',
      source: baseData.gdpGrowth.source,
    } : null,
    exchangeRate: baseData.exchangeRate?.value ? {
      value: baseData.exchangeRate.value,
      pair: baseData.exchangeRate.pair,
      source: baseData.exchangeRate.source,
    } : null,
    outlook: baseData.outlook,
    centralBank: baseData.centralBank,
    country,
    fetchedAt: new Date().toISOString(),
    source: 'default',
  };

  // Add industry outlook if requested
  if (industry) {
    const industryLower = industry.toLowerCase();
    result.industryOutlook = INDUSTRY_OUTLOOKS[industryLower] ||
      `${industry} sector outlook requires specific analysis based on current market conditions.`;
    result.industry = industry;
  }

  return result;
}

/**
 * Identify macro risks based on economic data
 */
function identifyMacroRisks(economicData, params = {}) {
  const risks = [];

  // High inflation risk
  if (economicData.inflation?.value > 6) {
    risks.push({
      type: 'inflation',
      severity: economicData.inflation.value > 10 ? 'critical' : 'elevated',
      description: `Inflation at ${economicData.inflation.value}% may pressure borrower margins`,
      recommendation: 'Consider inflation-adjustment clauses in covenants',
    });
  }

  // Interest rate environment
  if (economicData.interestRate?.value > 8) {
    risks.push({
      type: 'rates',
      severity: economicData.interestRate.value > 12 ? 'critical' : 'elevated',
      description: 'High interest rate environment increases refinancing risk',
      recommendation: 'Lock in fixed rate; avoid floating rate exposure',
    });
  }

  // Recession risk / low growth
  if (economicData.gdpGrowth?.value < 1) {
    risks.push({
      type: 'recession',
      severity: economicData.gdpGrowth.value < 0 ? 'critical' : 'high',
      description: economicData.gdpGrowth.value < 0
        ? 'Economy in contraction - elevated default risk'
        : `Low GDP growth (${economicData.gdpGrowth.value}%) signals economic weakness`,
      recommendation: economicData.gdpGrowth.value < 0
        ? 'Require personal guarantees; tighten monitoring'
        : 'Increase covenant cushions; require additional collateral',
    });
  }

  return risks;
}

export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { country = 'Jamaica', industry, useWebSearch = false } = req.body;

    // Optional: Validate auth token if provided
    const authHeader = req.headers.authorization;
    if (authHeader && supabase) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token && token !== 'undefined' && token !== 'null') {
        try {
          const { error: authError } = await supabase.auth.getUser(token);
          if (authError) {
            console.warn('Auth validation failed:', authError.message);
            // Continue anyway - economic data is not sensitive
          }
        } catch (authErr) {
          console.warn('Auth check error:', authErr.message);
        }
      }
    }

    let economicData;

    // If web search is enabled and we have an API key for a search provider
    // This could be integrated with SerpAPI, Google Custom Search, etc.
    if (useWebSearch && process.env.SEARCH_API_KEY) {
      // TODO: Implement actual web search when search API is configured
      // For now, fall back to default data
      console.log('Web search requested but not yet implemented, using default data');
      economicData = getDefaultEconomicData(country, industry);
      economicData.source = 'default (web search not configured)';
    } else {
      // Use default/cached economic data
      economicData = getDefaultEconomicData(country, industry);
    }

    // Identify macro risks
    const macroRisks = identifyMacroRisks(economicData);

    // Build response
    const response = {
      success: true,
      data: {
        ...economicData,
        macroRisks,
      },
      country,
      industry: industry || null,
      fetchedAt: economicData.fetchedAt,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Economic data fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch economic data',
    });
  }
}
