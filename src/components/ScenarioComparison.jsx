import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { ChartWrapper } from "./ChartWrapper";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { 
  BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, 
  ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, Cell
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Zap, DollarSign, CheckCircle, XCircle, Info } from "lucide-react";

// Color palette for consistency
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

// Enhanced impact calculator with proper safety and calculations
const calculateEnhancedMetrics = (facilityParams, projection, scenarioKey) => {
  const params = facilityParams || {};
  const balloonPercentage = params.balloonPercentage || 0;
  const hasBalloon = balloonPercentage > 0;
  
  // Safe access to projection data with comprehensive fallbacks
  const endingDebt = projection.endingDebtBalance || projection.rows?.[projection.rows?.length - 1]?.endingDebt || 0;
  const annualCashFlow = projection.annualCashFlow || [];
  const projectedCash = projection.cashAtMaturity || annualCashFlow[annualCashFlow.length - 1] || 0;
  const requestedLoanAmount = params.requestedLoanAmount || 0;
  
  // PROPER balloon risk calculation (coverage ratio)
  const balloonAmount = requestedLoanAmount > 0 ? requestedLoanAmount * (balloonPercentage / 100) : 0;
  const balloonCoverage = balloonAmount > 0 && projectedCash > 0 ? projectedCash / balloonAmount : Infinity;
  
  // Risk classification
  let refinancingRisk = 'None';
  let riskColor = COLORS.success.chart;
  if (hasBalloon && balloonAmount > 0) {
    if (balloonCoverage < 1) {
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

  // CORRECT effective rate calculation
  const interestRate = params.interestRate || params.proposedPricing || 0;
  const dayCountConvention = params.dayCountConvention || "30/360";
  const effectiveRate = dayCountConvention === "Actual/360" ? 
    interestRate * (365/360) : interestRate;

  // Enhanced credit metrics with safe calculations
  const minDSCR = projection.creditStats?.minDSCR || 
    (projection.rows ? Math.min(...projection.rows.map(r => r.dscr || 0)) : 0);
  const maxLeverage = projection.creditStats?.maxLeverage || 
    (projection.rows ? Math.max(...projection.rows.map(r => r.ndToEbitda || 0)) : 0);
  
  // Covenant breach analysis
  const breaches = projection.breaches ? 
    (projection.breaches.dscrBreaches || 0) +
    (projection.breaches.icrBreaches || 0) +
    (projection.breaches.ndBreaches || 0) : 0;

  // Cash flow volatility analysis
  const cashFlowVolatility = annualCashFlow.length > 1 ? 
    calculateCashFlowVolatility(annualCashFlow) : 0;

  // Debt service capacity analysis
  const debtServiceCapacity = calculateDebtServiceCapacity(projection, params);

  // Resilience scoring
  const resilienceScore = calculateResilienceScore({
    minDSCR,
    maxLeverage,
    breaches,
    cashFlowVolatility,
    debtServiceCapacity,
    balloonCoverage
  });

  // Scenario-specific insights
  const scenarioInsight = generateScenarioInsight({
    scenarioKey,
    minDSCR,
    maxLeverage,
    breaches,
    resilienceScore,
    refinancingRisk,
    params
  });

  return {
    // Basic metrics
    scenario: PRESETS[scenarioKey]?.label || scenarioKey,
    enterpriseValue: (projection.enterpriseValue || 0) / 1_000_000,
    equityValue: (projection.equityValue || 0) / 1_000_000,
    equityMOIC: projection.equityMOIC || 0,
    irr: projection.irr || 0,
    minDSCR,
    maxLeverage,
    breaches,
    
    // Enhanced risk metrics
    hasBalloon,
    balloonAmount,
    balloonCoverage,
    refinancingRisk,
    riskColor,
    effectiveRate,
    paymentFrequency: params.paymentFrequency || "Quarterly",
    
    // New advanced metrics
    cashFlowVolatility,
    debtServiceCapacity,
    resilienceScore,
    scenarioInsight,
    
    // For visualization
    annualCashFlow,
    balloonTimeline: hasBalloon ? (params.maturityYear || params.debtTenorYears || 5) : null,
    scenarioColor: PRESETS[scenarioKey]?.color || "#6B7280"
  };
};

// Helper function to calculate cash flow volatility
const calculateCashFlowVolatility = (cashFlows) => {
  if (!cashFlows || cashFlows.length < 2) return 0;
  
  const mean = cashFlows.reduce((sum, val) => sum + val, 0) / cashFlows.length;
  const variance = cashFlows.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cashFlows.length;
  const volatility = Math.sqrt(variance);
  
  return mean !== 0 ? volatility / Math.abs(mean) : 0;
};

// Helper function to calculate debt service capacity
const calculateDebtServiceCapacity = (projection, params) => {
  if (!projection.rows || projection.rows.length === 0) return 0;
  
  const totalDebtService = projection.rows.reduce((sum, row) => sum + (row.debtService || 0), 0);
  const totalEBITDA = projection.rows.reduce((sum, row) => sum + (row.ebitda || 0), 0);
  
  return totalEBITDA > 0 ? totalEBITDA / totalDebtService : 0;
};

// Helper function to calculate resilience score (0-100)
const calculateResilienceScore = (metrics) => {
  let score = 100;
  
  // DSCR component (40% weight)
  const dscrScore = metrics.minDSCR >= 2.0 ? 40 : 
                   metrics.minDSCR >= 1.5 ? 30 :
                   metrics.minDSCR >= 1.2 ? 20 : 10;
  score = score - 40 + dscrScore;
  
  // Leverage component (25% weight)
  const leverageScore = metrics.maxLeverage <= 3.0 ? 25 :
                       metrics.maxLeverage <= 4.0 ? 20 :
                       metrics.maxLeverage <= 5.0 ? 15 : 10;
  score = score - 25 + leverageScore;
  
  // Breach component (20% weight)
  const breachScore = metrics.breaches === 0 ? 20 :
                     metrics.breaches === 1 ? 15 :
                     metrics.breaches === 2 ? 10 : 5;
  score = score - 20 + breachScore;
  
  // Balloon coverage component (15% weight)
  const balloonScore = metrics.balloonCoverage >= 2.0 ? 15 :
                      metrics.balloonCoverage >= 1.5 ? 12 :
                      metrics.balloonCoverage >= 1.0 ? 8 : 5;
  score = score - 15 + balloonScore;
  
  return Math.max(0, Math.min(100, score));
};

// Generate scenario-specific insights
const generateScenarioInsight = (data) => {
  const { scenarioKey, minDSCR, maxLeverage, breaches, resilienceScore, refinancingRisk, params } = data;
  const minDSCRThreshold = params.minDSCR || 1.5;
  const maxLeverageThreshold = params.maxNDToEBITDA || 4.0;

  switch(scenarioKey) {
    case 'base':
      if (minDSCR >= minDSCRThreshold + 0.5 && maxLeverage <= maxLeverageThreshold - 1.0) {
        return {
          summary: "Strong performance with ample covenant cushion",
          recommendation: "Proceed confidently - structure provides significant buffer",
          riskLevel: "LOW"
        };
      } else {
        return {
          summary: "Adequate performance but limited stress buffer",
          recommendation: "Monitor closely - consider reducing leverage for more resilience",
          riskLevel: "MEDIUM"
        };
      }
      
    case 'mild':
      if (minDSCR >= minDSCRThreshold && breaches === 0) {
        return {
          summary: "Resilient to moderate downturn with covenant compliance maintained",
          recommendation: "Structure can withstand typical business cycle fluctuations",
          riskLevel: "LOW"
        };
      } else {
        return {
          summary: "Vulnerable to mild stress with potential covenant pressure",
          recommendation: "Increase equity cushion or reduce debt to improve resilience",
          riskLevel: "MEDIUM"
        };
      }
      
    case 'severe':
      if (minDSCR >= minDSCRThreshold - 0.2 && breaches <= 1) {
        return {
          summary: "Survives severe stress but with covenant breaches",
          recommendation: "Requires waivers or restructuring contingency planning",
          riskLevel: "HIGH"
        };
      } else {
        return {
          summary: "Severe stress exposes fundamental viability concerns",
          recommendation: "Restructure or seek additional equity before proceeding",
          riskLevel: "CRITICAL"
        };
      }
      
    case 'rateHike':
      const rateShockCapacity = minDSCR >= minDSCRThreshold + 0.3;
      return rateShockCapacity ? {
        summary: "Adequate capacity to absorb significant rate increases",
        recommendation: "Fixed rate exposure limits refinancing risk",
        riskLevel: "LOW"
      } : {
        summary: "Vulnerable to interest rate movements",
        recommendation: "Consider interest rate hedges or fixed rate financing",
        riskLevel: "MEDIUM"
      };
      
    case 'costShock':
      return minDSCR >= minDSCRThreshold ? {
        summary: "Margin compression absorbed without covenant issues",
        recommendation: "Maintain current pricing power assumptions",
        riskLevel: "LOW"
      } : {
        summary: "Cost inflation threatens debt service capacity",
        recommendation: "Implement cost pass-through mechanisms or efficiency programs",
        riskLevel: "MEDIUM"
      };
      
    default:
      return {
        summary: "Scenario requires detailed review",
        recommendation: "Analyze specific drivers and mitigants",
        riskLevel: "UNKNOWN"
      };
  }
};

// Risk-Return scatter chart data preparation
const prepareRiskReturnData = (enhancedData) => {
  return enhancedData.map(item => ({
    scenario: item.scenario,
    return: item.irr * 100,
    risk: 100 - item.resilienceScore,
    size: item.equityValue,
    color: item.scenarioColor,
    moic: item.equityMOIC
  }));
};

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="rounded-lg border bg-white p-3 text-xs shadow-lg">
      <div className="font-semibold mb-2 text-slate-800">{label}</div>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex justify-between gap-4">
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold" style={{ color: entry.color }}>
              {entry.value?.toFixed?.(2) || entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScenarioComparison({ projections, ccy, facilityParams }) {
  const [selectedScenario, setSelectedScenario] = useState('base');
  const scenarios = Object.keys(projections);

  // Calculate enhanced metrics for all scenarios
  const enhancedData = useMemo(() => {
    return scenarios.map(scenario => 
      calculateEnhancedMetrics(facilityParams, projections[scenario], scenario)
    );
  }, [projections, facilityParams, scenarios]);

  // Prepare cash flow timeline data
  const cashFlowTimelineData = useMemo(() => {
    const selectedData = enhancedData.find(d => d.scenario === PRESETS[selectedScenario]?.label);
    if (!selectedData || !selectedData.annualCashFlow) return [];
    
    return selectedData.annualCashFlow.map((cashFlow, year) => ({
      year: year + 1,
      cashFlow: cashFlow / 1_000_000,
      isBalloonYear: year + 1 === selectedData.balloonTimeline,
      balloonAmount: year + 1 === selectedData.balloonTimeline ? 
        (selectedData.balloonAmount || 0) / 1_000_000 : 0,
    }));
  }, [enhancedData, selectedScenario]);

  // Risk-return data for scatter chart
  const riskReturnData = useMemo(() => prepareRiskReturnData(enhancedData), [enhancedData]);

  const selectedScenarioData = enhancedData.find(d => d.scenario === PRESETS[selectedScenario]?.label) || enhancedData[0];

  // Risk level badge color helper
  const getRiskBadgeColor = (riskLevel) => {
    switch(riskLevel) {
      case 'LOW': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'MEDIUM': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Risk-Return Dashboard */}
      <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-600" />
            Risk-Return Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk-Return Scatter Chart */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">Risk vs Return Profile</h4>
              <ChartWrapper data={riskReturnData} height={320} ariaLabel="Risk-return analysis">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      dataKey="risk" 
                      name="Risk Score" 
                      label={{ value: 'Risk (100 - Resilience)', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="return" 
                      name="Return (IRR %)" 
                      label={{ value: 'IRR (%)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      formatter={(value, name) => {
                        if (name === 'return') return [`${value.toFixed(1)}%`, 'IRR'];
                        if (name === 'risk') return [value.toFixed(1), 'Risk Score'];
                        return [value, name];
                      }}
                    />
                    <Scatter name="Scenarios" data={riskReturnData} fill="#8884d8">
                      {riskReturnData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            {/* Resilience Score Gauge */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">Scenario Resilience Scores</h4>
              <div className="space-y-4">
                {enhancedData.map((scenario, index) => (
                  <div 
                    key={scenario.scenario} 
                    className={`p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                      selectedScenarioData.scenario === scenario.scenario 
                        ? 'border-blue-400 bg-blue-50' 
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                    onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === scenario.scenario) || 'base')}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm text-slate-800">{scenario.scenario}</span>
                      <span className={`font-bold text-lg ${
                        scenario.resilienceScore >= 80 ? 'text-emerald-600' :
                        scenario.resilienceScore >= 60 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {scenario.resilienceScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          scenario.resilienceScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                          scenario.resilienceScore >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 
                          'bg-gradient-to-r from-red-500 to-red-600'
                        }`}
                        style={{ width: `${scenario.resilienceScore}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Insights & Narratives */}
      <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Scenario Analysis & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enhancedData.map((scenario) => (
              <div 
                key={scenario.scenario}
                className={`p-5 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                  selectedScenarioData.scenario === scenario.scenario 
                    ? 'ring-2 ring-blue-500 border-blue-300 shadow-md' 
                    : 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                }`}
                onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === scenario.scenario) || 'base')}
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-bold text-base text-slate-800">{scenario.scenario}</h4>
                  {scenario.scenarioInsight.riskLevel === 'LOW' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {scenario.scenarioInsight.riskLevel === 'MEDIUM' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {(scenario.scenarioInsight.riskLevel === 'HIGH' || scenario.scenarioInsight.riskLevel === 'CRITICAL') && 
                    <XCircle className="w-5 h-5 text-red-600" />}
                </div>
                <div className="space-y-3">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                    getRiskBadgeColor(scenario.scenarioInsight.riskLevel)
                  }`}>
                    {scenario.scenarioInsight.riskLevel} RISK
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{scenario.scenarioInsight.summary}</p>
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 font-medium">{scenario.scenarioInsight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Selected Scenario Analysis */}
      <Card className="border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Detailed Analysis: {selectedScenarioData.scenario}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Key Performance Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <div className="text-xs opacity-90 mb-1">Equity IRR</div>
                  <div className="text-xl font-bold">{pctFmt(selectedScenarioData.irr)}</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <div className="text-xs opacity-90 mb-1">Equity MOIC</div>
                  <div className="text-xl font-bold">{numFmt(selectedScenarioData.equityMOIC)}x</div>
                </div>
                <div className={`p-4 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105 ${
                  selectedScenarioData.minDSCR >= 1.5 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                  selectedScenarioData.minDSCR >= 1.2 ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 
                  'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                  <div className="text-xs opacity-90 mb-1">Min DSCR</div>
                  <div className="text-xl font-bold">{numFmt(selectedScenarioData.minDSCR)}x</div>
                </div>
                <div className={`p-4 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105 ${
                  selectedScenarioData.maxLeverage <= 3.0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                  selectedScenarioData.maxLeverage <= 4.0 ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 
                  'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                  <div className="text-xs opacity-90 mb-1">Max Leverage</div>
                  <div className="text-xl font-bold">{numFmt(selectedScenarioData.maxLeverage)}x</div>
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk Assessment
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700">Covenant Breaches</span>
                  <span className={`font-bold text-lg ${
                    selectedScenarioData.breaches === 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {selectedScenarioData.breaches} year(s)
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700">Refinancing Risk</span>
                  <span className="font-bold text-lg" style={{ color: selectedScenarioData.riskColor }}>
                    {selectedScenarioData.refinancingRisk}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-700">Cash Flow Volatility</span>
                  <span className={`font-bold text-lg ${
                    selectedScenarioData.cashFlowVolatility < 0.2 ? 'text-emerald-600' :
                    selectedScenarioData.cashFlowVolatility < 0.4 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {pctFmt(selectedScenarioData.cashFlowVolatility)}
                  </span>
                </div>
                {selectedScenarioData.hasBalloon && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-700">Balloon Coverage</span>
                    <span className={`font-bold text-lg ${
                      selectedScenarioData.balloonCoverage >= 1.5 ? 'text-emerald-600' :
                      selectedScenarioData.balloonCoverage >= 1.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(selectedScenarioData.balloonCoverage)}x
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Timeline */}
      {cashFlowTimelineData.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Cash Flow Timeline & Balloon Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartWrapper data={cashFlowTimelineData} height={350} ariaLabel="Cash flow timeline">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlowTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value, name) => {
                      if (name === 'cashFlow' || name === 'balloonAmount') {
                        return [currencyFmtMM(value * 1_000_000, ccy), name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="cashFlow" 
                    stroke={COLORS.primary.chart}
                    name="Annual Cash Flow" 
                    strokeWidth={3}
                    dot={{ fill: COLORS.primary.chart, r: 5 }}
                  />
                  <Line 
                    type="monotone"
                    dataKey="balloonAmount"
                    stroke={COLORS.danger.chart}
                    name="Balloon Payment"
                    strokeWidth={3}
                    dot={{ fill: COLORS.danger.chart, r: 6 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </CardContent>
        </Card>
      )}

      {/* Valuation Sensitivity Chart */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Valuation Sensitivity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={enhancedData} height={320} ariaLabel="Valuation sensitivity comparison">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enhancedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  content={<CustomTooltip />}
                  formatter={(value, name) => [currencyFmtMM(value * 1_000_000, ccy), name]} 
                />
                <Legend />
                <Bar dataKey="enterpriseValue" fill={COLORS.info.chart} name="Enterprise Value" radius={[8, 8, 0, 0]} />
                <Bar dataKey="equityValue" fill={COLORS.success.chart} name="Equity Value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Comprehensive Scenario Comparison Table */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5 text-slate-600" />
            Comprehensive Scenario Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-700">Scenario</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Enterprise Value</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Equity Value</th>
                  <th className="text-right p-3 font-semibold text-slate-700">IRR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">MOIC</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Min DSCR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Max Lev</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Breaches</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Resilience</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Refinance Risk</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Cash Vol</th>
                </tr>
              </thead>
              <tbody>
                {enhancedData.map((row, i) => (
                  <tr 
                    key={i} 
                    className={`border-b border-slate-200 transition-all duration-150 cursor-pointer ${
                      selectedScenarioData.scenario === row.scenario 
                        ? 'bg-blue-50 hover:bg-blue-100' 
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedScenario(scenarios.find(s => PRESETS[s]?.label === row.scenario) || 'base')}
                  >
                    <td className="p-3 font-semibold text-slate-800">{row.scenario}</td>
                    <td className="text-right p-3 text-slate-600">
                      {currencyFmtMM(row.enterpriseValue * 1_000_000, ccy)}
                    </td>
                    <td className="text-right p-3 text-slate-600">
                      {currencyFmtMM(row.equityValue * 1_000_000, ccy)}
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.irr > 0.15 ? 'text-emerald-600' : row.irr > 0.08 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {pctFmt(row.irr)}
                    </td>
                    <td className="text-right p-3 font-semibold text-slate-800">{numFmt(row.equityMOIC)}x</td>
                    <td className={`text-right p-3 font-bold ${
                      row.minDSCR >= 1.5 ? 'text-emerald-600' : 
                      row.minDSCR >= 1.2 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(row.minDSCR)}x
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.maxLeverage <= 3.0 ? 'text-emerald-600' : 
                      row.maxLeverage <= 4.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(row.maxLeverage)}x
                    </td>
                    <td className={`text-right p-3 font-bold ${
                      row.breaches === 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {row.breaches}
                    </td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-2.5 rounded-full transition-all duration-500 ${
                              row.resilienceScore >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                              row.resilienceScore >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 
                              'bg-gradient-to-r from-red-500 to-red-600'
                            }`}
                            style={{ width: `${row.resilienceScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-8">{row.resilienceScore}</span>
                      </div>
                    </td>
                    <td className="text-right p-3">
                      <span className="font-bold" style={{ color: row.riskColor }}>
                        {row.refinancingRisk}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <span className={`font-bold ${
                        row.cashFlowVolatility < 0.2 ? 'text-emerald-600' :
                        row.cashFlowVolatility < 0.4 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {pctFmt(row.cashFlowVolatility)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Decision Support Summary */}
      <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="border-b border-blue-200">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <DollarSign className="w-6 h-6" />
            Investment Decision Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-5 bg-white rounded-lg border-2 border-blue-200 shadow-sm transform transition-all duration-200 hover:scale-105">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {enhancedData.filter(d => d.resilienceScore >= 60).length}/{enhancedData.length}
              </div>
              <div className="text-sm text-slate-600 font-medium">Resilient Scenarios</div>
            </div>
            <div className="text-center p-5 bg-white rounded-lg border-2 border-emerald-200 shadow-sm transform transition-all duration-200 hover:scale-105">
              <div className="text-3xl font-bold text-emerald-600 mb-1">
                {pctFmt(enhancedData.reduce((sum, d) => sum + d.irr, 0) / enhancedData.length)}
              </div>
              <div className="text-sm text-slate-600 font-medium">Average IRR</div>
            </div>
            <div className="text-center p-5 bg-white rounded-lg border-2 border-purple-200 shadow-sm transform transition-all duration-200 hover:scale-105">
              <div className={`text-3xl font-bold mb-1 ${
                selectedScenarioData.resilienceScore >= 70 ? 'text-emerald-600' :
                selectedScenarioData.resilienceScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {selectedScenarioData.scenarioInsight.riskLevel}
              </div>
              <div className="text-sm text-slate-600 font-medium">Selected Scenario Risk</div>
            </div>
          </div>
          
          <div className="p-5 bg-white rounded-lg border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-base text-slate-800">Final Recommendation</h4>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {selectedScenarioData.resilienceScore >= 70 ? 
                "Structure appears resilient across most scenarios. Proceed with confidence, but maintain standard monitoring protocols and covenant compliance oversight." :
               selectedScenarioData.resilienceScore >= 50 ?
                "Proceed with enhanced caution. Implement additional risk mitigants, tighter monitoring requirements, and consider establishing contingency plans for stress scenarios." :
                "Significant reconsideration recommended. Current structure shows vulnerability to stress. Consider material enhancements including increased equity, reduced leverage, or strengthened covenants before proceeding."
              }
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 mb-1">Best Case IRR</div>
                  <div className="font-bold text-emerald-600">
                    {pctFmt(Math.max(...enhancedData.map(d => d.irr)))}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Worst Case IRR</div>
                  <div className="font-bold text-red-600">
                    {pctFmt(Math.min(...enhancedData.map(d => d.irr)))}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Avg Resilience</div>
                  <div className="font-bold text-blue-600">
                    {Math.round(enhancedData.reduce((sum, d) => sum + d.resilienceScore, 0) / enhancedData.length)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Scenarios w/ Breaches</div>
                  <div className="font-bold text-amber-600">
                    {enhancedData.filter(d => d.breaches > 0).length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}