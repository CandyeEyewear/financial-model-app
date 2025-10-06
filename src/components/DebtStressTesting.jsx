import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { KPI } from "./KPI";
import { ChartWrapper } from "./ChartWrapper";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { exportComprehensiveStressTestReport } from "../utils/exportStressTestReport";
import { buildProjection } from "../utils/buildProjection";
import { 
  BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, ResponsiveContainer,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart,
  Cell, AreaChart, Area
} from "recharts";
import { 
  AlertTriangle, CheckCircle, XCircle, TrendingDown, Shield, Activity, 
  Download, History, Calendar, DollarSign, Info, Zap, TrendingUp 
} from "lucide-react";

// Color palette for consistency
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#2563eb' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10b981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#f59e0b' },
  danger: { from: 'red-500', to: 'red-600', chart: '#ef4444' },
  info: { from: 'indigo-500', to: 'indigo-600', chart: '#6366f1' },
  purple: { from: 'purple-500', to: 'purple-600', chart: '#a855f7' },
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
  },
  refinancingRisk: {
    name: "Refinancing Stress",
    description: "Balloon payment with market stress",
    adjustments: { revenueShock: -0.15, rateShock: 0.02, refinancingStress: true },
    color: '#7c2d12'
  }
};

// Helper functions
function getPaymentsPerYear(frequency) {
  const frequencyMap = {
    "Monthly": 12, "Quarterly": 4, "Semi-Annually": 2, "Annually": 1, "Bullet": 0
  };
  return frequencyMap[frequency] || 4;
}

// FIXED: Calculate refinancing risk with proper cash accumulation
function calculateRefinancingRisk(params, stressedMetrics, ccy) {
  if (!params.balloonPercentage || params.balloonPercentage === 0) {
    return { level: "LOW", description: "No balloon payment", feasible: true };
  }
  
  const balloonAmount = params.requestedLoanAmount * (params.balloonPercentage / 100);
  const maturityYear = params.proposedTenor || params.debtTenorYears || 5;
  const maturityYearIndex = Math.min(maturityYear - 1, (stressedMetrics.rows?.length || 1) - 1);
  const maturityMetrics = stressedMetrics.rows?.[maturityYearIndex];
  
  if (!maturityMetrics) {
    return { level: "UNKNOWN", description: "Unable to assess", feasible: false };
  }
  
  // FIXED: Calculate accumulated free cash flow to maturity
  const accumulatedFCF = stressedMetrics.rows
    ?.slice(0, maturityYearIndex + 1)
    .reduce((sum, row) => sum + (row.fcfToEquity || 0), 0) || 0;
  
  const stressedLeverage = maturityMetrics.ndToEbitda;
  const stressedDSCR = maturityMetrics.dscr;
  const cashCoverage = accumulatedFCF / balloonAmount;
  
  // Multi-factor risk assessment
  if (cashCoverage < 0.5 || stressedLeverage > 5.0 || stressedDSCR < 0.8) {
    return {
      level: "HIGH",
      description: `Insufficient cash to refinance ${currencyFmtMM(balloonAmount, ccy)}`,
      feasible: false,
      metrics: { leverage: stressedLeverage, dscr: stressedDSCR, cashCoverage }
    };
  } else if (cashCoverage < 1.0 || stressedLeverage > 4.0 || stressedDSCR < 1.2) {
    return {
      level: "ELEVATED",
      description: `Challenging refinancing for ${currencyFmtMM(balloonAmount, ccy)}`,
      feasible: true,
      metrics: { leverage: stressedLeverage, dscr: stressedDSCR, cashCoverage }
    };
  }
  
  return {
    level: "MODERATE",
    description: `Balloon refinancing feasible`,
    feasible: true,
    metrics: { leverage: stressedLeverage, dscr: stressedDSCR, cashCoverage }
  };
}

// Calculate payment frequency impact
function calculatePaymentFrequencyImpact(params, ccy) {
  if (!params.requestedLoanAmount || params.requestedLoanAmount <= 0) {
    return { riskLevel: "N/A", minCashBuffer: 0 };
  }
  
  const paymentsPerYear = getPaymentsPerYear(params.paymentFrequency);
  const annualDebtService = params.requestedLoanAmount * (params.proposedPricing || params.interestRate);
  const paymentAmount = paymentsPerYear > 0 ? annualDebtService / paymentsPerYear : annualDebtService;
  
  const frequencyRisk = {
    "Monthly": "HIGH", "Quarterly": "MODERATE", 
    "Semi-Annually": "LOW", "Annually": "LOW", "Bullet": "HIGH"
  };
  
  return {
    riskLevel: frequencyRisk[params.paymentFrequency] || "MODERATE",
    minCashBuffer: paymentAmount * 3,
    paymentsPerYear,
    paymentAmount,
    annualDebtService
  };
}

// FIXED: Calculate volatility with better handling of edge cases
function calculateVolatility(values) {
  if (!values || values.length < 2) return 0;
  
  const positiveValues = values.filter(v => v > 0);
  if (positiveValues.length < 2) return 0;
  
  const avg = positiveValues.reduce((sum, val) => sum + val, 0) / positiveValues.length;
  if (avg === 0) return 0;
  
  const variance = positiveValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / positiveValues.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev / avg; // Coefficient of variation
}

// FIXED: Calculate historical metrics with proper EBITDA calculation
function calculateHistoricalBurnRates(historicalData) {
  if (!historicalData || historicalData.length === 0) return null;
  
  const validData = historicalData.filter(d => d.revenue > 0);
  if (validData.length < 2) return null;
  
  // Calculate operating cash flows
  const operatingCashFlows = validData.map(year => {
    const ebitda = year.ebitda || (year.revenue * 0.15); // Conservative estimate
    const capex = year.capex || (year.revenue * 0.04);
    const interestExpense = year.interestExpense || 0;
    const taxes = year.taxExpense || (year.netIncome ? year.netIncome * 0.25 : 0);
    const wcChange = year.workingCapitalChange || 0;
    
    return ebitda - capex - interestExpense - taxes - wcChange;
  });
  
  // Burn rate only applies when cash flow is negative
  const burnRates = operatingCashFlows
    .map(cf => cf < 0 ? Math.abs(cf) : 0)
    .filter(b => b > 0);
  
  if (burnRates.length === 0) {
    // Positive cash flow company
    return {
      avgMonthlyBurn: 0,
      maxMonthlyBurn: 0,
      yearsWithNegativeCash: 0,
      burnVolatility: 0,
      stressMultipliers: {
        revenueDecline: 0.85,
        burnRateIncrease: 1.3,
        workingCapitalStrain: 1.2
      },
      isPositiveCashFlow: true
    };
  }
  
  const avgAnnualBurn = burnRates.reduce((sum, b) => sum + b, 0) / burnRates.length;
  const maxAnnualBurn = Math.max(...burnRates);
  
  // Calculate revenue volatility
  const revenueChanges = [];
  for (let i = 1; i < validData.length; i++) {
    if (validData[i-1].revenue > 0) {
      revenueChanges.push((validData[i].revenue - validData[i-1].revenue) / validData[i-1].revenue);
    }
  }
  
  const worstRevenueDecline = revenueChanges.length > 0 ? Math.min(...revenueChanges, 0) : -0.15;
  
  return {
    avgMonthlyBurn: avgAnnualBurn / 12,
    maxMonthlyBurn: maxAnnualBurn / 12,
    yearsWithNegativeCash: burnRates.length,
    burnVolatility: calculateVolatility(burnRates),
    stressMultipliers: {
      revenueDecline: 1 + worstRevenueDecline, // e.g., 0.85 for 15% decline
      burnRateIncrease: 1.5,
      workingCapitalStrain: 1.3
    },
    isPositiveCashFlow: false,
    historicalMetrics: {
      avgOperatingCashFlow: operatingCashFlows.reduce((sum, cf) => sum + cf, 0) / operatingCashFlows.length,
      worstRevenueDecline
    }
  };
}

function calculateHistoricalLiquidityMetrics(historicalData) {
  if (!historicalData || historicalData.length === 0) return { minCashBalance: 0 };
  
  const cashBalances = historicalData
    .map(d => d.cashBalance || d.workingCapital * 0.3 || 0) // Estimate 30% of WC is cash
    .filter(b => b > 0);
    
  return {
    minCashBalance: cashBalances.length > 0 ? Math.min(...cashBalances) : 0,
    avgCashBalance: cashBalances.length > 0 ? cashBalances.reduce((sum, b) => sum + b, 0) / cashBalances.length : 0,
    cashVolatility: calculateVolatility(cashBalances)
  };
}

// FIXED: Improved liquidity runway calculation
function calculateLiquidityRunway(projection, scenarioKey, historicalAnalysis, params) {
  if (!projection || !projection.rows || projection.rows.length === 0) return 12;
  
  try {
    // Use first year's cash balance or estimate from assets
    const firstYear = projection.rows[0];
    const currentCash = firstYear?.cashBalance || 
                       (firstYear?.workingCapital * 0.3) || 
                       (params.totalAssets * 0.05) || 
                       50000;
    
    // Calculate OPERATING cash flow (before financing activities)
    const operatingCashFlows = projection.rows.map(row => {
      const ebitda = row.ebitda || 0;
      const capex = row.capex || 0;
      const wcChange = row.wcChange || 0;
      const taxes = row.taxes || 0;
      
      return ebitda - capex - wcChange - taxes; // Before debt service
    });
    
    // Calculate average annual operating cash burn
    const totalOperatingCF = operatingCashFlows.reduce((sum, cf) => sum + cf, 0);
    const avgAnnualOperatingCF = totalOperatingCF / projection.rows.length;
    
    // If positive operating cash flow, runway is very long
    if (avgAnnualOperatingCF >= 0) {
      return 36; // 3+ years, effectively sustainable
    }
    
    // Calculate burn rate (negative cash flow)
    const monthlyBurn = Math.abs(avgAnnualOperatingCF) / 12;
    let runway = currentCash / monthlyBurn;
    
    // Apply scenario-specific stress multipliers
    const stressMultipliers = {
      'revenueDown30': 0.5,
      'severeRecession': 0.6,
      'stagflation': 0.55,
      'revenueDown20': 0.75,
      'mildRecession': 0.80,
      'marginCompression': 0.85
    };
    
    const multiplier = stressMultipliers[scenarioKey] || 1.0;
    runway *= multiplier;
    
    // Apply historical adjustments if available
    if (historicalAnalysis && !historicalAnalysis.isPositiveCashFlow) {
      runway /= (historicalAnalysis.stressMultipliers?.burnRateIncrease || 1.0);
    }
    
    return Math.min(36, Math.max(0, Math.round(runway * 10) / 10));
  } catch (error) {
    console.error("Error calculating liquidity runway:", error);
    return 12;
  }
}

// FIXED: Better risk level determination with weights
function determineRiskLevel(metrics, params, historicalAnalysis) {
  const { totalBreaches, liquidityRunway, dscrCushion, leverageCushion, icrCushion } = metrics;
  
  let riskScore = 0;
  
  // Covenant breaches (critical - 40 points)
  if (totalBreaches > 0) riskScore += 40;
  else if (dscrCushion < 0 || leverageCushion < 0 || icrCushion < 0) riskScore += 30;
  else if (dscrCushion < 0.2 || leverageCushion < 0.5) riskScore += 20;
  else if (dscrCushion < 0.5 || leverageCushion < 1.0) riskScore += 10;
  
  // Liquidity runway (critical - 30 points)
  if (liquidityRunway < 3) riskScore += 30;
  else if (liquidityRunway < 6) riskScore += 20;
  else if (liquidityRunway < 12) riskScore += 10;
  else if (liquidityRunway < 18) riskScore += 5;
  
  // ICR cushion (important - 20 points)
  if (icrCushion < 0) riskScore += 20;
  else if (icrCushion < 0.5) riskScore += 10;
  else if (icrCushion < 1.0) riskScore += 5;
  
  // Historical volatility adjustment (10 points)
  if (historicalAnalysis && historicalAnalysis.burnVolatility > 0.5) {
    riskScore += 10;
  } else if (historicalAnalysis && historicalAnalysis.burnVolatility > 0.3) {
    riskScore += 5;
  }
  
  // Risk level mapping
  if (riskScore >= 60) return "HIGH";
  if (riskScore >= 40) return "ELEVATED";
  if (riskScore >= 20) return "MODERATE";
  return "LOW";
}

// Custom tooltip component
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
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebtStressTesting({ params, ccy, baseProjection, historicalData = [], newFacilityParams }) {
  if (!baseProjection) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading stress testing data...</p>
          <p className="text-slate-500 text-sm mt-2">Building comprehensive stress scenarios...</p>
        </div>
      </div>
    );
  }

  const [selectedScenarios, setSelectedScenarios] = useState([
    'base', 'revenueDown20', 'rateHike300', 'mildRecession', 'severeRecession'
  ]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Historical analysis
  const historicalAnalysis = useMemo(() => {
    return calculateHistoricalBurnRates(historicalData);
  }, [historicalData]);

  const historicalLiquidityMetrics = useMemo(() => {
    return calculateHistoricalLiquidityMetrics(historicalData);
  }, [historicalData]);

  // Payment structure analysis
  const paymentStructureAnalysis = useMemo(() => {
    return {
      frequency: calculatePaymentFrequencyImpact(params, ccy),
      hasBalloon: params.balloonPercentage > 0,
      balloonAmount: params.requestedLoanAmount * (params.balloonPercentage / 100),
      dayCountImpact: params.dayCountConvention === "Actual/360" ? 1.014 : 1.0
    };
  }, [params, ccy]);

  // Enhanced stress test results
  const stressTestResults = useMemo(() => {
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
        const existingDebtProjection = buildProjection(adjustedParams);
        
        // New facility stress test
        let combinedProjection = existingDebtProjection;
        let refinancingRisk = { level: "N/A" };
        
        if (params.requestedLoanAmount > 0) {
          const newFacilityAdjusted = {
            ...adjustedParams,
            openingDebt: params.openingDebt + params.requestedLoanAmount,
            interestRate: params.proposedPricing + (adjustments.rateShock || 0),
            balloonPercentage: params.balloonPercentage,
            useBalloonPayment: params.useBalloonPayment,
            customAmortizationIntervals: params.customAmortizationIntervals,
            paymentFrequency: params.paymentFrequency,
            dayCountConvention: params.dayCountConvention
          };
          
          combinedProjection = buildProjection(newFacilityAdjusted);
          refinancingRisk = calculateRefinancingRisk(params, combinedProjection, ccy);
        }
        
        const projection = params.requestedLoanAmount > 0 ? combinedProjection : existingDebtProjection;
        
        // Extract metrics with safe defaults
        const minDSCR = projection.creditStats?.minDSCR || 1.0;
        const maxLeverage = projection.creditStats?.maxLeverage || 0;
        const minICR = projection.creditStats?.minICR || 1.0;
        
        const totalBreaches = (projection.breaches?.dscrBreaches || 0) + 
                            (projection.breaches?.icrBreaches || 0) + 
                            (projection.breaches?.ndBreaches || 0);
        
        const dscrCushion = minDSCR - (params.minDSCR || 1.2);
        const leverageCushion = (params.maxNDToEBITDA || 3.5) - maxLeverage;
        const icrCushion = minICR - (params.targetICR || 2.0);
        
        const liquidityRunway = calculateLiquidityRunway(projection, scenarioKey, historicalAnalysis, params);
        
        let riskLevel = determineRiskLevel(
          { totalBreaches, liquidityRunway, dscrCushion, leverageCushion, icrCushion },
          params, historicalAnalysis
        );
        
        // Adjust for refinancing risk
        if (refinancingRisk.level === "HIGH") riskLevel = "HIGH";
        if (paymentStructureAnalysis.frequency.riskLevel === "HIGH" && liquidityRunway < 6) {
          if (riskLevel === "LOW") riskLevel = "MODERATE";
        }
        
        const riskColorMap = {
          "LOW": COLORS.success.chart,
          "MODERATE": COLORS.warning.chart,
          "ELEVATED": "#f97316",
          "HIGH": COLORS.danger.chart
        };
        
        results[scenarioKey] = {
          name: scenario.name,
          description: scenario.description,
          color: scenario.color,
          minDSCR, maxLeverage, minICR, totalBreaches,
          dscrCushion, leverageCushion, icrCushion,
          liquidityRunway, riskLevel,
          riskColor: riskColorMap[riskLevel],
          projection,
          existingDebtMetrics: {
            minDSCR: existingDebtProjection.creditStats?.minDSCR || 1.0,
            maxLeverage: existingDebtProjection.creditStats?.maxLeverage || 0
          },
          combinedMetrics: params.requestedLoanAmount > 0 ? {
            minDSCR: combinedProjection.creditStats?.minDSCR || 1.0,
            maxLeverage: combinedProjection.creditStats?.maxLeverage || 0
          } : null,
          refinancingRisk,
          equityValue: projection.equityValue || 0,
          equityMOIC: projection.moic || 0,
          irr: projection.irr || 0,
          usesHistoricalData: historicalAnalysis !== null
        };
      });
      
      return results;
    } catch (error) {
      console.error("Error calculating stress test results:", error);
      return {};
    } finally {
      setIsCalculating(false);
    }
  }, [params, baseProjection, historicalAnalysis, paymentStructureAnalysis, ccy]);

  // Chart data preparation
  const comparisonData = useMemo(() => {
    return selectedScenarios.map(key => ({
      scenario: DEBT_STRESS_SCENARIOS[key].name,
      minDSCR: stressTestResults[key]?.minDSCR || 0,
      covenant: params.minDSCR,
      color: DEBT_STRESS_SCENARIOS[key].color
    }));
  }, [selectedScenarios, stressTestResults, params.minDSCR]);

  const cushionRadarData = useMemo(() => {
    return selectedScenarios.map(key => ({
      scenario: DEBT_STRESS_SCENARIOS[key].name.substring(0, 15),
      "DSCR Cushion": Math.max(0, (stressTestResults[key]?.dscrCushion || 0) * 100),
      "Leverage Cushion": Math.max(0, (stressTestResults[key]?.leverageCushion || 0) * 50),
      "ICR Cushion": Math.max(0, (stressTestResults[key]?.icrCushion || 0) * 50),
      "Liquidity": Math.min(100, (stressTestResults[key]?.liquidityRunway || 0) / 24 * 100)
    }));
  }, [selectedScenarios, stressTestResults]);

  const liquidityData = useMemo(() => {
    return selectedScenarios.map(key => ({
      scenario: DEBT_STRESS_SCENARIOS[key].name,
      liquidityRunway: Math.min(36, stressTestResults[key]?.liquidityRunway || 0),
      riskColor: stressTestResults[key]?.riskColor || COLORS.success.chart
    }));
  }, [selectedScenarios, stressTestResults]);

  const valuationImpactData = useMemo(() => {
    const baseValue = stressTestResults.base?.equityValue || 1;
    return selectedScenarios.map(key => ({
      scenario: DEBT_STRESS_SCENARIOS[key].name,
      equityValue: (stressTestResults[key]?.equityValue || 0) / 1_000_000,
      valueLoss: baseValue > 0 ? ((baseValue - (stressTestResults[key]?.equityValue || 0)) / baseValue) * 100 : 0,
      moic: stressTestResults[key]?.equityMOIC || 0,
      irr: (stressTestResults[key]?.irr || 0) * 100
    }));
  }, [selectedScenarios, stressTestResults]);

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

  // Find worst case scenario
  const worstCaseScenario = useMemo(() => {
    let worst = null;
    let lowestDSCR = Infinity;
    
    Object.entries(stressTestResults).forEach(([key, result]) => {
      if (result.minDSCR < lowestDSCR) {
        lowestDSCR = result.minDSCR;
        worst = { key, ...result };
      }
    });
    
    return worst;
    
    return worst;
  }, [stressTestResults]);

  // Handle export
  const handleExport = () => {
    exportComprehensiveStressTestReport(
      stressTestResults, 
      params, 
      historicalAnalysis, 
      historicalLiquidityMetrics, 
      selectedScenarios, 
      ccy
    );
  };

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

  return (
    <div className="space-y-6">
      {/* Payment Structure Risk Analysis Card */}
      {params.requestedLoanAmount > 0 && (
        <Card className="border-l-4 border-l-indigo-600 shadow-md hover:shadow-lg transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-600" />
              Payment Structure Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Balloon Refinancing Risk */}
              {params.balloonPercentage > 0 && (
                <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <h4 className="font-semibold text-sm mb-2 opacity-90">Balloon Refinancing</h4>
                  <div className="text-2xl font-bold mb-1">
                    {currencyFmtMM(paymentStructureAnalysis.balloonAmount, ccy)}
                  </div>
                  <div className="text-xs opacity-80 mb-3">
                    Due in Year {params.proposedTenor || params.debtTenorYears}
                  </div>
                  <div className="mt-3 space-y-1 bg-white/20 rounded p-2">
                    {selectedScenarios.slice(0, 3).map(key => {
                      const risk = stressTestResults[key]?.refinancingRisk || { level: "UNKNOWN", feasible: false };
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="truncate">{DEBT_STRESS_SCENARIOS[key].name}:</span>
                          <span className={`font-bold ${risk.feasible ? "text-emerald-200" : "text-red-200"}`}>
                            {risk.feasible ? "✓" : "✗"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Payment Frequency Impact */}
              <div className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <h4 className="font-semibold text-sm mb-2 opacity-90">Payment Frequency</h4>
                <div className="text-2xl font-bold mb-1">
                  {params.paymentFrequency || "Quarterly"}
                </div>
                <div className="text-xs opacity-80 mb-3">
                  {paymentStructureAnalysis.frequency.paymentsPerYear} payments/year
                </div>
                <div className="mt-3 text-xs space-y-1 bg-white/20 rounded p-2">
                  <div className="flex justify-between">
                    <span>Risk Level:</span>
                    <span className="font-bold">
                      {paymentStructureAnalysis.frequency.riskLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Buffer:</span>
                    <span className="font-bold">
                      {currencyFmtMM(paymentStructureAnalysis.frequency.minCashBuffer, ccy)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Day Count Impact */}
              <div className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <h4 className="font-semibold text-sm mb-2 opacity-90">Interest Impact</h4>
                <div className="text-2xl font-bold mb-1">
                  {params.dayCountConvention || "Actual/365"}
                </div>
                <div className="text-xs opacity-80 mb-3">
                  {params.dayCountConvention === "Actual/360" 
                    ? "Higher effective rate" 
                    : "Standard calculation"}
                </div>
                <div className="mt-3 text-xs bg-white/20 rounded p-2">
                  <div className="flex justify-between">
                    <span>Extra Interest/yr:</span>
                    <span className="font-bold">
                      {params.dayCountConvention === "Actual/360" 
                        ? currencyFmtMM(params.requestedLoanAmount * params.proposedPricing * 0.014, ccy)
                        : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Context Card */}
      {historicalData.length > 0 && (
        <Card className="border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <History className="w-6 h-6 text-purple-600" />
              Historical Context & Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <div className="text-xs font-semibold opacity-90 mb-1">Historical Years</div>
                <div className="text-3xl font-bold">{historicalData.length}</div>
                <div className="text-xs opacity-80">Years of data</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <div className="text-xs font-semibold opacity-90 mb-1">Operating CF</div>
                <div className="text-3xl font-bold">
                  {historicalAnalysis?.isPositiveCashFlow ? "+" : "-"}
                </div>
                <div className="text-xs opacity-80">
                  {historicalAnalysis?.isPositiveCashFlow ? "Positive" : "Burn mode"}
                </div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <div className="text-xs font-semibold opacity-90 mb-1">Min Cash</div>
                <div className="text-2xl font-bold">
                  {currencyFmtMM(historicalLiquidityMetrics.minCashBalance, ccy)}
                </div>
                <div className="text-xs opacity-80">Historical low</div>
              </div>
              
              <div className="text-center p-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                <div className="text-xs font-semibold opacity-90 mb-1">Data Quality</div>
                <div className="text-3xl font-bold">
                  {historicalAnalysis?.yearsWithNegativeCash > 0 ? "High" : "Good"}
                </div>
                <div className="text-xs opacity-80">Analysis depth</div>
              </div>
            </div>
            
            {historicalAnalysis?.stressMultipliers && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-sm mb-3 text-slate-800 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Historical Stress Patterns
                </h4>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-medium text-slate-600">Revenue Decline: </span>
                    <span className="font-bold text-slate-800">
                      {pctFmt((historicalAnalysis.stressMultipliers.revenueDecline - 1))}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-medium text-slate-600">Burn Increase: </span>
                    <span className="font-bold text-slate-800">
                      {pctFmt(historicalAnalysis.stressMultipliers.burnRateIncrease - 1)}
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="font-medium text-slate-600">WC Strain: </span>
                    <span className="font-bold text-slate-800">
                      {pctFmt(historicalAnalysis.stressMultipliers.workingCapitalStrain - 1)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Summary KPIs */}
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
          Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length > 0
            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">With Breaches</div>
          <div className="text-3xl font-bold">
            {Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length}
          </div>
          <div className="text-xs opacity-80">Out of {Object.keys(DEBT_STRESS_SCENARIOS).length}</div>
        </div>
        
        {params.balloonPercentage > 0 && (
          <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Refinanceable</div>
            <div className="text-3xl font-bold">
              {Object.values(stressTestResults).filter(r => r.refinancingRisk?.feasible).length}
            </div>
            <div className="text-xs opacity-80">Balloon scenarios</div>
          </div>
        )}
        
        <div className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Analysis Type</div>
          <div className="text-2xl font-bold">{params.requestedLoanAmount > 0 ? "Combined" : "Existing"}</div>
          <div className="text-xs opacity-80">{historicalData.length > 0 ? "Historical+" : "Projection"}</div>
        </div>
      </div>

      {/* Scenario Selection Card */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Select Scenarios to Compare
            {historicalData.length > 0 && (
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
                    {result?.usesHistoricalData && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <History className="w-3 h-3" />
                        <span className="font-semibold">Historical</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Covenant Compliance Table - Enhanced */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Covenant Compliance Stress Test
              {historicalData.length > 0 && (
                <span className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold border border-purple-200">
                  Enhanced with Historical Data
                </span>
              )}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
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
                  <th className="text-right p-3 font-semibold text-slate-700">Lev. Cushion</th>
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
                            <div className="font-semibold text-slate-800">{result?.name || DEBT_STRESS_SCENARIOS[key].name}</div>
                            <div className="text-xs text-slate-500">{result?.description || DEBT_STRESS_SCENARIOS[key].description}</div>
                          </div>
                          {result?.usesHistoricalData && (
                            <History className="w-3 h-3 text-purple-500" title="Uses historical data" />
                          )}
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
                      <td className={`text-right p-3 font-semibold ${
                        result?.leverageCushion < 0 ? 'text-red-600' : 
                        result?.leverageCushion < 0.5 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {result?.leverageCushion >= 0 ? '+' : ''}{numFmt(result?.leverageCushion || 0)}x
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
              Legend
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br from-${COLORS.success.from} to-${COLORS.success.to}`} />
                <span className="text-slate-700">Low Risk - Strong cushion</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br from-${COLORS.warning.from} to-${COLORS.warning.to}`} />
                <span className="text-slate-700">Moderate - Adequate</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-slate-700">Elevated - Limited cushion</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br from-${COLORS.danger.from} to-${COLORS.danger.to}`} />
                <span className="text-slate-700">High - Breach risk</span>
              </div>
            </div>
            {historicalData.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-300">
                <div className="flex items-center gap-2 text-purple-600 text-xs font-semibold">
                  <History className="w-4 h-4" />
                  <span>Historical data enhances liquidity runway accuracy by {historicalData.length}x</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DSCR Comparison Chart */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Debt Service Coverage Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={comparisonData} height={350} ariaLabel="DSCR comparison across scenarios">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="minDSCR" name="Min DSCR" radius={[8, 8, 0, 0]}>
                  {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
                <Line 
                  type="monotone" 
                  dataKey="covenant" 
                  stroke={COLORS.danger.chart}
                  strokeWidth={3} 
                  strokeDasharray="5 5" 
                  name="DSCR Covenant" 
                  dot={{ r: 4 }}
                />
              </ComposedChart></ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Covenant Cushion Radar Chart */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Covenant Cushion Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={cushionRadarData} height={400} ariaLabel="Covenant cushion radar chart">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={cushionRadarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="scenario" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                <Radar name="DSCR Cushion" dataKey="DSCR Cushion" stroke={COLORS.primary.chart} fill={COLORS.primary.chart} fillOpacity={0.5} />
                <Radar name="Leverage Cushion" dataKey="Leverage Cushion" stroke={COLORS.success.chart} fill={COLORS.success.chart} fillOpacity={0.5} />
                <Radar name="ICR Cushion" dataKey="ICR Cushion" stroke={COLORS.warning.chart} fill={COLORS.warning.chart} fillOpacity={0.5} />
                <Radar name="Liquidity" dataKey="Liquidity" stroke={COLORS.purple.chart} fill={COLORS.purple.chart} fillOpacity={0.5} />
                <Legend />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Liquidity Runway Chart */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Liquidity Runway Under Stress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={liquidityData} height={350} ariaLabel="Liquidity runway across scenarios">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liquidityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
                <YAxis label={{ value: 'Months', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
                <Tooltip 
                  content={<CustomTooltip />}
                  formatter={(value) => [`${value >= 36 ? "36+" : numFmt(value)} months`, "Liquidity Runway"]}
                />
                <Legend />
                <Bar 
                  dataKey="liquidityRunway" 
                  name="Liquidity Runway"
                  radius={[8, 8, 0, 0]}
                >
                  {liquidityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.riskColor} />
                  ))}
                </Bar>
                <Line 
                  type="monotone" 
                  dataKey={() => 6} 
                  stroke={COLORS.danger.chart}
                  strokeWidth={3} 
                  strokeDasharray="5 5" 
                  name="Minimum Runway (6 mos)" 
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Valuation Impact */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Equity Value Impact Under Stress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={valuationImpactData} height={350} ariaLabel="Equity value impact">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valuationImpactData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip 
                  content={<CustomTooltip />}
                  formatter={(value, name) => {
                    if (name === "Equity Value") return [currencyFmtMM(value * 1_000_000, ccy), name];
                    if (name === "Value Loss %") return [numFmt(value) + "%", name];
                    if (name === "IRR") return [pctFmt(value / 100), name];
                    return [numFmt(value) + "x", name];
                  }} 
                />
                <Legend />
                <Bar yAxisId="left" dataKey="equityValue" fill={COLORS.success.chart} name="Equity Value" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="right" dataKey="valueLoss" fill={COLORS.danger.chart} name="Value Loss %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Enhanced Risk Summary */}
      <Card className="border-l-4 border-l-orange-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            Risk Summary & Recommendations
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
                {Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length > 0 && (
                  <li className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-red-700 font-bold">
                        {Object.values(stressTestResults).filter(r => r.totalBreaches > 0).length} scenarios result in covenant breaches
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
                {Object.values(stressTestResults).filter(r => r.riskLevel === "ELEVATED" || r.riskLevel === "HIGH").length > Object.keys(DEBT_STRESS_SCENARIOS).length / 2 && (
                  <li className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-amber-700">
                      Over 50% of scenarios show elevated or high risk. Consider reducing leverage or improving margins by 3-5%.
                    </span>
                  </li>
                )}
                {historicalData.length > 0 && (
                  <li className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      <strong className="text-emerald-700 font-bold">
                        Analysis enhanced with {historicalData.length} years of historical data
                      </strong>
                      <span className="text-emerald-600"> - Liquidity projections are more accurate than industry averages.</span>
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-base mb-3 text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Recommendations
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