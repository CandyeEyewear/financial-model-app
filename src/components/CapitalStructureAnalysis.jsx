import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { ChartWrapper } from "./ChartWrapper";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { buildProjection } from "../utils/buildProjection";
import { DollarSign, TrendingUp, AlertCircle, AlertTriangle, Calendar, Clock, CheckCircle2, Info } from "lucide-react";
import { ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";

// Color palette for consistency
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#4F46E5' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10B981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#F59E0B' },
  danger: { from: 'red-500', to: 'red-600', chart: '#EF4444' },
  info: { from: 'indigo-500', to: 'indigo-600', chart: '#6366F1' },
  purple: { from: 'purple-500', to: 'purple-600', chart: '#A855F7' },
};

// Chart colors array for pie charts
const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#A855F7'];

// NEW: Payment structure risk calculation
const calculatePaymentRiskAdjustment = (params) => {
  const safeParams = params || {};
  let adjustment = 0;
  
  // Balloon risk
  const balloonPercentage = safeParams.balloonPercentage || 0;
  if (balloonPercentage > 75) adjustment += 0.20;
  else if (balloonPercentage > 50) adjustment += 0.10;
  else if (balloonPercentage > 25) adjustment += 0.05;
  
  // Payment frequency risk
  const paymentFrequency = safeParams.paymentFrequency || "Quarterly";
  if (paymentFrequency === "Monthly") adjustment += 0.10;
  else if (paymentFrequency === "Bullet") adjustment += 0.15;
  
  // Day count penalty
  const dayCountConvention = safeParams.dayCountConvention || "30/360";
  if (dayCountConvention === "Actual/360") adjustment += 0.02;
  
  return Math.min(adjustment, 0.3); // Cap at 30% reduction
};

// NEW: Calculate minimum cash buffer needed
const calculateMinimumCashBuffer = (params, annualDebtService) => {
  const safeParams = params || {};
  const paymentFrequency = safeParams.paymentFrequency || "Quarterly";
  
  let bufferMultiplier = 1.0;
  switch (paymentFrequency) {
    case "Monthly":
      bufferMultiplier = 3.0; // 3 months of payments
      break;
    case "Quarterly":
      bufferMultiplier = 6.0; // 2 quarters of payments
      break;
    case "Semi-Annually":
      bufferMultiplier = 9;
      break;
    case "Annual":
      bufferMultiplier = 12;
      break;
    case "Bullet":
      bufferMultiplier = 0.5; // Lower buffer for bullet payments
      break;
    default:
      bufferMultiplier = 2.0;
  }
  
  return annualDebtService * (bufferMultiplier / 12);
};

// NEW: Assess payment structure risk
const assessPaymentStructureRisk = (debtAmount, params) => {
  const safeParams = params || {};
  const balloonPercentage = safeParams.balloonPercentage || 0;
  const paymentFrequency = safeParams.paymentFrequency || "Quarterly";
  
  let riskLevel = "LOW";
  let scoreAdjustment = 0;
  
  if (balloonPercentage > 75) {
    riskLevel = "HIGH";
    scoreAdjustment = -15;
  } else if (balloonPercentage > 50) {
    riskLevel = "MEDIUM_HIGH";
    scoreAdjustment = -10;
  } else if (balloonPercentage > 25) {
    riskLevel = "MEDIUM";
    scoreAdjustment = -5;
  }
  
  // Additional penalty for frequent payments with high debt
  if (paymentFrequency === "Monthly" && debtAmount > 10000000) {
    scoreAdjustment -= 3;
  } else if (paymentFrequency === "Bullet") {
    scoreAdjustment -= 2;
  }
  
  return {
    riskLevel,
    scoreAdjustment,
    balloonAmount: debtAmount * (balloonPercentage / 100),
    paymentFrequency,
    hasBalloon: balloonPercentage > 0
  };
};

// NEW: Calculate amortization profile
const calculateAmortizationProfile = (scenario, params, projection) => {
  const safeParams = params || {};
  
  // FIXED: Only use balloon if checkbox is checked AND frequency is Balloon
  const balloonPercentage = 
    (safeParams.paymentFrequency === "Balloon" && safeParams.useBalloonPayment)
      ? (safeParams.balloonPercentage || 0)
      : 0;
  
  const maturityYears = safeParams.proposedTenor || safeParams.debtTenorYears || 5;
  const interestOnlyYears = safeParams.interestOnlyYears || 0;
  
  // Check for custom amortization
  let customSchedule = null;
  if (safeParams.paymentFrequency === "customAmortization" && 
      Array.isArray(safeParams.customAmortizationIntervals)) {
    // Use the same expand logic as buildProjection
    const ioYrs = Math.max(0, Math.min(maturityYears, interestOnlyYears));
    const amortYears = Math.max(maturityYears - ioYrs, 1);
    const base = Math.floor(amortYears / 4);
    const rem = amortYears % 4;
    
    customSchedule = [];
    for (let y = 0; y < ioYrs; y++) customSchedule.push(0);
    
    for (let k = 0; k < 4; k++) {
      const bucketYears = base + (k < rem ? 1 : 0);
      const pctPerYear = bucketYears > 0 ? (safeParams.customAmortizationIntervals[k] || 0) / bucketYears : 0;
      for (let y = 0; y < bucketYears; y++) customSchedule.push(pctPerYear);
    }
    
    while (customSchedule.length < maturityYears) customSchedule.push(0);
  }
  
  const annualData = [];
  let remainingPrincipal = scenario.debtAmount;
  const balloonPayment = scenario.debtAmount * (balloonPercentage / 100);
  const amortizingAmount = scenario.debtAmount - balloonPayment;
  
  for (let year = 1; year <= maturityYears; year++) {
    const isFinalYear = year === maturityYears;
    const isInterestOnly = year <= interestOnlyYears;
    
    let principalPayment = 0;
    
    // Use custom schedule if available
    if (customSchedule && customSchedule[year - 1]) {
      principalPayment = (customSchedule[year - 1] / 100) * scenario.debtAmount;
    } else if (!isInterestOnly) {
      // Regular amortization
      const amortPeriods = maturityYears - interestOnlyYears;
      principalPayment = amortPeriods > 0 ? amortizingAmount / amortPeriods : 0;
    }
    
    // Add balloon in final year
    if (isFinalYear && balloonPayment > 0) {
      principalPayment += balloonPayment;
    }
    
    const interestPayment = remainingPrincipal * (scenario.effectiveRate || 0.08);
    const totalPayment = principalPayment + interestPayment;
    
    annualData.push({
      year,
      principalPayment,
      interestPayment,
      totalPayment,
      remainingPrincipal: Math.max(0, remainingPrincipal - principalPayment),
      isBalloonYear: isFinalYear && balloonPercentage > 0,
      isInterestOnly
    });
    
    remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
  }
  
  return annualData;
};
export function CapitalStructureAnalysis({ params, ccy, historicalData = [] }) {
  const [selectedScenario, setSelectedScenario] = useState(null);

  // Calculate metrics from historical data
  const historicalMetrics = useMemo(() => {
    if (!historicalData || historicalData.length === 0) {
      return null;
    }

    const validYears = historicalData.filter(d => d.revenue > 0 && d.ebitda && d.ebitda > 0);
    
    if (validYears.length === 0) {
      return null;
    }

    // Average EBITDA from historical data
    const avgEBITDA = validYears.reduce((sum, y) => sum + y.ebitda, 0) / validYears.length;
    
    // Most recent EBITDA (for conservative leverage calculation)
    const recentEBITDA = validYears[validYears.length - 1].ebitda;
    
    // Calculate historical revenue growth
    let avgGrowth = 0;
    if (validYears.length >= 2) {
      const growthRates = [];
      for (let i = 1; i < validYears.length; i++) {
        const growth = (validYears[i].revenue - validYears[i-1].revenue) / validYears[i-1].revenue;
        growthRates.push(growth);
      }
      avgGrowth = growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length;
    }

    // Calculate EBITDA margin stability (lower volatility = can handle more debt)
    const ebitdaMargins = validYears.map(y => y.ebitda / y.revenue);
    const avgMargin = ebitdaMargins.reduce((sum, m) => sum + m, 0) / ebitdaMargins.length;
    const marginVolatility = Math.sqrt(
      ebitdaMargins.reduce((sum, m) => sum + Math.pow(m - avgMargin, 2), 0) / ebitdaMargins.length
    );

    // Historical leverage (if debt data exists)
    const historicalLeverage = validYears
      .filter(y => (y.longTermDebt || y.shortTermDebt) && y.ebitda > 0)
      .map(y => {
        const totalDebt = (y.longTermDebt || 0) + (y.shortTermDebt || 0);
        return totalDebt / y.ebitda;
      });
    
    const avgHistoricalLeverage = historicalLeverage.length > 0
      ? historicalLeverage.reduce((sum, l) => sum + l, 0) / historicalLeverage.length
      : null;

    return {
      avgEBITDA,
      recentEBITDA,
      avgGrowth,
      marginVolatility,
      avgHistoricalLeverage,
      yearsOfData: validYears.length,
      ebitdaMargin: avgMargin,
    };
  }, [historicalData]);

  const capitalScenarios = useMemo(() => {
    // STEP 1: Determine total capital needed
    const totalCapitalNeeded = (params.requestedLoanAmount || 0) + (params.equityContribution || 0);
    
    // STEP 2: Calculate what they can actually afford based on EBITDA
    const baseEBITDA = historicalMetrics?.recentEBITDA || 
                       (params.baseRevenue * (1 - (params.cogsPct || 0) - (params.opexPct || 0)));
    const effectiveEBITDA = baseEBITDA > 0 ? baseEBITDA : totalCapitalNeeded * 0.15;

    // STEP 3: Payment structure risk adjustment
    const paymentRiskAdjustment = calculatePaymentRiskAdjustment(params);
    
    // Maximum debt capacity at different leverage levels
    const maxConservativeLeverage = 2.0 * (1 - paymentRiskAdjustment);
    const maxModerateLeverage = 3.0 * (1 - paymentRiskAdjustment);
    const maxAggressiveLeverage = 4.0 * (1 - paymentRiskAdjustment);
    
    const maxConservativeDebt = effectiveEBITDA * maxConservativeLeverage;
    const maxModerateDebt = effectiveEBITDA * maxModerateLeverage;
    const maxAggressiveDebt = effectiveEBITDA * maxAggressiveLeverage;

    // STEP 4: Build scenarios with different debt/equity mixes
    const scenarios = {};
    
    // Calculate effective rate
    const dayCountConvention = params.dayCountConvention || "30/360";
    const interestRate = params.interestRate || 0;
    const effectiveRate = dayCountConvention === "Actual/360" ? 
      interestRate * 1.014 : interestRate;

    // Scenario 1: Maximum Debt (100% Debt)
    const maxDebtAmount = Math.min(totalCapitalNeeded, maxAggressiveDebt);
    scenarios.maxDebt = {
      label: `Maximum Debt (100% Debt)`,
      params: {
        ...params,
        openingDebt: maxDebtAmount,
        equityContribution: 0,
      },
      leverage: maxDebtAmount / effectiveEBITDA,
      debtAmount: maxDebtAmount,
      equityAmount: 0,
      debtPercentage: 100,
      equityPercentage: 0,
      isAffordable: maxDebtAmount <= maxAggressiveDebt,
      effectiveRate: effectiveRate,
    };

    // Scenario 2: High Debt (70% debt, 30% equity)
    const highDebtAmount = Math.min(totalCapitalNeeded * 0.70, maxAggressiveDebt);
    scenarios.highDebt = {
      label: `High Debt (70% Debt)`,
      params: {
        ...params,
        openingDebt: highDebtAmount,
        equityContribution: totalCapitalNeeded - highDebtAmount,
      },
      leverage: highDebtAmount / effectiveEBITDA,
      debtAmount: highDebtAmount,
      equityAmount: totalCapitalNeeded - highDebtAmount,
      debtPercentage: 70,
      equityPercentage: 30,
      isAffordable: highDebtAmount <= maxAggressiveDebt,
      effectiveRate: effectiveRate,
    };

    // Scenario 3: Moderate Debt (60% debt, 40% equity)
    const modDebtAmount = Math.min(totalCapitalNeeded * 0.60, maxModerateDebt);
    scenarios.modDebt = {
      label: `Moderate Debt (60% Debt)`,
      params: {
        ...params,
        openingDebt: modDebtAmount,
        equityContribution: totalCapitalNeeded - modDebtAmount,
      },
      leverage: modDebtAmount / effectiveEBITDA,
      debtAmount: modDebtAmount,
      equityAmount: totalCapitalNeeded - modDebtAmount,
      debtPercentage: 60,
      equityPercentage: 40,
      isAffordable: modDebtAmount <= maxModerateDebt,
      effectiveRate: effectiveRate,
    };

    // Scenario 4: Conservative (50% debt, 50% equity)
    const lowDebtAmount = Math.min(totalCapitalNeeded * 0.50, maxConservativeDebt);
    scenarios.lowDebt = {
      label: `Conservative (50% Debt)`,
      params: {
        ...params,
        openingDebt: lowDebtAmount,
        equityContribution: totalCapitalNeeded - lowDebtAmount,
      },
      leverage: lowDebtAmount / effectiveEBITDA,
      debtAmount: lowDebtAmount,
      equityAmount: totalCapitalNeeded - lowDebtAmount,
      debtPercentage: 50,
      equityPercentage: 50,
      isAffordable: lowDebtAmount <= maxConservativeDebt,
      effectiveRate: effectiveRate,
    };

    // Scenario 5: Equity Heavy (30% debt, 70% equity)
    const equityDebtAmount = Math.min(totalCapitalNeeded * 0.30, maxConservativeDebt);
    scenarios.equity = {
      label: `Equity Heavy (30% Debt)`,
      params: {
        ...params,
        openingDebt: equityDebtAmount,
        equityContribution: totalCapitalNeeded - equityDebtAmount,
      },
      leverage: equityDebtAmount / effectiveEBITDA,
      debtAmount: equityDebtAmount,
      equityAmount: totalCapitalNeeded - equityDebtAmount,
      debtPercentage: 30,
      equityPercentage: 70,
      isAffordable: equityDebtAmount <= maxConservativeDebt,
      effectiveRate: effectiveRate,
    };
    
    // Scenario 6: All Equity (100% Equity)
    scenarios.allEquity = {
      label: `All Equity (100% Equity)`,
      params: {
        ...params,
        openingDebt: 0,
        equityContribution: totalCapitalNeeded,
      },
      leverage: 0,
      debtAmount: 0,
      equityAmount: totalCapitalNeeded,
      debtPercentage: 0,
      equityPercentage: 100,
      isAffordable: true,
      effectiveRate: effectiveRate,
    };     

    // Add payment structure analysis to each scenario
    Object.keys(scenarios).forEach(key => {
      const scenario = scenarios[key];
      const paymentRisk = assessPaymentStructureRisk(scenario.debtAmount, params);
      scenario.paymentStructureRisk = paymentRisk;
      scenario.annualDebtService = scenario.debtAmount * effectiveRate;
      scenario.minCashBuffer = calculateMinimumCashBuffer(params, scenario.annualDebtService);
    });

    return {
      scenarios,
      capacityAnalysis: {
        totalCapitalNeeded,
        effectiveEBITDA,
        maxConservativeDebt,
        maxModerateDebt,
        maxAggressiveDebt,
        paymentRiskAdjustment,
      }
    };
  }, [params, historicalMetrics]);

  const capitalProjections = useMemo(() => {
    const result = {};
    Object.keys(capitalScenarios.scenarios).forEach(key => {
      try {
        const projection = buildProjection(capitalScenarios.scenarios[key].params);
        const scenario = capitalScenarios.scenarios[key];
        
        // Calculate MOIC if not provided by buildProjection
        const equityInvestment = scenario.equityAmount || 0;
        const equityValue = projection.equityValue || 0;
        
        // Ensure MOIC is properly calculated
        const calculatedMOIC = equityInvestment > 0 ? equityValue / equityInvestment : 0;
        
        result[key] = {
          ...projection,
          equityMOIC: projection.moic || projection.equityMOIC || calculatedMOIC,
          moic: projection.moic || projection.equityMOIC || calculatedMOIC,
        };
      } catch (error) {
        console.error(`Projection failed for ${key}:`, error);
        result[key] = {
          enterpriseValue: 0,
          equityValue: 0,
          equityMOIC: 0,
          moic: 0,
          irr: 0,
          creditStats: { minDSCR: 0, maxLeverage: 0 },
          breaches: { dscrBreaches: 0, icrBreaches: 0, ndBreaches: 0 },
          annualCashFlow: []
        };
      }
    });
    return result;
  }, [capitalScenarios]);

  const comparisonData = Object.keys(capitalScenarios.scenarios).map(key => {
    const scenario = capitalScenarios.scenarios[key];
    const projection = capitalProjections[key];
    
    const equityMOIC = projection.moic || projection.equityMOIC || 0;
    const irr = projection.irr || 0;
    const minDSCR = projection.creditStats?.minDSCR || 0;
    
    const annualDebtService = scenario.annualDebtService || 0;
    const minCashBuffer = scenario.minCashBuffer || 0;
    const paymentRisk = scenario.paymentStructureRisk || {};
    
    return {
      scenario: scenario.label,
      leverage: scenario.leverage,
      debtAmount: scenario.debtAmount / 1_000_000,
      equityAmount: scenario.equityAmount / 1_000_000,
      debtPercentage: scenario.debtPercentage,
      equityPercentage: scenario.equityPercentage,
      totalCapital: (scenario.debtAmount + scenario.equityAmount) / 1_000_000,
      isAffordable: scenario.isAffordable,
      enterpriseValue: (projection.enterpriseValue || 0) / 1_000_000,
      equityValue: (projection.equityValue || 0) / 1_000_000,
      equityMOIC: isFinite(equityMOIC) ? equityMOIC : 0,
      irr: isFinite(irr) ? irr : 0,
      minDSCR: isFinite(minDSCR) ? minDSCR : 0,
      maxLeverage: projection.creditStats?.maxLeverage || 0,
      breaches: (projection.breaches?.dscrBreaches || 0) +
        (projection.breaches?.icrBreaches || 0) +
        (projection.breaches?.ndBreaches || 0),
      
      // Payment structure metrics
      annualDebtService: annualDebtService / 1_000_000,
      minCashBuffer: minCashBuffer / 1_000_000,
      balloonAmount: (paymentRisk.balloonAmount || 0) / 1_000_000,
      hasBalloon: paymentRisk.hasBalloon,
      paymentFrequency: paymentRisk.paymentFrequency,
      refinancingRisk: paymentRisk.riskLevel,
      paymentRiskScore: paymentRisk.scoreAdjustment,
      effectiveRate: scenario.effectiveRate,
      score: 0,
    };
  });

  // Generate amortization profile data for charts
  const amortizationData = useMemo(() => {
    if (Object.keys(capitalScenarios.scenarios).length === 0) return [];
    
    const profileData = [];
    const scenarioKeys = Object.keys(capitalScenarios.scenarios);
    const maturityYears = params.proposedTenor || params.debtTenorYears || 5;
    
    for (let year = 1; year <= maturityYears; year++) {
      const yearData = { year };
      
      scenarioKeys.forEach(key => {
        const scenario = capitalScenarios.scenarios[key];
        const projection = capitalProjections[key];
        const amortizationProfile = calculateAmortizationProfile(scenario, params, projection);
        const yearProfile = amortizationProfile.find(p => p.year === year) || {};
        
        yearData[`${key}_principal`] = (yearProfile.principalPayment || 0) / 1_000_000;
        yearData[`${key}_interest`] = (yearProfile.interestPayment || 0) / 1_000_000;
        yearData[`${key}_total`] = (yearProfile.totalPayment || 0) / 1_000_000;
        yearData[`${key}_balloon`] = yearProfile.isBalloonYear ? (yearProfile.principalPayment || 0) / 1_000_000 : 0;
      });
      
      profileData.push(yearData);
    }
    
    return profileData;
  }, [capitalScenarios, capitalProjections, params]);

  const recommendation = useMemo(() => {
    const scores = comparisonData.map(scenario => {
      // Handle 100% Debt case (no equity)
      if (scenario.equityAmount <= 0) {
        return {
          ...scenario,
          score: 0,
          explanation: "100% Debt: No equity investment means infinite returns but extreme financial risk. Not recommended for most businesses."
        };
      }

      // Handle 100% Equity case (no debt)
      if (scenario.debtAmount <= 0) {
        let score = 50;
        let technicalExplanation = [];
        let businessReasoning = [];

        const irrScore = Math.min(scenario.irr * 80, 20);
        score += irrScore;
        technicalExplanation.push(`IRR: ${pctFmt(scenario.irr)} contributes ${irrScore.toFixed(1)} points`);

        const moicScore = Math.min(scenario.equityMOIC * 3, 10);
        score += moicScore;
        technicalExplanation.push(`MOIC: ${numFmt(scenario.equityMOIC)}x contributes ${moicScore.toFixed(1)} points`);

        score += 30;
        technicalExplanation.push(`No debt risk = +30 points`);
        businessReasoning.push("Zero financial risk - no debt service or covenant concerns");

        score += 10;
        technicalExplanation.push(`Maximum financial flexibility = +10 points`);
        businessReasoning.push("Complete operational flexibility without lender constraints");

        businessReasoning.push("Lower returns due to absence of leverage");
        businessReasoning.push("Ideal for risk-averse investors or highly volatile businesses");

        const finalScore = Math.max(0, Math.min(100, score));
        
        return { 
          ...scenario, 
          score: finalScore,
          explanation: `All-Equity Scoring:\n${technicalExplanation.join('\n')}\n\nBusiness Assessment:\n${businessReasoning.join('\n')}`
        };
      }

      // Regular scoring for mixed scenarios
      if (!isFinite(scenario.irr) || !isFinite(scenario.equityMOIC) || !isFinite(scenario.minDSCR) ||
          scenario.equityAmount <= 0) {
        return {
          ...scenario,
          score: 0,
          explanation: "Invalid structure: Insufficient equity or calculation error. This scenario is not viable."
        };
      }

      let score = 0;
      let technicalExplanation = [];
      let businessReasoning = [];
      
      // 1. Return Score (25% weight)
      const irrScore = Math.min(scenario.irr * 100, 30);
      score += irrScore * 0.25;
      technicalExplanation.push(`IRR: ${pctFmt(scenario.irr)} contributes ${(irrScore * 0.25).toFixed(1)} points`);
      
      // 2. MOIC Score (15% weight)
      const moicScore = Math.min(scenario.equityMOIC * 5, 15);
      score += moicScore * 0.15;
      technicalExplanation.push(`MOIC: ${numFmt(scenario.equityMOIC)}x contributes ${(moicScore * 0.15).toFixed(1)} points`);
      
      // 3. Credit Safety Score (35% weight)
      let creditScore = 0;
      if (scenario.minDSCR >= 1.5) {
        creditScore = 35;
        technicalExplanation.push(`Strong DSCR (${numFmt(scenario.minDSCR)}) = 35 points`);
        businessReasoning.push("Strong debt service coverage provides safety cushion for lenders");
      } else if (scenario.minDSCR >= 1.2) {
        creditScore = 20;
        technicalExplanation.push(`Adequate DSCR (${numFmt(scenario.minDSCR)}) = 20 points`);
        businessReasoning.push("Adequate cash flow coverage for debt obligations");
      } else if (scenario.minDSCR >= 1.0) {
        creditScore = 5;
        technicalExplanation.push(`Warning: Tight DSCR (${numFmt(scenario.minDSCR)}) = 5 points`);
        businessReasoning.push("Insufficient cash flow to cover debt obligations reliably");
      } else {
        creditScore = 0;
        technicalExplanation.push(`Critical: Insufficient DSCR (${numFmt(scenario.minDSCR)}) = 0 points`);
        businessReasoning.push("Critical: Cash flow cannot cover required debt payments");
      }
      score += creditScore;
      
      // 4. Covenant Compliance (15% weight)
      if (scenario.breaches === 0) {
        score += 15;
        technicalExplanation.push(`No covenant breaches = 15 points`);
        businessReasoning.push("No covenant violations - maintains good lender relationships");
      } else {
        score += 0;
        technicalExplanation.push(`Critical: ${scenario.breaches} covenant breach(es) = 0 points`);
        businessReasoning.push(`${scenario.breaches} covenant breach(es) could trigger default`);
      }
      
      // 5. Leverage Appropriateness (10% weight)
      let leverageScore = 0;
      if (scenario.leverage <= 2.5) {
        leverageScore = 10;
        technicalExplanation.push(`Conservative leverage (${numFmt(scenario.leverage)}x) = 10 points`);
        businessReasoning.push("Conservative leverage preserves financial flexibility");
      } else if (scenario.leverage <= 3.5) {
        leverageScore = 7;
        technicalExplanation.push(`Moderate leverage (${numFmt(scenario.leverage)}x) = 7 points`);
        businessReasoning.push("Moderate leverage balances risk and return");
      } else if (scenario.leverage <= 4.5) {
        leverageScore = 3;
        technicalExplanation.push(`Warning: Aggressive leverage (${numFmt(scenario.leverage)}x) = 3 points`);
        businessReasoning.push("High leverage increases bankruptcy risk during downturns");
      } else {
        leverageScore = 0;
        technicalExplanation.push(`Critical: Excessive leverage (${numFmt(scenario.leverage)}x) = 0 points`);
        businessReasoning.push("Excessive leverage poses significant financial risk");
      }
      score += leverageScore;
      
      // 6. Payment Structure Score (10% weight)
      let paymentScore = 10;
      if (scenario.hasBalloon) {
        paymentScore -= 5;
        technicalExplanation.push(`High balloon (${currencyFmtMM(scenario.balloonAmount * 1_000_000, ccy)}) = -5 penalty`);
        businessReasoning.push("Large balloon payment creates refinancing risk");
      }

      if (scenario.paymentFrequency === "Monthly") {
        paymentScore -= 2;
        technicalExplanation.push(`Monthly payments require liquidity buffer = -2 penalty`);
        businessReasoning.push("Monthly payments require strong liquidity management");
      } else if (scenario.paymentFrequency === "Bullet") {
        paymentScore -= 3;
        technicalExplanation.push(`Bullet payment structure = -3 penalty`);
        businessReasoning.push("Bullet payments concentrate refinancing risk");
      }

      if (scenario.paymentRiskScore < 0) {
        paymentScore += scenario.paymentRiskScore;
        technicalExplanation.push(`Payment structure penalty: ${scenario.paymentRiskScore} points`);
      }
      
      score += Math.max(0, paymentScore);
      
      // 7. Historical Context Bonus
      if (historicalMetrics?.avgHistoricalLeverage) {
        const leverageDiff = Math.abs(scenario.leverage - historicalMetrics.avgHistoricalLeverage);
        if (leverageDiff < 0.5) {
          score += 5;
          technicalExplanation.push(`Bonus: Aligned with historical leverage = +5 points`);
          businessReasoning.push("Leverage aligned with company's historical levels");
        }
      }
      
      // 8. Margin Volatility Adjustment
      if (historicalMetrics?.marginVolatility > 0.1 && scenario.leverage > 3.0) {
        score -= 10;
        technicalExplanation.push(`Warning: High leverage + volatile margins = -10 penalty`);
        businessReasoning.push("High leverage combined with volatile margins increases risk");
      }

      // 9. Return quality assessment
      if (scenario.irr > 0.25) {
        businessReasoning.push("Excellent equity returns justify the investment risk");
      } else if (scenario.irr > 0.15) {
        businessReasoning.push("Strong returns provide good risk-adjusted compensation");
      } else if (scenario.irr > 0.10) {
        businessReasoning.push("Acceptable returns for the level of risk");
      } else if (scenario.irr > 0) {
        businessReasoning.push("Low returns may not adequately compensate for risk");
      } else {
        businessReasoning.push("Negative returns make this scenario unacceptable");
      }
      
      // 10. Payment capacity assessment
      const annualCashFlow = scenario.equityValue * 1_000_000 * 0.1;
      if (scenario.annualDebtService * 1_000_000 > annualCashFlow * 0.4) {
        score -= 5;
        technicalExplanation.push(`Warning: High debt service relative to cash flow = -5 penalty`);
        businessReasoning.push("Debt service consumes significant portion of cash flow");
      }
      
      const finalScore = Math.max(0, Math.min(100, score));
      
      return { 
        ...scenario, 
        score: finalScore,
        explanation: `Technical Scoring:\n${technicalExplanation.join('\n')}\n\nBusiness Assessment:\n${businessReasoning.join('\n')}`
      };
    });
    
    const validScores = scores.filter(s => s.score > 0);
    if (validScores.length === 0) {
      return {
        ...scores[0] || comparisonData[0],
        score: 0,
        explanation: "No optimal structure found. All scenarios have calculation issues. Consider adjusting financial assumptions."
      };
    }
    
    return validScores.sort((a, b) => b.score - a.score)[0];
  }, [comparisonData, historicalMetrics, ccy]);

  const hasValidHistoricalData = historicalData && historicalData.some(d => d.revenue > 0 && d.ebitda > 0);
  const paymentRiskAdjustment = capitalScenarios.capacityAnalysis?.paymentRiskAdjustment || 0;

  // Pie chart data for capital mix
  const pieChartData = selectedScenario ? [
    { name: 'Debt', value: selectedScenario.debtAmount, color: COLORS.danger.chart },
    { name: 'Equity', value: selectedScenario.equityAmount, color: COLORS.success.chart },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      {/* Payment Structure Risk Warning */}
      {params?.balloonPercentage > 50 && (
        <Card className="border-l-4 border-l-orange-600 bg-orange-50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-semibold text-orange-900 mb-2">Balloon Payment Risk</div>
                <div className="text-sm text-orange-800 space-y-1">
                  <div><strong>Balloon Percentage:</strong> {params.balloonPercentage}%</div>
                  <div><strong>Payment Frequency:</strong> {params.paymentFrequency || "Quarterly"}</div>
                  <div><strong>Debt Capacity Reduction:</strong> {pctFmt(paymentRiskAdjustment)} to account for refinancing risk</div>
                  <div><strong>Risk Level:</strong> <span className="font-bold">{params.balloonPercentage > 75 ? "HIGH" : "MEDIUM"}</span></div>
                </div>
                <div className="text-sm text-orange-800 mt-3 p-3 bg-orange-100 rounded border border-orange-200">
                  <strong>Warning:</strong> Large balloon payment due at maturity increases refinancing risk. 
                  Consider more amortizing structure or ensure strong refinancing prospects.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Payment Warning */}
      {params?.paymentFrequency === "Monthly" && (
        <Card className="border-l-4 border-l-yellow-600 bg-yellow-50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-yellow-900 mb-2">Monthly Payment Requirement</div>
                <div className="text-sm text-yellow-800">
                  Monthly payments require strong liquidity management and higher cash buffers.
                  Ensure adequate working capital to meet frequent payment obligations.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Performance Context Card */}
      {historicalMetrics && (
        <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Historical Performance Context
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all duration-200">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Average EBITDA</div>
                <div className="text-2xl font-bold text-slate-800">{currencyFmtMM(historicalMetrics.avgEBITDA, ccy)}</div>
                <div className="text-xs text-slate-600 mt-1">{historicalMetrics.yearsOfData} years of data</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all duration-200">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Historical Growth</div>
                <div className="text-2xl font-bold text-slate-800">{pctFmt(historicalMetrics.avgGrowth)}</div>
                <div className="text-xs text-slate-600 mt-1">Avg annual revenue growth</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all duration-200">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">EBITDA Margin</div>
                <div className="text-2xl font-bold text-slate-800">{pctFmt(historicalMetrics.ebitdaMargin)}</div>
                <div className={`text-xs mt-1 font-semibold ${historicalMetrics.marginVolatility > 0.1 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {historicalMetrics.marginVolatility > 0.1 ? 'High volatility' : 'Stable margins'}
                </div>
              </div>
              {historicalMetrics.avgHistoricalLeverage !== null && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-300 transition-all duration-200">
                  <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Historical Leverage</div>
                  <div className="text-2xl font-bold text-slate-800">{numFmt(historicalMetrics.avgHistoricalLeverage)}x</div>
                  <div className="text-xs text-slate-600 mt-1">Avg Debt/EBITDA</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limited Historical Data Warning */}
      {!hasValidHistoricalData && historicalData.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 shadow-sm hover:shadow-md transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <div className="font-semibold text-yellow-900 mb-2">Limited Historical Data</div>
                <div className="text-sm text-yellow-800">
                  Capital structure recommendations are based on assumptions. Add historical financial data 
                  for more accurate leverage analysis based on your company's actual performance.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital Structure Mix Overview */}
      <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Capital Structure Mix Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Total Capital Needed</div>
              <div className="text-2xl font-bold">{currencyFmtMM(capitalScenarios.capacityAnalysis?.totalCapitalNeeded || 0, ccy)}</div>
              <div className="text-xs opacity-80">Debt + Equity</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">EBITDA Capacity</div>
              <div className="text-2xl font-bold">{currencyFmtMM(capitalScenarios.capacityAnalysis?.effectiveEBITDA || 0, ccy)}</div>
              <div className="text-xs opacity-80">Annual operating profit</div>
            </div>
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-1">Max Debt Capacity</div>
              <div className="text-2xl font-bold">{currencyFmtMM(capitalScenarios.capacityAnalysis?.maxModerateDebt || 0, ccy)}</div>
              <div className="text-xs opacity-80">At 3.0x leverage</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capital Structure Recommendation Card */}
      <Card className="border-l-4 border-l-emerald-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            Recommended Capital Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg border-2 border-emerald-200">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Recommended Structure</div>
              <div className="text-xl font-bold text-emerald-600">{recommendation.scenario}</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">{recommendation.debtPercentage}% Debt / {recommendation.equityPercentage}% Equity</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border-2 border-blue-200">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Expected Equity IRR</div>
              <div className="text-xl font-bold text-blue-600">{pctFmt(recommendation.irr)}</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">MOIC: {numFmt(recommendation.equityMOIC)}x</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border-2 border-purple-200">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Credit Risk</div>
              <div className="text-xl font-bold text-purple-600">{numFmt(recommendation.minDSCR)}</div>
              <div className="text-sm text-slate-600 font-semibold mt-1">Min DSCR</div>
            </div>
          </div>
          
          <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-600" />
              <div className="font-semibold text-sm text-slate-800">Why This Structure?</div>
            </div>
            <div className="text-xs text-slate-700 whitespace-pre-line font-mono bg-white p-3 rounded border border-slate-200">
              {recommendation.explanation}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-300">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">
                  Total Score: <span className="text-emerald-600">{numFmt(recommendation.score)} / 100</span>
                </div>
                <div className="flex gap-2">
                  <div className="h-2 w-24 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500" 
                      style={{ width: `${recommendation.score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns vs Risk Analysis */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Returns vs Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ChartWrapper data={comparisonData} height={400} ariaLabel="Returns vs Risk Analysis">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scenario" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Legend />
                <Bar yAxisId="left" dataKey="irr" fill={COLORS.primary.chart} name="Equity IRR" radius={[8, 8, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="minDSCR" stroke={COLORS.danger.chart} strokeWidth={3} name="Min DSCR" dot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="leverage" stroke={COLORS.success.chart} strokeWidth={2} name="Leverage" dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </CardContent>
      </Card>

      {/* Amortization Profile Chart */}
      {amortizationData.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Amortization Profile & Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartWrapper data={amortizationData} height={400} ariaLabel="Amortization profile">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={amortizationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => [currencyFmtMM(value * 1_000_000, ccy), "Amount"]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="modDebt_total" 
                    stackId="1"
                    stroke={COLORS.primary.chart}
                    fill={COLORS.primary.chart}
                    fillOpacity={0.6}
                    name="Moderate Debt Total Payment" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="modDebt_interest" 
                    stackId="2"
                    stroke={COLORS.success.chart}
                    fill={COLORS.success.chart}
                    fillOpacity={0.6}
                    name="Moderate Debt Interest" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="modDebt_principal" 
                    stackId="3"
                    stroke={COLORS.info.chart}
                    fill={COLORS.info.chart}
                    fillOpacity={0.6}
                    name="Moderate Debt Principal" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </CardContent>
        </Card>
      )}

      {/* Capital Structure Scenarios Table */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle>Capital Structure Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="text-left p-3 font-semibold text-slate-700">Scenario</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Debt %</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Equity %</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Debt Amount</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Equity Amount</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Leverage</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Annual Debt Service</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Min Cash Buffer</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Balloon Amount</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Equity IRR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Equity MOIC</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Min DSCR</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Breaches</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Score</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr 
                    key={i} 
                    className={`border-b border-slate-200 hover:bg-slate-50 transition-all duration-150 cursor-pointer ${
                      row.scenario === recommendation.scenario ? 'bg-emerald-50 hover:bg-emerald-100' : ''
                    }`}
                    onClick={() => setSelectedScenario(row)}
                  >
                    <td className="p-3 font-medium text-slate-800">{row.scenario}</td>
                    <td className="text-right p-3 text-slate-600">{row.debtPercentage}%</td>
                    <td className="text-right p-3 text-slate-600">{row.equityPercentage}%</td>
                    <td className="text-right p-3 text-slate-600">{currencyFmtMM(row.debtAmount * 1_000_000, ccy)}</td>
                    <td className="text-right p-3 text-slate-600">{currencyFmtMM(row.equityAmount * 1_000_000, ccy)}</td>
                    <td className="text-right p-3 text-slate-600 font-semibold">{numFmt(row.leverage)}x</td>
                    <td className="text-right p-3 text-slate-600">
                      {row.debtAmount > 0 ? currencyFmtMM(row.annualDebtService * 1_000_000, ccy) : "N/A"}
                    </td>
                    <td className="text-right p-3 text-slate-600">{currencyFmtMM(row.minCashBuffer * 1_000_000, ccy)}</td>
                    <td className="text-right p-3 text-slate-600">
                      {row.hasBalloon ? currencyFmtMM(row.balloonAmount * 1_000_000, ccy) : "N/A"}
                    </td>
                    <td className="text-right p-3 font-semibold text-blue-600">{pctFmt(row.irr)}</td>
                    <td className="text-right p-3 font-semibold text-purple-600">
                      {row.equityAmount > 0 ? `${numFmt(row.equityMOIC)}x` : "N/A"}
                    </td>
                    <td className="text-right p-3 font-semibold text-emerald-600">
                      {row.debtAmount > 0 ? numFmt(row.minDSCR) : "N/A"}
                    </td>
                    <td className={`text-right p-3 font-bold ${row.breaches > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {row.breaches}
                    </td>
                    <td className="text-right p-3 font-bold text-slate-800">
                      {numFmt(row.score || 0)}
                    </td>
                    <td className="text-right p-3">
                      {row.scenario === recommendation.scenario && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 shadow-sm">
                          Recommended
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Capital Mix Visualization (Pie Chart) - Shows when scenario selected */}
      {selectedScenario && pieChartData.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              {selectedScenario.scenario} - Capital Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ChartWrapper data={pieChartData} height={300} ariaLabel="Capital mix pie chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => currencyFmtMM(value * 1_000_000, ccy)} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartWrapper>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800 mb-3">Scenario Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-xs text-red-600 font-semibold mb-1">Total Debt</div>
                    <div className="text-lg font-bold text-red-700">{currencyFmtMM(selectedScenario.debtAmount * 1_000_000, ccy)}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs text-green-600 font-semibold mb-1">Total Equity</div>
                    <div className="text-lg font-bold text-green-700">{currencyFmtMM(selectedScenario.equityAmount * 1_000_000, ccy)}</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Equity IRR</div>
                    <div className="text-lg font-bold text-blue-700">{pctFmt(selectedScenario.irr)}</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Leverage</div>
                    <div className="text-lg font-bold text-purple-700">{numFmt(selectedScenario.leverage)}x</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital Structure Insights */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Info className="ww-5 h-5 text-slate-600" />
            Capital Structure Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-6 bg-emerald-500 rounded"></div>
                <h4 className="font-semibold text-slate-800">Debt Financing Benefits</h4>
              </div>
              <ul className="text-sm space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Higher equity returns due to leverage</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Tax deductibility of interest payments</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Lower cost of capital vs equity</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Maintains ownership control</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-6 bg-blue-500 rounded"></div>
                <h4 className="font-semibold text-slate-800">Equity Financing Benefits</h4>
              </div>
              <ul className="text-sm space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Lower financial risk and covenant constraints</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>More operational flexibility</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>No mandatory debt service requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>Better positioned for economic downturns</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Scoring Methodology
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ul className="text-sm space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Returns (40%):</strong> IRR (25%) + MOIC (15%)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Credit Safety (35%):</strong> Debt service coverage ratio</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Covenant Compliance (15%):</strong> Zero tolerance for breaches</span>
                </li>
              </ul>
              <ul className="text-sm space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Leverage (10%):</strong> Appropriateness of debt levels</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Payment Structure (10%):</strong> Balloon risk & frequency</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span><strong>Bonuses/Penalties:</strong> Historical alignment, volatility</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}