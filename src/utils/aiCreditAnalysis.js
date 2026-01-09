// utils/aiCreditAnalysis.js
// Uses /api/ai/analyze serverless function for AI-powered credit analysis

import { supabase } from '../lib/supabase';

/**
 * Call the serverless AI analysis API
 * @param {string} prompt - The analysis prompt
 * @param {string} systemMessage - Optional system message for context
 * @returns {Promise<string>} - AI response text
 */
async function callAIAnalysisAPI(prompt, systemMessage) {
  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('User must be authenticated to use AI analysis');
  }

  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      prompt,
      systemMessage
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * AI-Powered Credit Analysis Engine
 * Uses /api/ai/analyze serverless function for DeepSeek integration
 */
export async function generateCreditInsights(projection, params) {
  // Prepare structured data for AI
  const analysisContext = {
    creditStats: {
      avgDSCR: projection.creditStats.avgDSCR,
      minDSCR: projection.creditStats.minDSCR,
      avgICR: projection.creditStats.avgICR,
      minICR: projection.creditStats.minICR,
      avgLeverage: projection.creditStats.avgLeverage,
      maxLeverage: projection.creditStats.maxLeverage
    },
    breaches: {
      dscrBreaches: projection.breaches.dscrBreaches,
      icrBreaches: projection.breaches.icrBreaches,
      leverageBreaches: projection.breaches.ndBreaches,
      breachYears: [
        ...projection.breaches.dscrBreachYears,
        ...projection.breaches.icrBreachYears,
        ...projection.breaches.leverageBreachYears
      ]
    },
    covenants: {
      minDSCR: params.minDSCR,
      targetICR: params.targetICR,
      maxNDToEBITDA: params.maxNDToEBITDA
    },
    industry: params.industry,
    facilityType: params.facilityType,
    totalDebt: projection.rows[0].grossDebt,
    baseRevenue: params.baseRevenue
  };

  const systemMessage = 'You are a senior credit analyst at a top-tier investment bank. Provide expert financial analysis with precise metrics and actionable insights.';

  // Construct AI prompt with specific analysis requests
  const prompt = `Analyze this credit profile and provide expert insights.

## Credit Profile:
${JSON.stringify(analysisContext, null, 2)}

## Analysis Requirements:
1. **Overall Credit Quality Assessment**: Rate the credit as Investment Grade, Sub-Investment Grade, or Distressed. Justify your rating.

2. **Covenant Breach Analysis**: 
   - If breaches exist, explain their severity and timing
   - Identify root causes (revenue shortfall, cost overruns, overleveraging)
   - Assess probability of waiver vs default

3. **Leverage Profile**: 
   - Compare leverage to industry norms for ${params.industry}
   - Assess deleveraging trajectory
   - Identify optimal leverage target

4. **Cash Flow Coverage**:
   - Evaluate DSCR and ICR adequacy
   - Compare to lending standards
   - Assess margin for error

5. **Risk Factors**:
   - Identify top 3 credit risks
   - Quantify potential impact
   - Suggest mitigation strategies

6. **Strategic Recommendations**:
   - Prioritized action items (1-3 only)
   - Financial restructuring needs (if any)
   - Optimal capital structure adjustments

**Format**: Provide concise, actionable insights. Use banker terminology. Be direct and specific with numbers.`;

  try {
    const aiResponse = await callAIAnalysisAPI(prompt, systemMessage);
    return parseAIInsights(aiResponse);
  } catch (error) {
    console.error('AI Credit Analysis failed:', error);
    return getFallbackInsights(analysisContext);
  }
}

/**
 * Parse AI response into structured insights
 */
function parseAIInsights(aiResponse) {
  // Extract structured sections from AI response
  const sections = {
    creditRating: extractSection(aiResponse, 'Overall Credit Quality'),
    covenantAnalysis: extractSection(aiResponse, 'Covenant Breach Analysis'),
    leverageAssessment: extractSection(aiResponse, 'Leverage Profile'),
    coverageAnalysis: extractSection(aiResponse, 'Cash Flow Coverage'),
    riskFactors: extractSection(aiResponse, 'Risk Factors'),
    recommendations: extractSection(aiResponse, 'Strategic Recommendations')
  };

  return {
    summary: sections.creditRating,
    insights: [
      {
        category: 'Credit Rating',
        content: sections.creditRating,
        severity: inferSeverity(sections.creditRating)
      },
      {
        category: 'Covenant Health',
        content: sections.covenantAnalysis,
        severity: inferSeverity(sections.covenantAnalysis)
      },
      {
        category: 'Leverage',
        content: sections.leverageAssessment,
        severity: inferSeverity(sections.leverageAssessment)
      },
      {
        category: 'Coverage',
        content: sections.coverageAnalysis,
        severity: inferSeverity(sections.coverageAnalysis)
      }
    ],
    risks: parseRiskFactors(sections.riskFactors),
    recommendations: parseRecommendations(sections.recommendations)
  };
}

/**
 * Fallback insights if AI fails
 */
function getFallbackInsights(context) {
  // Rule-based analysis as backup
  const insights = [];
  
  if (context.creditStats.avgDSCR < 1.2) {
    insights.push({
      category: 'Critical Risk',
      content: 'DSCR below 1.2x indicates insufficient cash flow to service debt. Immediate deleveraging required.',
      severity: 'critical'
    });
  }
  
  if (context.breaches.dscrBreaches > 0) {
    insights.push({
      category: 'Covenant Breach',
      content: `${context.breaches.dscrBreaches} DSCR breach(es) detected. Engage lenders for waivers.`,
      severity: 'warning'
    });
  }
  
  return {
    summary: 'AI analysis unavailable. Using rule-based assessment.',
    insights,
    risks: [],
    recommendations: ['Enable AI integration for deeper insights']
  };
}

// Helper functions
function extractSection(text, sectionName) {
  const regex = new RegExp(`${sectionName}[:\\s]+(.*?)(?=\\n\\n|$)`, 's');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function inferSeverity(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('critical') || lowerText.includes('distressed') || lowerText.includes('default')) {
    return 'critical';
  }
  if (lowerText.includes('concern') || lowerText.includes('warning') || lowerText.includes('below')) {
    return 'warning';
  }
  if (lowerText.includes('strong') || lowerText.includes('robust') || lowerText.includes('healthy')) {
    return 'positive';
  }
  return 'neutral';
}

function parseRiskFactors(text) {
  // Extract numbered or bulleted list items
  const risks = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    if (/^\d+\.|\-|\*/.test(line.trim())) {
      risks.push(line.replace(/^\d+\.|\-|\*/, '').trim());
    }
  });
  
  return risks.slice(0, 5); // Top 5 risks
}

function parseRecommendations(text) {
  const recs = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    if (/^\d+\.|\-|\*/.test(line.trim())) {
      recs.push(line.replace(/^\d+\.|\-|\*/, '').trim());
    }
  });
  
  return recs.slice(0, 3); // Top 3 actions
}