import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { getTotalDebt } from "../utils/debtHelpers";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, XCircle, Shield, Sliders, Info, ChevronDown, ChevronUp } from "lucide-react";

// Metric explanations database
const METRIC_EXPLANATIONS = {
  dscr: {
    title: "Debt Service Coverage Ratio (DSCR)",
    description: "Measures ability to cover total debt payments (principal + interest) from operating cash flow. Formula: (EBITDA - CapEx) / Debt Service",
    interpretation: "Higher is better. Below 1.0x means you cannot service debt from operations alone. Lenders typically require 1.20x-1.50x minimum.",
    benchmark: "Industry standard: 1.20x - 1.50x minimum covenant",
    criticalLevel: 1.0,
    warningLevel: 1.2
  },
  icr: {
    title: "Interest Coverage Ratio (ICR)",
    description: "Shows how many times EBITDA can cover interest expense. Formula: EBITDA / Interest Expense",
    interpretation: "Higher is better. Below 2.0x indicates tight coverage and limited ability to absorb interest rate increases.",
    benchmark: "Industry standard: 2.0x - 3.0x minimum covenant",
    criticalLevel: 1.5,
    warningLevel: 2.0
  },
  leverage: {
    title: "Leverage Ratio (Net Debt/EBITDA)",
    description: "Measures total debt burden relative to earnings. Formula: Net Debt / EBITDA",
    interpretation: "Lower is better. Higher leverage means more financial risk and less capacity for additional borrowing.",
    benchmark: "Industry standard: 3.0x - 4.0x maximum covenant",
    criticalLevel: 5.0,
    warningLevel: 3.5,
    inverse: true
  },
  debtService: {
    title: "Annual Debt Service",
    description: "Total cash required annually to service debt (principal repayment + interest payments).",
    interpretation: "Shows absolute cash burden. Compare to operating cash flow to assess affordability.",
    benchmark: "Should not exceed 15-25% of revenue for most businesses"
  },
  debtServicePct: {
    title: "Debt Service as % of Revenue",
    description: "Debt service payments as a percentage of total revenue. Shows relative debt burden.",
    interpretation: "Lower is better. Above 20% indicates high debt burden relative to sales.",
    benchmark: "Healthy range: 10-20% of revenue",
    criticalLevel: 0.25,
    warningLevel: 0.20,
    inverse: true
  },
  breakeven: {
    title: "Breakeven EBITDA",
    description: "Minimum EBITDA required to cover debt service. If EBITDA falls below this, debt payments cannot be made.",
    interpretation: "Your actual EBITDA should be well above this level to provide cushion for downturns.",
    benchmark: "Aim for actual EBITDA 150-200% of breakeven level",
    inverse: true
  },
  ltv: {
    title: "Loan-to-Value (LTV)",
    description: "Total debt as a percentage of collateral/asset value. Measures collateral coverage.",
    interpretation: "Lower is better. Higher LTV means less equity cushion and higher loss severity for lenders.",
    benchmark: "Typical maximum: 60-80% depending on asset type",
    criticalLevel: 0.85,
    warningLevel: 0.75,
    inverse: true
  },
  assetCoverage: {
    title: "Asset Coverage Ratio",
    description: "Total assets divided by total debt. Shows how many times assets cover debt obligations.",
    interpretation: "Higher is better. Provides cushion for asset value declines and secondary repayment source.",
    benchmark: "Minimum 1.5x-2.0x for secured lending",
    criticalLevel: 1.0,
    warningLevel: 1.5
  },
  breaches: {
    title: "Covenant Breaches",
    description: "Number of years in projection period where one or more financial covenants are violated.",
    interpretation: "Any breach triggers default provisions and requires lender waiver or restructuring.",
    benchmark: "Zero breaches required for deal approval",
    criticalLevel: 1,
    warningLevel: 0,
    inverse: true
  }
};

function Tooltip({ content, children }) {
  const [show, setShow] = useState(false);
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 left-0 top-6 w-96 p-4 bg-white border-2 border-blue-500 rounded-lg shadow-xl">
          <div className="font-bold text-sm text-blue-900 mb-2">{content.title}</div>
          <div className="text-xs text-slate-700 mb-2">{content.description}</div>
          <div className="text-xs text-blue-700 mb-1">
            <strong>Interpretation:</strong> {content.interpretation}
          </div>
          <div className="text-xs text-slate-600">
            <strong>Benchmark:</strong> {content.benchmark}
          </div>
        </div>
      )}
    </div>
  );
}

function ShockSlider({ label, value, onChange, min = -0.2, max = 0.2, step = 0.005 }) {
  const percentage = (value * 100).toFixed(1);
  const isNegative = value < 0;
  const isPositive = value > 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-slate-700">{label}</Label>
        <div className={`text-sm font-bold px-2 py-1 rounded ${
          isNegative ? 'bg-red-100 text-red-700' : 
          isPositive ? 'bg-orange-100 text-orange-700' : 
          'bg-slate-100 text-slate-700'
        }`}>
          {value >= 0 ? '+' : ''}{percentage}%
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>{(min * 100).toFixed(0)}%</span>
        <span>0%</span>
        <span>+{(max * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function Label({ children, className = "" }) {
  return <label className={`block text-sm font-medium ${className}`}>{children}</label>;
}

function MetricCard({ label, metricKey, baseValue, stressedValue, covenant, threshold, format = "number", inverse = false, unit = "" }) {
  const base = parseFloat(baseValue) || 0;
  const stressed = parseFloat(stressedValue) || 0;
  const covenantVal = parseFloat(covenant) || 0;
  const explanation = METRIC_EXPLANATIONS[metricKey];
  
  // Determine status
  let status, statusColor, statusIcon;
  
  if (inverse) {
    // For leverage, LTV, debt service % - lower is better
    if (stressed <= covenantVal * 0.8) {
      status = "Strong";
      statusColor = "text-green-600 bg-green-50 border-green-200";
      statusIcon = <CheckCircle className="w-4 h-4" />;
    } else if (stressed <= covenantVal) {
      status = "Pass";
      statusColor = "text-yellow-600 bg-yellow-50 border-yellow-200";
      statusIcon = <CheckCircle className="w-4 h-4" />;
    } else {
      status = "Breach";
      statusColor = "text-red-600 bg-red-50 border-red-200";
      statusIcon = <XCircle className="w-4 h-4" />;
    }
  } else {
    // For DSCR, ICR, Asset Coverage - higher is better
    if (stressed >= covenantVal * 1.2) {
      status = "Strong";
      statusColor = "text-green-600 bg-green-50 border-green-200";
      statusIcon = <CheckCircle className="w-4 h-4" />;
    } else if (stressed >= covenantVal) {
      status = "Pass";
      statusColor = "text-yellow-600 bg-yellow-50 border-yellow-200";
      statusIcon = <CheckCircle className="w-4 h-4" />;
    } else {
      status = "Breach";
      statusColor = "text-red-600 bg-red-50 border-red-200";
      statusIcon = <XCircle className="w-4 h-4" />;
    }
  }
  
  const change = stressed - base;
  const changePercent = base !== 0 ? (change / base) * 100 : 0;
  const isNegativeChange = change < 0;
  
  // Format values based on type
  const formatValue = (val) => {
    if (format === "currency") return currencyFmtMM(val, unit);
    if (format === "percent") return pctFmt(val);
    return numFmt(val) + (unit ? unit : "");
  };
  
  return (
    <div className={`p-4 rounded-lg border-2 ${statusColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-600">{label}</div>
          {explanation && (
            <Tooltip content={explanation}>
              <Info className="w-4 h-4 text-blue-500 cursor-help" />
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1">
          {statusIcon}
          <span className="text-xs font-bold">{status}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-xs text-slate-500">Base:</div>
          <div className="text-sm font-semibold text-slate-700">{formatValue(base)}</div>
        </div>
        
        <div className="flex items-baseline justify-between">
          <div className="text-xs text-slate-500">Stressed:</div>
          <div className="text-lg font-bold">{formatValue(stressed)}</div>
        </div>
        
        <div className="flex items-baseline justify-between pt-2 border-t">
          <div className="text-xs text-slate-500">Change:</div>
          <div className={`text-sm font-bold flex items-center gap-1 ${
            isNegativeChange ? 'text-red-600' : 'text-green-600'
          }`}>
            {isNegativeChange ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {change >= 0 ? '+' : ''}{formatValue(change)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
          </div>
        </div>
        
        {covenant && (
          <div className="text-xs text-slate-500 mt-1">
            Covenant: {formatValue(covenantVal)}
          </div>
        )}
      </div>
    </div>
  );
}

function StressInterpretation({ baseMetrics, stressedMetrics, params, stressedBreaches }) {
  const [expanded, setExpanded] = useState(true);
  const criticalIssues = [];
  const warnings = [];
  const strengths = [];
  
  // DSCR Analysis
  if (stressedMetrics.minDSCR < 1.0) {
    criticalIssues.push({
      metric: "DSCR",
      message: `DSCR of ${numFmt(stressedMetrics.minDSCR)}x is below 1.0x - Cannot service debt from operations. Company would require restructuring, equity injection, or covenant waiver to avoid default.`
    });
  } else if (stressedMetrics.minDSCR < params.minDSCR) {
    warnings.push({
      metric: "DSCR",
      message: `DSCR breach: ${numFmt(stressedMetrics.minDSCR)}x is below ${numFmt(params.minDSCR)}x covenant. This would trigger technical default requiring lender waiver.`
    });
  } else if (stressedMetrics.minDSCR >= params.minDSCR * 1.2) {
    strengths.push({
      metric: "DSCR",
      message: `Strong DSCR of ${numFmt(stressedMetrics.minDSCR)}x provides ${numFmt(stressedMetrics.minDSCR - params.minDSCR)}x cushion above covenant.`
    });
  }
  
  // ICR Analysis
  if (stressedMetrics.minICR < 1.5) {
    criticalIssues.push({
      metric: "ICR",
      message: `ICR of ${numFmt(stressedMetrics.minICR)}x indicates severe stress. Limited ability to absorb interest rate increases or revenue declines.`
    });
  } else if (stressedMetrics.minICR < params.targetICR) {
    warnings.push({
      metric: "ICR",
      message: `ICR breach: ${numFmt(stressedMetrics.minICR)}x is below ${numFmt(params.targetICR)}x covenant.`
    });
  } else if (stressedMetrics.minICR >= params.targetICR * 1.3) {
    strengths.push({
      metric: "ICR",
      message: `Strong interest coverage of ${numFmt(stressedMetrics.minICR)}x provides cushion for rate increases.`
    });
  }
  
  // Leverage Analysis
  if (stressedMetrics.maxLeverage > params.maxNDToEBITDA) {
    warnings.push({
      metric: "Leverage",
      message: `Leverage of ${numFmt(stressedMetrics.maxLeverage)}x exceeds ${numFmt(params.maxNDToEBITDA)}x maximum covenant.`
    });
  } else if (stressedMetrics.maxLeverage <= params.maxNDToEBITDA * 0.7) {
    strengths.push({
      metric: "Leverage",
      message: `Conservative leverage of ${numFmt(stressedMetrics.maxLeverage)}x is well below ${numFmt(params.maxNDToEBITDA)}x covenant.`
    });
  }
  
  // Debt Service % Analysis
  if (stressedMetrics.debtServicePctRevenue > 0.25) {
    criticalIssues.push({
      metric: "Debt Burden",
      message: `Debt service consumes ${pctFmt(stressedMetrics.debtServicePctRevenue)} of revenue - extremely high burden limiting operational flexibility.`
    });
  } else if (stressedMetrics.debtServicePctRevenue > 0.20) {
    warnings.push({
      metric: "Debt Burden",
      message: `Debt service at ${pctFmt(stressedMetrics.debtServicePctRevenue)} of revenue indicates elevated burden.`
    });
  }
  
  // LTV Analysis
  if (stressedMetrics.loanToValue > 0.80) {
    warnings.push({
      metric: "Collateral",
      message: `LTV of ${pctFmt(stressedMetrics.loanToValue)} indicates limited equity cushion. Minimal room for collateral value decline.`
    });
  } else if (stressedMetrics.loanToValue <= 0.60) {
    strengths.push({
      metric: "Collateral",
      message: `Conservative LTV of ${pctFmt(stressedMetrics.loanToValue)} provides strong collateral coverage.`
    });
  }
  
  // Overall breach summary
  if (stressedBreaches > 2) {
    criticalIssues.push({
      metric: "Covenants",
      message: `Multiple covenant breaches (${stressedBreaches} years) indicate fundamental mismatch between debt structure and operating performance under stress.`
    });
  }
  
  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader>
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Stress Test Interpretation
          </CardTitle>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Auto-generated analysis of stress scenario impact
        </p>
      </CardHeader>
      
      {expanded && (
        <CardContent>
          <div className="space-y-4">
            {criticalIssues.length > 0 && (
              <div>
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Critical Issues ({criticalIssues.length})
                </h4>
                <ul className="space-y-3">
                  {criticalIssues.map((issue, i) => (
                    <li key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="font-semibold text-sm text-red-900 mb-1">{issue.metric}</div>
                      <div className="text-sm text-red-700">{issue.message}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {warnings.length > 0 && (
              <div>
                <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Warnings ({warnings.length})
                </h4>
                <ul className="space-y-3">
                  {warnings.map((warning, i) => (
                    <li key={i} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="font-semibold text-sm text-orange-900 mb-1">{warning.metric}</div>
                      <div className="text-sm text-orange-700">{warning.message}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {strengths.length > 0 && (
              <div>
                <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Strengths ({strengths.length})
                </h4>
                <ul className="space-y-3">
                  {strengths.map((strength, i) => (
                    <li key={i} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="font-semibold text-sm text-green-900 mb-1">{strength.metric}</div>
                      <div className="text-sm text-green-700">{strength.message}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {criticalIssues.length === 0 && warnings.length === 0 && strengths.length === 0 && (
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <div className="text-slate-600">Adjust stress parameters to see analysis</div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function CustomStressTesting({ projections, params, customShocks, onShocksChange, ccy }) {
  const baseProjection = projections.base;
  const stressedProjection = projections.custom || baseProjection;
  
  // Calculate total debt using helper (checks all debt sources)
  const totalDebt = getTotalDebt(baseProjection, params);

  // Calculate loan metrics with proper debt detection and division guards
  const baseMetrics = {
    minDSCR: baseProjection.creditStats.minDSCR,
    minICR: baseProjection.creditStats.minICR,
    maxLeverage: baseProjection.creditStats.maxLeverage,
    avgDebtService: baseProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / baseProjection.rows.length,
    debtServicePctRevenue: (baseProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / baseProjection.rows.length) / params.baseRevenue,
    breakEvenEBITDA: baseProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / baseProjection.rows.length,
    // FIXED: Use totalDebt and guard against division by zero
    loanToValue: (params.collateralValue || 0) > 0 ? totalDebt / params.collateralValue : 0,
    assetCoverage: totalDebt > 0 ? (params.totalAssets || 0) / totalDebt : Infinity,
  };
  
  // Get total debt for stressed projection (might differ due to stress scenarios)
  const stressedTotalDebt = getTotalDebt(stressedProjection, params);

  const stressedMetrics = {
    minDSCR: stressedProjection.creditStats.minDSCR,
    minICR: stressedProjection.creditStats.minICR,
    maxLeverage: stressedProjection.creditStats.maxLeverage,
    avgDebtService: stressedProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / stressedProjection.rows.length,
    debtServicePctRevenue: (stressedProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / stressedProjection.rows.length) / (params.baseRevenue * (1 + customShocks.growthDelta)),
    breakEvenEBITDA: stressedProjection.rows.reduce((sum, r) => sum + r.debtService, 0) / stressedProjection.rows.length,
    // FIXED: Use stressedTotalDebt and guard against division by zero
    loanToValue: (params.collateralValue || 0) > 0 ? stressedTotalDebt / params.collateralValue : 0,
    assetCoverage: stressedTotalDebt > 0 ? (params.totalAssets || 0) / stressedTotalDebt : Infinity,
  };
  
  // Count breaches
  const baseBreaches = baseProjection.breaches.dscrBreaches + baseProjection.breaches.icrBreaches + baseProjection.breaches.ndBreaches;
  const stressedBreaches = stressedProjection.breaches.dscrBreaches + stressedProjection.breaches.icrBreaches + stressedProjection.breaches.ndBreaches;
  
  const hasShocks = Object.values(customShocks).some(v => v !== 0);
  
  return (
    <div className="space-y-6">
      {/* Stress Parameters */}
      <Card className="border-l-4 border-l-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            Adjust Stress Parameters
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Move sliders to simulate adverse scenarios. Metrics update in real-time.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ShockSlider 
              label="Revenue Growth Shock" 
              value={customShocks.growthDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, growthDelta: v })}
              min={-0.30}
              max={0.10}
            />
            <ShockSlider 
              label="COGS Increase" 
              value={customShocks.cogsDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, cogsDelta: v })}
              min={0}
              max={0.15}
            />
            <ShockSlider 
              label="OpEx Increase" 
              value={customShocks.opexDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, opexDelta: v })}
              min={0}
              max={0.15}
            />
            <ShockSlider 
              label="Interest Rate Hike" 
              value={customShocks.rateDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, rateDelta: v })}
              min={0}
              max={0.10}
            />
            <ShockSlider 
              label="WACC Increase" 
              value={customShocks.waccDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, waccDelta: v })}
              min={0}
              max={0.10}
            />
            <ShockSlider 
              label="CapEx Change" 
              value={customShocks.capexDelta} 
              onChange={(v) => onShocksChange({ ...customShocks, capexDelta: v })}
              min={-0.10}
              max={0.15}
            />
          </div>
          
          {hasShocks && (
            <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                Active stress scenario applied. View metrics below.
              </div>
              <button
                onClick={() => onShocksChange({ growthDelta: 0, cogsDelta: 0, opexDelta: 0, capexDelta: 0, rateDelta: 0, waccDelta: 0, termGDelta: 0 })}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-semibold"
              >
                Reset All
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Loan Metrics */}
      <Card className="border-l-4 border-l-indigo-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Loan Metrics - Real-Time Impact
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Compare base case vs stressed scenario. Hover over <Info className="w-3 h-3 inline text-blue-500" /> for explanations.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              label="Debt Service Coverage Ratio (DSCR)"
              metricKey="dscr"
              baseValue={baseMetrics.minDSCR}
              stressedValue={stressedMetrics.minDSCR}
              covenant={params.minDSCR}
              unit="x"
            />
            
            <MetricCard
              label="Interest Coverage Ratio (ICR)"
              metricKey="icr"
              baseValue={baseMetrics.minICR}
              stressedValue={stressedMetrics.minICR}
              covenant={params.targetICR}
              unit="x"
            />
            
            <MetricCard
              label="Leverage Ratio (Net Debt/EBITDA)"
              metricKey="leverage"
              baseValue={baseMetrics.maxLeverage}
              stressedValue={stressedMetrics.maxLeverage}
              covenant={params.maxNDToEBITDA}
              unit="x"
              inverse={true}
            />
            
            <MetricCard
              label="Annual Debt Service"
              metricKey="debtService"
              baseValue={baseMetrics.avgDebtService}
              stressedValue={stressedMetrics.avgDebtService}
              format="currency"
              unit={ccy}
            />
            
            <MetricCard
              label="Debt Service % of Revenue"
              metricKey="debtServicePct"
              baseValue={baseMetrics.debtServicePctRevenue}
              stressedValue={stressedMetrics.debtServicePctRevenue}
              format="percent"
              covenant={0.20}
              inverse={true}
            />
            
            <MetricCard
              label="Breakeven EBITDA"
              metricKey="breakeven"
              baseValue={baseMetrics.breakEvenEBITDA}
              stressedValue={stressedMetrics.breakEvenEBITDA}
              format="currency"
              unit={ccy}
              inverse={true}
            />
            
            <MetricCard
              label="Loan-to-Value (LTV)"
              metricKey="ltv"
              baseValue={baseMetrics.loanToValue}
              stressedValue={stressedMetrics.loanToValue}
              format="percent"
              covenant={0.75}
              inverse={true}
            />
            
            <MetricCard
              label="Asset Coverage"
              metricKey="assetCoverage"
              baseValue={baseMetrics.assetCoverage}
              stressedValue={stressedMetrics.assetCoverage}
              unit="x"
              covenant={1.5}
            />
            
            <MetricCard
              label="Covenant Breaches"
              metricKey="breaches"
              baseValue={baseBreaches}
              stressedValue={stressedBreaches}
              covenant={0}
              inverse={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-generated Interpretation */}
      <StressInterpretation 
        baseMetrics={baseMetrics}
        stressedMetrics={stressedMetrics}
        params={params}
        stressedBreaches={stressedBreaches}
      />

      {/* Breach Warnings */}
      {stressedBreaches > 0 && (
        <Card className="border-l-4 border-l-red-600 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              
<AlertTriangle className="w-5 h-5" />
              Covenant Breach Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stressedProjection.breaches.dscrBreaches > 0 && (
                <div className="flex items-start gap-2 p-3 bg-white rounded border border-red-200">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-red-800">DSCR Covenant Breach</div>
                    <div className="text-sm text-red-700">
                      {stressedProjection.breaches.dscrBreaches} year(s) with DSCR below {numFmt(params.minDSCR)}x minimum
                    </div>
                  </div>
                </div>
              )}
              
              {stressedProjection.breaches.icrBreaches > 0 && (
                <div className="flex items-start gap-2 p-3 bg-white rounded border border-red-200">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-red-800">ICR Covenant Breach</div>
                    <div className="text-sm text-red-700">
                      {stressedProjection.breaches.icrBreaches} year(s) with ICR below {numFmt(params.targetICR)}x minimum
                    </div>
                  </div>
                </div>
              )}
              
              {stressedProjection.breaches.ndBreaches > 0 && (
                <div className="flex items-start gap-2 p-3 bg-white rounded border border-red-200">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-red-800">Leverage Covenant Breach</div>
                    <div className="text-sm text-red-700">
                      {stressedProjection.breaches.ndBreaches} year(s) with Net Debt/EBITDA above {numFmt(params.maxNDToEBITDA)}x maximum
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Valuation Impact */}
      <Card>
        <CardHeader>
          <CardTitle>Valuation Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Enterprise Value</div>
              <div className="text-sm text-slate-500">{currencyFmtMM(baseProjection.enterpriseValue, ccy)}</div>
              <div className="text-lg font-bold text-slate-800">{currencyFmtMM(stressedProjection.enterpriseValue, ccy)}</div>
              <div className={`text-xs mt-1 ${stressedProjection.enterpriseValue < baseProjection.enterpriseValue ? 'text-red-600' : 'text-green-600'}`}>
                {((stressedProjection.enterpriseValue / baseProjection.enterpriseValue - 1) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Equity Value</div>
              <div className="text-sm text-slate-500">{currencyFmtMM(baseProjection.equityValue, ccy)}</div>
              <div className="text-lg font-bold text-slate-800">{currencyFmtMM(stressedProjection.equityValue, ccy)}</div>
              <div className={`text-xs mt-1 ${stressedProjection.equityValue < baseProjection.equityValue ? 'text-red-600' : 'text-green-600'}`}>
                {((stressedProjection.equityValue / baseProjection.equityValue - 1) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Equity MOIC</div>
              <div className="text-sm text-slate-500">{numFmt(baseProjection.moic)}x</div>
              <div className="text-lg font-bold text-slate-800">{numFmt(stressedProjection.moic)}x</div>
              <div className={`text-xs mt-1 ${stressedProjection.moic < baseProjection.moic ? 'text-red-600' : 'text-green-600'}`}>
                {((stressedProjection.moic / baseProjection.moic - 1) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-600 mb-1">Equity IRR</div>
              <div className="text-sm text-slate-500">{pctFmt(baseProjection.irr)}</div>
              <div className="text-lg font-bold text-slate-800">{pctFmt(stressedProjection.irr)}</div>
              <div className={`text-xs mt-1 ${stressedProjection.irr < baseProjection.irr ? 'text-red-600' : 'text-green-600'}`}>
                {((stressedProjection.irr - baseProjection.irr) * 100).toFixed(1)}bps
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}