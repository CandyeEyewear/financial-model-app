// src/utils/aiCapitalStructureAdvisor.js
// AI-powered capital structure recommendations for lenders

import { calculateDebtCapacity, generateAlternativeStructures } from './debtCapacityAnalyzer';

/**
 * Generate AI-powered capital structure recommendations
 */
export async function generateAICapitalStructureRecommendations(projection, params, ccy) {
  // Get API key
  const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    console.error("DeepSeek API key not found");
    return {
      summary: "AI analysis unavailable: API key not configured.",
      recommendation: "MANUAL_REVIEW_REQUIRED",
      keyFindings: [],
      structuralImprovements: [],
      riskAssessment: "UNKNOWN"
    };
  }

  try {
    // Calculate debt capacity
    const capacity = calculateDebtCapacity(params, projection);
    const alternatives = generateAlternativeStructures(params, projection, capacity);
    
    // Prepare context for AI
    const context = {
      // Current structure
      currentDebt: capacity.currentDebtRequest / 1_000_000,
      currentEquity: (params.equityContribution || 0) / 1_000_000,
      currentLeverage: projection?.rows?.[0]?.ndToEbitda || 0,
      currentDSCR: projection?.creditStats?.minDSCR || 0,
      
      // Capacity analysis
      maxSustainableDebt: capacity.maxSustainableDebt / 1_000_000,
      safeDebt: capacity.safeDebt / 1_000_000,
      excessDebt: capacity.excessDebt / 1_000_000,
      utilizationPct: capacity.utilizationPct,
      
      // Financial metrics
      ebitda: capacity.ebitda / 1_000_000,
      revenue: (projection?.rows?.[0]?.revenue || params.baseRevenue) / 1_000_000,
      ebitdaMargin: projection?.rows?.[0]?.ebitdaMargin || 0,
      
      // Covenants
      minDSCR: params.minDSCR || 1.25,
      maxLeverage: params.maxNDToEBITDA || 4.0,
      breaches: (projection?.breaches?.dscrBreaches || 0) + 
               (projection?.breaches?.icrBreaches || 0) + 
               (projection?.breaches?.ndBreaches || 0),
      
      // Alternatives
      alternatives: {
        current: alternatives.current,
        alt1: alternatives.alternative1,
        alt2: alternatives.alternative2,
        alt3: alternatives.alternative3
      },
      
      // Industry
      industry: params.industry || 'General',
      
      // Collateral
      collateralValue: (params.collateralValue || 0) / 1_000_000,
      ltv: params.collateralValue > 0 ? 
        (capacity.currentDebtRequest / params.collateralValue) * 100 : 0
    };

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `You are a senior credit officer at a commercial bank evaluating a lending request. Provide a concise, actionable capital structure recommendation.

**DEAL OVERVIEW:**
- Requested Debt: ${ccy} ${context.currentDebt.toFixed(1)}M
- Equity Contribution: ${ccy} ${context.currentEquity.toFixed(1)}M
- Current Leverage: ${context.currentLeverage.toFixed(2)}x
- Minimum DSCR: ${context.currentDSCR.toFixed(2)}x
- Industry: ${context.industry}

**DEBT CAPACITY ANALYSIS:**
- Maximum Sustainable Debt: ${ccy} ${context.maxSustainableDebt.toFixed(1)}M
- Safe Debt (with buffer): ${ccy} ${context.safeDebt.toFixed(1)}M
- Excess Over Capacity: ${ccy} ${context.excessDebt.toFixed(1)}M (${context.utilizationPct.toFixed(0)}% utilization)

**FINANCIAL PERFORMANCE:**
- EBITDA: ${ccy} ${context.ebitda.toFixed(1)}M (${(context.ebitdaMargin * 100).toFixed(1)}% margin)
- Revenue: ${ccy} ${context.revenue.toFixed(1)}M

**COVENANT COMPLIANCE:**
- Required Min DSCR: ${context.minDSCR.toFixed(2)}x (Current: ${context.currentDSCR.toFixed(2)}x)
- Required Max Leverage: ${context.maxLeverage.toFixed(2)}x (Current: ${context.currentLeverage.toFixed(2)}x)
- Projected Breaches: ${context.breaches} year(s)

**COLLATERAL:**
- Collateral Value: ${ccy} ${context.collateralValue.toFixed(1)}M
- Loan-to-Value: ${context.ltv.toFixed(1)}%

**ALTERNATIVE STRUCTURES:**
1. Current: ${context.alternatives.current.debtPct.toFixed(0)}% debt, DSCR ${context.alternatives.current.dscr.toFixed(2)}x
2. Reduce Debt: ${context.alternatives.alt1.debtPct.toFixed(0)}% debt, DSCR ${context.alternatives.alt1.dscr.toFixed(2)}x
3. Optimize Mix: ${context.alternatives.alt2.debtPct.toFixed(0)}% debt, DSCR ${context.alternatives.alt2.dscr.toFixed(2)}x
4. Extend Tenor: ${context.alternatives.alt3.tenor} years, DSCR ${context.alternatives.alt3.dscr.toFixed(2)}x

**YOUR TASK:**
Provide a 250-word analysis with:

1. **RECOMMENDATION** (one line): APPROVE / APPROVE WITH CONDITIONS / REJECT
2. **KEY FINDINGS** (3-4 bullets with specific numbers)
3. **OPTIMAL STRUCTURE** (which alternative is best and why)
4. **REQUIRED MITIGANTS** (3-4 specific conditions if approval recommended)
5. **RISK ASSESSMENT** (LOW / MEDIUM / HIGH / CRITICAL)

Be direct, use specific numbers from above, and write from a lender's risk perspective.`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "No response from AI.";
    
    // Parse AI response (basic parsing - enhance as needed)
    const lines = aiText.split('\n').filter(line => line.trim());
    
    return {
      fullAnalysis: aiText,
      summary: lines[0] || "Analysis complete",
      recommendation: capacity.recommendation,
      keyFindings: lines.filter(line => line.includes('•') || line.includes('-')).slice(0, 4),
      riskAssessment: capacity.riskLevel,
      alternatives: alternatives,
      capacity: capacity
    };
    
  } catch (error) {
    console.error("AI recommendation error:", error);
    return {
      summary: `Error generating AI recommendations: ${error.message}`,
      recommendation: "MANUAL_REVIEW_REQUIRED",
      keyFindings: [],
      riskAssessment: "UNKNOWN",
      capacity: calculateDebtCapacity(params, projection),
      alternatives: generateAlternativeStructures(params, projection, calculateDebtCapacity(params, projection))
    };
  }
}