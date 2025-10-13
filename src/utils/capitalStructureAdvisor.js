// utils/capitalStructureAdvisor.js

const INDUSTRY_BENCHMARKS = {
  'Technology': { typicalLeverage: { min: 0.5, target: 2.0, max: 3.5 }, minDSCR: 1.5, minICR: 3.0, cashConversionRate: 0.20 },
  'Manufacturing': { typicalLeverage: { min: 1.5, target: 3.0, max: 4.5 }, minDSCR: 1.25, minICR: 2.5, cashConversionRate: 0.12 },
  'Healthcare': { typicalLeverage: { min: 1.0, target: 2.5, max: 4.0 }, minDSCR: 1.35, minICR: 2.75, cashConversionRate: 0.15 },
  'Retail': { typicalLeverage: { min: 1.5, target: 2.5, max: 3.5 }, minDSCR: 1.4, minICR: 2.5, cashConversionRate: 0.08 },
  'Real Estate': { typicalLeverage: { min: 3.0, target: 5.0, max: 7.0 }, minDSCR: 1.2, minICR: 2.0, cashConversionRate: 0.10 },
  'Services': { typicalLeverage: { min: 0.5, target: 1.5, max: 3.0 }, minDSCR: 1.5, minICR: 3.0, cashConversionRate: 0.18 },
  'Default': { typicalLeverage: { min: 1.0, target: 2.5, max: 4.0 }, minDSCR: 1.35, minICR: 2.5, cashConversionRate: 0.12 }
};

const safe = (v, d = 0) => (Number.isFinite(v) && v !== null ? v : d);

export function assessCapitalStructure(projection, params, ccy) {
  const industry = params.industry || 'Default';
  const benchmark = INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS['Default'];
  
  const currentState = analyzeCurrentState(projection, params, benchmark);
  const structuralIssues = identifyStructuralIssues(currentState, benchmark, params);
  const optimalStructure = calculateOptimalStructure(projection, params, benchmark, structuralIssues);
  const transitionPlan = buildTransitionPlan(currentState, optimalStructure, projection, params);
  const impactAnalysis = quantifyImpact(currentState, optimalStructure, projection);
  
  return {
    currentState,
    structuralIssues,
    optimalStructure,
    transitionPlan,
    impactAnalysis,
    benchmark
  };
}

function analyzeCurrentState(projection, params, benchmark) {
  const rows = projection?.rows || [];
  if (!rows.length) return {
    revenue: 0, ebitda: 0, ebitdaMargin: 0, fcf: 0, cashConversion: 0,
    currentDebt: 0, currentLeverage: 0, currentDSCR: 0, minDSCR: 0,
    currentICR: 0, minICR: 0, sustainableDebtService: 0, currentDebtService: 0,
    debtServiceGap: 0, hasBreaches: false, breachYears: [], isDeleveraging: false,
    liquidityRatio: 0, avgCash: 0
  };
  
  const firstYear = rows[0];
  const avgDSCR = rows.reduce((s, r) => s + safe(r.dscr), 0) / rows.length;
  const avgICR = rows.reduce((s, r) => s + safe(r.icr), 0) / rows.length;
  
  return {
    revenue: safe(firstYear.revenue),
    ebitda: safe(firstYear.ebitda),
    ebitdaMargin: rows.reduce((s, r) => s + safe(r.ebitdaMargin), 0) / rows.length,
    fcf: rows.reduce((s, r) => s + safe(r.fcf || r.fcfToEquity), 0) / rows.length,
    cashConversion: 0.10,
    currentDebt: safe(firstYear.grossDebt || firstYear.debtBalance),
    currentLeverage: safe(firstYear.ndToEbitda),
    currentDSCR: avgDSCR,
    minDSCR: Math.min(...rows.map(r => safe(r.dscr, 999))),
    currentICR: avgICR,
    minICR: Math.min(...rows.map(r => safe(r.icr, 999))),
    sustainableDebtService: safe(firstYear.ebitda) / Math.max(avgDSCR - 0.3, 1.0),
    currentDebtService: safe(firstYear.principalPayment) + safe(firstYear.interestExpense),
    debtServiceGap: 0,
    hasBreaches: projection.hasCovenantBreaches || false,
    breachYears: [
      ...(projection.breaches?.dscrBreachYears || []),
      ...(projection.breaches?.icrBreachYears || []),
      ...(projection.breaches?.leverageBreachYears || [])
    ],
    isDeleveraging: false,
    liquidityRatio: safe(firstYear.cash) / Math.max(safe(firstYear.principalPayment) + safe(firstYear.interestExpense), 1) * 12,
    avgCash: rows.reduce((s, r) => s + safe(r.cash), 0) / rows.length
  };
}

function identifyStructuralIssues(state, benchmark, params) {
  const issues = [];
  
  if (state.currentLeverage > benchmark.typicalLeverage.max) {
    const excessLeverage = state.currentLeverage - benchmark.typicalLeverage.target;
    const excessDebt = excessLeverage * state.ebitda;
    
    issues.push({
      severity: 'critical',
      category: 'Overleveraging',
      issue: `Leverage of ${state.currentLeverage.toFixed(2)}x exceeds industry norm of ${benchmark.typicalLeverage.target}x`,
      rootCause: 'Excessive debt relative to earnings capacity',
      quantification: {
        excessDebt: excessDebt,
        requiredDeleveraging: excessDebt,
        timeToNormalize: Math.ceil(excessDebt / Math.max(state.fcf, 1))
      },
      businessImplication: 'Limits strategic flexibility and increases refinancing risk'
    });
  }
  
  if (state.minDSCR < benchmark.minDSCR) {
    issues.push({
      severity: state.minDSCR < 1.1 ? 'critical' : 'high',
      category: 'Inadequate Debt Service Coverage',
      issue: `Min DSCR of ${state.minDSCR.toFixed(2)}x below lending standard of ${benchmark.minDSCR}x`,
      rootCause: 'Current debt service exceeds sustainable cash generation capacity',
      quantification: {
        dscrShortfall: benchmark.minDSCR - state.minDSCR
      },
      businessImplication: 'Creates covenant breach risk and technical default scenarios'
    });
  }
  
  if (state.hasBreaches) {
    issues.push({
      severity: 'critical',
      category: 'Covenant Breach',
      issue: `Covenant violations projected in years: ${state.breachYears.join(', ')}`,
      rootCause: 'Debt structure misaligned with business cash generation profile',
      quantification: {
        breachYears: state.breachYears.length,
        waiverCost: state.currentDebt * 0.005
      },
      businessImplication: 'CRITICAL: Triggers lender waiver negotiations and expensive amendment fees'
    });
  }
  
  return issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function calculateOptimalStructure(projection, params, benchmark, issues) {
  const state = analyzeCurrentState(projection, params, benchmark);
  
  const targetDSCR = Math.max(benchmark.minDSCR, 1.35);
  const sustainableAnnualDebtService = state.ebitda / targetDSCR;
  
  const assumedAvgRate = Math.min(safe(params.interestRate, 0.10), 0.15);
  const assumedTenor = 5;
  const sustainableDebt = sustainableAnnualDebtService / (assumedAvgRate + (1/assumedTenor));
  
  const optimalLeverage = state.ebitda > 0 ? sustainableDebt / state.ebitda : 0;
  const targetLeverage = Math.min(optimalLeverage, benchmark.typicalLeverage.target);
  const targetDebt = targetLeverage * state.ebitda;
  
  const debtReductionNeeded = Math.max(0, state.currentDebt - targetDebt);
  const projectedDSCR = targetDebt > 0 ? state.ebitda / (targetDebt * (assumedAvgRate + (1/assumedTenor))) : 0;
  const projectedICR = targetDebt > 0 ? state.ebitda / (targetDebt * assumedAvgRate) : 0;
  
  return {
    targetDebt,
    targetLeverage,
    targetDSCR: projectedDSCR,
    targetICR: projectedICR,
    targetBlendedRate: assumedAvgRate,
    debtReductionNeeded,
    excessDebtCapacity: Math.max(0, targetDebt - state.currentDebt),
    equityNeed: debtReductionNeeded > state.avgCash ? debtReductionNeeded - state.avgCash : 0,
    optimalTranches: {
      structure: 'Single Tranche',
      rationale: 'Business has strong cash flow and moderate leverage. Single senior secured term loan provides simplicity.',
      tranches: [{
        name: 'Senior Secured Term Loan',
        amount: targetDebt,
        percentage: 100,
        seniority: 'Senior Secured',
        suggestedRate: 0.08,
        tenor: 5,
        amortization: 'Amortizing',
        purpose: 'Core debt financing'
      }],
      totalCost: targetDebt * 0.08
    },
    dscrImprovement: projectedDSCR - state.currentDSCR,
    icrImprovement: projectedICR - state.currentICR,
    leverageImprovement: state.currentLeverage - targetLeverage,
    annualInterestSavings: (safe(params.interestRate, 0.10) - assumedAvgRate) * Math.min(state.currentDebt, targetDebt),
    covenantComplianceRestored: projectedDSCR >= benchmark.minDSCR && targetLeverage <= benchmark.typicalLeverage.max
  };
}

function buildTransitionPlan(currentState, optimalStructure, projection, params) {
  const steps = [];
  const debtReduction = optimalStructure.debtReductionNeeded;
  
  if (currentState.hasBreaches) {
    steps.push({
      phase: 'Phase 1: Stabilization',
      timeline: '0-3 months',
      actions: [{
        action: 'Engage Lenders for Covenant Waivers',
        timeline: 'Week 1-4',
        cost: currentState.currentDebt * 0.005,
        description: `Request waiver for ${currentState.breachYears.length} projected breach(es)`,
        criticality: 'CRITICAL'
      }],
      objective: 'Prevent default and secure liquidity'
    });
  }
  
  if (debtReduction > 0) {
    steps.push({
      phase: 'Phase 2: Restructuring',
      timeline: '3-12 months',
      actions: [{
        action: 'Accelerated Debt Paydown',
        timeline: 'Months 3-12',
        amount: debtReduction,
        description: 'Direct FCF to debt reduction',
        criticality: 'HIGH'
      }],
      objective: 'Execute capital structure optimization'
    });
  }
  
  steps.push({
    phase: 'Phase 3: Optimization',
    timeline: '12-24 months',
    actions: [{
      action: 'EBITDA Enhancement',
      timeline: 'Months 12-24',
      description: 'Operational improvements to expand margins',
      criticality: 'MEDIUM'
    }],
    objective: 'Enhance operational performance'
  });
  
  return {
    steps,
    summary: {
      totalPhases: steps.length,
      totalActions: steps.reduce((sum, phase) => sum + phase.actions.length, 0),
      estimatedDuration: '24 months',
      totalTransitionCost: steps.reduce((sum, phase) => 
        sum + phase.actions.reduce((psum, action) => psum + (action.cost || 0), 0), 0
      ),
      totalCapitalRequired: debtReduction,
      keyMilestones: [
        { milestone: 'Covenant compliance restored', target: 'Month 3' },
        { milestone: 'Target leverage achieved', target: 'Month 24' }
      ]
    }
  };
}

function quantifyImpact(currentState, optimalStructure, projection) {
  return {
    financialImpact: {
      dscrImprovement: {
        current: currentState.currentDSCR,
        target: optimalStructure.targetDSCR,
        improvement: optimalStructure.dscrImprovement
      },
      icrImprovement: {
        current: currentState.currentICR,
        target: optimalStructure.targetICR,
        improvement: optimalStructure.icrImprovement
      },
      leverageImprovement: {
        current: currentState.currentLeverage,
        target: optimalStructure.targetLeverage,
        improvement: optimalStructure.leverageImprovement
      }
    },
    cashFlowImpact: {
      annualInterestSavings: optimalStructure.annualInterestSavings,
      cumulativeCashSavings: optimalStructure.annualInterestSavings * 5
    },
    riskReduction: {
      creditRatingUplift: 'Moderate upgrade (1 notch)',
      defaultProbabilityReduction: 0.25,
      covenantBreachElimination: optimalStructure.covenantComplianceRestored
    },
    strategicBenefits: [
      'Eliminates covenant breach risk',
      'Improves refinancing flexibility',
      'Frees up cash for growth'
    ],
    valuationImpact: {
      enterpriseValueIncrease: optimalStructure.annualInterestSavings * 8,
      equityValueIncrease: (optimalStructure.annualInterestSavings * 8) + optimalStructure.debtReductionNeeded,
      interpretation: 'Estimated 15-20% EV uplift'
    },
    transactionEconomics: {
      totalInvestmentRequired: optimalStructure.equityNeed + optimalStructure.debtReductionNeeded,
      paybackPeriod: 3,
      npv: optimalStructure.annualInterestSavings * 4
    }
  };
}

export default assessCapitalStructure;