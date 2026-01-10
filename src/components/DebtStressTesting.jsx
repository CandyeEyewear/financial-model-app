import React, { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { buildProjection } from "../utils/buildProjection";
import { generateModelDataSummary } from "../utils/ModelDataSummary";
import { AITextRenderer } from "./AITextRenderer";
import { 
  AlertTriangle, CheckCircle, XCircle, TrendingDown, Shield, Activity, 
  Download, History, Calendar, DollarSign, Info, Zap, TrendingUp, Database,
  ArrowRight, Sparkles, Loader2, FileText, BarChart3
} from "lucide-react";

// Color palette
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#2563eb' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10b981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#f59e0b' },
  danger: { from: 'red-500', to: 'red-600', chart: '#ef4444' },
  info: { from: 'indigo-500', to: 'indigo-600', chart: '#6366f1' },
  purple: { from: 'purple-500', to: 'purple-600', chart: '#a855f7' },
};

// Industry benchmarks database
const INDUSTRY_BENCHMARKS = {
  'Manufacturing': { medianLeverage: 3.2, medianDSCR: 1.8, medianICR: 3.5, typicalCovenants: '1.25x DSCR, 4.0x Max Leverage' },
  'Technology': { medianLeverage: 2.5, medianDSCR: 2.2, medianICR: 4.0, typicalCovenants: '1.50x DSCR, 3.0x Max Leverage' },
  'Retail': { medianLeverage: 3.8, medianDSCR: 1.6, medianICR: 3.0, typicalCovenants: '1.20x DSCR, 4.5x Max Leverage' },
  'Healthcare': { medianLeverage: 3.0, medianDSCR: 1.9, medianICR: 3.8, typicalCovenants: '1.40x DSCR, 3.5x Max Leverage' },
  'Real Estate': { medianLeverage: 4.5, medianDSCR: 1.4, medianICR: 2.5, typicalCovenants: '1.15x DSCR, 5.0x Max Leverage' },
  'Services': { medianLeverage: 2.8, medianDSCR: 2.0, medianICR: 3.5, typicalCovenants: '1.35x DSCR, 3.5x Max Leverage' },
  'default': { medianLeverage: 3.0, medianDSCR: 1.8, medianICR: 3.2, typicalCovenants: '1.25x DSCR, 3.5x Max Leverage' }
};

// Enhanced debt stress test scenarios
const DEBT_STRESS_SCENARIOS = {
  base: {
    name: "Base Case",
    description: "Current assumptions",
    adjustments: {},
    color: COLORS.success.chart
  },
  revenueDown10: {
    name: "Revenue -10%",
    description: "10% revenue decline",
    adjustments: { revenueShock: -0.10 },
    color: COLORS.info.chart
  },
  revenueDown20: {
    name: "Revenue -20%",
    description: "20% revenue decline",
    adjustments: { revenueShock: -0.20 },
    color: COLORS.warning.chart
  },
  revenueDown30: {
    name: "Revenue -30%",
    description: "Severe revenue decline",
    adjustments: { revenueShock: -0.30 },
    color: COLORS.danger.chart
  },
  marginCompression: {
    name: "Margin Pressure",
    description: "COGS +5%, OpEx +3%",
    adjustments: { cogsShock: 0.05, opexShock: 0.03 },
    color: '#ec4899'
  },
  rateHike200: {
    name: "Rates +2%",
    description: "200 bps rate increase",
    adjustments: { rateShock: 0.02 },
    color: '#8b5cf6'
  },
  rateHike300: {
    name: "Rates +3%",
    description: "300 bps rate increase",
    adjustments: { rateShock: 0.03 },
    color: '#a855f7'
  },
  rateHike500: {
    name: "Rates +5%",
    description: "500 bps rate shock",
    adjustments: { rateShock: 0.05 },
    color: '#c026d3'
  },
  workingCapital: {
    name: "WC Strain",
    description: "Working capital +5% of revenue",
    adjustments: { wcShock: 0.05 },
    color: '#06b6d4'
  },
  mildRecession: {
    name: "Mild Recession",
    description: "Revenue -15%, Margin -2%, Rates +1%",
    adjustments: { revenueShock: -0.15, cogsShock: 0.02, rateShock: 0.01 },
    color: '#f97316'
  },
  severeRecession: {
    name: "Severe Recession",
    description: "Revenue -25%, Margin -5%, Rates +2%",
    adjustments: { revenueShock: -0.25, cogsShock: 0.05, rateShock: 0.02 },
    color: '#dc2626'
  },
  stagflation: {
    name: "Stagflation",
    description: "Revenue -10%, COGS +8%, Rates +4%",
    adjustments: { revenueShock: -0.10, cogsShock: 0.08, rateShock: 0.04 },
    color: '#b91c1c'
  }
};

// ✅ AI Integration using serverless function /api/ai/analyze
const generateStressTestNarrative = async (context, accessToken) => {
  // Check for access token
  if (!accessToken) {
    console.error("No access token for AI analysis");
    return "AI analysis unavailable: Please log in to access AI features.";
  }

  const prompt = `You are a senior credit risk analyst providing stress test insights. Analyze these results and provide SPECIFIC, ACTIONABLE recommendations based on the ACTUAL numbers below.

**FACILITY OVERVIEW:**
- Total Debt Exposure: ${currencyFmtMM(context.totalDebt, context.ccy)}
- Interest Rate: ${pctFmt(context.interestRate)} ${context.isFloating ? "(Floating - rate risk exposure!)" : "(Fixed)"}
- Required Min DSCR: ${numFmt(context.covenants.minDSCR)}x
- Required Max Leverage: ${numFmt(context.covenants.maxLeverage)}x
${context.hasNewFacility ? `- New Facility Amount: ${currencyFmtMM(context.newFacilityAmount, context.ccy)} (incremental risk)` : ''}

**STRESS TEST RESULTS:**
- Total Scenarios Tested: ${context.totalScenarios}
- Scenarios with Covenant Breaches: ${context.breachCount} (${((context.breachCount / context.totalScenarios) * 100).toFixed(0)}%)
- Worst Case Scenario: ${context.worstCase.name}
- Worst Case DSCR: ${numFmt(context.worstCase.minDSCR)}x ${context.worstCase.minDSCR < 1.0 ? "⚠️ INSUFFICIENT CASH FLOW" : ""}
- Base Case DSCR: ${numFmt(context.baseCase.minDSCR)}x
- Minimum Liquidity Runway: ${context.minRunway} months ${context.minRunway < 6 ? "⚠️ CRITICAL" : context.minRunway < 12 ? "⚠️ TIGHT" : "✅"}

**BREAKING POINTS (Revenue Sensitivity):**
- Safe Revenue Decline Threshold: ~${context.safeRevenueDip}%
- DSCR Breach Point: Revenue decline of ${context.dscrBreakPoint}% → DSCR falls below ${numFmt(context.covenants.minDSCR)}x
- Critical Threshold: Revenue decline of ${context.criticalThreshold}% → DSCR < 1.0x (default risk)

**INTEREST RATE SENSITIVITY:**
- Current Rate: ${pctFmt(context.interestRate)}
- Rate Ceiling: Can tolerate +${context.rateCeiling}% increase before DSCR breach
${context.isFloating ? "⚠️ FLOATING RATE = HIGH RISK. Consider hedging." : ""}

${context.hasHistoricalData ? `
**HISTORICAL PERFORMANCE:**
- Years of Data: ${context.historicalYears} years
- Historical Revenue Growth: ${pctFmt(context.historicalGrowth)} annually
- Revenue Trajectory: ${context.revenueTrajectory}
- Margin Trend: ${context.marginTrend}
- Cash Flow Status: ${context.isPositiveCashFlow ? "✅ Currently profitable" : "⚠️ Operating at a loss (burn mode)"}
- Historical Volatility: ${context.revenueVolatility}

**TRAJECTORY ANALYSIS:**
${context.trajectoryInsights}
` : '**WARNING:** No historical data provided. Analysis based on projections only, which increases uncertainty.'}

**INDUSTRY BENCHMARKING (${context.industry}):**
- Your Leverage: ${numFmt(context.currentLeverage)}x vs Industry Median: ${numFmt(context.industryBenchmarks.medianLeverage)}x
  → You are ${context.currentLeverage > context.industryBenchmarks.medianLeverage ? "ABOVE" : "BELOW"} median by ${numFmt(Math.abs(context.currentLeverage - context.industryBenchmarks.medianLeverage))}x
- Your DSCR: ${numFmt(context.baseCase.minDSCR)}x vs Industry Median: ${numFmt(context.industryBenchmarks.medianDSCR)}x
- Typical Industry Covenants: ${context.industryBenchmarks.typicalCovenants}

**SCENARIO FAILURE ANALYSIS:**
${context.failureReasons}

**YOUR TASK:**
Write a conversational, plain-English analysis (300-350 words) that includes:

1. **Executive Summary** (2-3 sentences): Bottom line - what's the risk level and key concern?

2. **Breaking Point Analysis** (specific numbers): 
   - "Your facility can withstand a revenue decline of up to ${context.safeRevenueDip}% before approaching covenant limits."
   - "At ${context.dscrBreakPoint}% revenue decline, you breach the ${numFmt(context.covenants.minDSCR)}x DSCR covenant."
   - "Critical threshold is ${context.criticalThreshold}% revenue decline where DSCR < 1.0x."

3. **Key Vulnerabilities** (3-4 specific bullets with numbers):
   - Use ACTUAL numbers from the data above
   - Example: "Your ${currencyFmtMM(context.totalDebt, context.ccy)} debt at ${numFmt(context.currentLeverage)}x leverage is ${Math.abs(context.currentLeverage - context.industryBenchmarks.medianLeverage) > 0.5 ? "significantly" : "moderately"} above the ${context.industry} industry median of ${numFmt(context.industryBenchmarks.medianLeverage)}x."

4. **Actionable Recommendations** (4-5 specific bullets with numbers):
   - Be SPECIFIC: "Reduce debt by $${((context.totalDebt - (context.industryBenchmarks.medianLeverage * context.baseCase.ebitda)) / 1000000).toFixed(1)}M to reach industry-standard ${numFmt(context.industryBenchmarks.medianLeverage)}x leverage"
   - Include: capital structure changes, liquidity targets, operational improvements, hedging strategies
   - Use phrases like "I recommend", "You should", "Target"

5. **Risk Rating**: Based on the data, assign overall risk: LOW / MODERATE / ELEVATED / HIGH and justify with 1-2 sentences.

Write in first person ("I recommend", "Based on your numbers"), be direct and honest, cite specific metrics, and make it actionable. Focus on what the user can DO about the risks identified.`;

  const systemMessage = "You are a senior credit risk analyst providing stress test insights. Be specific, actionable, and data-driven.";

  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
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
    return data.choices?.[0]?.message?.content || "No response from AI service.";
  } catch (error) {
    console.error("AI narrative error:", error);
    return `Unable to generate AI analysis: ${error.message}. Please review the quantitative stress test results above.`;
  }
};

// ✅ ENHANCED: Calculate historical metrics with trajectory analysis
function calculateHistoricalMetrics(historicalData) {
  if (!historicalData || historicalData.length === 0) return null;
  
  const validYears = historicalData.filter(d => d.revenue > 0);
  if (validYears.length === 0) return null;
  
  let avgGrowth = 0;
  let revenueVolatility = "N/A";
  let revenueTrajectory = "Insufficient data";
  let marginTrend = "Unknown";
  
  if (validYears.length >= 2) {
    const growthRates = [];
    for (let i = 1; i < validYears.length; i++) {
      const growth = (validYears[i].revenue - validYears[i-1].revenue) / validYears[i-1].revenue;
      growthRates.push(growth);
    }
    avgGrowth = growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length;
    
    // Calculate volatility
    const stdDev = Math.sqrt(
      growthRates.reduce((sum, g) => sum + Math.pow(g - avgGrowth, 2), 0) / growthRates.length
    );
    
    if (stdDev < 0.05) revenueVolatility = "Low (stable)";
    else if (stdDev < 0.15) revenueVolatility = "Moderate";
    else revenueVolatility = "High (volatile)";
    
    // Determine trajectory
    const recentGrowth = growthRates[growthRates.length - 1];
    if (recentGrowth > avgGrowth * 1.2) revenueTrajectory = "Accelerating growth";
    else if (recentGrowth < avgGrowth * 0.8) revenueTrajectory = "Slowing growth";
    else revenueTrajectory = "Steady growth";
  }
  
  // Margin analysis
  if (validYears.length >= 2) {
    const margins = validYears.map(y => (y.ebitda || 0) / y.revenue);
    const recentMargin = margins[margins.length - 1];
    const avgMargin = margins.reduce((sum, m) => sum + m, 0) / margins.length;
    
    if (recentMargin > avgMargin * 1.1) marginTrend = "Improving (recent margin +10% above avg)";
    else if (recentMargin < avgMargin * 0.9) marginTrend = "Deteriorating (recent margin -10% below avg)";
    else marginTrend = "Stable";
  }
  
  const avgRevenue = validYears.reduce((sum, y) => sum + y.revenue, 0) / validYears.length;
  const avgEBITDA = validYears.reduce((sum, y) => sum + (y.ebitda || 0), 0) / validYears.length;
  
  // Generate trajectory insights
  let trajectoryInsights = "";
  if (validYears.length >= 3) {
    const y1 = validYears[0];
    const y2 = validYears[Math.floor(validYears.length / 2)];
    const y3 = validYears[validYears.length - 1];
    
    trajectoryInsights = `Year 1: ${currencyFmtMM(y1.revenue, "USD")} revenue, ${y1.ebitda > 0 ? `+${currencyFmtMM(y1.ebitda, "USD")}` : `${currencyFmtMM(y1.ebitda, "USD")}`} EBITDA
Year ${Math.floor(validYears.length / 2) + 1}: ${currencyFmtMM(y2.revenue, "USD")} revenue, ${y2.ebitda > 0 ? `+${currencyFmtMM(y2.ebitda, "USD")}` : `${currencyFmtMM(y2.ebitda, "USD")}`} EBITDA
Year ${validYears.length}: ${currencyFmtMM(y3.revenue, "USD")} revenue, ${y3.ebitda > 0 ? `+${currencyFmtMM(y3.ebitda, "USD")}` : `${currencyFmtMM(y3.ebitda, "USD")}`} EBITDA
${y1.ebitda < 0 && y3.ebitda > 0 ? "✅ Successfully achieved profitability" : ""}`;
  }
  
  return {
    yearsOfData: validYears.length,
    avgGrowth,
    avgRevenue,
    avgEBITDA,
    isPositiveCashFlow: avgEBITDA > 0,
    revenueVolatility,
    revenueTrajectory,
    marginTrend,
    trajectoryInsights
  };
}

// ✅ ENHANCED: Calculate liquidity runway with proper stress adjustments
function calculateLiquidityRunway(projection, scenarioKey, adjustments, params) {
  if (!projection || !projection.rows || projection.rows.length === 0) return 12;
  
  try {
    const firstYear = projection.rows[0];
    const currentCash = firstYear?.cash || 100000;
    
    // Calculate stressed operating cash flow
    const baseEBITDA = firstYear?.ebitda || 0;
    const stressedRevenue = params.baseRevenue * (1 + (adjustments.revenueShock || 0));
    const stressedEBITDA = baseEBITDA * (1 + (adjustments.revenueShock || 0)) * (1 - (adjustments.cogsShock || 0));
    
    // Account for increased debt service under rate shock
    const baseDebtService = (params.openingDebt || 0 + params.requestedLoanAmount || 0) * params.interestRate;
    const stressedDebtService = baseDebtService * (1 + (adjustments.rateShock || 0) / params.interestRate);
    
    // Account for working capital drain
    const wcDrain = stressedRevenue * (adjustments.wcShock || 0);
    
    // Calculate monthly burn
    const annualCashFlow = stressedEBITDA - stressedDebtService - wcDrain;
    
    if (annualCashFlow >= 0) return 36; // Positive cash flow = no liquidity concern
    
    const monthlyBurn = Math.abs(annualCashFlow) / 12;
    let runway = currentCash / monthlyBurn;
    
    return Math.round(runway * 10) / 10; // Don't cap artificially
  } catch (error) {
    console.error("Error calculating liquidity:", error);
    return 12;
  }
}

// ✅ ENHANCED: Comprehensive risk scoring
function determineRiskLevel(metrics, params, historicalMetrics) {
  const { totalBreaches, liquidityRunway, dscrCushion, leverageCushion, icrCushion } = metrics;
  
  let riskScore = 0;
  let riskFactors = [];
  
  // Covenant breaches (0-40 points)
  if (totalBreaches > 0) {
    riskScore += 40;
    riskFactors.push(`${totalBreaches} covenant breach(es)`);
  } else if (dscrCushion < 0.2) {
    riskScore += 20;
    riskFactors.push("Thin DSCR cushion (<0.2)");
  } else if (dscrCushion < 0.5) {
    riskScore += 10;
    riskFactors.push("Limited DSCR cushion (<0.5)");
  }
  
  // Liquidity (0-30 points)
  if (liquidityRunway < 3) {
    riskScore += 30;
    riskFactors.push("Critical liquidity (<3 months)");
  } else if (liquidityRunway < 6) {
    riskScore += 20;
    riskFactors.push("Tight liquidity (<6 months)");
  } else if (liquidityRunway < 12) {
    riskScore += 10;
    riskFactors.push("Moderate liquidity (<12 months)");
  }
  
  // Leverage cushion (0-15 points)
  if (leverageCushion < 0) {
    riskScore += 15;
    riskFactors.push("Leverage covenant breach");
  } else if (leverageCushion < 0.5) {
    riskScore += 10;
    riskFactors.push("Limited leverage headroom");
  }
  
  // ICR cushion (0-10 points)
  if (icrCushion < 0) {
    riskScore += 10;
    riskFactors.push("ICR covenant breach");
  } else if (icrCushion < 0.5) {
    riskScore += 5;
    riskFactors.push("Thin ICR cushion");
  }
  
  // Historical volatility (0-10 points)
  if (historicalMetrics && historicalMetrics.revenueVolatility === "High (volatile)") {
    riskScore += 10;
    riskFactors.push("High revenue volatility");
  }
  
  // Floating rate risk (0-5 points)
  if (params.dayCountConvention === "Actual/360" || !params.interestRate) {
    riskScore += 5;
    riskFactors.push("Floating rate exposure");
  }
  
  // Determine level
  let level = "LOW";
  if (riskScore >= 60) level = "HIGH";
  else if (riskScore >= 40) level = "ELEVATED";
  else if (riskScore >= 20) level = "MODERATE";
  
  return { level, score: riskScore, factors: riskFactors };
}

// ✅ NEW: Calculate breaking points
function calculateBreakingPoints(params, baseCase) {
  const minDSCR = params.minDSCR || 1.25;
  const baseEBITDA = baseCase.ebitda || params.baseRevenue * 0.2;
  const annualDebtService = (params.openingDebt || 0 + params.requestedLoanAmount || 0) * params.interestRate;
  
  // DSCR = EBITDA / Debt Service
  // Need: EBITDA / Debt Service >= minDSCR
  // So: EBITDA >= minDSCR * Debt Service
  const requiredEBITDA = minDSCR * annualDebtService;
  const safeEBITDA = minDSCR * 1.2 * annualDebtService; // 20% cushion
  
  // Convert to revenue impact
  const ebitdaMargin = baseEBITDA / params.baseRevenue;
  const dscrBreachRevenue = requiredEBITDA / ebitdaMargin;
  const safeRevenue = safeEBITDA / ebitdaMargin;
  
  const dscrBreakPoint = ((params.baseRevenue - dscrBreachRevenue) / params.baseRevenue) * 100;
  const safeRevenueDip = ((params.baseRevenue - safeRevenue) / params.baseRevenue) * 100;
  const criticalThreshold = ((params.baseRevenue - (annualDebtService / ebitdaMargin)) / params.baseRevenue) * 100;
  
  // Interest rate ceiling
  const maxDebtService = baseEBITDA / minDSCR;
  const maxRate = maxDebtService / (params.openingDebt || 0 + params.requestedLoanAmount || 0);
  const rateCeiling = (maxRate - params.interestRate) * 100;
  
  return {
    dscrBreakPoint: Math.abs(dscrBreakPoint).toFixed(1),
    safeRevenueDip: Math.abs(safeRevenueDip).toFixed(1),
    criticalThreshold: Math.abs(criticalThreshold).toFixed(1),
    rateCeiling: rateCeiling.toFixed(1)
  };
}

export default function DebtStressTesting({ 
  params,
  ccy = "USD", 
  historicalData = [],
  onNavigateToTab,
  accessToken // Supabase access token for AI features
}) {


  // ============================================================================
  // ✅ ALL HOOKS FIRST - ALWAYS RUN IN SAME ORDER
  // ============================================================================
  
  const [selectedScenarios, setSelectedScenarios] = useState([
    'base', 'revenueDown20', 'rateHike300', 'mildRecession', 'severeRecession'
  ]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [aiNarrative, setAiNarrative] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Data validation
  const hasFinancialData = useMemo(() => {
    return params?.baseRevenue > 0;
  }, [params]);

  const hasExistingDebt = useMemo(() => {
    return params?.openingDebt > 0;
  }, [params]);

  const hasNewFacility = useMemo(() => {
    return params?.requestedLoanAmount > 0;
  }, [params]);

  const hasAnyDebt = hasExistingDebt || hasNewFacility;

  const hasHistoricalData = useMemo(() => {
    return historicalData && historicalData.some(d => d.revenue > 0);
  }, [historicalData]);

  const historicalMetrics = useMemo(() => {
    return calculateHistoricalMetrics(historicalData);
  }, [historicalData]);

  // ✅ MUST RUN EVERY RENDER: Calculate stress test results
  const stressTestResults = useMemo(() => {
    // Return empty if no data
    if (!hasFinancialData || !hasAnyDebt) {
      return {};
    }

    setIsCalculating(true);
    try {
      const results = {};
      
      Object.keys(DEBT_STRESS_SCENARIOS).forEach(scenarioKey => {
        const scenario = DEBT_STRESS_SCENARIOS[scenarioKey];
        const adjustments = scenario.adjustments;
        
        // Apply shocks to parameters
        const adjustedParams = {
          ...params,
          baseRevenue: params.baseRevenue * (1 + (adjustments.revenueShock || 0)),
          cogsPct: Math.min(0.95, params.cogsPct + (adjustments.cogsShock || 0)),
          opexPct: Math.min(0.50, params.opexPct + (adjustments.opexShock || 0)),
          interestRate: Math.max(0, params.interestRate + (adjustments.rateShock || 0)),
          wcPctOfRev: Math.max(0, params.wcPctOfRev + (adjustments.wcShock || 0)),
        };
        
        // Build projection with stressed parameters
        const projection = buildProjection(adjustedParams);
        
        // Extract metrics
        const minDSCR = projection.creditStats?.minDSCR || 1.0;
        const maxLeverage = projection.creditStats?.maxLeverage || 0;
        const minICR = projection.creditStats?.minICR || 1.0;
        
        const totalBreaches = (projection.breaches?.dscrBreaches || 0) + 
                            (projection.breaches?.icrBreaches || 0) + 
                            (projection.breaches?.ndBreaches || 0);
        
        const dscrCushion = minDSCR - (params.minDSCR || 1.2);
        const leverageCushion = (params.maxNDToEBITDA || 3.5) - maxLeverage;
        const icrCushion = minICR - (params.targetICR || 2.0);
        
        const liquidityRunway = calculateLiquidityRunway(projection, scenarioKey, adjustments, params);
        
        const riskAssessment = determineRiskLevel(
          { totalBreaches, liquidityRunway, dscrCushion, leverageCushion, icrCushion },
          params,
          historicalMetrics
        );
        
        const riskColorMap = {
          "LOW": COLORS.success.chart,
          "MODERATE": COLORS.warning.chart,
          "ELEVATED": "#f97316",
          "HIGH": COLORS.danger.chart
        };
        
        // Generate failure reason
        let failureReason = "";
        if (totalBreaches > 0 || minDSCR < 1.0) {
          const revenueImpact = adjustments.revenueShock ? `Revenue drops ${Math.abs(adjustments.revenueShock * 100).toFixed(0)}%` : "";
          const marginImpact = adjustments.cogsShock ? `Margin compression (COGS +${(adjustments.cogsShock * 100).toFixed(0)}%)` : "";
          const rateImpact = adjustments.rateShock ? `Interest rates +${(adjustments.rateShock * 100).toFixed(0)}%` : "";
          const wcImpact = adjustments.wcShock ? `WC drain +${(adjustments.wcShock * 100).toFixed(0)}% of revenue` : "";
          
          const impacts = [revenueImpact, marginImpact, rateImpact, wcImpact].filter(Boolean);
          failureReason = `WHY IT FAILS: ${impacts.join(", ")} → DSCR drops to ${numFmt(minDSCR)}x`;
        }
        
        results[scenarioKey] = {
          name: scenario.name,
          description: scenario.description,
          color: scenario.color,
          minDSCR, maxLeverage, minICR, totalBreaches,
          dscrCushion, leverageCushion, icrCushion,
          liquidityRunway, 
          riskLevel: riskAssessment.level,
          riskScore: riskAssessment.score,
          riskFactors: riskAssessment.factors,
          riskColor: riskColorMap[riskAssessment.level],
          projection,
          equityValue: projection.equityValue || 0,
          equityMOIC: projection.moic || 0,
          irr: projection.irr || 0,
          failureReason,
          ebitda: projection.rows?.[0]?.ebitda || 0
        };
      });
      
      return results;
    } catch (error) {
      console.error("Error calculating stress test results:", error);
      return {};
    } finally {
      setIsCalculating(false);
    }
  }, [params, hasFinancialData, hasAnyDebt, historicalMetrics]);

  // ✅ MUST RUN EVERY RENDER: Find worst case scenario
  const worstCaseScenario = useMemo(() => {
    if (!hasFinancialData || !hasAnyDebt || Object.keys(stressTestResults).length === 0) {
      return null;
    }
    
    let worst = null;
    let lowestDSCR = Infinity;
    
    Object.entries(stressTestResults).forEach(([key, result]) => {
      if (result.minDSCR < lowestDSCR) {
        lowestDSCR = result.minDSCR;
        worst = { key, ...result };
      }
    });
    
    return worst;
  }, [stressTestResults, hasFinancialData, hasAnyDebt]);

  // ✅ MUST RUN EVERY RENDER: AI Narrative Generation
  // âœ… MANUAL AI TRIGGER FUNCTION (replaces auto-running useEffect)
const triggerAIAnalysis = async () => {
  if (!hasFinancialData || !hasAnyDebt) {
    setAiNarrative("⚠️ No data available for AI analysis.");
    return;
  }
  if (!stressTestResults || Object.keys(stressTestResults).length === 0) {
    setAiNarrative("⚠️ Stress test results not ready.");
    return;
  }
  if (!worstCaseScenario) {
    setAiNarrative("⚠️ Unable to determine worst case scenario.");
    return;
  }

  setIsLoadingAI(true);
  
  try {
    const breachCount = Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length;
    const minRunway = Math.min(...Object.values(stressTestResults).map(r => r.liquidityRunway));
    const baseCase = stressTestResults.base;
    
    // Get industry benchmarks
    const industryBenchmarks = INDUSTRY_BENCHMARKS[params.industry] || INDUSTRY_BENCHMARKS['default'];
    
    // Calculate breaking points
    const breakingPoints = calculateBreakingPoints(params, baseCase);
    
    // Calculate current leverage
    const totalDebt = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
    const currentLeverage = totalDebt / (baseCase?.ebitda || params.baseRevenue * 0.2);
    
    // Generate failure reasons for worst scenarios
    const worstScenarios = Object.values(stressTestResults)
      .filter(r => r.totalBreaches > 0 || r.minDSCR < 1.25)
      .sort((a, b) => a.minDSCR - b.minDSCR)
      .slice(0, 3);
    
    const failureReasons = worstScenarios.map((s, i) => 
      `${i + 1}. ${s.name}: ${s.failureReason}`
    ).join('\n');
    
    const narrative = await generateStressTestNarrative({
      totalScenarios: Object.keys(DEBT_STRESS_SCENARIOS).length,
      breachCount,
      worstCase: worstCaseScenario,
      minRunway,
      baseCase,
      totalDebt,
      interestRate: params.interestRate,
      isFloating: params.dayCountConvention === "Actual/360",
      covenants: {
        minDSCR: params.minDSCR || 1.25,
        maxLeverage: params.maxNDToEBITDA || 3.5
      },
      hasHistoricalData: hasHistoricalData,
      historicalYears: historicalMetrics?.yearsOfData || 0,
      historicalGrowth: historicalMetrics?.avgGrowth || 0,
      isPositiveCashFlow: historicalMetrics?.isPositiveCashFlow || false,
      revenueVolatility: historicalMetrics?.revenueVolatility || "Unknown",
      revenueTrajectory: historicalMetrics?.revenueTrajectory || "Unknown",
      marginTrend: historicalMetrics?.marginTrend || "Unknown",
      trajectoryInsights: historicalMetrics?.trajectoryInsights || "No historical data available",
      hasNewFacility: hasNewFacility,
      newFacilityAmount: params.requestedLoanAmount || 0,
      industry: params.industry || "General Industry",
      industryBenchmarks,
      currentLeverage,
      safeRevenueDip: breakingPoints.safeRevenueDip,
      dscrBreakPoint: breakingPoints.dscrBreakPoint,
      criticalThreshold: breakingPoints.criticalThreshold,
      rateCeiling: breakingPoints.rateCeiling,
      failureReasons,
      ccy
    }, accessToken);
    
    setAiNarrative(narrative);
  } catch (error) {
    console.error("Failed to fetch AI narrative:", error);
    setAiNarrative(`Unable to generate AI analysis: ${error.message}. Please review the quantitative results above.`);
  } finally {
    setIsLoadingAI(false);
  }
};
  // ============================================================================
  // ✅ EARLY RETURNS: After ALL hooks are called
  // ============================================================================
  
  if (!hasFinancialData) {
    return (
      <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <Card className="border-l-4 border-l-yellow-600 bg-yellow-50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Database className="w-12 h-12 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-yellow-900 mb-3">No Financial Data for Stress Testing</h3>
                <p className="text-yellow-800 mb-4">
                  Stress testing requires baseline financial projections. Please enter the borrower's financial assumptions first.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-yellow-800">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Enter base revenue and growth assumptions</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-yellow-800">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Configure debt parameters (existing or new facility)</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-yellow-800">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Add historical data for enhanced accuracy (optional)</span>
                  </div>
                </div>
                {onNavigateToTab && (
                  <div className="mt-6">
                    <button
                      onClick={() => onNavigateToTab('historical-data')}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-all duration-200"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Enter Financial Data
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What is Stress Testing? */}
        <Card className="border-l-4 border-l-blue-600 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              What is Debt Stress Testing?
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-slate-700 mb-4">
              Debt stress testing simulates adverse scenarios to assess whether the borrower can meet debt obligations 
              under challenging conditions like revenue declines, margin compression, or rising interest rates.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">Risk Assessment</h4>
                <p className="text-sm text-blue-800">Identify breaking points before they happen</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 className="font-bold text-emerald-900 mb-2">Covenant Compliance</h4>
                <p className="text-sm text-emerald-800">Test DSCR, leverage, and ICR under stress</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-bold text-purple-900 mb-2">AI Insights</h4>
                <p className="text-sm text-purple-800">Get actionable recommendations in plain English</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAnyDebt) {
    return (
      <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
        <Card className="border-l-4 border-l-orange-600 bg-orange-50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileText className="w-12 h-12 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-orange-900 mb-3">No Debt to Stress Test</h3>
                <p className="text-orange-800 mb-4">
                  Stress testing requires debt obligations. Configure either existing debt or a new facility to begin analysis.
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2 text-sm text-orange-800">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold">Financial Data: {currencyFmtMM(params.baseRevenue, ccy)} base revenue</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-orange-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>❌ Existing Debt: Not configured</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-orange-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>❌ New Facility: Not configured</span>
                  </div>
                </div>
                {onNavigateToTab && (
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => onNavigateToTab('deal-information')}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-all duration-200"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Configure New Facility
                    </button>
                    <button
                      onClick={() => onNavigateToTab('opening-debt-schedule')}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all duration-200"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Add Existing Debt
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Financial Profile */}
        <Card className="border-l-4 border-l-emerald-600 shadow-md">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Current Financial Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Base Revenue</div>
                <div className="text-2xl font-bold text-slate-800">{currencyFmtMM(params.baseRevenue, ccy)}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Growth Rate</div>
                <div className="text-2xl font-bold text-slate-800">{pctFmt(params.growth || 0)}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase mb-1">Industry</div>
                <div className="text-lg font-bold text-slate-800">{params.industry || "Not set"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // ✅ MAIN RENDER: Data is complete - proceed with stress testing
  // ============================================================================

  // Loading state
  if (isCalculating || !stressTestResults || Object.keys(stressTestResults).length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Calculating stress scenarios...</p>
          <p className="text-slate-500 text-sm mt-2">Running comprehensive analysis...</p>
        </div>
      </div>
    );
  }

  const breachCount = Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length;
  const totalDebt = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);

  // Toggle scenario selection
  const toggleScenario = (scenarioKey) => {
    if (selectedScenarios.includes(scenarioKey)) {
      if (selectedScenarios.length > 1) {
        setSelectedScenarios(selectedScenarios.filter(k => k !== scenarioKey));
      }
    } else {
      setSelectedScenarios([...selectedScenarios, scenarioKey]);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Debt Type Banner */}
      {hasExistingDebt && hasNewFacility && (
        <Card className="border-l-4 border-l-purple-600 bg-gradient-to-r from-purple-50 to-indigo-50 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-purple-600 mt-0.5" />
              <div>
                <div className="font-bold text-purple-900 text-lg mb-2">🔄 Combined Debt Analysis</div>
                <div className="text-sm text-purple-800">
                  Testing <strong>existing debt of {currencyFmtMM(params.openingDebt, ccy)}</strong> plus{' '}
                  <strong>new facility of {currencyFmtMM(params.requestedLoanAmount, ccy)}</strong>.
                  Total exposure: <strong>{currencyFmtMM(totalDebt, ccy)}</strong>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasExistingDebt && !hasNewFacility && (
        <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <div className="font-bold text-blue-900 text-lg mb-2">Existing Debt Stress Test</div>
                <div className="text-sm text-blue-800">
                  Analyzing resilience of <strong>existing debt of {currencyFmtMM(params.openingDebt, ccy)}</strong> under adverse scenarios.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasExistingDebt && hasNewFacility && (
        <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-r from-emerald-50 to-green-50 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-emerald-600 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-900 text-lg mb-2">🆕 New Facility Stress Test</div>
                <div className="text-sm text-emerald-800">
                  Pre-approval stress testing for <strong>proposed facility of {currencyFmtMM(params.requestedLoanAmount, ccy)}</strong>.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Context Banner */}
      {hasHistoricalData && (
        <Card className="border-l-4 border-l-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <History className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  Enhanced with Historical Data
                </div>
                <div className="text-sm text-amber-800">
                  Analysis enhanced with <strong>{historicalMetrics.yearsOfData} years</strong> of historical data. 
                  Avg growth: <strong>{pctFmt(historicalMetrics.avgGrowth)}</strong>. 
                  Cash flow: <strong>{historicalMetrics.isPositiveCashFlow ? "Positive" : "Negative (burn mode)"}</strong>
                  {" | "}Trajectory: <strong>{historicalMetrics.revenueTrajectory}</strong>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

  {/* Summary KPIs */}
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  <div className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105">
    <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Scenarios Tested</div>
    <div className="text-3xl font-bold">{Object.keys(DEBT_STRESS_SCENARIOS).length}</div>
    <div className="text-xs opacity-80">Comprehensive</div>
  </div>
  
  <div className={`p-5 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105 ${
    worstCaseScenario?.minDSCR < params.minDSCR 
      ? 'bg-gradient-to-br from-red-500 to-red-600' 
      : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
  }`}>
    <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Worst Case DSCR</div>
    <div className="text-3xl font-bold">{numFmt(worstCaseScenario?.minDSCR || 0)}</div>
    <div className="text-xs opacity-80 truncate">{worstCaseScenario?.name || "N/A"}</div>
  </div>
  
  <div className={`p-5 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105 ${
    breachCount > 0
      ? 'bg-gradient-to-br from-amber-500 to-amber-600'
      : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
  }`}>
    <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">With Breaches</div>
    <div className="text-3xl font-bold">{breachCount}</div>
    <div className="text-xs opacity-80">Out of {Object.keys(DEBT_STRESS_SCENARIOS).length}</div>
  </div>
  
  <div className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105">
    <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Total Exposure</div>
    <div className="text-2xl font-bold">
      {currencyFmtMM(totalDebt, ccy)}
    </div>
    <div className="text-xs opacity-80">
      {hasExistingDebt && hasNewFacility ? "Combined" : hasNewFacility ? "New Only" : "Existing Only"}
    </div>
  </div>
  
  <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105">
    <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Data Quality</div>
    <div className="text-2xl font-bold">{hasHistoricalData ? "Enhanced" : "Standard"}</div>
    <div className="text-xs opacity-80">{hasHistoricalData ? `${historicalMetrics.yearsOfData} yrs data` : "Projection only"}</div>
  </div>
</div>

{/* AI-POWERED RISK NARRATIVE */}
<Card className="border-l-4 border-l-emerald-600 shadow-xl hover:shadow-2xl transition-all duration-300">
  <CardHeader className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border-b">
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-emerald-600" />
        <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          AI Credit Officer Analysis
        </span>
      </CardTitle>
      {/* Manual trigger button */}
      <button
        onClick={triggerAIAnalysis}
        disabled={isLoadingAI}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-md shadow hover:from-emerald-600 hover:to-teal-700 transition-all disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed"
      >
        {isLoadingAI ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Generate Credit Analysis</span>
          </>
        )}
      </button>
    </div>
  </CardHeader>
  
  <CardContent className="pt-6">
    {/* Quick Risk Indicators */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className={`p-4 rounded-lg border-2 shadow-sm ${
        worstCaseScenario?.riskLevel === "HIGH" 
          ? "bg-red-50 border-red-200" 
          : worstCaseScenario?.riskLevel === "ELEVATED"
          ? "bg-orange-50 border-orange-200"
          : worstCaseScenario?.riskLevel === "MODERATE"
          ? "bg-yellow-50 border-yellow-200"
          : "bg-emerald-50 border-emerald-200"
      }`}>
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Overall Risk Level</div>
        <div className={`text-xl font-bold ${
          worstCaseScenario?.riskLevel === "HIGH" ? "text-red-600" :
          worstCaseScenario?.riskLevel === "ELEVATED" ? "text-orange-600" :
          worstCaseScenario?.riskLevel === "MODERATE" ? "text-yellow-600" :
          "text-emerald-600"
        }`}>
          {worstCaseScenario?.riskLevel || "LOW"}
        </div>
        <div className="text-xs text-slate-600 mt-1">
          Risk Score: {worstCaseScenario?.riskScore || 0}/100
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 shadow-sm">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Min Liquidity</div>
        <div className="text-xl font-bold text-blue-600">
          {Math.min(...Object.values(stressTestResults).map(r => r.liquidityRunway))} mos
        </div>
        <div className="text-xs text-slate-600 mt-1">
          Worst case runway
        </div>
      </div>
      
      <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200 shadow-sm">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Covenant Cushion</div>
        <div className="text-xl font-bold text-purple-600">
          {worstCaseScenario ? numFmt(worstCaseScenario.dscrCushion) : "N/A"}
        </div>
        <div className="text-xs text-slate-600 mt-1">
          DSCR headroom
        </div>
      </div>
    </div>
    
    {/* AI Narrative */}
    <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-lg border-2 border-emerald-200 shadow-inner">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
        <div className="font-bold text-base text-slate-800">Senior Credit Officer Assessment</div>
      </div>
      
      {!aiNarrative && !isLoadingAI ? (
        <div className="text-center py-8 text-slate-600">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p className="font-semibold mb-2">AI Credit Analysis Available</p>
          <p className="text-sm">Click "Generate Credit Analysis" above to get a detailed lender-perspective assessment of default risk, collateral adequacy, and loan approval recommendation</p>
        </div>
      ) : isLoadingAI ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <span className="ml-3 text-slate-600">Analyzing loan structure and stress scenarios from lender's perspective...</span>
        </div>
      ) : (
        <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
          <AITextRenderer 
            content={aiNarrative}
            className="text-sm text-slate-700 leading-relaxed"
          />
        </div>
      )}
    </div>
  </CardContent>
</Card>

      {/* Scenario Selection */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Select Scenarios to Compare
            {hasHistoricalData && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full ml-2 font-semibold border border-emerald-200">
                Historical Data Integrated
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(DEBT_STRESS_SCENARIOS).map(([key, scenario]) => {
              const result = stressTestResults[key];
              const isSelected = selectedScenarios.includes(key);
              
              return (
                <button
                  key={key}
                  onClick={() => toggleScenario(key)}
                  className={`p-4 rounded-lg border-2 text-left transition-all duration-200 transform hover:scale-105 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-bold text-sm text-slate-800">{scenario.name}</div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed">{scenario.description}</div>
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 shadow-sm"
                      style={{ backgroundColor: result?.riskColor || COLORS.success.chart }}
                    />
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">DSCR:</span>
                      <span className="font-bold text-slate-800">{numFmt(result?.minDSCR || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Runway:</span>
                      <span className="font-bold text-slate-800">
                        {result?.liquidityRunway >= 36 ? "36+" : numFmt(result?.liquidityRunway || 0)} mos
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Covenant Compliance Table */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Covenant Compliance Stress Test
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-700">Scenario</th>
                  <th className="text-center p-3 font-semibold text-slate-700">Risk</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Min DSCR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">DSCR Cushion</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Max Leverage</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Min ICR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Liquidity</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Breaches</th>
                </tr>
              </thead>
              <tbody>
                {selectedScenarios.map((key) => {
                  const result = stressTestResults[key];
                  const isBase = key === 'base';
                  
                  return (
                    <tr 
                      key={key} 
                      className={`border-b border-slate-200 transition-all duration-150 ${
                        isBase ? 'bg-blue-50 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: result?.color || COLORS.success.chart }}
                          />
                          <div>
                            <div className="font-semibold text-slate-800">{result?.name}</div>
                            <div className="text-xs text-slate-500">{result?.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-3">
                        <div 
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border-2" 
                          style={{ 
                            backgroundColor: (result?.riskColor || COLORS.success.chart) + '15', 
                            color: result?.riskColor || COLORS.success.chart,
                            borderColor: (result?.riskColor || COLORS.success.chart) + '40'
                          }}
                        >
                          {result?.riskLevel === "LOW" && <CheckCircle className="w-3 h-3" />}
                          {(result?.riskLevel === "MODERATE" || result?.riskLevel === "ELEVATED") && <AlertTriangle className="w-3 h-3" />}
                          {result?.riskLevel === "HIGH" && <XCircle className="w-3 h-3" />}
                          {result?.riskLevel || "LOW"}
                        </div>
                      </td>
                      <td className={`text-right p-3 font-bold ${result?.minDSCR < params.minDSCR ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(result?.minDSCR || 0)}
                      </td>
                      <td className={`text-right p-3 font-semibold ${
                        result?.dscrCushion < 0 ? 'text-red-600' : 
                        result?.dscrCushion < 0.2 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {result?.dscrCushion >= 0 ? '+' : ''}{numFmt(result?.dscrCushion || 0)}
                      </td>
                      <td className={`text-right p-3 font-bold ${result?.maxLeverage > params.maxNDToEBITDA ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(result?.maxLeverage || 0)}x
                      </td>
                      <td className={`text-right p-3 font-bold ${result?.minICR < params.targetICR ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(result?.minICR || 0)}
                      </td>
                      <td className="text-right p-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-bold ${
                            result?.liquidityRunway < 3 ? 'text-red-600' : 
                            result?.liquidityRunway < 6 ? 'text-amber-600' : 
                            result?.liquidityRunway < 12 ? 'text-yellow-600' : 
                            'text-emerald-600'
                          }`}>
                            {result?.liquidityRunway >= 36 ? "36+" : numFmt(result?.liquidityRunway || 0)}
                          </span>
                          <div className="w-16 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-500 ${
                                result?.liquidityRunway > 12 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                result?.liquidityRunway > 6 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                'bg-gradient-to-r from-red-500 to-red-600'
                              }`}
                              style={{ width: `${Math.min(100, ((result?.liquidityRunway || 0) / 24) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`text-right p-3 font-bold ${result?.totalBreaches > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {result?.totalBreaches || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-sm mb-3 text-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Legend & Risk Factors
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-700">Low Risk - Strong cushion</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-700">Moderate - Adequate</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-slate-700">Elevated - Limited cushion</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-slate-700">High - Breach risk</span>
              </div>
            </div>
            {worstCaseScenario && worstCaseScenario.riskFactors && worstCaseScenario.riskFactors.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                <div className="font-semibold text-sm text-amber-900 mb-2">Key Risk Factors:</div>
                <ul className="text-xs text-amber-800 space-y-1">
                  {worstCaseScenario.riskFactors.map((factor, i) => (
                    <li key={i}>• {factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Summary & Recommendations */}
      <Card className="border-l-4 border-l-orange-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            Risk Summary & Action Items
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-base mb-3 text-slate-800 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Critical Findings
              </h4>
              <ul className="space-y-3">
                {breachCount > 0 && (
                  <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-red-700 font-bold">
                        {breachCount} scenarios result in covenant breaches
                      </strong>
                      <span className="text-red-600"> - Immediate attention required. Review capital structure.</span>
                    </span>
                  </li>
                )}
                {worstCaseScenario && worstCaseScenario.minDSCR < 1.0 && (
                  <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-red-700 font-bold">
                        Worst case ({worstCaseScenario.name}): DSCR {numFmt(worstCaseScenario.minDSCR)}
                      </strong>
                      <span className="text-red-600"> - Insufficient cash flow to service debt.</span>
                      {worstCaseScenario.failureReason && (
                        <div className="mt-2 text-xs text-red-700 font-mono bg-red-100 p-2 rounded">
                          {worstCaseScenario.failureReason}
                        </div>
                      )}
                    </span>
                  </li>
                )}
                {Object.values(stressTestResults).filter(r => r.liquidityRunway < 6).length > 0 && (
                  <li className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-amber-700 font-bold">
                        {Object.values(stressTestResults).filter(r => r.liquidityRunway < 6).length} scenarios show &lt;6 months liquidity
                      </strong>
                      <span className="text-amber-600"> - Cash conservation measures needed immediately.</span>
                    </span>
                  </li>
                )}
                {hasHistoricalData && (
                  <li className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-emerald-700 font-bold">
                        Analysis enhanced with {historicalMetrics.yearsOfData} years of historical data
                      </strong>
                      <span className="text-emerald-600"> - Projections are more accurate than industry averages.</span>
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-base mb-3 text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Recommended Actions
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-semibold text-sm text-blue-900 mb-2">Capital Structure</div>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Increase equity contribution by 15-20%</li>
                    <li>• Negotiate covenant step-downs</li>
                    <li>• Consider covenant-lite structures</li>
                  </ul>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="font-semibold text-sm text-emerald-900 mb-2">Liquidity Management</div>
                  <ul className="text-xs text-emerald-800 space-y-1">
                    <li>• Build 6-12 month cash reserves</li>
                    <li>• Establish revolving credit facility</li>
                    <li>• Monitor working capital weekly</li>
                  </ul>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-semibold text-sm text-purple-900 mb-2">Operational Improvements</div>
                  <ul className="text-xs text-purple-800 space-y-1">
                    <li>• Target 2-3% EBITDA margin increase</li>
                    <li>• Implement cost reduction programs</li>
                    <li>• Optimize pricing strategies</li>
                  </ul>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="font-semibold text-sm text-amber-900 mb-2">Risk Mitigation</div>
                  <ul className="text-xs text-amber-800 space-y-1">
                    <li>• Interest rate hedging for floating exposure</li>
                    <li>• Develop contingency plans</li>
                    <li>• Quarterly stress testing reviews</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
