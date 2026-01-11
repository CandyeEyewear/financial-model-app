// utils/aiCreditAnalysis.js

/**
 * Call AI API for analysis
 * Replaces deprecated deepseekIntegration
 */
async function callAIAPI(prompt, accessToken, options = {}) {
  if (!accessToken) {
    throw new Error("Authentication required for AI analysis");
  }

  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      prompt,
      systemMessage: options.systemMessage || "You are a senior credit analyst at a top-tier investment bank.",
      temperature: options.temperature || 0.3,
      maxTokens: options.maxTokens || 2000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * AI-Powered Credit Analysis Engine
 * Uses AI API to provide contextual interpretations
 */
export async function generateCreditInsights(projection, params, accessToken) {
  // Prepare structured data for AI
  const analysisContext = {
    creditStats: {
      avgDSCR: projection.creditStats?.avgDSCR || 0,
      minDSCR: projection.creditStats?.minDSCR || 0,
      avgICR: projection.creditStats?.avgICR || 0,
      minICR: projection.creditStats?.minICR || 0,
      avgLeverage: projection.creditStats?.avgLeverage || 0,
      maxLeverage: projection.creditStats?.maxLeverage || 0
    },
    breaches: {
      dscrBreaches: projection.breaches?.dscrBreaches || 0,
      icrBreaches: projection.breaches?.icrBreaches || 0,
      leverageBreaches: projection.breaches?.ndBreaches || 0,
      breachYears: [
        ...(projection.breaches?.dscrBreachYears || []),
        ...(projection.breaches?.icrBreachYears || []),
        ...(projection.breaches?.leverageBreachYears || [])
      ]
    },
    covenants: {
      minDSCR: params.minDSCR || 1.2,
      targetICR: params.targetICR || 2.0,
      maxNDToEBITDA: params.maxNDToEBITDA || 3.5
    },
    industry: params.industry || 'General',
    facilityType: params.facilityType || params.dealStructure,
    // Fixed: Respect hasExistingDebt toggle in fallback calculation
    totalDebt: projection.rows?.[0]?.grossDebt ||
               (params.hasExistingDebt === true ? (params.openingDebt || params.existingDebtAmount || 0) : 0) +
               (params.requestedLoanAmount || 0),
    baseRevenue: params.baseRevenue
  };

  // Construct AI prompt with specific analysis requests
  const prompt = `
You are a senior credit analyst at a top-tier investment bank. Analyze this credit profile and provide expert insights.

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

**Format**: Provide concise, actionable insights. Use banker terminology. Be direct and specific with numbers.
`;

  try {
    const aiResponse = await callAIAPI(prompt, accessToken, {
      temperature: 0.3, // Lower temperature for analytical precision
      maxTokens: 2000
    });

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