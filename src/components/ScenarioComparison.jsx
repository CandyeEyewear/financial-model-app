import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { ChartWrapper } from "./ChartWrapper";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { 
  BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, 
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, Cell,
  Area, AreaChart, ComposedChart
} from "recharts";
import { 
  AlertTriangle, TrendingUp, TrendingDown, Shield, Zap, DollarSign, 
  CheckCircle, XCircle, Info, AlertCircle, BarChart3
} from "lucide-react";

// ============================================================================
// CONSTANTS & COLOR PALETTE
// ============================================================================

const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#2563eb' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10b981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#f59e0b' },
  danger: { from: 'red-500', to: 'red-600', chart: '#ef4444' },
  info: { from: 'indigo-500', to: 'indigo-600', chart: '#6366f1' },
  purple: { from: 'purple-500', to: 'purple-600', chart: '#a855f7' },
};

const PRESETS = {
  base: { 
    label: "Base Case",
    description: "Normal operating conditions with expected growth rates and stable margins",
    color: COLORS.success.chart
  },
  mild: { 
    label: "Mild Recession", 
    description: "5-10% revenue decline, moderate margin compression, reduced capex",
    color: COLORS.warning.chart
  },
  severe: { 
    label: "Severe Recession",
    description: "15-25% revenue decline, significant margin erosion, covenant pressure",
    color: COLORS.danger.chart
  },
  costShock: { 
    label: "Cost Inflation",
    description: "Input costs rise 15-20% with limited pricing power, compressing margins",
    color: COLORS.purple.chart
  },
  rateHike: { 
    label: "Rate Shock",
    description: "Interest rates increase 200-300bps, elevating debt service burden",
    color: '#ec4899'
  },
  custom: { 
    label: "Custom Scenario",
    description: "User-defined stress scenario",
    color: '#6b7280'
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if projection has meaningful debt
 */
function hasDebt(projection) {
  if (!projection || !projection.rows || projection.rows.length === 0) return false;
  
  // Check if any year has debt balance > 0
  const hasPositiveDebt = projection.rows.some(row => 
    (row.grossDebt || 0) > 0 || 
    (row.debtBalance || 0) > 0 ||
    (row.endingBalance || 0) > 0
  );
  
  // Check if total debt repaid or interest paid > 0
  const hasDebtActivity = (projection.totalDebtRepaid || 0) > 0 || 
                          (projection.totalInterestPaid || 0) > 0;
  
  return hasPositiveDebt || hasDebtActivity;
}

/**
 * Get total opening debt from params (handles multi-tranche)
 */
function getTotalOpeningDebt(params) {
  if (!params) return 0;
  
  // Multi-tranche case
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    return params.debtTranches.reduce((sum, tranche) => sum + (tranche.amount || 0), 0);
  }
  
  // Single debt case - combine opening debt + new facility
  const openingDebt = params.openingDebt || 0;
  const newFacility = params.requestedLoanAmount || 0;
  
  return openingDebt + newFacility;
}

/**
 * Calculate cash flow volatility (coefficient of variation)
 */
function calculateCashFlowVolatility(cashFlows) {
  if (!cashFlows || cashFlows.length < 2) return 0;
  
  const mean = cashFlows.reduce((sum, val) => sum + val, 0) / cashFlows.length;
  if (mean === 0) return 0;
  
  const variance = cashFlows.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cashFlows.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev / Math.abs(mean); // Coefficient of variation
}

/**
 * Calculate debt service capacity (aggregate EBITDA / aggregate debt service)
 */
function calculateDebtServiceCapacity(projection) {
  if (!projection.rows || projection.rows.length === 0) return 0;
  
  const totalEBITDA = projection.rows.reduce((sum, row) => sum + (row.ebitda || 0), 0);
  const totalDebtService = projection.rows.reduce((sum, row) => sum + (row.debtService || 0), 0);
  
  if (totalDebtService === 0) return Infinity;
  return totalEBITDA / totalDebtService;
}

/**
 * Calculate resilience score (0-100) based on multiple factors
 */
function calculateResilienceScore(metrics) {
  let score = 100;
  
  // DSCR component (35% weight) - Most important for debt service
  const dscrScore = metrics.minDSCR >= 2.0 ? 35 : 
                   metrics.minDSCR >= 1.5 ? 28 :
                   metrics.minDSCR >= 1.2 ? 20 : 
                   metrics.minDSCR >= 1.0 ? 12 : 5;
  score = score - 35 + dscrScore;
  
  // Leverage component (25% weight)
  const leverageScore = metrics.maxLeverage <= 2.5 ? 25 :
                       metrics.maxLeverage <= 3.5 ? 20 :
                       metrics.maxLeverage <= 4.5 ? 15 :
                       metrics.maxLeverage <= 6.0 ? 10 : 5;
  score = score - 25 + leverageScore;
  
  // Covenant breach component (20% weight)
  const breachScore = metrics.breaches === 0 ? 20 :
                     metrics.breaches === 1 ? 14 :
                     metrics.breaches === 2 ? 8 : 3;
  score = score - 20 + breachScore;
  
  // Cash flow volatility component (10% weight)
  const volScore = metrics.cashFlowVolatility < 0.15 ? 10 :
                  metrics.cashFlowVolatility < 0.30 ? 7 :
                  metrics.cashFlowVolatility < 0.50 ? 4 : 2;
  score = score - 10 + volScore;
  
  // ICR component (10% weight)
  const icrScore = metrics.minICR >= 3.0 ? 10 :
                  metrics.minICR >= 2.5 ? 8 :
                  metrics.minICR >= 2.0 ? 6 :
                  metrics.minICR >= 1.5 ? 4 : 2;
  score = score - 10 + icrScore;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate scenario-specific insights for lending decision
 */
function generateScenarioInsight(data) {
  const { 
    scenarioKey, minDSCR, maxLeverage, breaches, resilienceScore, 
    minICR, cashFlowVolatility, params 
  } = data;
  
  const minDSCRThreshold = params.minDSCR || 1.25;
  const maxLeverageThreshold = params.maxNDToEBITDA || 4.0;
  const minICRThreshold = params.targetICR || 2.0;

  // Calculate buffer/cushion
  const dscrBuffer = minDSCR - minDSCRThreshold;
  const leverageBuffer = maxLeverageThreshold - maxLeverage;
  const icrBuffer = minICR - minICRThreshold;

  switch(scenarioKey) {
    case 'base':
      if (dscrBuffer >= 0.5 && leverageBuffer >= 1.0 && breaches === 0) {
        return {
          summary: "Strong credit profile with substantial covenant cushion",
          recommendation: "APPROVE - Structure provides excellent downside protection with significant stress absorption capacity",
          riskLevel: "LOW",
          creditRating: "Investment Grade",
          detailedAnalysis: `DSCR buffer of ${dscrBuffer.toFixed(2)}x and leverage ${leverageBuffer.toFixed(2)}x below threshold indicates robust debt service capacity. Cash flow volatility of ${(cashFlowVolatility * 100).toFixed(1)}% suggests stable operations.`
        };
      } else if (dscrBuffer >= 0.2 && breaches === 0) {
        return {
          summary: "Adequate performance with moderate covenant buffer",
          recommendation: "APPROVE WITH CONDITIONS - Implement enhanced monitoring and maintain covenant compliance reporting",
          riskLevel: "MEDIUM",
          creditRating: "Non-Investment Grade",
          detailedAnalysis: `Limited DSCR buffer of ${dscrBuffer.toFixed(2)}x requires active monitoring. Consider financial covenants with quarterly testing and sweep provisions.`
        };
      } else {
        return {
          summary: "Tight covenant structure with minimal stress tolerance",
          recommendation: "RESTRUCTURE REQUIRED - Reduce leverage or increase equity before proceeding",
          riskLevel: "HIGH",
          creditRating: "Substandard",
          detailedAnalysis: `Insufficient covenant cushion. Current structure leaves no room for operational variance. Recommend 25-30% equity injection or 20% debt reduction.`
        };
      }
      
    case 'mild':
      if (minDSCR >= minDSCRThreshold && breaches === 0) {
        return {
          summary: "Resilient to economic downturn - covenant compliance maintained",
          recommendation: "Structure withstands typical recession scenarios without requiring modifications",
          riskLevel: "LOW",
          creditRating: "Investment Grade",
          detailedAnalysis: `Maintains ${minDSCR.toFixed(2)}x DSCR under stress. ${leverageBuffer >= 0 ? 'Leverage remains within policy' : 'Leverage approaches limits but manageable'}. No waiver risk.`
        };
      } else if (minDSCR >= minDSCRThreshold * 0.9) {
        return {
          summary: "Moderate stress triggers technical covenant concerns",
          recommendation: "Require covenant amendment package and enhanced financial reporting",
          riskLevel: "MEDIUM",
          creditRating: "Non-Investment Grade",
          detailedAnalysis: `DSCR drops to ${minDSCR.toFixed(2)}x (${((1 - minDSCR/minDSCRThreshold) * 100).toFixed(1)}% below threshold). ${breaches} period(s) of non-compliance require waiver contingency.`
        };
      } else {
        return {
          summary: "Insufficient capacity to absorb moderate stress",
          recommendation: "DECLINE - Structure fails under normal market stress conditions",
          riskLevel: "HIGH",
          creditRating: "Doubtful",
          detailedAnalysis: `Critical DSCR deterioration to ${minDSCR.toFixed(2)}x. Multiple covenant breaches (${breaches} years) indicate fundamental structural weakness.`
        };
      }
      
    case 'severe':
      if (minDSCR >= minDSCRThreshold * 0.85 && breaches <= 2) {
        return {
          summary: "Survives severe stress with manageable breaches",
          recommendation: "Structure resilient but requires comprehensive amendment/waiver framework",
          riskLevel: "MEDIUM-HIGH",
          creditRating: "Non-Investment Grade",
          detailedAnalysis: `DSCR of ${minDSCR.toFixed(2)}x under extreme stress. ${breaches} covenant breach(es) expected. Establish pre-negotiated waiver terms and increased reporting requirements.`
        };
      } else {
        return {
          summary: "Severe stress exposes fundamental viability concerns",
          recommendation: "RESTRUCTURE REQUIRED - Current structure unsuitable for stressed environment",
          riskLevel: "CRITICAL",
          creditRating: "Loss",
          detailedAnalysis: `DSCR collapse to ${minDSCR.toFixed(2)}x (${((minDSCRThreshold - minDSCR) / minDSCRThreshold * 100).toFixed(0)}% below threshold). ${breaches} breach years. Recommend 40-50% debt reduction or PIK structure.`
        };
      }
      
    case 'rateHike':
      const rateShockCapacity = minDSCR >= minDSCRThreshold + 0.3;
      const interestCoverage = minICR >= minICRThreshold;
      
      if (rateShockCapacity && interestCoverage) {
        return {
          summary: "Strong capacity to absorb interest rate increases",
          recommendation: "Fixed rate hedging provides adequate protection. No structural changes required.",
          riskLevel: "LOW",
          creditRating: "Investment Grade",
          detailedAnalysis: `ICR of ${minICR.toFixed(2)}x provides ${icrBuffer.toFixed(2)}x buffer. Rate shock absorbed with DSCR remaining at ${minDSCR.toFixed(2)}x.`
        };
      } else if (minDSCR >= minDSCRThreshold * 0.95) {
        return {
          summary: "Vulnerable to interest rate movements",
          recommendation: "Implement interest rate caps or fixed rate conversion. Monitor Fed policy closely.",
          riskLevel: "MEDIUM",
          creditRating: "Non-Investment Grade",
          detailedAnalysis: `Limited ICR buffer of ${icrBuffer.toFixed(2)}x. 200-300bps rate increase reduces DSCR to ${minDSCR.toFixed(2)}x. Recommend 5-year swap or cap at current +150bps.`
        };
      } else {
        return {
          summary: "High refinancing risk in rising rate environment",
          recommendation: "DECLINE floating rate structure. Require fixed rate or significantly reduced leverage.",
          riskLevel: "HIGH",
          creditRating: "Substandard",
          detailedAnalysis: `Insufficient interest coverage (${minICR.toFixed(2)}x vs ${minICRThreshold.toFixed(2)}x required). Rate shock causes ${breaches} covenant breach(es). Unsuitable for floating rate financing.`
        };
      }
      
    case 'costShock':
      const marginResilience = minDSCR >= minDSCRThreshold;
      
      if (marginResilience && breaches === 0) {
        return {
          summary: "Margin compression absorbed through operational efficiency",
          recommendation: "Pricing power and cost controls sufficient. Monitor gross margin trends quarterly.",
          riskLevel: "LOW-MEDIUM",
          creditRating: "Investment Grade",
          detailedAnalysis: `Maintains ${minDSCR.toFixed(2)}x DSCR despite cost pressures. Leverage increases to ${maxLeverage.toFixed(2)}x but remains ${leverageBuffer >= 0 ? 'within policy' : 'manageable'}.`
        };
      } else {
        return {
          summary: "Cost inflation threatens debt service capacity",
          recommendation: "Require cost pass-through mechanisms, supplier contracts, or efficiency programs before approval",
          riskLevel: "MEDIUM-HIGH",
          creditRating: "Non-Investment Grade",
          detailedAnalysis: `Cost shock compresses margins causing DSCR drop to ${minDSCR.toFixed(2)}x. ${breaches} breach(es) expected. Implement EBITDA floor covenant or equity cure provisions.`
        };
      }
      
    default:
      return {
        summary: "Custom scenario requires detailed review",
        recommendation: "Analyze specific stress drivers and mitigants with credit committee",
        riskLevel: "UNKNOWN",
        creditRating: "Under Review",
        detailedAnalysis: `Min DSCR: ${minDSCR.toFixed(2)}x, Max Leverage: ${maxLeverage.toFixed(2)}x, Breaches: ${breaches}. Custom stress parameters require individual assessment.`
      };
  }
}

/**
 * Calculate balloon payment metrics
 */
function calculateBalloonMetrics(projection, facilityParams) {
  if (!facilityParams || !projection) return null;
  
  const balloonPercentage = facilityParams.balloonPercentage || 0;
  const useBalloon = facilityParams.useBalloonPayment || balloonPercentage > 0;
  
  if (!useBalloon) return null;
  
  const principalAmount = getTotalOpeningDebt(facilityParams);
  const balloonAmount = principalAmount * (balloonPercentage / 100);
  
  // Get cash at maturity
  const finalYear = projection.rows?.[projection.rows.length - 1];
  const cashAtMaturity = finalYear?.cash || 0;
  
  // Calculate coverage
  const balloonCoverage = balloonAmount > 0 ? cashAtMaturity / balloonAmount : Infinity;
  
  // Determine refinancing risk
  let refinancingRisk = 'None';
  let riskColor = COLORS.success.chart;
  
  if (balloonAmount > 0) {
    if (balloonCoverage < 0.8) {
      refinancingRisk = 'Critical';
      riskColor = COLORS.danger.chart;
    } else if (balloonCoverage < 1.0) {
      refinancingRisk = 'High';
      riskColor = COLORS.danger.chart;
    } else if (balloonCoverage < 1.5) {
      refinancingRisk = 'Medium';
      riskColor = COLORS.warning.chart;
    } else {
      refinancingRisk = 'Low';
      riskColor = COLORS.success.chart;
    }
  }
  
  return {
    hasBalloon: true,
    balloonAmount,
    balloonPercentage,
    cashAtMaturity,
    balloonCoverage,
    refinancingRisk,
    riskColor,
    maturityYear: projection.rows?.length || 0
  };
}

// ============================================================================
// ENHANCED METRICS CALCULATOR
// ============================================================================

function calculateEnhancedMetrics(facilityParams, projection, scenarioKey) {
  // If no debt, return minimal data structure
  if (!hasDebt(projection)) {
    return {
      scenario: PRESETS[scenarioKey]?.label || scenarioKey,
      hasDebt: false,
      enterpriseValue: (projection.enterpriseValue || 0) / 1_000_000,
      equityValue: (projection.equityValue || 0) / 1_000_000,
      equityMOIC: projection.moic || 0,
      irr: projection.irr || 0,
      scenarioColor: PRESETS[scenarioKey]?.color || "#6B7280",
      resilienceScore: 0,
      scenarioInsight: {
        summary: "No debt structure - equity-only investment",
        recommendation: "Pure equity returns analysis - no debt service considerations",
        riskLevel: "N/A",
        creditRating: "N/A",
        detailedAnalysis: "No leverage employed. Returns driven solely by operational performance and exit valuation."
      }
    };
  }
  
  // Extract metrics safely
  const rows = projection.rows || [];
  const creditStats = projection.creditStats || {};
  const breaches = projection.breaches || {};
  
  // Core credit metrics
  const minDSCR = creditStats.minDSCR || 
    (rows.length > 0 ? Math.min(...rows.map(r => r.dscr || Infinity).filter(v => isFinite(v))) : 0);
  
  const minICR = creditStats.minICR || 
    (rows.length > 0 ? Math.min(...rows.map(r => r.icr || Infinity).filter(v => isFinite(v))) : 0);
  
  const maxLeverage = creditStats.maxLeverage || 
    (rows.length > 0 ? Math.max(...rows.map(r => r.ndToEbitda || 0)) : 0);
  
  const avgDSCR = creditStats.avgDSCR ||
    (rows.length > 0 ? rows.reduce((sum, r) => sum + (r.dscr || 0), 0) / rows.length : 0);
  
  // Covenant breaches
  const totalBreaches = (breaches.dscrBreaches || 0) + 
                       (breaches.icrBreaches || 0) + 
                       (breaches.ndBreaches || 0);
  
  // Cash flow metrics
  const annualCashFlow = rows.map(r => r.fcf || 0);
  const cashFlowVolatility = calculateCashFlowVolatility(annualCashFlow);
  const debtServiceCapacity = calculateDebtServiceCapacity(projection);
  
  // Balloon payment analysis
  const balloonMetrics = calculateBalloonMetrics(projection, facilityParams);
  
  // Calculate resilience score
  const resilienceScore = calculateResilienceScore({
    minDSCR,
    minICR,
    maxLeverage,
    breaches: totalBreaches,
    cashFlowVolatility,
    debtServiceCapacity
  });
  
  // Generate insights
  const scenarioInsight = generateScenarioInsight({
    scenarioKey,
    minDSCR,
    minICR,
    maxLeverage,
    breaches: totalBreaches,
    resilienceScore,
    cashFlowVolatility,
    params: facilityParams
  });
  
  // Debt service metrics
  const totalDebtRepaid = projection.totalDebtRepaid || 0;
  const totalInterestPaid = projection.totalInterestPaid || 0;
  const totalDebtService = totalDebtRepaid + totalInterestPaid;
  
  // Multi-tranche info
  const multiTrancheInfo = projection.multiTrancheInfo || null;
  
  return {
    // Identification
    scenario: PRESETS[scenarioKey]?.label || scenarioKey,
    hasDebt: true,
    
    // Valuation metrics
    enterpriseValue: (projection.enterpriseValue || 0) / 1_000_000,
    equityValue: (projection.equityValue || 0) / 1_000_000,
    equityMOIC: projection.moic || 0,
    irr: projection.irr || 0,
    
    // Core credit metrics
    minDSCR,
    avgDSCR,
    minICR,
    maxLeverage,
    breaches: totalBreaches,
    
    // Covenant breach details
    dscrBreaches: breaches.dscrBreaches || 0,
    icrBreaches: breaches.icrBreaches || 0,
    leverageBreaches: breaches.ndBreaches || 0,
    
    // Cash flow analysis
    cashFlowVolatility,
    debtServiceCapacity,
    annualCashFlow,
    
    // Debt service totals
    totalDebtRepaid,
    totalInterestPaid,
    totalDebtService,
    
    // Balloon metrics (if applicable)
    ...balloonMetrics,
    
    // Multi-tranche info
    multiTrancheInfo,
    hasTranches: !!multiTrancheInfo,
    
    // Advanced metrics
    resilienceScore,
    scenarioInsight,
    
    // Visual properties
    scenarioColor: PRESETS[scenarioKey]?.color || "#6B7280",
    
    // Additional useful metrics
    finalDebt: projection.finalDebt || 0,
    finalCash: projection.finalCash || 0,
    finalNetDebt: projection.finalNetDebt || 0
  };
}

// ============================================================================
// CHART COMPONENTS
// ============================================================================

function CustomTooltip({ active, payload, label, ccy }) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="rounded-lg border bg-white p-3 text-xs shadow-lg">
      <div className="font-semibold mb-2 text-slate-800">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold" style={{ color: entry.color }}>
              {typeof entry.value === 'number' ? 
                (entry.name.includes('$') || entry.name.includes('Value') || entry.name.includes('Cash') ?
                  currencyFmtMM(entry.value * 1_000_000, ccy) :
                  entry.value.toFixed(2)) :
                entry.value
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ScenarioComparison({ projections, ccy, facilityParams }) {
  const [selectedScenario, setSelectedScenario] = useState('base');
  const scenarios = Object.keys(projections);

  // Calculate enhanced metrics for all scenarios
  const enhancedData = useMemo(() => {
    return scenarios.map(scenario => 
      calculateEnhancedMetrics(facilityParams, projections[scenario], scenario)
    );
  }, [projections, facilityParams, scenarios]);

  // Check if ANY scenario has debt
  const hasAnyDebt = enhancedData.some(d => d.hasDebt);
  
  // Get selected scenario data
  const selectedScenarioData = enhancedData.find(
    d => d.scenario === PRESETS[selectedScenario]?.label
  ) || enhancedData[0];

  // Prepare cash flow timeline data (only if debt exists)
  const cashFlowTimelineData = useMemo(() => {
    if (!selectedScenarioData.hasDebt || !selectedScenarioData.annualCashFlow) return [];
    
    return selectedScenarioData.annualCashFlow.map((cashFlow, index) => {
      const year = index + 1;
      const isBalloonYear = selectedScenarioData.hasBalloon && 
                           year === selectedScenarioData.maturityYear;
      
      return {
        year,
        cashFlow: cashFlow / 1_000_000,
        isBalloonYear,
        balloonAmount: isBalloonYear ? (selectedScenarioData.balloonAmount || 0) / 1_000_000 : 0,
      };
    });
  }, [selectedScenarioData]);

  // Risk-return scatter data
  const riskReturnData = useMemo(() => {
    return enhancedData.map(item => ({
      scenario: item.scenario,
      return: item.irr * 100,
      risk: item.hasDebt ? (100 - item.resilienceScore) : 0,
      size: item.equityValue,
      color: item.scenarioColor,
      moic: item.equityMOIC,
      hasDebt: item.hasDebt
    }));
  }, [enhancedData]);

  // Risk badge color helper
  const getRiskBadgeColor = (riskLevel) => {
    switch(riskLevel) {
      case 'LOW': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'LOW-MEDIUM': return 'bg-green-100 text-green-800 border-green-300';
      case 'MEDIUM': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'MEDIUM-HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      case 'CRITICAL': return 'bg-red-200 text-red-900 border-red-400';
      case 'N/A': return 'bg-slate-100 text-slate-600 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // If no debt in any scenario, show simplified view
  if (!hasAnyDebt) {
    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-l-blue-600 shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Info className="w-6 h-6 text-blue-600" />
              Equity-Only Investment Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
              <AlertCircle className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg text-blue-900 mb-2">No Debt Structure Detected</h3>
                <p className="text-blue-800 mb-3">
                  This analysis is for an equity-only investment with no leverage. Credit metrics, 
                  covenant analysis, and debt service calculations are not applicable.
                </p>
                <p className="text-sm text-blue-700">
                  Returns are driven purely by operational performance and exit valuation multiples. 
                  To analyze leveraged scenarios, add opening debt or new facility details in the 
                  Financial Parameters section.
                </p>
              </div>
            </div>

            {/* Equity-only valuation summary */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {enhancedData.map((scenario) => (
                <div key={scenario.scenario} className="p-5 bg-white rounded-lg border-2 border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                  <h4 className="font-bold text-sm text-slate-800 mb-3">{scenario.scenario}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Enterprise Value</span>
                      <span className="font-bold text-slate-900">{currencyFmtMM(scenario.enterpriseValue * 1_000_000, ccy)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">IRR</span>
                      <span className="font-bold text-emerald-600">{pctFmt(scenario.irr)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">MOIC</span>
                      <span className="font-bold text-blue-600">{numFmt(scenario.equityMOIC)}x</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full debt analysis view
  return (
    <div className="space-y-6">
      {/* Risk-Return Dashboard */}
      <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            Credit Risk-Return Profile
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Comprehensive stress testing across multiple scenarios with credit assessment
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk-Return Scatter */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">Risk vs Return Analysis</h4>
              <ChartWrapper data={riskReturnData} height={320} ariaLabel="Risk-return analysis">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      dataKey="risk" 
                      name="Credit Risk" 
                      domain={[0, 100]}
                      label={{ value: 'Credit Risk Score (100 - Resilience)', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="return" 
                      name="Equity IRR %" 
                      label={{ value: 'Equity IRR (%)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip ccy={ccy} />} />
                    <Scatter name="Scenarios" data={riskReturnData} fill="#8884d8">
                      {riskReturnData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartWrapper>
              <p className="text-xs text-slate-600 mt-2 italic">
                Lower risk score and higher IRR indicate optimal risk-return profile for lending
              </p>
            </div>

            {/* Resilience Scores */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">Credit Resilience Scores</h4>
              <div className="space-y-3">
                {enhancedData.filter(d => d.hasDebt).map((scenario) => (
                  <div 
                    key={scenario.scenario} 
                    className={`p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                      selectedScenarioData.scenario === scenario.scenario 
                        ? 'border-blue-400 bg-blue-50 shadow-sm' 
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                    onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === scenario.scenario) || 'base')}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm text-slate-800">{scenario.scenario}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${getRiskBadgeColor(scenario.scenarioInsight.riskLevel)}`}>
                          {scenario.scenarioInsight.riskLevel}
                        </span>
                        <span className={`font-bold text-lg ${
                          scenario.resilienceScore >= 75 ? 'text-emerald-600' :
                          scenario.resilienceScore >= 60 ? 'text-green-600' :
                          scenario.resilienceScore >= 45 ? 'text-amber-600' : 
                          scenario.resilienceScore >= 30 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {scenario.resilienceScore}/100
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          scenario.resilienceScore >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                          scenario.resilienceScore >= 60 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                          scenario.resilienceScore >= 45 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                          scenario.resilienceScore >= 30 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                          'bg-gradient-to-r from-red-500 to-red-600'
                        }`}
                        style={{ width: `${scenario.resilienceScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{scenario.scenarioInsight.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Credit Analysis */}
      <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Scenario Credit Assessment & Recommendations
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Professional lending analysis with actionable recommendations for each scenario
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {enhancedData.filter(d => d.hasDebt).map((scenario) => (
              <div 
                key={scenario.scenario}
                className={`p-5 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${
                  selectedScenarioData.scenario === scenario.scenario 
                    ? 'ring-2 ring-blue-500 border-blue-300 shadow-md' 
                    : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                }`}
                onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === scenario.scenario) || 'base')}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-base text-slate-800">{scenario.scenario}</h4>
                    <p className="text-xs text-slate-600 mt-1">{PRESETS[scenarios.find(s => PRESETS[s]?.label === scenario.scenario)]?.description}</p>
                  </div>
                  {scenario.scenarioInsight.riskLevel === 'LOW' && <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />}
                  {(scenario.scenarioInsight.riskLevel === 'MEDIUM' || scenario.scenarioInsight.riskLevel === 'LOW-MEDIUM') && 
                    <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />}
                  {(scenario.scenarioInsight.riskLevel === 'HIGH' || scenario.scenarioInsight.riskLevel === 'MEDIUM-HIGH') && 
                    <XCircle className="w-6 h-6 text-orange-600 flex-shrink-0" />}
                  {scenario.scenarioInsight.riskLevel === 'CRITICAL' && 
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />}
                </div>

                {/* Credit Rating & Risk Level */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                    getRiskBadgeColor(scenario.scenarioInsight.riskLevel)
                  }`}>
                    {scenario.scenarioInsight.riskLevel} RISK
                  </div>
                  <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
                    {scenario.scenarioInsight.creditRating}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-slate-200">
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="text-xs text-slate-600">Min DSCR</div>
                    <div className={`text-lg font-bold ${
                      scenario.minDSCR >= 1.5 ? 'text-emerald-600' :
                      scenario.minDSCR >= 1.2 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(scenario.minDSCR)}x
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="text-xs text-slate-600">Max Lev</div>
                    <div className={`text-lg font-bold ${
                      scenario.maxLeverage <= 3.5 ? 'text-emerald-600' :
                      scenario.maxLeverage <= 5.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(scenario.maxLeverage)}x
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="text-xs text-slate-600">Breaches</div>
                    <div className={`text-lg font-bold ${
                      scenario.breaches === 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {scenario.breaches}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded">
                    <div className="text-xs text-slate-600">Min ICR</div>
                    <div className={`text-lg font-bold ${
                      scenario.minICR >= 2.5 ? 'text-emerald-600' :
                      scenario.minICR >= 2.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(scenario.minICR)}x
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                  <strong>Assessment:</strong> {scenario.scenarioInsight.summary}
                </p>

                {/* Recommendation */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-900 mb-1">RECOMMENDATION</p>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        {scenario.scenarioInsight.recommendation}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis (expandable) */}
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-semibold">
                    View Detailed Analysis
                  </summary>
                  <p className="mt-2 p-3 bg-slate-50 rounded text-slate-700 leading-relaxed">
                    {scenario.scenarioInsight.detailedAnalysis}
                  </p>
                </details>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Scenario Deep Dive */}
      <Card className="border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Detailed Analysis: {selectedScenarioData.scenario}
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            In-depth credit metrics and financial performance analysis
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Valuation Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4" />
                Valuation Metrics
              </h4>
              <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md text-white">
                <div className="text-xs opacity-90 mb-1">Enterprise Value</div>
                <div className="text-xl font-bold">{currencyFmtMM(selectedScenarioData.enterpriseValue * 1_000_000, ccy)}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md text-white">
                <div className="text-xs opacity-90 mb-1">Equity Value</div>
                <div className="text-xl font-bold">{currencyFmtMM(selectedScenarioData.equityValue * 1_000_000, ccy)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md text-white">
                  <div className="text-xs opacity-90 mb-1">IRR</div>
                  <div className="text-lg font-bold">{pctFmt(selectedScenarioData.irr)}</div>
                </div>
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-md text-white">
                  <div className="text-xs opacity-90 mb-1">MOIC</div>
                  <div className="text-lg font-bold">{numFmt(selectedScenarioData.equityMOIC)}x</div>
                </div>
              </div>
            </div>

            {/* Credit Metrics */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Credit Metrics
              </h4>
              <div className={`p-4 rounded-lg shadow-md text-white ${
                selectedScenarioData.minDSCR >= 1.5 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                selectedScenarioData.minDSCR >= 1.2 ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 
                'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <div className="text-xs opacity-90 mb-1">Minimum DSCR</div>
                <div className="text-xl font-bold">{numFmt(selectedScenarioData.minDSCR)}x</div>
                <div className="text-xs opacity-80 mt-1">
                  {selectedScenarioData.minDSCR >= facilityParams.minDSCR ? '✓ Above covenant' : '✗ Below covenant'}
                </div>
              </div>
              <div className={`p-4 rounded-lg shadow-md text-white ${
                selectedScenarioData.minICR >= 2.5 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                selectedScenarioData.minICR >= 2.0 ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <div className="text-xs opacity-90 mb-1">Minimum ICR</div>
                <div className="text-xl font-bold">{numFmt(selectedScenarioData.minICR)}x</div>
                <div className="text-xs opacity-80 mt-1">
                  {selectedScenarioData.minICR >= (facilityParams.targetICR || 2.0) ? '✓ Above target' : '✗ Below target'}
                </div>
              </div>
              <div className={`p-4 rounded-lg shadow-md text-white ${
                selectedScenarioData.maxLeverage <= 3.5 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                selectedScenarioData.maxLeverage <= 5.0 ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 
                'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                <div className="text-xs opacity-90 mb-1">Maximum Leverage</div>
                <div className="text-xl font-bold">{numFmt(selectedScenarioData.maxLeverage)}x</div>
                <div className="text-xs opacity-80 mt-1">
                  {selectedScenarioData.maxLeverage <= (facilityParams.maxNDToEBITDA || 4.0) ? '✓ Within limit' : '✗ Exceeds limit'}
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Risk Assessment
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700 font-medium">Covenant Breaches</span>
                  <span className={`font-bold text-lg px-3 py-1 rounded ${
                    selectedScenarioData.breaches === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedScenarioData.breaches}
                  </span>
                </div>
                
                {selectedScenarioData.breaches > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs">
                    <div className="font-semibold text-red-900 mb-1">Breach Details:</div>
                    <ul className="space-y-1 text-red-800">
                      {selectedScenarioData.dscrBreaches > 0 && (
                        <li>• DSCR breaches: {selectedScenarioData.dscrBreaches} year(s)</li>
                      )}
                      {selectedScenarioData.icrBreaches > 0 && (
                        <li>• ICR breaches: {selectedScenarioData.icrBreaches} year(s)</li>
                      )}
                      {selectedScenarioData.leverageBreaches > 0 && (
                        <li>• Leverage breaches: {selectedScenarioData.leverageBreaches} year(s)</li>
                      )}
                    </ul>
                  </div>
                )}
                
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700 font-medium">Cash Flow Volatility</span>
                  <span className={`font-bold text-lg ${
                    selectedScenarioData.cashFlowVolatility < 0.2 ? 'text-emerald-600' :
                    selectedScenarioData.cashFlowVolatility < 0.4 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {pctFmt(selectedScenarioData.cashFlowVolatility)}
                  </span>
                </div>
                
                {selectedScenarioData.hasBalloon && (
                  <>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm text-slate-700 font-medium">Balloon Payment</span>
                      <span className="font-bold text-lg text-purple-600">
                        {currencyFmtMM(selectedScenarioData.balloonAmount, ccy)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm text-slate-700 font-medium">Balloon Coverage</span>
                      <span className={`font-bold text-lg ${
                        selectedScenarioData.balloonCoverage >= 1.5 ? 'text-emerald-600' :
                        selectedScenarioData.balloonCoverage >= 1.0 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {numFmt(selectedScenarioData.balloonCoverage)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-sm text-slate-700 font-medium">Refinancing Risk</span>
                      <span className="font-bold text-lg" style={{ color: selectedScenarioData.riskColor }}>
                        {selectedScenarioData.refinancingRisk}
                      </span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700 font-medium">Avg DSCR</span>
                  <span className="font-bold text-lg text-blue-600">
                    {numFmt(selectedScenarioData.avgDSCR)}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Tranche Info (if applicable) */}
          {selectedScenarioData.hasTranches && selectedScenarioData.multiTrancheInfo && (
            <div className="mt-6 p-5 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h4 className="font-bold text-base text-purple-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Multi-Tranche Debt Structure
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                  <div className="text-xs text-purple-700 mb-1">Total Tranches</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900">{selectedScenarioData.multiTrancheInfo.totalTranches}</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                  <div className="text-xs text-purple-700 mb-1">Total Debt</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900">
                    {currencyFmtMM(selectedScenarioData.multiTrancheInfo.totalDebt, ccy)}
                  </div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg border border-purple-200">
                  <div className="text-xs text-purple-700 mb-1">Blended Rate</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900">
                    {pctFmt(selectedScenarioData.multiTrancheInfo.blendedRate)}
                  </div>
                </div>
              </div>
              
              {/* Individual tranches */}
              <div className="mt-4 space-y-2">
                <h5 className="text-sm font-semibold text-purple-900">Tranche Details:</h5>
                {selectedScenarioData.multiTrancheInfo.tranches.map((tranche, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white rounded border border-purple-200 text-sm">
                    <div>
                      <span className="font-bold text-purple-900">{tranche.name}</span>
                      <span className="text-purple-600 ml-2">({tranche.seniority})</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-purple-900">{currencyFmtMM(tranche.amount, ccy)}</div>
                      <div className="text-xs text-purple-600">{pctFmt(tranche.rate)} • {tranche.maturityDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debt Service Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="text-sm text-blue-700 mb-1">Total Principal Repaid</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-900">
                {currencyFmtMM(selectedScenarioData.totalDebtRepaid, ccy)}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div className="text-sm text-purple-700 mb-1">Total Interest Paid</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900">
                {currencyFmtMM(selectedScenarioData.totalInterestPaid, ccy)}
              </div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <div className="text-sm text-indigo-700 mb-1">Total Debt Service</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-900">
                {currencyFmtMM(selectedScenarioData.totalDebtService, ccy)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Timeline (only if debt exists) */}
      {cashFlowTimelineData.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Annual Free Cash Flow Timeline
            </CardTitle>
            <p className="text-sm text-slate-600 mt-2">
              Cash flow generation capacity over projection period
              {selectedScenarioData.hasBalloon && ' with balloon payment visualization'}
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartWrapper data={cashFlowTimelineData} height={350} ariaLabel="Cash flow timeline">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashFlowTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="year" 
                    label={{ value: 'Year', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }} 
                  />
                  <YAxis 
                    label={{ value: `Cash Flow (${ccy} MM)`, angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }} 
                  />
                  <Tooltip content={<CustomTooltip ccy={ccy} />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cashFlow"
                    fill={COLORS.primary.chart}
                    fillOpacity={0.3}
                    stroke={COLORS.primary.chart}
                    strokeWidth={2}
                    name="Free Cash Flow"
                  />
                  {selectedScenarioData.hasBalloon && (
                    <Bar
                      dataKey="balloonAmount"
                      fill={COLORS.danger.chart}
                      name="Balloon Payment"
                      opacity={0.8}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </CardContent>
        </Card>
      )}

      {/* Valuation Sensitivity Comparison */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Valuation Sensitivity Across Scenarios
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Impact of different stress scenarios on enterprise and equity values
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={enhancedData.filter(d => d.hasDebt)} height={350} ariaLabel="Valuation sensitivity">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enhancedData.filter(d => d.hasDebt)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: `Value (${ccy} MM)`, angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip ccy={ccy} />} />
                <Legend />
                <Bar dataKey="enterpriseValue" fill={COLORS.info.chart} name="Enterprise Value" radius={[8, 8, 0, 0]} />
                <Bar dataKey="equityValue" fill={COLORS.success.chart} name="Equity Value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Comprehensive Comparison Table */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            Comprehensive Scenario Comparison Matrix
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Complete credit and financial metrics comparison across all scenarios
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="text-left p-3 font-bold text-slate-800">Scenario</th>
                  <th className="text-right p-3 font-bold text-slate-700">EV ({ccy}M)</th>
                  <th className="text-right p-3 font-bold text-slate-700">Equity ({ccy}M)</th>
                  <th className="text-right p-3 font-bold text-slate-700">IRR</th>
                  <th className="text-right p-3 font-bold text-slate-700">MOIC</th>
                  <th className="text-right p-3 font-bold text-slate-700">Min DSCR</th>
                  <th className="text-right p-3 font-bold text-slate-700">Avg DSCR</th>
                  <th className="text-right p-3 font-bold text-slate-700">Min ICR</th>
                  <th className="text-right p-3 font-bold text-slate-700">Max Lev</th>
                  <th className="text-right p-3 font-bold text-slate-700">Breaches</th>
                  <th className="text-right p-3 font-bold text-slate-700">CF Vol</th>
                  <th className="text-right p-3 font-bold text-slate-700">Resilience</th>
                  <th className="text-center p-3 font-bold text-slate-700">Risk</th>
                  <th className="text-center p-3 font-bold text-slate-700">Rating</th>
                </tr>
              </thead>
              <tbody>
                {enhancedData.filter(d => d.hasDebt).map((row, i) => (
                  <tr 
                    key={i} 
                    className={`border-b border-slate-200 transition-all duration-150 cursor-pointer ${
                      selectedScenarioData.scenario === row.scenario 
                        ? 'bg-blue-50 hover:bg-blue-100' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === row.scenario) || 'base')}
                  >
                    <td className="p-3 font-bold text-slate-800">{row.scenario}</td>
                    <td className="text-right p-3 text-slate-700 font-semibold">
                      {currencyFmtMM(row.enterpriseValue * 1_000_000, ccy)}
                    </td>
                    <td className="text-right p-3 text-slate-700 font-semibold">
                      {currencyFmtMM(row.equityValue * 1_000_000, ccy)}
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.irr > 0.20 ? 'text-emerald-600' : 
                      row.irr > 0.15 ? 'text-green-600' :
                      row.irr > 0.10 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {pctFmt(row.irr)}
                    </td>
                    <td className="text-right p-3 font-bold text-slate-800">{numFmt(row.equityMOIC)}x</td>
                    <td className={`text-right p-3 font-bold ${
                      row.minDSCR >= 1.75 ? 'text-emerald-600' :
                      row.minDSCR >= 1.5 ? 'text-green-600' :
                      row.minDSCR >= 1.25 ? 'text-amber-600' :
                      row.minDSCR >= 1.0 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {numFmt(row.minDSCR)}x
                    </td>
                    <td className="text-right p-3 font-semibold text-blue-600">
                      {numFmt(row.avgDSCR)}x
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.minICR >= 3.0 ? 'text-emerald-600' :
                      row.minICR >= 2.5 ? 'text-green-600' :
                      row.minICR >= 2.0 ? 'text-amber-600' :
                      row.minICR >= 1.5 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {numFmt(row.minICR)}x
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.maxLeverage <= 3.0 ? 'text-emerald-600' :
                      row.maxLeverage <= 4.0 ? 'text-green-600' :
                      row.maxLeverage <= 5.0 ? 'text-amber-600' :
                      row.maxLeverage <= 6.0 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {numFmt(row.maxLeverage)}x
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.breaches === 0 ? 'text-emerald-600' : 
                      row.breaches === 1 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {row.breaches}
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.cashFlowVolatility < 0.2 ? 'text-emerald-600' :
                      row.cashFlowVolatility < 0.35 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {pctFmt(row.cashFlowVolatility)}
                    </td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${
                              row.resilienceScore >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                              row.resilienceScore >= 60 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                              row.resilienceScore >= 45 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                              row.resilienceScore >= 30 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                              'bg-gradient-to-r from-red-500 to-red-600'
                            }`}
                            style={{ width: `${row.resilienceScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-10 text-right">{row.resilienceScore}</span>
                      </div>
                    </td>
                    <td className="text-center p-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${getRiskBadgeColor(row.scenarioInsight.riskLevel)}`}>
                        {row.scenarioInsight.riskLevel}
                      </span>
                    </td>
                    <td className="text-center p-3">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {row.scenarioInsight.creditRating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Investment Decision Summary */}
      <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
        <CardHeader className="border-b border-blue-200">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <DollarSign className="w-6 h-6" />
            Investment Decision Framework
          </CardTitle>
          <p className="text-sm text-blue-700 mt-2">
            Synthesized lending recommendation based on comprehensive stress testing
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-5 bg-white rounded-lg border-2 border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 mb-1">
                {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 60).length}/{enhancedData.filter(d => d.hasDebt).length}
              </div>
              <div className="text-sm text-slate-600 font-medium">Resilient Scenarios</div>
              <div className="text-xs text-slate-500 mt-1">(Score ≥ 60)</div>
            </div>
            
            <div className="text-center p-5 bg-white rounded-lg border-2 border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-600 mb-1">
                {pctFmt(enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.irr, 0) / enhancedData.filter(d => d.hasDebt).length)}
              </div>
              <div className="text-sm text-slate-600 font-medium">Average IRR</div>
              <div className="text-xs text-slate-500 mt-1">Across All Scenarios</div>
            </div>
            
            <div className="text-center p-5 bg-white rounded-lg border-2 border-amber-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-600 mb-1">
                {enhancedData.filter(d => d.hasDebt && d.breaches > 0).length}
              </div>
              <div className="text-sm text-slate-600 font-medium">Scenarios w/ Breaches</div>
              <div className="text-xs text-slate-500 mt-1">Require Waivers</div>
            </div>
            
            <div className="text-center p-5 bg-white rounded-lg border-2 border-purple-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className={`text-xl sm:text-2xl md:text-3xl font-bold mb-1 ${
                selectedScenarioData.resilienceScore >= 70 ? 'text-emerald-600' :
                selectedScenarioData.resilienceScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {selectedScenarioData.scenarioInsight.riskLevel}
              </div>
              <div className="text-sm text-slate-600 font-medium">Selected Risk Level</div>
              <div className="text-xs text-slate-500 mt-1">{selectedScenarioData.scenario}</div>
            </div>
          </div>
          
          {/* Overall Recommendation */}
          <div className="p-6 bg-white rounded-lg border-2 border-blue-300 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 60).length >= enhancedData.filter(d => d.hasDebt).length * 0.67 
                  ? 'bg-emerald-100' 
                  : enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 50).length >= enhancedData.filter(d => d.hasDebt).length * 0.5
                  ? 'bg-amber-100'
                  : 'bg-red-100'
              }`}>
                {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 60).length >= enhancedData.filter(d => d.hasDebt).length * 0.67 ? (
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                ) : enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 50).length >= enhancedData.filter(d => d.hasDebt).length * 0.5 ? (
                  <AlertTriangle className="w-7 h-7 text-amber-600" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-600" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-xl text-slate-900">Overall Lending Recommendation</h4>
                <p className="text-sm text-slate-600">Based on comprehensive scenario analysis</p>
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-base text-slate-800 leading-relaxed mb-4">
                {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 70).length >= enhancedData.filter(d => d.hasDebt).length * 0.67 ? (
                  <>
                    <strong className="text-emerald-700">APPROVE</strong> – The proposed debt structure demonstrates <strong>strong resilience</strong> across stress scenarios. 
                    With {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 70).length} out of {enhancedData.filter(d => d.hasDebt).length} scenarios scoring ≥70 on resilience, 
                    the borrower exhibits robust debt service capacity with adequate covenant cushions. Minimum DSCR across scenarios averages{' '}
                    {numFmt(enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.minDSCR, 0) / enhancedData.filter(d => d.hasDebt).length)}x, 
                    well above typical institutional thresholds.
                  </>
                ) : enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 60).length >= enhancedData.filter(d => d.hasDebt).length * 0.5 ? (
                  <>
                    <strong className="text-green-700">APPROVE WITH CONDITIONS</strong> – Structure shows <strong>moderate resilience</strong> but requires enhanced monitoring. 
                    While {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 60).length} scenarios achieve acceptable resilience scores, 
                    stress testing reveals potential covenant pressure under adverse conditions. Recommend implementing:
                    (1) Quarterly financial reporting with covenant calculations,
                    (2) Cash sweep provisions in excess of minimum DSCR,
                    (3) Pre-negotiated waiver framework for {enhancedData.filter(d => d.hasDebt && d.breaches > 0).length} scenarios showing potential breaches.
                  </>
                ) : enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 45).length >= enhancedData.filter(d => d.hasDebt).length * 0.4 ? (
                  <>
                    <strong className="text-amber-700">CONDITIONAL APPROVAL / RESTRUCTURE</strong> – Current structure shows <strong>limited stress capacity</strong>. 
                    Only {enhancedData.filter(d => d.hasDebt && d.resilienceScore >= 45).length} scenarios maintain adequate resilience. 
                    Consider requiring: (1) 25-30% equity injection to improve leverage, (2) Extended amortization to reduce annual debt service, 
                    (3) EBITDA floor covenant or equity cure provisions, (4) Step-down covenants tied to operational milestones.
                    Alternatively, reduce total debt by 15-20% to achieve investment-grade resilience profile.
                  </>
                ) : (
                  <>
                    <strong className="text-red-700">DECLINE / MAJOR RESTRUCTURE REQUIRED</strong> – Stress testing reveals <strong>fundamental structural weakness</strong>. 
                    Less than 40% of scenarios achieve acceptable resilience thresholds. The borrower demonstrates insufficient capacity to service debt 
                    under normal market volatility. Multiple covenant breaches expected across {enhancedData.filter(d => d.hasDebt && d.breaches > 0).length} scenarios. 
                    Recommend: (1) 40-50% debt reduction, (2) Payment-in-kind (PIK) toggle for 2-3 years, (3) Significant operational improvements before reapplication, 
                    or (4) Consider pure equity financing alternative.
                  </>
                )}
              </p>
              
              {/* Detailed breakdown */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h5 className="font-bold text-sm text-slate-800 mb-3">Key Risk Factors & Mitigants:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-slate-700 mb-2">Best Case Scenario ({enhancedData.filter(d => d.hasDebt).sort((a, b) => b.resilienceScore - a.resilienceScore)[0]?.scenario}):</p>
                    <ul className="space-y-1 text-slate-600">
                      <li>• Resilience: {enhancedData.filter(d => d.hasDebt).sort((a, b) => b.resilienceScore - a.resilienceScore)[0]?.resilienceScore}/100</li>
                      <li>• Min DSCR: {numFmt(enhancedData.filter(d => d.hasDebt).sort((a, b) => b.resilienceScore - a.resilienceScore)[0]?.minDSCR)}x</li>
                      <li>• IRR: {pctFmt(enhancedData.filter(d => d.hasDebt).sort((a, b) => b.resilienceScore - a.resilienceScore)[0]?.irr)}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-2">Worst Case Scenario ({enhancedData.filter(d => d.hasDebt).sort((a, b) => a.resilienceScore - b.resilienceScore)[0]?.scenario}):</p>
                    <ul className="space-y-1 text-slate-600">
                      <li>• Resilience: {enhancedData.filter(d => d.hasDebt).sort((a, b) => a.resilienceScore - b.resilienceScore)[0]?.resilienceScore}/100</li>
                      <li>• Min DSCR: {numFmt(enhancedData.filter(d => d.hasDebt).sort((a, b) => a.resilienceScore - b.resilienceScore)[0]?.minDSCR)}x</li>
                      <li>• Breaches: {enhancedData.filter(d => d.hasDebt).sort((a, b) => a.resilienceScore - b.resilienceScore)[0]?.breaches} year(s)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Credit Committee Notes */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-bold text-sm text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Credit Committee Considerations:
                </h5>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>
                    <strong>Covenant Structure:</strong> {enhancedData.filter(d => d.hasDebt && d.breaches === 0).length === enhancedData.filter(d => d.hasDebt).length 
                      ? 'All scenarios maintain covenant compliance - standard documentation appropriate'
                      : `${enhancedData.filter(d => d.hasDebt && d.breaches > 0).length} scenarios show breaches - recommend equity cure provisions or covenant step-downs`
                    }
                  </li>
                  <li>
                    <strong>Monitoring Frequency:</strong> {enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.resilienceScore, 0) / enhancedData.filter(d => d.hasDebt).length >= 65
                      ? 'Semi-annual reporting sufficient for resilient profile'
                      : 'Quarterly reporting with covenant calculations mandatory'
                    }
                  </li>
                  <li>
                    <strong>Pricing Implications:</strong> Average resilience of {Math.round(enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.resilienceScore, 0) / enhancedData.filter(d => d.hasDebt).length)}/100 suggests{' '}
                    {Math.round(enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.resilienceScore, 0) / enhancedData.filter(d => d.hasDebt).length) >= 70 ? 'investment-grade pricing (200-400bps over benchmark)' :
                     Math.round(enhancedData.filter(d => d.hasDebt).reduce((sum, d) => sum + d.resilienceScore, 0) / enhancedData.filter(d => d.hasDebt).length) >= 50 ? 'non-investment grade pricing (400-700bps over benchmark)' :
                     'high-yield pricing (700-1200bps over benchmark)'}
                  </li>
                  {selectedScenarioData.hasBalloon && (
                    <li>
                      <strong>Refinancing Risk:</strong> Balloon payment of {currencyFmtMM(selectedScenarioData.balloonAmount, ccy)} due at maturity. 
                      Coverage ratio of {numFmt(selectedScenarioData.balloonCoverage)}x indicates {selectedScenarioData.refinancingRisk.toLowerCase()} refinancing risk - 
                      {selectedScenarioData.balloonCoverage < 1.2 ? ' recommend requiring escrow or sinking fund' : ' acceptable with standard refinancing provisions'}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}