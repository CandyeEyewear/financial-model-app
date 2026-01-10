// src/components/CapitalStructureAnalysis.jsx
// LENDER-FOCUSED CAPITAL STRUCTURE ANALYSIS WITH AI INTEGRATION

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Shield,
  Sparkles,
  Info,
  TrendingDown,
  BarChart3,
  Sliders,
  Users,
  Zap,
  Target,
  Activity
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
  Area,
  AreaChart
} from "recharts";

// Import utilities
import { 
  calculateDebtCapacity, 
  generateAlternativeStructures,
  calculateSensitivity,
  getIndustryBenchmarks
} from "../utils/debtCapacityAnalyzer";
import { generateAICapitalStructureRecommendations } from "../utils/aiCapitalStructureAdvisor";

// Color palette
const COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#6366f1',
  purple: '#a855f7',
  slate: '#64748b',
  debt: '#ef4444',
  equity: '#10b981',
};

// ============================================================================
// ✅ AI CACHING IMPLEMENTATION
// ============================================================================

const generateAIInputHash = (projection, params, capacity, alternatives) => {
  if (!projection?.rows?.length || !params) return null;
  
  const firstYear = projection.rows[0];
  
  return JSON.stringify({
    // Debt structure
    currentDebt: Math.round((capacity?.currentDebtRequest || 0) / 1000),
    maxDebt: Math.round((capacity?.maxSustainableDebt || 0) / 1000),
    safeDebt: Math.round((capacity?.safeDebt || 0) / 1000),
    
    // Financial metrics
    ebitda: Math.round((firstYear.ebitda || 0) / 1000),
    revenue: Math.round((firstYear.revenue || 0) / 1000),
    
    // Coverage ratios
    minDSCR: (projection.creditStats?.minDSCR || 0).toFixed(2),
    leverage: (firstYear.ndToEbitda || 0).toFixed(2),
    
    // Alternatives
    alt1DSCR: alternatives?.alternative1?.dscr?.toFixed(2),
    alt2DSCR: alternatives?.alternative2?.dscr?.toFixed(2),
    alt3DSCR: alternatives?.alternative3?.dscr?.toFixed(2),
    
    // Structure
    industry: params.industry,
    tenor: params.debtTenorYears || 0,
    
    // Timestamp (day-level granularity)
    date: new Date().toDateString()
  });
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CapitalStructureAnalysis({ projection, params, ccy = "JMD" }) {

 // 🔍 DEBUG LOGGING - Remove after fixing
  // ============================================================================
  console.log('=== CAPITAL STRUCTURE DEBUG ===');
  console.log('projection:', projection);
  console.log('projection.rows:', projection?.rows);
  console.log('projection.rows.length:', projection?.rows?.length);
  console.log('params:', params);
  console.log('params.openingDebt:', params?.openingDebt);
  console.log('params.requestedLoanAmount:', params?.requestedLoanAmount);
  console.log('hasValidData check:', {
    hasProjection: !!projection,
    hasRows: !!projection?.rows,
    rowsLength: projection?.rows?.length || 0,
    hasParams: !!params
  });
  console.log('hasDebt check:', {
    openingDebt: params?.openingDebt || 0,
    requestedLoan: params?.requestedLoanAmount || 0,
    total: (params?.openingDebt || 0) + (params?.requestedLoanAmount || 0)
  });
  console.log('================================');
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  // AI state with caching
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [lastAIContext, setLastAIContext] = useState(null);
  
  // UI state
  const [selectedAlternative, setSelectedAlternative] = useState('current');
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [sensitivityVariable, setSensitivityVariable] = useState('ebitda');
  
  // Sensitivity slider states
  const [ebitdaAdjustment, setEbitdaAdjustment] = useState(0);
  const [rateAdjustment, setRateAdjustment] = useState(0);
  const [tenorAdjustment, setTenorAdjustment] = useState(0);

  // ============================================================================
  // DATA VALIDATION
  // ============================================================================
  
  const hasValidData = useMemo(() => {
    return projection && projection.rows && projection.rows.length > 0 && params;
  }, [projection, params]);

  const hasDebt = useMemo(() => {
    return (params?.openingDebt || 0) > 0 || (params?.requestedLoanAmount || 0) > 0;
  }, [params]);

  // ============================================================================
  // CALCULATIONS
  // ============================================================================
  
  // Debt capacity analysis
  const debtCapacity = useMemo(() => {
    if (!hasValidData || !hasDebt) return null;
    return calculateDebtCapacity(params, projection);
  }, [hasValidData, hasDebt, params, projection]);

  // Alternative structures
  const alternatives = useMemo(() => {
    if (!hasValidData || !hasDebt || !debtCapacity) return null;
    return generateAlternativeStructures(params, projection, debtCapacity);
  }, [hasValidData, hasDebt, params, projection, debtCapacity]);

  // Industry benchmarks
  const industryBenchmarks = useMemo(() => {
    return getIndustryBenchmarks(params?.industry || 'default');
  }, [params?.industry]);

  // Sensitivity analysis
  const sensitivityData = useMemo(() => {
    if (!hasValidData || !hasDebt) return { ebitda: [], rate: [], tenor: [] };
    
    return {
      ebitda: calculateSensitivity(params, projection, 'ebitda', [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30]),
      rate: calculateSensitivity(params, projection, 'rate', [-0.02, -0.01, 0, 0.01, 0.02, 0.03]),
      tenor: calculateSensitivity(params, projection, 'tenor', [-2, -1, 0, 1, 2, 3])
    };
  }, [hasValidData, hasDebt, params, projection]);

  // Live sensitivity calculation with sliders
  const liveDebtCapacity = useMemo(() => {
    if (!hasValidData || !hasDebt) return null;
    
    const adjustedParams = {
      ...params,
      baseRevenue: params.baseRevenue * (1 + ebitdaAdjustment),
      interestRate: params.interestRate + rateAdjustment,
      debtTenorYears: params.debtTenorYears + tenorAdjustment
    };
    
    // Create adjusted projection (simplified)
    const adjustedProjection = {
      ...projection,
      rows: projection.rows.map(row => ({
        ...row,
        ebitda: row.ebitda * (1 + ebitdaAdjustment)
      }))
    };
    
    return calculateDebtCapacity(adjustedParams, adjustedProjection);
  }, [hasValidData, hasDebt, params, projection, ebitdaAdjustment, rateAdjustment, tenorAdjustment]);

  // Capital structure breakdown data for pie chart
  const capitalStructureData = useMemo(() => {
    if (!hasDebt) return [];
    
    const debt = debtCapacity?.currentDebtRequest || 0;
    const equity = params?.equityContribution || 0;
    
    return [
      { name: 'Debt', value: debt, color: COLORS.debt },
      { name: 'Equity', value: equity, color: COLORS.equity }
    ];
  }, [hasDebt, debtCapacity, params]);

  // Comparison data for alternatives
  const alternativesComparisonData = useMemo(() => {
    if (!alternatives) return [];
    
    return [
      {
        name: 'Current',
        DSCR: alternatives.current.dscr,
        Leverage: alternatives.current.leverage,
        DebtPct: alternatives.current.debtPct
      },
      {
        name: 'Reduce Debt',
        DSCR: alternatives.alternative1.dscr,
        Leverage: alternatives.alternative1.leverage,
        DebtPct: alternatives.alternative1.debtPct
      },
      {
        name: 'Optimize Mix',
        DSCR: alternatives.alternative2.dscr,
        Leverage: alternatives.alternative2.leverage,
        DebtPct: alternatives.alternative2.debtPct
      },
      {
        name: 'Extend Tenor',
        DSCR: alternatives.alternative3.dscr,
        Leverage: alternatives.alternative3.leverage,
        DebtPct: alternatives.alternative3.debtPct
      }
    ];
  }, [alternatives]);

  // ============================================================================
  // AI RECOMMENDATIONS WITH CACHING
  // ============================================================================
  
  useEffect(() => {
    if (!hasValidData || !hasDebt || !debtCapacity || !alternatives) {
      setAiRecommendations(null);
      setLastAIContext(null);
      return;
    }

    // Generate hash of current inputs
    const currentHash = generateAIInputHash(projection, params, debtCapacity, alternatives);
    
    // ✅ CACHE CHECK: Skip if inputs haven't meaningfully changed
    if (currentHash === lastAIContext) {
      console.log('📌 AI cache hit - reusing previous capital structure analysis');
      return;
    }

    console.log('🔄 AI cache miss - generating new capital structure analysis');

    // Debounce AI calls (wait for user to stop changing inputs)
    const timer = setTimeout(() => {
      setIsLoadingAI(true);
      
      generateAICapitalStructureRecommendations(projection, params, ccy)
        .then(recs => {
          setAiRecommendations(recs);
          setIsLoadingAI(false);
          setLastAIContext(currentHash);
          console.log('✅ AI analysis complete and cached');
        })
        .catch(err => {
          console.error('❌ AI analysis failed:', err);
          setIsLoadingAI(false);
          // Don't update lastAIContext on error - allow retry
        });
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [hasValidData, hasDebt, projection, params, ccy, debtCapacity, alternatives, lastAIContext]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  const getRiskBadgeColor = (level) => {
    switch(level) {
      case 'LOW': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'MEDIUM': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getRecommendationIcon = (rec) => {
    if (rec === 'APPROVE') return <CheckCircle className="w-5 h-5 text-emerald-600" />;
    if (rec === 'REJECT' || rec === 'REDUCE DEBT') return <XCircle className="w-5 h-5 text-red-600" />;
    return <AlertTriangle className="w-5 h-5 text-amber-600" />;
  };

  // ============================================================================
  // EARLY RETURNS
  // ============================================================================
  
  if (!hasValidData) {
    return (
      <Card className="border-l-4 border-l-blue-600">
        <CardContent className="p-8 text-center">
          <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Awaiting Financial Data</h3>
          <p className="text-slate-600 text-sm">
            Please configure financial parameters and projections to enable capital structure analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasDebt) {
    return (
      <Card className="border-l-4 border-l-amber-600 bg-amber-50">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-amber-900 mb-3">No Debt Configured</h3>
              <p className="text-amber-800 mb-4">
                Capital structure analysis requires debt (either existing or proposed new facility) to assess optimal structure and debt capacity.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-amber-800">Configure Opening Debt if refinancing existing loans</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-amber-800">Configure New Facility in Deal Information section</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <div className="space-y-6">
      {/* ====================================================================== */}
      {/* SECTION 1: DEBT CAPACITY OVERVIEW */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-blue-600 shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Debt Capacity Analysis
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Maximum sustainable debt based on EBITDA and target debt service coverage
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Capacity Metrics */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Current Request */}
                <div className="p-4 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <div className="text-xs opacity-90 mb-1">Current Request</div>
                  <div className="text-2xl font-bold">{currencyFmtMM(debtCapacity.currentDebtRequest, ccy)}</div>
                  <div className="text-xs opacity-80 mt-1">As Proposed</div>
                </div>

                {/* Maximum Sustainable */}
                <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <div className="text-xs opacity-90 mb-1">Maximum Sustainable</div>
                  <div className="text-2xl font-bold">{currencyFmtMM(debtCapacity.maxSustainableDebt, ccy)}</div>
                  <div className="text-xs opacity-80 mt-1">@ {numFmt(debtCapacity.targetDSCR)}x DSCR</div>
                </div>

                {/* Safe Debt Level */}
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105">
                  <div className="text-xs opacity-90 mb-1">Safe Debt Level</div>
                  <div className="text-2xl font-bold">{currencyFmtMM(debtCapacity.safeDebt, ccy)}</div>
                  <div className="text-xs opacity-80 mt-1">@ {numFmt(debtCapacity.targetDSCRWithBuffer)}x DSCR</div>
                </div>

                {/* Available Capacity / Excess Debt */}
                <div className={`p-4 rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105 ${
                  debtCapacity.availableCapacity > 0 
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-red-500 to-red-600'
                }`}>
                  <div className="text-xs opacity-90 mb-1">
                    {debtCapacity.availableCapacity > 0 ? 'Available Capacity' : 'Excess Debt'}
                  </div>
                  <div className="text-2xl font-bold">
                    {currencyFmtMM(debtCapacity.availableCapacity > 0 ? debtCapacity.availableCapacity : debtCapacity.excessDebt, ccy)}
                  </div>
                  <div className="text-xs opacity-80 mt-1">
                    {debtCapacity.availableCapacity > 0 ? 'Under Capacity' : 'Over Capacity'}
                  </div>
                </div>
              </div>

              {/* Utilization Gauge */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Capacity Utilization</span>
                  <span className={`text-lg font-bold ${
                    debtCapacity.utilizationPct > 100 ? 'text-red-600' :
                    debtCapacity.utilizationPct > 90 ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                    {debtCapacity.utilizationPct.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className={`h-4 rounded-full transition-all duration-500 ${
                      debtCapacity.utilizationPct > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      debtCapacity.utilizationPct > 90 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-emerald-500 to-emerald-600'
                    }`}
                    style={{ width: `${Math.min(100, debtCapacity.utilizationPct)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-600">
                  <span>0%</span>
                  <span className="font-semibold">Safe Zone: ≤80%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Recommendation Badge */}
              <div className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
                debtCapacity.recommendation === 'APPROVE' 
                  ? 'bg-emerald-50 border-emerald-300' :
                debtCapacity.recommendation === 'APPROVE WITH CONDITIONS'
                  ? 'bg-amber-50 border-amber-300' :
                  'bg-red-50 border-red-300'
              }`}>
                {getRecommendationIcon(debtCapacity.recommendation)}
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800">Lender Recommendation</div>
                  <div className={`text-lg font-bold ${
                    debtCapacity.recommendation === 'APPROVE' ? 'text-emerald-700' :
                    debtCapacity.recommendation === 'APPROVE WITH CONDITIONS' ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {debtCapacity.recommendation}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getRiskBadgeColor(debtCapacity.riskLevel)}`}>
                  {debtCapacity.riskLevel} RISK
                </div>
              </div>
            </div>

            {/* Right: Visual Breakdown */}
            <div className="space-y-4">
              {/* Capital Structure Pie Chart */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-sm mb-3 text-slate-800">Current Capital Structure</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={capitalStructureData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {capitalStructureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currencyFmtMM(value, ccy)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="text-center">
                    <div className="text-slate-600">Debt Ratio</div>
                    <div className="text-lg font-bold text-red-600">
                      {((debtCapacity.currentDebtRequest / (debtCapacity.currentDebtRequest + (params.equityContribution || 0))) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-600">Equity Ratio</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {(((params.equityContribution || 0) / (debtCapacity.currentDebtRequest + (params.equityContribution || 0))) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Assumptions */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold text-sm text-blue-900">Analysis Assumptions</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-blue-700">EBITDA:</span>
                    <span className="font-bold text-blue-900">{currencyFmtMM(debtCapacity.ebitda, ccy)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Target DSCR:</span>
                    <span className="font-bold text-blue-900">{numFmt(debtCapacity.targetDSCR)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Interest Rate:</span>
                    <span className="font-bold text-blue-900">{pctFmt(params.interestRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Loan Tenor:</span>
                    <span className="font-bold text-blue-900">{params.debtTenorYears} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Annual Payment Factor:</span>
                    <span className="font-bold text-blue-900">{pctFmt(debtCapacity.annualPaymentFactor)}</span>
                  </div>
                  {debtCapacity.impliedDSCR && debtCapacity.impliedDSCR < 999 && (
                    <div className="flex justify-between pt-2 border-t border-blue-200 mt-2">
                      <span className="text-blue-700">Current DSCR:</span>
                      <span className={`font-bold ${debtCapacity.impliedDSCR >= debtCapacity.targetDSCR ? 'text-emerald-600' : 'text-red-600'}`}>
                        {numFmt(debtCapacity.impliedDSCR)}x
                      </span>
                    </div>
                  )}
                  {debtCapacity.leverage > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-700">Current Leverage:</span>
                      <span className={`font-bold ${debtCapacity.leverage <= (params.maxNDToEBITDA || 3.0) ? 'text-emerald-600' : 'text-red-600'}`}>
                        {numFmt(debtCapacity.leverage)}x
                      </span>
                    </div>
                  )}
                  {debtCapacity.totalAssets > 0 && (
                    <div className="flex justify-between pt-2 border-t border-blue-200 mt-2">
                      <span className="text-blue-700">Total Assets:</span>
                      <span className="font-bold text-blue-900">{currencyFmtMM(debtCapacity.totalAssets, ccy)}</span>
                    </div>
                  )}
                  {debtCapacity.ltv > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-700">LTV (Loan-to-Value):</span>
                      <span className={`font-bold ${debtCapacity.ltv <= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {debtCapacity.ltv.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================== */}
      {/* SECTION 2: ALTERNATIVE CAPITAL STRUCTURES */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-purple-600 shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-purple-600" />
            Structure Optimization & Alternatives
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Compare alternative capital structures and their impact on credit metrics
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Alternative Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(alternatives).map(([key, alt]) => (
              <div
                key={key}
                onClick={() => setSelectedAlternative(key)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                  selectedAlternative === key
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-purple-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-800">{alt.name}</h4>
                  {alt.covenantCompliant ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-3 min-h-[2.5rem]">{alt.description}</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Debt:</span>
                    <span className="font-bold text-slate-800">{currencyFmtMM(alt.debt, ccy)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DSCR:</span>
                    <span className={`font-bold ${
                      alt.dscr >= 1.5 ? 'text-emerald-600' :
                      alt.dscr >= 1.25 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {numFmt(alt.dscr)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Leverage:</span>
                    <span className={`font-bold ${
                      alt.leverage <= 3.0 ? 'text-emerald-600' :
                      alt.leverage <= 4.0 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {numFmt(alt.leverage)}x
                    </span>
                  </div>
                </div>
                {key !== 'current' && alt.changes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-xs text-purple-700 font-medium">
                      {alt.changes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected Alternative Details */}
          {selectedAlternative && alternatives[selectedAlternative] && (
            <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-purple-900">
                  {alternatives[selectedAlternative].name} - Detailed Analysis
                </h4>
                {alternatives[selectedAlternative].covenantCompliant ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-full">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">COVENANT COMPLIANT</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-100 border border-red-300 rounded-full">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-red-800">COVENANT BREACH</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Total Debt</div>
                  <div className="text-lg font-bold text-slate-800">
                    {currencyFmtMM(alternatives[selectedAlternative].debt, ccy)}
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Total Equity</div>
                  <div className="text-lg font-bold text-slate-800">
                    {currencyFmtMM(alternatives[selectedAlternative].equity, ccy)}
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Debt %</div>
                  <div className="text-lg font-bold text-red-600">
                    {alternatives[selectedAlternative].debtPct.toFixed(0)}%
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Equity %</div>
                  <div className="text-lg font-bold text-emerald-600">
                    {alternatives[selectedAlternative].equityPct.toFixed(0)}%
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">DSCR</div>
                  <div className={`text-lg font-bold ${
                    alternatives[selectedAlternative].dscr >= 1.5 ? 'text-emerald-600' :
                    alternatives[selectedAlternative].dscr >= 1.25 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {numFmt(alternatives[selectedAlternative].dscr)}x
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Leverage</div>
                  <div className={`text-lg font-bold ${
                    alternatives[selectedAlternative].leverage <= 3.0 ? 'text-emerald-600' :
                    alternatives[selectedAlternative].leverage <= 4.0 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {numFmt(alternatives[selectedAlternative].leverage)}x
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Annual Debt Service</div>
                  <div className="text-lg font-bold text-slate-800">
                    {currencyFmtMM(alternatives[selectedAlternative].annualDebtService, ccy)}
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">Loan Tenor</div>
                  <div className="text-lg font-bold text-slate-800">
                    {alternatives[selectedAlternative].tenor} years
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-purple-200">
                  <div className="text-xs text-slate-600 mb-1">LTV</div>
                  <div className={`text-lg font-bold ${
                    alternatives[selectedAlternative].ltv <= 65 ? 'text-emerald-600' :
                    alternatives[selectedAlternative].ltv <= 75 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {alternatives[selectedAlternative].ltv.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Chart */}
          <div className="mt-6">
            <h4 className="font-semibold text-sm mb-3 text-slate-800">Side-by-Side Comparison</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={alternativesComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine yAxisId="left" y={params.minDSCR || 1.25} stroke={COLORS.danger} strokeDasharray="3 3" label={{ value: 'Min DSCR', position: 'right', fontSize: 11 }} />
                <ReferenceLine yAxisId="left" y={params.maxNDToEBITDA || 4.0} stroke={COLORS.warning} strokeDasharray="3 3" label={{ value: 'Max Leverage', position: 'right', fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="DSCR" fill={COLORS.success} name="DSCR" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="left" dataKey="Leverage" fill={COLORS.danger} name="Leverage" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="right" dataKey="DebtPct" fill={COLORS.purple} name="Debt %" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================== */}
      {/* SECTION 3: INTERACTIVE SENSITIVITY ANALYSIS */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-indigo-600 shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-indigo-600" />
                Interactive Sensitivity Analysis
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Adjust key assumptions to see real-time impact on debt capacity
              </p>
            </div>
            <Button
              size="sm"
              variant={showSensitivity ? "default" : "outline"}
              onClick={() => setShowSensitivity(!showSensitivity)}
            >
              {showSensitivity ? 'Hide' : 'Show'} Sensitivity
            </Button>
          </div>
        </CardHeader>

        {showSensitivity && (
          <CardContent className="pt-6">
            {/* Interactive Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* EBITDA Adjustment */}
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-emerald-900">EBITDA Change</label>
                  <span className={`text-lg font-bold ${
                    ebitdaAdjustment >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {ebitdaAdjustment >= 0 ? '+' : ''}{(ebitdaAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="5"
                  value={ebitdaAdjustment * 100}
                  onChange={(e) => setEbitdaAdjustment(Number(e.target.value) / 100)}
                  className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-emerald-700 mt-2">
                  <span>-30%</span>
                  <span className="font-semibold">0%</span>
                  <span>+30%</span>
                </div>
                <div className="mt-3 text-xs text-emerald-800">
                  New EBITDA: <strong>{currencyFmtMM((debtCapacity.ebitda * (1 + ebitdaAdjustment)), ccy)}</strong>
                </div>
              </div>

              {/* Interest Rate Adjustment */}
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-amber-900">Interest Rate Change</label>
                  <span className={`text-lg font-bold ${
                    rateAdjustment >= 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {rateAdjustment >= 0 ? '+' : ''}{(rateAdjustment * 100).toFixed(0)}bps
                  </span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="300"
                  step="25"
                  value={rateAdjustment * 10000}
                  onChange={(e) => setRateAdjustment(Number(e.target.value) / 10000)}
                  className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-xs text-amber-700 mt-2">
                  <span>-200bps</span>
                  <span className="font-semibold">0</span>
                  <span>+300bps</span>
                </div>
                <div className="mt-3 text-xs text-amber-800">
                  New Rate: <strong>{pctFmt(params.interestRate + rateAdjustment)}</strong>
                </div>
              </div>

              {/* Tenor Adjustment */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-blue-900">Loan Tenor Change</label>
                  <span className={`text-lg font-bold ${
                    tenorAdjustment >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {tenorAdjustment >= 0 ? '+' : ''}{tenorAdjustment} years
                  </span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="5"
                  step="1"
                  value={tenorAdjustment}
                  onChange={(e) => setTenorAdjustment(Number(e.target.value))}
                  className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-blue-700 mt-2">
                  <span>-2yr</span>
                  <span className="font-semibold">0</span>
                  <span>+5yr</span>
                </div>
                <div className="mt-3 text-xs text-blue-800">
                  New Tenor: <strong>{params.debtTenorYears + tenorAdjustment} years</strong>
                </div>
              </div>
            </div>

            {/* Live Capacity Update */}
            {liveDebtCapacity && (
              <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-300">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-indigo-900">Live Debt Capacity Update</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-indigo-700 mb-1">Max Sustainable</div>
                    <div className="text-xl font-bold text-indigo-900">
                      {currencyFmtMM(liveDebtCapacity.maxSustainableDebt, ccy)}
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">
                      {((liveDebtCapacity.maxSustainableDebt / debtCapacity.maxSustainableDebt - 1) * 100) >= 0 ? '↑' : '↓'}
                      {Math.abs((liveDebtCapacity.maxSustainableDebt / debtCapacity.maxSustainableDebt - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-indigo-700 mb-1">Safe Debt</div>
                    <div className="text-xl font-bold text-indigo-900">
                      {currencyFmtMM(liveDebtCapacity.safeDebt, ccy)}
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">
                      {((liveDebtCapacity.safeDebt / debtCapacity.safeDebt - 1) * 100) >= 0 ? '↑' : '↓'}
                      {Math.abs((liveDebtCapacity.safeDebt / debtCapacity.safeDebt - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-indigo-700 mb-1">Utilization</div>
                    <div className={`text-xl font-bold ${
                      liveDebtCapacity.utilizationPct > 100 ? 'text-red-600' :
                      liveDebtCapacity.utilizationPct > 90 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {liveDebtCapacity.utilizationPct.toFixed(0)}%
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">
                      {((liveDebtCapacity.utilizationPct - debtCapacity.utilizationPct)) >= 0 ? '↑' : '↓'}
                      {Math.abs(liveDebtCapacity.utilizationPct - debtCapacity.utilizationPct).toFixed(1)}pp
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-indigo-700 mb-1">Excess/(Gap)</div>
                    <div className={`text-xl font-bold ${
                      liveDebtCapacity.excessDebt > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {currencyFmtMM(Math.abs(liveDebtCapacity.excessDebt), ccy)}
                    </div>
                    <div className="text-xs text-indigo-600 mt-1">
                      {liveDebtCapacity.excessDebt > 0 ? 'Over' : 'Under'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reset Button */}
            <div className="flex justify-center mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEbitdaAdjustment(0);
                  setRateAdjustment(0);
                  setTenorAdjustment(0);
                }}
                className="flex items-center gap-2"
              >
                <TrendingDown className="w-4 h-4" />
                Reset to Base Case
              </Button>
            </div>

            {/* Static Sensitivity Charts */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* EBITDA Sensitivity */}
              <div>
                <h5 className="text-sm font-semibold mb-3 text-slate-800">EBITDA Sensitivity</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sensitivityData.ebitda}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => `${ccy} ${value.toFixed(1)}M`} />
                    <Line type="monotone" dataKey="capacity" stroke={COLORS.success} strokeWidth={2} dot={{ r: 4 }} />
                    <ReferenceLine y={debtCapacity.currentDebtRequest / 1_000_000} stroke={COLORS.danger} strokeDasharray="3 3" label={{ value: 'Current', fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Rate Sensitivity */}
              <div>
                <h5 className="text-sm font-semibold mb-3 text-slate-800">Interest Rate Sensitivity</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sensitivityData.rate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => `${ccy} ${value.toFixed(1)}M`} />
                    <Line type="monotone" dataKey="capacity" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
                    <ReferenceLine y={debtCapacity.currentDebtRequest / 1_000_000} stroke={COLORS.danger} strokeDasharray="3 3" label={{ value: 'Current', fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tenor Sensitivity */}
              <div>
                <h5 className="text-sm font-semibold mb-3 text-slate-800">Tenor Sensitivity</h5>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sensitivityData.tenor}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => `${ccy} ${value.toFixed(1)}M`} />
                    <Line type="monotone" dataKey="capacity" stroke={COLORS.info} strokeWidth={2} dot={{ r: 4 }} />
                    <ReferenceLine y={debtCapacity.currentDebtRequest / 1_000_000} stroke={COLORS.danger} strokeDasharray="3 3" label={{ value: 'Current', fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ====================================================================== */}
      {/* SECTION 4: INDUSTRY BENCHMARKING */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-emerald-600 shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Industry Benchmarking: {params?.industry || 'General Industry'}
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Compare your proposed structure to industry peers and standards
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Benchmark Comparison Cards */}
            <div className="space-y-4">
              {/* Leverage Comparison */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-slate-800">Leverage (Net Debt/EBITDA)</h5>
                  {projection?.rows?.[0]?.ndToEbitda <= industryBenchmarks.medianLeverage ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-center p-3 bg-white rounded border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Your Structure</div>
                    <div className={`text-2xl font-bold ${
                      projection?.rows?.[0]?.ndToEbitda <= industryBenchmarks.medianLeverage 
                        ? 'text-emerald-600' 
                        : 'text-amber-600'
                    }`}>
                      {numFmt(projection?.rows?.[0]?.ndToEbitda || 0)}x
                    </div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">Industry Median</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {numFmt(industryBenchmarks.medianLeverage)}x
                    </div>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      projection?.rows?.[0]?.ndToEbitda <= industryBenchmarks.medianLeverage
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600'
                    }`}
                    style={{ width: `${Math.min(100, ((projection?.rows?.[0]?.ndToEbitda || 0) / industryBenchmarks.medianLeverage) * 50)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-600 mt-2">
                  {projection?.rows?.[0]?.ndToEbitda <= industryBenchmarks.medianLeverage
                    ? `✅ ${numFmt(industryBenchmarks.medianLeverage - (projection?.rows?.[0]?.ndToEbitda || 0))}x below industry median`
                    : `⚠️ ${numFmt((projection?.rows?.[0]?.ndToEbitda || 0) - industryBenchmarks.medianLeverage)}x above industry median`}
                </div>
              </div>

              {/* DSCR Comparison */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-slate-800">Debt Service Coverage (DSCR)</h5>
                  {(projection?.creditStats?.minDSCR || 0) >= industryBenchmarks.medianDSCR ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-center p-3 bg-white rounded border border-slate-200">
                    <div className="text-xs text-slate-600 mb-1">Your Min DSCR</div>
                    <div className={`text-2xl font-bold ${
                      (projection?.creditStats?.minDSCR || 0) >= industryBenchmarks.medianDSCR
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}>
                      {numFmt(projection?.creditStats?.minDSCR || 0)}x
                    </div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded border border-emerald-200">
                    <div className="text-xs text-emerald-700 mb-1">Industry Median</div>
                    <div className="text-2xl font-bold text-emerald-700">
                      {numFmt(industryBenchmarks.medianDSCR)}x
                    </div>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      (projection?.creditStats?.minDSCR || 0) >= industryBenchmarks.medianDSCR
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600'
                    }`}
                    style={{ width: `${Math.min(100, ((projection?.creditStats?.minDSCR || 0) / industryBenchmarks.medianDSCR) * 50)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-600 mt-2">
                  {(projection?.creditStats?.minDSCR || 0) >= industryBenchmarks.medianDSCR
                    ? `✅ ${numFmt((projection?.creditStats?.minDSCR || 0) - industryBenchmarks.medianDSCR)}x above industry median`
                    : `⚠️ ${numFmt(industryBenchmarks.medianDSCR - (projection?.creditStats?.minDSCR || 0))}x below industry median`}
                </div>
              </div>

              {/* Debt/Equity Mix Comparison */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h5 className="text-sm font-semibold text-slate-800 mb-3">Capital Structure Mix</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-600 mb-2">Your Structure</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Debt:</span>
                        <span className="font-bold text-red-600">
                          {((debtCapacity.currentDebtRequest / (debtCapacity.currentDebtRequest + (params.equityContribution || 0))) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Equity:</span>
                        <span className="font-bold text-emerald-600">
                          {(((params.equityContribution || 0) / (debtCapacity.currentDebtRequest + (params.equityContribution || 0))) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600 mb-2">Industry Typical</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Debt:</span>
                        <span className="font-bold text-red-600">
                          {industryBenchmarks.medianDebtPct}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Equity:</span>
                        <span className="font-bold text-emerald-600">
                          {industryBenchmarks.medianEquityPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Comparison Chart */}
            <div>
              <h5 className="text-sm font-semibold mb-3 text-slate-800">Benchmark Comparison Chart</h5>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  {
                    metric: 'Leverage',
                    yours: projection?.rows?.[0]?.ndToEbitda || 0,
                    industry: industryBenchmarks.medianLeverage
                  },
                  {
                    metric: 'DSCR',
                    yours: projection?.creditStats?.minDSCR || 0,
                    industry: industryBenchmarks.medianDSCR
                  },
                  {
                    metric: 'Debt %',
                    yours: ((debtCapacity.currentDebtRequest / (debtCapacity.currentDebtRequest + (params.equityContribution || 0))) * 100),
                    industry: industryBenchmarks.medianDebtPct
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="yours" fill={COLORS.primary} name="Your Structure" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="industry" fill={COLORS.success} name="Industry Median" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Industry Context */}
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-xs text-emerald-800">
                    <p className="font-semibold mb-2">Industry Context: {params?.industry}</p>
                    <ul className="space-y-1">
                      <li>• Typical leverage for this sector: {numFmt(industryBenchmarks.medianLeverage)}x Net Debt/EBITDA</li>
                      <li>• Standard DSCR requirement: {numFmt(industryBenchmarks.medianDSCR)}x minimum</li>
                      <li>• Common capital structure: {industryBenchmarks.medianDebtPct}% debt / {industryBenchmarks.medianEquityPct}% equity</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================== */}
      {/* SECTION 5: AI-POWERED RECOMMENDATIONS */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI-Powered Lender Recommendations
                </span>
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Intelligent analysis and actionable recommendations from AI credit advisor
              </p>
            </div>
            {aiRecommendations && (
              <button
                onClick={() => {
                  setLastAIContext(null);
                  setAiRecommendations(null);
                }}
                className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1"
                title="Clear cached analysis and regenerate"
              >
                <Activity className="w-3 h-3" />
                Refresh Analysis
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoadingAI ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                <Sparkles className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-slate-600 font-medium mt-4">AI analyzing capital structure...</p>
              <p className="text-slate-500 text-sm mt-2">Evaluating optimal debt capacity and structure</p>
            </div>
          ) : aiRecommendations ? (
            <div className="space-y-6">
              {/* Overall Recommendation Banner */}
              <div className={`p-5 rounded-lg border-2 ${
                aiRecommendations.recommendation === 'APPROVE' 
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300' :
                aiRecommendations.recommendation === 'APPROVE WITH CONDITIONS'
                  ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300' :
                  'bg-gradient-to-r from-red-50 to-rose-50 border-red-300'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {getRecommendationIcon(aiRecommendations.recommendation)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-bold text-slate-900">
                        {aiRecommendations.recommendation}
                      </h4>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                        getRiskBadgeColor(aiRecommendations.riskAssessment)
                      }`}>
                        {aiRecommendations.riskAssessment} RISK
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {aiRecommendations.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Full AI Analysis */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-slate-600" />
                  <h4 className="font-bold text-slate-800">Detailed AI Analysis</h4>
                </div>
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap bg-white p-4 rounded border border-slate-200 shadow-sm">
                  {aiRecommendations.fullAnalysis}
                </div>
              </div>

              {/* Key Findings */}
              {aiRecommendations.keyFindings && aiRecommendations.keyFindings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiRecommendations.keyFindings.map((finding, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-3"
                    >
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900">{finding}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Capacity Summary from AI */}
              {aiRecommendations.capacity && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                    <div className="text-xs text-slate-600 mb-1">Max Sustainable</div>
                    <div className="text-lg font-bold text-slate-800">
                      {currencyFmtMM(aiRecommendations.capacity.maxSustainableDebt, ccy)}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                    <div className="text-xs text-slate-600 mb-1">Safe Level</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {currencyFmtMM(aiRecommendations.capacity.safeDebt, ccy)}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                    <div className="text-xs text-slate-600 mb-1">Current Request</div>
                    <div className="text-lg font-bold text-slate-800">
                      {currencyFmtMM(aiRecommendations.capacity.currentDebtRequest, ccy)}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-center">
                    <div className="text-xs text-slate-600 mb-1">Utilization</div>
                    <div className={`text-lg font-bold ${
                      aiRecommendations.capacity.utilizationPct > 100 ? 'text-red-600' :
                      aiRecommendations.capacity.utilizationPct > 90 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {aiRecommendations.capacity.utilizationPct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}

              {/* AI Recommended Alternative */}
              {aiRecommendations.alternatives && (
                <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-300">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-purple-600" />
                    <h4 className="font-bold text-purple-900">AI Recommended Structure</h4>
                  </div>
                  <p className="text-sm text-purple-800 mb-4">
                    Based on comprehensive analysis, the AI recommends considering alternative structures to optimize risk-return profile.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(aiRecommendations.alternatives)
                      .filter(([key]) => key !== 'current')
                      .map(([key, alt]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedAlternative(key)}
                          className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-all text-left"
                        >
                          <div className="font-semibold text-sm text-purple-900 mb-2">{alt.name}</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-600">DSCR:</span>
                              <span className="font-bold text-slate-800">{numFmt(alt.dscr)}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-600">Leverage:</span>
                              <span className="font-bold text-slate-800">{numFmt(alt.leverage)}x</span>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Cache Status Indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Activity className="w-3 h-3" />
                <span>Analysis cached • Updated: {new Date().toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">AI recommendations will appear here</p>
              <p className="text-slate-500 text-sm mt-2">Configure debt parameters to enable AI analysis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====================================================================== */}
      {/* SECTION 6: EXECUTIVE SUMMARY */}
      {/* ====================================================================== */}
      
      <Card className="border-l-4 border-l-slate-600 bg-gradient-to-r from-slate-50 to-slate-100 shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-600" />
            Executive Summary: Lender Decision Framework
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Decision Metrics */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-600 mb-2">Debt Capacity Status</div>
                  <div className={`text-3xl font-bold ${
                    debtCapacity.utilizationPct <= 80 ? 'text-emerald-600' :
                    debtCapacity.utilizationPct <= 100 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {debtCapacity.utilizationPct > 100 ? 'OVER' : debtCapacity.utilizationPct > 90 ? 'FULL' : 'OK'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {debtCapacity.utilizationPct.toFixed(0)}% utilized
                  </div>
                </div>

                <div className="text-center p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-600 mb-2">Industry Position</div>
                  <div className={`text-3xl font-bold ${
                    (projection?.rows?.[0]?.ndToEbitda || 0) <= industryBenchmarks.medianLeverage ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {(projection?.rows?.[0]?.ndToEbitda || 0) <= industryBenchmarks.medianLeverage ? 'BELOW' : 'ABOVE'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    vs. industry median
                  </div>
                </div>

                <div className="text-center p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-600 mb-2">Covenant Risk</div>
                  <div className={`text-3xl font-bold ${
                    (projection?.breaches?.dscrBreaches || 0) === 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {(projection?.breaches?.dscrBreaches || 0) === 0 ? 'LOW' : 'HIGH'}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {(projection?.breaches?.dscrBreaches || 0)} breach(es)
                  </div>
                </div>
              </div>

              {/* Key Decision Points */}
              <div className="p-5 bg-white rounded-lg border-2 border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Key Decision Points
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      debtCapacity.utilizationPct <= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <div>
                      <span className="font-semibold text-slate-800">Debt Sizing:</span>
                      <span className="text-slate-700 ml-1">
                        {debtCapacity.utilizationPct <= 80 
                          ? `Within safe capacity - ${currencyFmtMM(debtCapacity.maxSustainableDebt - debtCapacity.currentDebtRequest, ccy)} additional headroom available`
                          : `Exceeds safe capacity - recommend reducing by ${currencyFmtMM(debtCapacity.excessDebt, ccy)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      alternatives?.alternative1?.covenantCompliant ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <span className="font-semibold text-slate-800">Structure Optimization:</span>
                      <span className="text-slate-700 ml-1">
                        {alternatives?.alternative1?.covenantCompliant
                          ? 'Alternative structures maintain covenant compliance'
                          : 'Current structure requires enhancement for sustainability'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      (projection?.rows?.[0]?.ndToEbitda || 0) <= industryBenchmarks.medianLeverage 
                        ? 'bg-emerald-500' 
                        : 'bg-amber-500'
                    }`} />
                    <div>
                      <span className="font-semibold text-slate-800">Industry Alignment:</span>
                      <span className="text-slate-700 ml-1">
                        {(projection?.rows?.[0]?.ndToEbitda || 0) <= industryBenchmarks.medianLeverage
                          ? `Leverage within industry norms (${numFmt((projection?.rows?.[0]?.ndToEbitda || 0))}x vs ${numFmt(industryBenchmarks.medianLeverage)}x median)`
                          : `Leverage above industry average - consider peer comparison justification`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Final Recommendation Box */}
            <div className="space-y-4">
              <div className={`p-5 rounded-lg border-2 ${
                debtCapacity.recommendation === 'APPROVE'
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300'
                  : debtCapacity.recommendation === 'APPROVE WITH CONDITIONS'
                  ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
              }`}>
                <div className="text-center">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Final Recommendation
                  </div>
                  <div className={`text-2xl font-bold mb-3 ${
                    debtCapacity.recommendation === 'APPROVE' ? 'text-emerald-700' :
                    debtCapacity.recommendation === 'APPROVE WITH CONDITIONS' ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {debtCapacity.recommendation}
                  </div>
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-xs font-bold border-2 ${
                    getRiskBadgeColor(debtCapacity.riskLevel)
                  }`}>
                    {debtCapacity.riskLevel} RISK PROFILE
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="p-4 bg-white rounded-lg border-2 border-slate-200 shadow-sm space-y-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-600">Requested Amount:</span>
                  <span className="font-bold text-slate-800">
                    {currencyFmtMM(debtCapacity.currentDebtRequest, ccy)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-600">Safe Debt Level:</span>
                  <span className="font-bold text-emerald-600">
                    {currencyFmtMM(debtCapacity.safeDebt, ccy)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-600">Excess/(Gap):</span>
                  <span className={`font-bold ${
                    debtCapacity.excessDebt > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {currencyFmtMM(Math.abs(debtCapacity.excessDebt), ccy)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Capacity Used:</span>
                  <span className={`font-bold ${
                    debtCapacity.utilizationPct > 100 ? 'text-red-600' :
                    debtCapacity.utilizationPct > 90 ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                    {debtCapacity.utilizationPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Action Required */}
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <h5 className="text-sm font-bold text-blue-900">Next Steps</h5>
                </div>
                <ul className="space-y-2 text-xs text-blue-800">
                  {debtCapacity.recommendation === 'APPROVE' ? (
                    <>
                      <li>• Finalize loan documentation</li>
                      <li>• Establish monitoring framework</li>
                      <li>• Set quarterly covenant testing</li>
                    </>
                  ) : debtCapacity.recommendation === 'APPROVE WITH CONDITIONS' ? (
                    <>
                      <li>• Negotiate enhanced covenants</li>
                      <li>• Require additional collateral</li>
                      <li>• Establish DSRA account</li>
                      <li>• Implement quarterly reviews</li>
                    </>
                  ) : (
                    <>
                      <li>• Reduce debt to safe level</li>
                      <li>• Increase equity contribution</li>
                      <li>• Restructure payment terms</li>
                      <li>• Re-submit revised proposal</li>
                    </>
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