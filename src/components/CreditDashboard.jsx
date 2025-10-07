// src/components/CreditDashboard.jsx
import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Landmark,
  BarChart3,
  Building,
  DollarSign,
  User,
  ClipboardList,
  TrendingUp,
  Shield,
  Info,
  Download,
} from "lucide-react";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

// Color palette for consistency
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#2563eb' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10b981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#f59e0b' },
  danger: { from: 'red-500', to: 'red-600', chart: '#ef4444' },
  info: { from: 'indigo-500', to: 'indigo-600', chart: '#6366f1' },
  purple: { from: 'purple-500', to: 'purple-600', chart: '#a855f7' },
};

/* ---------- small helpers ---------- */
const safe = (v, d = 0) => (Number.isFinite(v) ? v : d);

/* ---------- dynamic rationale ---------- */
function buildRationale(params, proj) {
  const rows = proj?.rows || [];
  
  // FIXED: Changed baseProj to proj
  const minDSCR = rows.length ? Math.min(...rows.map(r => safe(r.dscr))) : 0;
  const minICR = rows.length ? Math.min(...rows.map(r => safe(r.icr))) : 0;
  const maxLeverage = rows.length ? Math.max(...rows.map(r => safe(r.ndToEbitda))) : 0;

  const first = rows[0] || {};
  const last = rows[rows.length - 1] || {};
  const ebitdaCAGR =
    rows.length > 1 && first.ebitda > 0
      ? Math.pow(safe(last.ebitda) / safe(first.ebitda), 1 / (rows.length - 1)) - 1
      : 0;

  const collateralCoverage =
    params.collateralValue > 0
      ? safe(last.endingDebt || first.endingDebt) / params.collateralValue
      : 0;

  const bullets = [
    { text: "Manageable risk with current balloon structure", pass: params.balloonPercentage <= 50 },
    { text: "Debt service coverage above benchmark", pass: minDSCR >= safe(params.minDSCR, 1.2) },
    { text: "Leverage below internal maximum", pass: maxLeverage <= safe(params.maxNDToEBITDA, 3.5) }, // FIXED: maxLev to maxLeverage
    { text: "Strong collateral coverage (≥ 2.0x)", pass: collateralCoverage <= 0.5 },
    { text: "Interest coverage above target", pass: minICR >= safe(params.targetICR, 2.0) },
    { text: "Positive EBITDA trajectory", pass: ebitdaCAGR > 0 },
    { text: "Clean credit history", pass: (params.creditHistory || "").toLowerCase() === "clean" },
    { text: "Experienced management", pass: (params.managementExperience || "").toLowerCase() === "strong" },
  ];

  return { bullets, summary: { minDSCR, minICR, maxLeverage, ebitdaCAGR } }; // FIXED: maxLev to maxLeverage
}
/* ---------- dynamic covenants ---------- */
function buildCovenants(params, proj) {
  const rows = proj?.rows || [];
  const minDSCR = rows.length ? Math.min(...rows.map(r => safe(r.dscr))) : 0;
  const maxLev = rows.length ? Math.max(...rows.map(r => safe(r.ndToEbitda))) : 0;

  const covs = [];
  if (params.balloonPercentage > 0) {
    covs.push(`Refinancing plan required 18 months before maturity (Balloon: ${numFmt(params.balloonPercentage)}%).`);
  }
  covs.push(
    minDSCR < safe(params.minDSCR, 1.2)
      ? "Debt Service Reserve Account (DSRA): 6 months of scheduled debt service."
      : "Debt Service Reserve Account (DSRA): 3 months of scheduled debt service."
  );
  covs.push(`Net Debt/EBITDA ≤ ${numFmt(safe(params.maxNDToEBITDA, 3.5))}x (tested quarterly).`);
  covs.push(`Interest Coverage Ratio ≥ ${numFmt(safe(params.targetICR, 2.0))}x (tested quarterly).`);
  covs.push(maxLev > safe(params.maxNDToEBITDA, 3.5) - 0.3
    ? "Capital Expenditure limit subject to lender consent."
    : "Capital Expenditure Limit customary for sector.");
  if (minDSCR < safe(params.minDSCR, 1.2) + 0.2) {
    covs.push("Dividend/Distribution lock-up if DSCR < covenant for two consecutive quarters.");
  }

  return covs;
}

/* ---------- chart data ---------- */
function buildChartData(proj) {
  const rows = proj?.rows || [];
  return rows.map(r => ({
    year: r.year,
    DSCR: safe(r.dscr),
    ICR: safe(r.icr),
    NDE: safe(r.ndToEbitda),
    EBITDA: safe(r.ebitda),
    FCF: safe(r.fcfToEquity),
  }));
}

/* ---------- score ---------- */
function computeScore(params, proj) {
  const rows = proj?.rows || [];
  if (!rows.length) return { score: 0, band: "N/A", details: [] };
  
  const minDSCR = Math.min(...rows.map(r => safe(r.dscr)));
  const minICR = Math.min(...rows.map(r => safe(r.icr)));
  const maxLev = Math.max(...rows.map(r => safe(r.ndToEbitda)));
  
  let score = 50;
  const details = [];
  
  const dscrPoints = Math.min(25, (minDSCR - safe(params.minDSCR, 1.2)) * 20);
  score += dscrPoints;
  details.push({ category: "DSCR Coverage", points: dscrPoints, max: 25 });
  
  const icrPoints = Math.min(15, (minICR - safe(params.targetICR, 2.0)) * 10);
  score += icrPoints;
  details.push({ category: "Interest Coverage", points: icrPoints, max: 15 });
  
  const levPoints = Math.min(10, (safe(params.maxNDToEBITDA, 3.5) - maxLev) * 5);
  score += levPoints;
  details.push({ category: "Leverage", points: levPoints, max: 10 });
  
  score = Math.max(0, Math.min(100, score));
  
  let band = "BBB";
  if (score >= 90) band = "AA";
  else if (score >= 80) band = "A";
  else if (score >= 70) band = "BBB";
  else if (score >= 60) band = "BB";
  else band = "B";
  
  return { score: Math.round(score), band, details };
}

/* ---------- radar chart data ---------- */
function buildRadarData(params, summary) {
  return [
    {
      metric: "DSCR",
      value: Math.min(100, (summary.minDSCR / safe(params.minDSCR, 1.2)) * 100),
      fullMark: 100,
    },
    {
      metric: "ICR",
      value: Math.min(100, (summary.minICR / safe(params.targetICR, 2.0)) * 100),
      fullMark: 100,
    },
    {
      metric: "Leverage",
      value: Math.min(100, (1 - (summary.maxLeverage / safe(params.maxNDToEBITDA, 3.5))) * 100),
      fullMark: 100,
    },
    {
      metric: "Collateral",
      value: params.collateralValue > 0 ? Math.min(100, (params.collateralValue / (params.openingDebt + params.requestedLoanAmount)) * 50) : 0,
      fullMark: 100,
    },
    {
      metric: "Experience",
      value: (params.managementExperience || "").toLowerCase() === "strong" ? 90 : 
             (params.managementExperience || "").toLowerCase() === "adequate" ? 60 : 30,
      fullMark: 100,
    },
  ];
}

/* ---------- custom tooltip ---------- */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const byName = Object.fromEntries(payload.map(p => [p.name, p]));
  const fmtRatio = v => (Number.isFinite(v) ? `${numFmt(v)}x` : "—");
  const fmtAmt = v => (Number.isFinite(v) ? `${numFmt(v)}` : "—");
  
  return (
    <div className="rounded-lg border bg-white p-3 text-xs shadow-lg">
      <div className="font-semibold mb-2 text-slate-800">{label}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">DSCR:</span>
          <span className="font-semibold text-blue-600">{fmtRatio(byName.DSCR?.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">ICR:</span>
          <span className="font-semibold text-emerald-600">{fmtRatio(byName.ICR?.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Net Debt/EBITDA:</span>
          <span className="font-semibold text-red-600">{fmtRatio(byName["Net Debt/EBITDA"]?.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">EBITDA:</span>
          <span className="font-semibold text-amber-600">{fmtAmt(byName["EBITDA (raw)"]?.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">FCF:</span>
          <span className="font-semibold text-indigo-600">{fmtAmt(byName["FCF (raw)"]?.value)}</span>
        </div>
      </div>
    </div>
  );
}

export function CreditDashboard({ params, projections, ccy = "JMD" }) {
  const baseProj = projections?.base || projections;
  const [expandedSection, setExpandedSection] = useState(null);

  const summary = useMemo(() => {
    if (!baseProj?.rows?.length) {
      return {
        minDSCR: 0,
        minICR: 0,
        maxLeverage: 0,
        totalDebtService: 0,
        annualDebtService: 0,
        lastEndingDebt: 0,
      };
    }
    const minDSCR = Math.min(...baseProj.rows.map(r => safe(r.dscr)));
    const minICR = Math.min(...baseProj.rows.map(r => safe(r.icr)));
    const maxLeverage = Math.max(...baseProj.rows.map(r => safe(r.ndToEbitda)));
    const totalDebtService = baseProj.rows.reduce((s, r) => s + safe(r.debtService), 0);
    const annualDebtService = safe(baseProj.rows[0]?.debtService);
    const lastEndingDebt = safe(baseProj.rows[baseProj.rows.length - 1]?.endingDebt);
    return { minDSCR, minICR, maxLeverage, totalDebtService, annualDebtService, lastEndingDebt };
  }, [baseProj]);

  const rationale = useMemo(() => buildRationale(params, baseProj), [params, baseProj]);
  const covenants = useMemo(() => buildCovenants(params, baseProj), [params, baseProj]);
  const score = useMemo(() => computeScore(params, baseProj), [params, baseProj]);
  const chartData = useMemo(() => buildChartData(baseProj), [baseProj]);
  const radarData = useMemo(() => buildRadarData(params, summary), [params, summary]);

  const existingDebt = safe(params.openingDebt);
  const newFacility = safe(params.requestedLoanAmount);
  const proFormaDebt = existingDebt + newFacility;
  const ltvPct = params.collateralValue > 0 ? (proFormaDebt / params.collateralValue) * 100 : 0;
  const assetCoverage = proFormaDebt > 0 ? params.collateralValue / proFormaDebt : 0;

  // Rating color helper
  const getRatingColor = (band) => {
    switch(band) {
      case "AA": return "from-emerald-500 to-emerald-600";
      case "A": return "from-blue-500 to-blue-600";
      case "BBB": return "from-amber-500 to-amber-600";
      case "BB": return "from-orange-500 to-orange-600";
      case "B": return "from-red-500 to-red-600";
      default: return "from-slate-500 to-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Credit Score Card */}
      <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Credit Assessment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score Display */}
            <div className="col-span-1">
              <div className="text-center">
                <div className={`mx-auto w-32 h-32 rounded-full bg-gradient-to-br ${getRatingColor(score.band)} flex items-center justify-center shadow-lg transform transition-all duration-200 hover:scale-110`}>
                  <div className="text-white">
                    <div className="text-4xl font-bold">{score.score}</div>
                    <div className="text-sm opacity-90">out of 100</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-slate-600 mb-1">Proposed Rating</div>
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold text-white bg-gradient-to-r ${getRatingColor(score.band)} shadow-md`}>
                    {score.band}
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="col-span-2">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 mb-3">Score Breakdown</h4>
                {score.details && score.details.map((detail, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{detail.category}</span>
                      <span className="font-semibold text-slate-800">
                        {detail.points.toFixed(1)} / {detail.max}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${(detail.points / detail.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Min DSCR</div>
            <TrendingUp className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
  {Number.isFinite(summary.minDSCR) && summary.minDSCR < 999
    ? `${numFmt(summary.minDSCR)}x`
    : "—"}
</div>

          <div className="text-xs opacity-80">Covenant: {numFmt(params.minDSCR)}x</div>
          <div className={`text-xs mt-2 font-semibold ${summary.minDSCR >= params.minDSCR ? 'opacity-100' : 'opacity-70'}`}>
            {summary.minDSCR >= params.minDSCR ? '✓ Compliant' : '✗ Below Covenant'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Min ICR</div>
            <Shield className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
  {Number.isFinite(summary.minICR) && summary.minICR < 999
    ? `${numFmt(summary.minICR)}x`
    : "—"}
</div>

          <div className="text-xs opacity-80">Target: {numFmt(params.targetICR)}x</div>
          <div className={`text-xs mt-2 font-semibold ${summary.minICR >= params.targetICR ? 'opacity-100' : 'opacity-70'}`}>
            {summary.minICR >= params.targetICR ? '✓ Above Target' : '✗ Below Target'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Max Leverage</div>
            <BarChart3 className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-3xl font-bold mb-1">
  {Number.isFinite(summary.maxLeverage) && summary.maxLeverage < 999
    ? `${numFmt(summary.maxLeverage)}x`
    : "—"}
</div>

          <div className="text-xs opacity-80">Limit: {numFmt(params.maxNDToEBITDA)}x</div>
          <div className={`text-xs mt-2 font-semibold ${summary.maxLeverage <= params.maxNDToEBITDA ? 'opacity-100' : 'opacity-70'}`}>
            {summary.maxLeverage <= params.maxNDToEBITDA ? '✓ Within Limit' : '✗ Exceeds Limit'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Annual Debt Service</div>
            <DollarSign className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-bold mb-1">{currencyFmtMM(summary.annualDebtService, ccy)}</div>
          <div className="text-xs opacity-80">{params.paymentFrequency} payments</div>
          <div className="text-xs mt-2 opacity-90">
            {params.balloonPercentage > 0 && `${params.balloonPercentage}% balloon`}
          </div>
        </div>
      </div>

      {/* Company Profile */}
      <Card className="border-l-4 border-l-slate-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-600" />
            Company Profile & Industry Context
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Industry</div>
              <div className="text-sm font-semibold">{params.industry || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Credit History</div>
              <div className="text-sm font-semibold">{params.creditHistory || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-amber-500 to-amber-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Business Age</div>
              <div className="text-sm font-semibold">{safe(params.businessAge)} years</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Management</div>
              <div className="text-sm font-semibold">{params.managementExperience || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-purple-500 to-purple-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Total Assets</div>
              <div className="text-sm font-semibold">{currencyFmtMM(params.totalAssets, ccy)}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-sky-500 to-sky-600 shadow-md transform transition-all duration-200 hover:scale-105">
              <div className="text-[11px] opacity-90 mb-1">Collateral</div>
              <div className="text-sm font-semibold">{currencyFmtMM(params.collateralValue, ccy)}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50 hover:border-blue-300 transition-all duration-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Max Leverage</div>
              <div className="text-lg font-bold text-slate-800">{numFmt(params.maxNDToEBITDA)}x</div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50 hover:border-blue-300 transition-all duration-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Min DSCR</div>
              <div className="text-lg font-bold text-slate-800">{numFmt(params.minDSCR)}x</div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50 hover:border-blue-300 transition-all duration-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Asset Coverage</div>
              <div className="text-lg font-bold text-slate-800">{assetCoverage ? numFmt(assetCoverage) + "x" : "—"}</div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50 hover:border-blue-300 transition-all duration-200">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Pro-Forma LTV</div>
              <div className={`text-lg font-bold ${ltvPct <= 50 ? 'text-emerald-600' : ltvPct <= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                {ltvPct ? ltvPct.toFixed(1) + "%" : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Strength Radar Chart */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Credit Strength Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Credit Profile"
                    dataKey="value"
                    stroke={COLORS.primary.chart}
                    fill={COLORS.primary.chart}
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center">
              <div className="space-y-3 w-full">
                <h4 className="font-semibold text-slate-800 mb-4">Metric Performance</h4>
                {radarData.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.metric}</span>
                      <span className="font-semibold text-slate-800">{item.value.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          item.value >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                          item.value >= 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                          'bg-gradient-to-r from-red-500 to-red-600'
                        }`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facility Details & Collateral */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proposed Facility */}
        <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-600" />
              Proposed New Facility
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-600 font-semibold mb-2">Facility Type</div>
                <div className="text-base font-bold text-blue-900">{params.facilityType || "—"}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Amount</div>
                  <div className="text-lg font-bold text-slate-800">{currencyFmtMM(params.requestedLoanAmount, ccy)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Interest Rate</div>
                  <div className="text-lg font-bold text-slate-800">{pctFmt(params.proposedPricing)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Term</div>
                  <div className="text-lg font-bold text-slate-800">{params.proposedTenor} years</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Payment Frequency</div>
                  <div className="text-lg font-bold text-slate-800">{params.paymentFrequency}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Day Count</div>
                  <div className="text-lg font-bold text-slate-800">{params.dayCountConvention}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Balloon Payment</div>
                  <div className={`text-lg font-bold ${params.balloonPercentage > 50 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {numFmt(params.balloonPercentage)}%
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Annual Debt Service</div>
                <div className="text-xl font-bold text-slate-800">{currencyFmtMM(summary.annualDebtService, ccy)}</div>
                <div className="text-xs text-slate-600 mt-1">
                  {params.paymentFrequency} payments{params.balloonPercentage ? ` with ${params.balloonPercentage}% balloon at maturity` : ""}.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collateral & Coverage */}
        <Card className="border-l-4 border-l-amber-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              Collateral & Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Existing Debt</div>
                  <div className="text-base font-bold text-slate-800">{currencyFmtMM(existingDebt, ccy)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">New Facility</div>
                  <div className="text-base font-bold text-slate-800">{currencyFmtMM(newFacility, ccy)}</div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-xs text-amber-600 font-semibold mb-1">Total Pro-Forma Debt</div>
                <div className="text-2xl font-bold text-amber-900">{currencyFmtMM(proFormaDebt, ccy)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">LTV</div>
                  <div className={`text-lg font-bold ${ltvPct <= 50 ? 'text-emerald-600' : ltvPct <= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                    {ltvPct ? ltvPct.toFixed(1) + "%" : "—"}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Asset Coverage</div>
                  <div className={`text-lg font-bold ${assetCoverage >= 2 ? 'text-emerald-600' : assetCoverage >= 1.5 ? 'text-amber-600' : 'text-red-600'}`}>
                    {assetCoverage ? numFmt(assetCoverage) + "x" : "—"}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Pro-Forma DSCR</div>
                  <div className="text-lg font-bold text-slate-800">{numFmt(summary.minDSCR)}x</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Pro-Forma Leverage</div>
                  <div className="text-lg font-bold text-slate-800">{numFmt(summary.maxLeverage)}x</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Qualitative Snapshot Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              Deal Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div><span className="font-semibold text-indigo-900">Purpose:</span> <span className="text-slate-700">{params.loanPurpose || "—"}</span></div>
            <div><span className="font-semibold text-indigo-900">Use of Proceeds:</span> <span className="text-slate-700">{params.useOfProceeds || "—"}</span></div>
            <div><span className="font-semibold text-indigo-900">Structure:</span> <span className="text-slate-700">{params.dealStructure || "—"}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Management & Relationship
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div><span className="font-semibold text-emerald-900">Key Management:</span> <span className="text-slate-700">{params.keyManagementNames || "—"}</span></div>
            <div><span className="font-semibold text-emerald-900">Track Record:</span> <span className="text-slate-700">{params.managementTrackRecord || "—"}</span></div>
            <div><span className="font-semibold text-emerald-900">RM:</span> <span className="text-slate-700">{params.relationshipManager || "—"}</span> • <span className="font-semibold text-emerald-900">Years:</span> <span className="text-slate-700">{safe(params.existingRelationshipYears)}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-600" />
              Collateral Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div><span className="font-semibold text-amber-900">Description:</span> <span className="text-slate-700">{params.collateralDescription || "—"}</span></div>
            <div><span className="font-semibold text-amber-900">Lien:</span> <span className="text-slate-700">{params.lienPosition || "—"}</span></div>
            <div><span className="font-semibold text-amber-900">Appraisal:</span> <span className="text-slate-700">{currencyFmtMM(params.appraisalValue, ccy)} on {params.appraisalDate || "—"}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Conditions & Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div><span className="font-semibold text-rose-900">Conditions Precedent:</span> <span className="text-slate-700">{params.conditionsPrecedent || "—"}</span></div>
            <div><span className="font-semibold text-rose-900">Reporting:</span> <span className="text-slate-700">{params.reportingRequirements || "—"}</span></div>
            <div><span className="font-semibold text-rose-900">Site Visits:</span> <span className="text-slate-700">{params.siteVisitFrequency || "—"}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Rationale & Covenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Underwriting Rationale
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3 max-h-80 overflow-auto pr-2">
              {rationale.bullets.map((b, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 ${
                    b.pass 
                      ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {b.pass ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${b.pass ? 'text-emerald-900' : 'text-rose-900'} font-medium`}>
                    {b.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                <strong>Passed:</strong> {rationale.bullets.filter(b => b.pass).length} / {rationale.bullets.length} criteria
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Recommended Covenants & Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {covenants.map((c, i) => (
                <li key={i} className="flex items-start gap-3 text-sm p-3 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-all duration-200">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="text-indigo-900">{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Credit Metrics Chart */}
      <Card className="border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Credit Metrics Over Time
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {chartData.length ? (
            <div className="w-full h-96">
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ebitdaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.warning.chart} stopOpacity={0.55} />
                      <stop offset="95%" stopColor={COLORS.warning.chart} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fcfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.info.chart} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={COLORS.info.chart} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  {/* Ratios (lines) */}
                  <Line yAxisId="left" type="monotone" dataKey="DSCR" stroke={COLORS.primary.chart} strokeWidth={3} dot={{ r: 4 }} />
                  <Line yAxisId="left" type="monotone" dataKey="ICR" stroke={COLORS.success.chart} strokeWidth={3} dot={{ r: 4 }} />
                  <Line yAxisId="left" type="monotone" dataKey="NDE" name="Net Debt/EBITDA" stroke={COLORS.danger.chart} strokeWidth={3} dot={{ r: 4 }} />
                  {/* Amounts */}
                  <Bar yAxisId="right" dataKey="EBITDA" fill="url(#ebitdaFill)" name="EBITDA (raw)" radius={[8, 8, 0, 0]} />
                  <Area yAxisId="right" type="monotone" dataKey="FCF" fill="url(#fcfFill)" stroke={COLORS.info.chart} name="FCF (raw)" />
                  <ReferenceLine yAxisId="left" y={safe(params.minDSCR, 1.2)} stroke={COLORS.danger.chart} strokeDasharray="4 4" label={{ value: "Min DSCR", position: "right", fontSize: 11 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-600">
                    <strong>Note:</strong> Ratios (DSCR / ICR / Net Debt/EBITDA) use the left axis; EBITDA & FCF use the right axis (raw units from projections).
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="text-slate-400 mb-2">
                <BarChart3 className="w-12 h-12 mx-auto" />
              </div>
              <div className="text-slate-500 text-sm font-medium">No data available</div>
              <div className="text-slate-400 text-xs mt-1">Enter financial inputs and build projections to see metrics.</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}