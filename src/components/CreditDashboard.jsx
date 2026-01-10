// src/components/CreditDashboard.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { CapitalStructurePanel } from './CapitalStructurePanel';
import { generateAICapitalStructureRecommendations } from '../utils/aiCapitalStructureAdvisor';

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
  Sparkles,
  Download,
  Layers,
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
  AreaChart,
} from "recharts";

import { EnhancedCreditCard } from "./EnhancedCreditCard";
import { SmartSuggestion, OpeningDebtWarning } from "./SmartSuggestions";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const COLORS = {
  primary: { chart: "#2563eb" },
  success: { chart: "#10b981" },
  warning: { chart: "#f59e0b" },
  danger: { chart: "#ef4444" },
  info: { chart: "#6366f1" },
};

const safe = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clampPct = (v) => Math.max(0, Math.min(100, v));
const asM = (v) => (Number.isFinite(v) ? (v / 1_000_000) : 0);

function calculateTrend(arr = []) {
  if (!arr.length) return "stable";
  const first = arr[0];
  const last = arr[arr.length - 1];
  const delta = last - first;
  if (delta > 0.05) return "improving";
  if (delta < -0.05) return "declining";
  return "stable";
}

function buildRationale(params, proj, hasExistingDebt) {
  const rows = proj?.rows || [];
  
  // If no debt, return minimal rationale
  if (!hasExistingDebt) {
    return {
      bullets: [
        {
          text: "No existing debt - creditworthiness assessment pending facility disbursement",
          pass: true,
          show: true,
        }
      ],
      summary: { minDSCR: 0, minICR: 0, maxLeverage: 0, ebitdaCAGR: 0 }
    };
  }

  const minDSCR = rows.length ? Math.min(...rows.map((r) => safe(r.dscr))) : 0;
  const minICR = rows.length ? Math.min(...rows.map((r) => safe(r.icr))) : 0;
  const maxLeverage = rows.length ? Math.max(...rows.map((r) => safe(r.ndToEbitda))) : 0;

  const first = rows[0] || {};
  const last = rows[rows.length - 1] || {};
  const ebitdaCAGR =
    rows.length > 1 && first.ebitda > 0
      ? Math.pow(safe(last.ebitda) / safe(first.ebitda), 1 / (rows.length - 1)) - 1
      : 0;

  const lastEndingDebt = last.debtBalance ?? last.endingDebt ?? 0;
  const collateralCoverage =
    params.collateralValue > 0 ? lastEndingDebt / params.collateralValue : 0;

  const bullets = [
    {
      text: "Manageable risk with current balloon structure",
      pass: !params.useBalloonPayment || safe(params.balloonPercentage) <= 30,
      show: !!params.useBalloonPayment,
    },
    {
      text: "Debt service coverage above benchmark",
      pass: minDSCR >= safe(params.minDSCR, 1.2),
      show: true,
    },
    {
      text: "Leverage below internal maximum",
      pass: maxLeverage <= safe(params.maxNDToEBITDA, 3.5),
      show: true,
    },
    {
      text: "Strong collateral coverage (≥ 2.0x)",
      pass: params.collateralValue > 0 ? collateralCoverage <= 0.5 : false,
      show: params.collateralValue > 0,
    },
    {
      text: "Interest coverage above target",
      pass: minICR >= safe(params.targetICR, 2.0),
      show: true,
    },
    {
      text: "Positive EBITDA trajectory",
      pass: ebitdaCAGR > 0,
      show: rows.length > 1 && first.ebitda > 0,
    },
    {
      text: "Clean credit history",
      pass: (params.creditHistory || "").toLowerCase() === "clean",
      show: !!params.creditHistory,
    },
    {
      text: "Experienced management",
      pass: (params.managementExperience || "").toLowerCase() === "strong",
      show: !!params.managementExperience,
    },
  ].filter((b) => b.show);

  return { bullets, summary: { minDSCR, minICR, maxLeverage, ebitdaCAGR } };
}

function buildCovenants(params, proj, hasExistingDebt) {
  if (!hasExistingDebt) {
    return ["Covenant package will be established upon facility disbursement."];
  }

  const rows = proj?.rows || [];
  const minDSCR = rows.length ? Math.min(...rows.map((r) => safe(r.dscr))) : 0;
  const maxLev = rows.length ? Math.max(...rows.map((r) => safe(r.ndToEbitda))) : 0;
  const covs = [];

  if (params.useBalloonPayment && safe(params.balloonPercentage) > 0) {
    covs.push(
      `Refinancing plan required 18 months before maturity (Balloon: ${numFmt(
        params.balloonPercentage
      )}%).`
    );
  }

  covs.push(
    minDSCR < 1.0
      ? "Debt Service Reserve Account (DSRA): 12 months (High Risk - DSCR < 1.0x)."
      : minDSCR < safe(params.minDSCR, 1.2)
      ? "Debt Service Reserve Account (DSRA): 6 months (Covenant Breach)."
      : minDSCR < safe(params.minDSCR, 1.2) + 0.3
      ? "Debt Service Reserve Account (DSRA): 3 months (Marginal Coverage)."
      : "Debt Service Reserve Account (DSRA): 3 months (Adequate Coverage)."
  );

  covs.push(
    `Net Debt/EBITDA ≤ ${numFmt(safe(params.maxNDToEBITDA, 3.5))}x (tested quarterly).`
  );
  covs.push(
    `Interest Coverage Ratio ≥ ${numFmt(safe(params.targetICR, 2.0))}x (tested quarterly).`
  );

  if (maxLev > safe(params.maxNDToEBITDA, 3.5) - 0.3) {
    covs.push("Capital Expenditure limit subject to lender consent.");
  } else {
    covs.push("Capital Expenditure limit customary for sector.");
  }

  if (minDSCR < safe(params.minDSCR, 1.2) + 0.2) {
    covs.push("Dividend/distribution lock-up if DSCR < covenant for two consecutive quarters.");
  }

  return covs;
}

function buildChartData(proj) {
  const rows = proj?.rows || [];
  return rows.map((r) => ({
    year: r.year,
    DSCR: safe(r.dscr),
    ICR: safe(r.icr),
    NDE: safe(r.ndToEbitda),
    EBITDA: safe(r.ebitda),
    FCF: safe(r.fcfToEquity),
  }));
}

function buildRadarData(params, summary, hasExistingDebt) {
  if (!hasExistingDebt) {
    return [
      { metric: "DSCR", value: 0, fullMark: 100 },
      { metric: "ICR", value: 0, fullMark: 100 },
      { metric: "Leverage", value: 0, fullMark: 100 },
      { metric: "Collateral", value: 0, fullMark: 100 },
      { metric: "Experience", value: 0, fullMark: 100 },
    ];
  }

  const leverageScore = clampPct(
    (1 - safe(summary.maxLeverage, 0) / safe(params.maxNDToEBITDA, 3.5)) * 100
  );

  const denom = safe(params.openingDebt, 0) + safe(params.requestedLoanAmount, 0);
  const coverage = denom > 0 ? safe(params.collateralValue, 0) / denom : 0;
  const collateralScore = clampPct((coverage / 2.0) * 100);

  const exp = (params.managementExperience || "").toLowerCase().trim();
  const expScore =
    exp === "strong" ? 90 : exp === "adequate" ? 60 : exp === "limited" ? 30 : exp === "new team" || exp.includes("new") ? 10 : 0;

  return [
    {
      metric: "DSCR",
      value: clampPct((safe(summary.minDSCR, 0) / safe(params.minDSCR, 1.2)) * 100),
      fullMark: 100,
    },
    {
      metric: "ICR",
      value: clampPct((safe(summary.minICR, 0) / safe(params.targetICR, 2.0)) * 100),
      fullMark: 100,
    },
    {
      metric: "Leverage",
      value: leverageScore,
      fullMark: 100,
    },
    {
      metric: "Collateral",
      value: collateralScore,
      fullMark: 100,
    },
    {
      metric: "Experience",
      value: expScore,
      fullMark: 100,
    },
  ];
}

function ChartTooltip({ active, payload, label, ccy }) {
  if (!active || !payload?.length) return null;
  const byName = Object.fromEntries(payload.map((p) => [p.name || p.dataKey, p]));
  const fmtRatio = (v) => (Number.isFinite(v) ? `${numFmt(v)}x` : "—");
  const fmtAmtM = (v) => (Number.isFinite(v) ? `${ccy} ${numFmt(asM(v))}M` : "—");

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
          <span className="font-semibold text-red-600">
            {fmtRatio(byName["Net Debt/EBITDA"]?.value ?? byName.NDE?.value)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">EBITDA:</span>
          <span className="font-semibold text-amber-600">
            {fmtAmtM(byName["EBITDA (raw)"]?.value ?? byName.EBITDA?.value)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">FCF:</span>
          <span className="font-semibold text-indigo-600">
            {fmtAmtM(byName["FCF (raw)"]?.value ?? byName.FCF?.value)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CreditDashboard({ params, projections, ccy = "JMD" }) {
  const containerRef = useRef(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [showMetricDetails, setShowMetricDetails] = useState(false);
  
  // AI State Management
  const [capitalStructureRecs, setCapitalStructureRecs] = useState(null);
  const [isLoadingCapStructure, setIsLoadingCapStructure] = useState(false);

  const baseProj = projections?.base || projections;
  
  if (!baseProj || !baseProj.rows || baseProj.rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-lg shadow-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600 font-semibold">Building credit analysis...</p>
        <p className="text-slate-500 text-sm mt-2">
          Please ensure financial parameters are entered and projections are generated.
        </p>
      </div>
    );
  }

  // Check for existing debt - must check ALL possible debt sources:
  // 1. Single opening debt (openingDebt > 0)
  // 2. Multi-tranche mode with tranches configured
  // 3. Projection data that includes multi-tranche info
  // Note: When hasMultipleTranches is true, openingDebt is set to 0 by the sync logic,
  // so we must also check the tranches array and projection data directly.
  const hasExistingDebt =
    safe(params.openingDebt, 0) > 0 ||
    (params.hasMultipleTranches && params.debtTranches?.some(t => t.amount > 0)) ||
    (baseProj?.hasMultipleTranches && safe(baseProj?.multiTrancheInfo?.totalDebt, 0) > 0);
  const hasNewFacility = safe(params.requestedLoanAmount, 0) > 0;

  const summary = useMemo(() => {
    const rows = baseProj.rows || [];
    if (!rows.length || !hasExistingDebt) {
      return {
        minDSCR: 0,
        minICR: 0,
        maxLeverage: 0,
        avgDSCR: 0,
        avgICR: 0,
        totalDebtService: 0,
        annualDebtService: 0,
        lastEndingDebt: 0,
      };
    }
    
    const minDSCR = Math.min(...rows.map((r) => safe(r.dscr)));
    const minICR = Math.min(...rows.map((r) => safe(r.icr)));
    const maxLeverage = Math.max(...rows.map((r) => safe(r.ndToEbitda)));
    const avgDSCR = rows.reduce((s, r) => s + safe(r.dscr), 0) / (rows.length || 1);
    const avgICR = rows.reduce((s, r) => s + safe(r.icr), 0) / (rows.length || 1);

    const totalDebtService = rows.reduce(
      (s, r) => s + safe(r.principalPayment, 0) + safe(r.interestExpense, 0),
      0
    );
    const annualDebtService =
      safe(rows[0]?.principalPayment, 0) + safe(rows[0]?.interestExpense, 0);

    const lastRow = rows[rows.length - 1] || {};
    const lastEndingDebt = safe(lastRow.debtBalance ?? lastRow.endingDebt, 0);

    return {
      minDSCR,
      minICR,
      maxLeverage,
      avgDSCR,
      avgICR,
      totalDebtService,
      annualDebtService,
      lastEndingDebt,
    };
  }, [baseProj, hasExistingDebt]);

  const rationale = useMemo(() => buildRationale(params, baseProj, hasExistingDebt), [params, baseProj, hasExistingDebt]);
  const covenants = useMemo(() => buildCovenants(params, baseProj, hasExistingDebt), [params, baseProj, hasExistingDebt]);
  const chartData = useMemo(() => buildChartData(baseProj), [baseProj]);
  const radarData = useMemo(() => buildRadarData(params, summary, hasExistingDebt), [params, summary, hasExistingDebt]);

  const existingDebt = safe(params.openingDebt);
  const newFacility = safe(params.requestedLoanAmount);
  const proFormaDebt = existingDebt + newFacility;

  const ltvPct =
    params.collateralValue > 0 && proFormaDebt > 0
      ? (proFormaDebt / params.collateralValue) * 100
      : null;
  const assetCoverage =
    proFormaDebt > 0 && params.collateralValue > 0
      ? params.collateralValue / proFormaDebt
      : null;

  const dscrTrend = calculateTrend((baseProj.rows || []).map((r) => safe(r.dscr)));
  const icrTrend = calculateTrend((baseProj.rows || []).map((r) => safe(r.icr)));
  const levTrend = calculateTrend((baseProj.rows || []).map((r) => safe(r.ndToEbitda)));

  const scenarioLabel = projections?.base ? "Base Case" : "Current";

  // AI Capital Structure Generation
  useEffect(() => {
    if (!baseProj?.rows?.length || !params || !hasExistingDebt) {
      setCapitalStructureRecs(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoadingCapStructure(true);
      generateAICapitalStructureRecommendations(baseProj, params, ccy)
        .then(recs => {
          setCapitalStructureRecs(recs);
          setIsLoadingCapStructure(false);
        })
        .catch(err => {
          console.error('Capital structure analysis failed:', err);
          setIsLoadingCapStructure(false);
        });
    }, 2000);

    return () => clearTimeout(timer);
  }, [baseProj, params, ccy, hasExistingDebt]);

  useEffect(() => {
    const saved = localStorage.getItem("creditDashboard_expandedSection");
    if (saved) setExpandedSection(saved);
  }, []);
  
  useEffect(() => {
    if (expandedSection) {
      localStorage.setItem("creditDashboard_expandedSection", expandedSection);
    }
  }, [expandedSection]);

  const fmtM = (val) => `${ccy} ${asM(val).toFixed(1)}M`;

  const handlePrint = () => window.print();
  const handleExportPDF = async () => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = -heightLeft;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("credit-dashboard.pdf");
  };

  const getRatingColor = (band) => {
    switch (band) {
      case "AA": return "from-emerald-500 to-emerald-600";
      case "A": return "from-blue-500 to-blue-600";
      case "BBB": return "from-amber-500 to-amber-600";
      case "BB": return "from-orange-500 to-orange-600";
      case "B": return "from-red-500 to-red-600";
      default: return "from-slate-500 to-slate-600";
    }
  };

  // Build debt schedule visualization data
  const debtScheduleData = useMemo(() => {
    if (!baseProj?.debtSchedule || !hasExistingDebt) return [];
    
    return baseProj.debtSchedule.map((yearData, idx) => ({
      year: params.startYear + idx,
      principal: safe(yearData.principal),
      interest: safe(yearData.interest),
      endingBalance: safe(yearData.endingBalance),
    }));
  }, [baseProj, params, hasExistingDebt]);

  // Multi-tranche detection
  const hasMultipleTranches = baseProj?.hasMultipleTranches || false;
  const multiTrancheInfo = baseProj?.multiTrancheInfo;

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-800">Credit Dashboard</h2>
          <div className="px-3 py-1 bg-blue-100 border border-blue-300 rounded-full">
            <span className="text-xs font-semibold text-blue-900">Scenario: {scenarioLabel}</span>
          </div>
          {hasMultipleTranches && (
            <div className="px-3 py-1 bg-purple-100 border border-purple-300 rounded-full flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-600" />
              <span className="text-xs font-semibold text-purple-900">Multi-Tranche</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleExportPDF} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button size="sm" onClick={handlePrint} variant="outline">
            🖨️ Print
          </Button>
        </div>
      </div>

      {/* Zero Balance Warning */}
      {!hasExistingDebt && (
        <Card className="border-l-4 border-l-amber-600 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-1">No Existing Debt Configured</h3>
                <p className="text-sm text-amber-800 mb-3">
                  Credit ratios (DSCR, ICR, Leverage) require existing debt to calculate. 
                  Configure Opening Debt in the parameters section to enable full credit analysis.
                </p>
                <div className="text-xs text-amber-700">
                  <strong>What you can still see:</strong> Company profile, collateral coverage, 
                  new facility details, and forward-looking projections.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Dashboard Info */}
      <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-l-indigo-600 shadow-sm">
        <CardContent className="p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === 'dashboardInfo' ? null : 'dashboardInfo')}
            className="w-full flex items-start gap-3 text-left hover:opacity-80 transition-opacity"
          >
            <div className="flex-shrink-0 mt-1">
              <Info className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-900">
                  What This Dashboard Shows
                </h3>
                <span className="text-indigo-600 text-xs font-semibold">
                  {expandedSection === 'dashboardInfo' ? '▲ Hide' : '▼ Learn More'}
                </span>
              </div>
              {expandedSection !== 'dashboardInfo' && (
                <p className="text-xs text-slate-600 mt-1">
                  Click to understand credit metrics, scoring methodology, and how to interpret results.
                </p>
              )}
            </div>
          </button>

          {expandedSection === 'dashboardInfo' && (
            <div className="mt-4 pl-8 space-y-4 text-xs text-slate-700 border-l-2 border-indigo-300">
              <div>
                <h4 className="font-bold text-indigo-900 mb-1.5">Purpose</h4>
                <p>
                  Comprehensive credit risk assessment for the proposed lending facility. 
                  {hasExistingDebt ? (
                    <>All metrics are based on your <strong className="text-indigo-700">Opening Debt</strong> of {fmtM(params.openingDebt)} 
                    and projected financial performance over {params.years} years.</>
                  ) : (
                    <strong className="text-amber-700"> Configure Opening Debt to enable full covenant analysis.</strong>
                  )}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-indigo-900 mb-1.5">Key Metrics Explained</h4>
                <div className="space-y-2 bg-white p-3 rounded border border-indigo-100">
                  <div>
                    <strong className="text-blue-700">DSCR (Debt Service Coverage Ratio):</strong> 
                    <span className="ml-1">Measures cash flow available to pay debt. Target: ≥ {params.minDSCR.toFixed(2)}x. 
                    Higher is better (1.5x+ is strong).</span>
                  </div>
                  <div>
                    <strong className="text-emerald-700">ICR (Interest Coverage Ratio):</strong> 
                    <span className="ml-1">EBIT divided by interest expense. Target: ≥ {params.targetICR.toFixed(2)}x. 
                    Shows ability to service interest payments.</span>
                  </div>
                  <div>
                    <strong className="text-red-700">Leverage (Net Debt/EBITDA):</strong> 
                    <span className="ml-1">Total debt burden relative to earnings. Limit: ≤ {params.maxNDToEBITDA.toFixed(2)}x. 
                    Lower is better.</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-indigo-900 mb-1.5">How to Interpret Results</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
                      <strong className="text-emerald-900">Compliant</strong>
                    </div>
                    <p className="text-emerald-800">Meets all covenant thresholds. Low credit risk.</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-2 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                      <strong className="text-amber-900">At Risk</strong>
                    </div>
                    <p className="text-amber-800">Close to covenant limits. Monitor closely.</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-2 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <strong className="text-red-900">Breach</strong>
                    </div>
                    <p className="text-red-800">Covenant violation. Restructuring may be needed.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Assessment Summary */}
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
                <div
                  className={`mx-auto w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-500 ${
                    hasExistingDebt
                      ? getRatingColor(
                          summary.minDSCR >= 2 && summary.minICR >= 3 && summary.maxLeverage <= 2
                            ? "AA"
                            : summary.minDSCR >= 1.8 && summary.minICR >= 2.5 && summary.maxLeverage <= 2.5
                            ? "A"
                            : summary.minDSCR >= 1.5 && summary.minICR >= 2 && summary.maxLeverage <= 3.5
                            ? "BBB"
                            : summary.minDSCR >= 1.3 && summary.minICR >= 1.8 && summary.maxLeverage <= 4.0
                            ? "BB"
                            : "B"
                        )
                      : "bg-slate-300 text-slate-700"
                  }`}
                >
                  <div className="text-4xl font-bold">
                    {hasExistingDebt
                      ? Math.round(
                          clampPct(
                            (summary.minDSCR / safe(params.minDSCR, 1.2)) * 40 +
                              (summary.minICR / safe(params.targetICR, 2.0)) * 30 +
                              clampPct(
                                (1 - summary.maxLeverage / safe(params.maxNDToEBITDA, 3.5)) * 100
                              ) * 0.2
                          )
                        )
                      : "N/A"}
                  </div>
                  <div className="text-sm opacity-90">
                    {hasExistingDebt ? "score" : "no data"}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-slate-600 mb-1">At-a-glance</div>
                  {hasExistingDebt ? (
                    <div className="inline-flex items-center px-4 py-2 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md">
                      Min DSCR {summary.minDSCR.toFixed(2)}x • Min ICR{" "}
                      {summary.minICR.toFixed(2)}x • Max Lev {summary.maxLeverage.toFixed(2)}x
                    </div>
                  ) : (
                    <div className="px-4 py-2 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300">
                      No existing debt
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="col-span-2">
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-800 mb-3">Coverage & Leverage</h4>
                {/* DSCR */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">DSCR (min / avg / trend)</span>
                    <span className="font-semibold text-slate-800">
                      {!hasExistingDebt
                        ? <span className="italic text-slate-500">No existing debt</span>
                        : `${summary.minDSCR.toFixed(2)}x / ${summary.avgDSCR.toFixed(2)}x / ${dscrTrend}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        hasExistingDebt
                          ? "bg-gradient-to-r from-blue-500 to-blue-600"
                          : "bg-slate-300"
                      }`}
                      style={{
                        width: `${hasExistingDebt ? clampPct((summary.minDSCR / safe(params.minDSCR, 1.2)) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                {/* ICR */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">ICR (min / avg / trend)</span>
                    <span className="font-semibold text-slate-800">
                      {!hasExistingDebt
                        ? <span className="italic text-slate-500">No existing debt</span>
                        : `${summary.minICR.toFixed(2)}x / ${summary.avgICR.toFixed(2)}x / ${icrTrend}`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        hasExistingDebt
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                          : "bg-slate-300"
                      }`}
                      style={{
                        width: `${hasExistingDebt ? clampPct((summary.minICR / safe(params.targetICR, 2)) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Leverage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Leverage (max / trend)</span>
                    <span className="font-semibold text-slate-800">
                      {hasExistingDebt 
                        ? `${summary.maxLeverage.toFixed(2)}x / ${levTrend}`
                        : <span className="italic text-slate-500">No existing debt</span>}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        hasExistingDebt
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : "bg-slate-300"
                      }`}
                      style={{
                        width: `${hasExistingDebt ? clampPct((summary.maxLeverage / safe(params.maxNDToEBITDA, 3.5)) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Suggestions */}
      <div className="space-y-4">
        {(() => {
          const suggestedEquity = params.requestedLoanAmount * 0.15;
          const denom = params.equityContribution + params.requestedLoanAmount;
          const currentEquityPct = denom > 0 ? (params.equityContribution / denom) * 100 : NaN;
          const showEquitySuggestion =
            Number.isFinite(currentEquityPct) && currentEquityPct < 15;

          return (
            showEquitySuggestion &&
            params.equityContribution > 0 &&
            params.requestedLoanAmount > 0 &&
            !isNaN(currentEquityPct) && (
              <SmartSuggestion
                type="equity"
                current={fmtM(params.equityContribution)}
                suggested={fmtM(suggestedEquity)}
                impact={`Increasing equity to ${fmtM(
                  suggestedEquity
                )} would improve DSCR by ~15-20% and reduce refinancing risk.`}
              />
            )
          );
        })()}

        {params.openingDebtMaturityDate && params.issueDate && (
          <OpeningDebtWarning
            maturityDate={params.openingDebtMaturityDate}
            newFacilityEndDate={(() => {
              const facilityEndDate = new Date(params.issueDate || new Date());
              facilityEndDate.setFullYear(
                facilityEndDate.getFullYear() + safe(params.proposedTenor, 0)
              );
              return facilityEndDate.toISOString().split("T")[0];
            })()}
          />
        )}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Credit Metrics</h2>
        {hasExistingDebt && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
            <span className="text-xs font-semibold text-slate-700">
              Based on Opening Debt: {fmtM(params.openingDebt)}
            </span>
          </div>
        )}
      </div>

      {/* Enhanced Credit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedCreditCard
          title="Min DSCR"
          value={hasExistingDebt ? summary.minDSCR.toFixed(2) + 'x' : 'No existing debt'}
          threshold={safe(params.minDSCR, 1.2).toFixed(2) + "x"}
          status={hasExistingDebt ? (summary.minDSCR >= safe(params.minDSCR, 1.2) ? "compliant" : "breach") : "n/a"}
          type="dscr"
          subtitle={hasExistingDebt ? `Avg ${summary.avgDSCR.toFixed(2)}x • ${dscrTrend}` : "Configure opening debt"}
          isOpeningDebt={true}
        />
        <EnhancedCreditCard
          title="Min ICR"
          value={hasExistingDebt ? summary.minICR.toFixed(2) + 'x' : 'No existing debt'}
          threshold={safe(params.targetICR, 2.0).toFixed(2) + "x"}
          status={
            hasExistingDebt 
              ? (summary.minICR >= safe(params.targetICR, 2.0)
                  ? "compliant"
                  : summary.minICR >= safe(params.targetICR, 2.0) * 0.9
                  ? "warning"
                  : "breach")
              : "n/a"
          }
          type="icr"
          subtitle={hasExistingDebt ? `Avg ${summary.avgICR.toFixed(2)}x • ${icrTrend}` : "Configure opening debt"}
          isOpeningDebt={true}
        />
        <EnhancedCreditCard
          title="Max Leverage"
          value={hasExistingDebt ? summary.maxLeverage.toFixed(2) + "x" : 'No existing debt'}
          threshold={safe(params.maxNDToEBITDA, 3.5).toFixed(2) + "x"}
          status={hasExistingDebt ? (summary.maxLeverage <= safe(params.maxNDToEBITDA, 3.5) ? "compliant" : "breach") : "n/a"}
          type="leverage"
          subtitle={hasExistingDebt ? `${levTrend}` : "Configure opening debt"}
          isOpeningDebt={true}
        />

        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <div className="mb-2">
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
              Opening Debt
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Annual Debt Service</h3>
          <div className="text-3xl font-bold text-slate-800 mb-1">
            {hasExistingDebt && baseProj?.rows && baseProj.rows[0]
              ? fmtM(
                  safe(baseProj.rows[0].principalPayment, 0) +
                    safe(baseProj.rows[0].interestExpense, 0)
                )
              : fmtM(0)}
          </div>
          <div className="text-xs text-slate-500">
            {hasExistingDebt ? "Year 1 annual payment" : "No debt service"}
          </div>
        </div>
      </div>

      {/* Drill-down details */}
      {hasExistingDebt && (
        <>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = !showMetricDetails;
                setShowMetricDetails(next);
                if (next) setExpandedSection("metricsDetails");
                else setExpandedSection(null);
              }}
            >
              {showMetricDetails ? "Hide" : "Show"} metric details
            </Button>
          </div>
          {showMetricDetails && (
            <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div className="font-semibold mb-2">Ratios by Year</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <div className="font-semibold mb-1">DSCR</div>
                  {baseProj.rows.map((row) => (
                    <div key={`dscr-${row.year}`} className="flex justify-between">
                      <span>{row.year}</span>
                      <span className={row.dscr < safe(params.minDSCR, 1.2) ? "text-red-600 font-bold" : ""}>
                        {safe(row.dscr).toFixed(2)}x
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-semibold mb-1">ICR</div>
                  {baseProj.rows.map((row) => (
                    <div key={`icr-${row.year}`} className="flex justify-between">
                      <span>{row.year}</span>
                      <span className={row.icr < safe(params.targetICR, 2.0) ? "text-red-600 font-bold" : ""}>
                        {safe(row.icr).toFixed(2)}x
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="font-semibold mb-1">Leverage (ND/EBITDA)</div>
                  {baseProj.rows.map((row) => (
                    <div key={`lev-${row.year}`} className="flex justify-between">
                      <span>{row.year}</span>
                      <span
                        className={
                          row.ndToEbitda > safe(params.maxNDToEBITDA, 3.5) ? "text-red-600 font-bold" : ""
                        }
                      >
                        {safe(row.ndToEbitda).toFixed(2)}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Multi-Tranche Breakdown */}
      {hasMultipleTranches && multiTrancheInfo && (
        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              Multi-Tranche Debt Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-600 font-semibold mb-1">Total Tranches</div>
                <div className="text-2xl font-bold text-purple-900">{multiTrancheInfo.totalTranches}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-600 font-semibold mb-1">Total Debt</div>
                <div className="text-2xl font-bold text-purple-900">{fmtM(multiTrancheInfo.totalDebt)}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-purple-600 font-semibold mb-1">Blended Rate</div>
                <div className="text-2xl font-bold text-purple-900">{pctFmt(multiTrancheInfo.blendedRate)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-700">Tranche</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Amount</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Rate</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Seniority</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Maturity</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {multiTrancheInfo.tranches.map((tranche, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{tranche.name}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">{fmtM(tranche.amount)}</td>
                      <td className="p-3 text-right text-slate-700">{pctFmt(tranche.rate)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          tranche.seniority === 'Senior Secured' ? 'bg-emerald-100 text-emerald-800' :
                          tranche.seniority === 'Senior Unsecured' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {tranche.seniority}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">{tranche.maturityDate}</td>
                      <td className="p-3 text-slate-700">{tranche.amortizationType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debt Schedule Visualization */}
      {hasExistingDebt && debtScheduleData.length > 0 && (
        <Card className="border-l-4 border-l-indigo-600 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Debt Amortization Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="w-full h-80">
              <ResponsiveContainer>
                <AreaChart data={debtScheduleData}>
                  <defs>
                    <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: `Amount (${ccy})`, angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                        <div className="font-semibold mb-2">{label}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-indigo-600">Principal:</span>
                            <span className="font-semibold">{fmtM(payload[0]?.value || 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-amber-600">Interest:</span>
                            <span className="font-semibold">{fmtM(payload[1]?.value || 0)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-600">Ending Balance:</span>
                            <span className="font-semibold">{fmtM(payload[2]?.value || 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }} />
                  <Legend />
                  <Area type="monotone" dataKey="principal" stackId="1" stroke="#6366f1" fill="url(#principalGrad)" name="Principal Payment" />
                  <Area type="monotone" dataKey="interest" stackId="1" stroke="#f59e0b" fill="url(#interestGrad)" name="Interest Payment" />
                  <Line type="monotone" dataKey="endingBalance" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Ending Balance" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Profile */}
      <Card className="border-l-4 border-l-slate-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-600" />
            Company Profile & Industry Context
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Industry</div>
              <div className="text-sm font-semibold">{params.industry || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Credit History</div>
              <div className="text-sm font-semibold">{params.creditHistory || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-amber-500 to-amber-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Business Age</div>
              <div className="text-sm font-semibold">{safe(params.businessAge)} years</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Management</div>
              <div className="text-sm font-semibold">{params.managementExperience || "—"}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-purple-500 to-purple-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Total Assets</div>
              <div className="text-sm font-semibold">{currencyFmtMM(params.totalAssets, ccy)}</div>
            </div>
            <div className="rounded-lg p-4 text-white bg-gradient-to-br from-sky-500 to-sky-600 shadow-md">
              <div className="text-[11px] opacity-90 mb-1">Collateral</div>
              <div className="text-sm font-semibold">{currencyFmtMM(params.collateralValue, ccy)}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Max Leverage Benchmark</div>
              <div className="text-lg font-bold text-slate-800">{numFmt(params.maxNDToEBITDA)}x</div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Min DSCR Benchmark</div>
              <div className="text-lg font-bold text-slate-800">{numFmt(params.minDSCR)}x</div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Asset Coverage</div>
              <div className="text-lg font-bold text-slate-800">
                {assetCoverage !== null ? `${numFmt(assetCoverage)}x` : "N/A"}
              </div>
            </div>
            <div className="rounded-lg border-2 border-slate-200 p-4 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-semibold mb-1">Pro-Forma LTV</div>
              <div
                className={`text-lg font-bold ${
                  ltvPct === null
                    ? "text-slate-600"
                    : ltvPct <= 50
                    ? "text-emerald-600"
                    : ltvPct <= 75
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {ltvPct !== null ? `${ltvPct.toFixed(1)}%` : "N/A"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Strength Radar */}
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
              {hasExistingDebt ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center h-56 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm font-medium p-4">
                  <p>No existing debt – credit ratios not applicable.</p>
                  <p className="text-xs mt-1 text-slate-400 text-center">
                    Once the facility is disbursed, this radar chart will update automatically.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center w-full">
              <h4 className="font-semibold text-slate-800 mb-4">Metric Performance</h4>
              {radarData.map((item, i) => {
                const displayValue = hasExistingDebt ? item.value.toFixed(0) : 0;
                const barColor = hasExistingDebt
                  ? item.value >= 80
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                    : item.value >= 60
                    ? "bg-gradient-to-r from-amber-500 to-amber-600"
                    : "bg-gradient-to-r from-red-500 to-red-600"
                  : "bg-gradient-to-r from-slate-400 to-slate-500";

                return (
                  <div key={i} className="space-y-1 w-full">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.metric}</span>
                      <span className="font-semibold text-slate-800">{displayValue}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${displayValue}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening Debt vs New Facility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-amber-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Opening Debt
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {hasExistingDebt ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount:</span>
                  <span className="font-semibold">{fmtM(params.openingDebt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-semibold">{pctFmt(params.interestRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Maturity:</span>
                  <span className="font-semibold">{params.openingDebtMaturityDate || "—"}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No opening debt configured</p>
                <p className="text-xs text-slate-400 mt-1">Configure in parameters to enable analysis</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-blue-600" />
              Proposed New Facility
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {hasNewFacility ? (
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
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No new facility configured</p>
                <p className="text-xs text-slate-400 mt-1">Configure facility details in parameters</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Qualitative Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              Deal Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="font-semibold text-indigo-900">Purpose:</span>{" "}
              <span className="text-slate-700">{params.loanPurpose || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-indigo-900">Use of Proceeds:</span>{" "}
              <span className="text-slate-700">{params.useOfProceeds || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-indigo-900">Structure:</span>{" "}
              <span className="text-slate-700">{params.dealStructure || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Management & Relationship
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="font-semibold text-emerald-900">Key Management:</span>{" "}
              <span className="text-slate-700">{params.keyManagementNames || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-emerald-900">Track Record:</span>{" "}
              <span className="text-slate-700">{params.managementTrackRecord || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-emerald-900">RM:</span>{" "}
              <span className="text-slate-700">{params.relationshipManager || "—"}</span>{" "}
              • <span className="font-semibold text-emerald-900">Years:</span>{" "}
              <span className="text-slate-700">{safe(params.existingRelationshipYears)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-600" />
              Collateral Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="font-semibold text-amber-900">Description:</span>{" "}
              <span className="text-slate-700">{params.collateralDescription || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-amber-900">Lien:</span>{" "}
              <span className="text-slate-700">{params.lienPosition || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-amber-900">Appraisal:</span>{" "}
              <span className="text-slate-700">
                {currencyFmtMM(params.appraisalValue, ccy)} on {params.appraisalDate || "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Conditions & Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <span className="font-semibold text-rose-900">Conditions Precedent:</span>{" "}
              <span className="text-slate-700">{params.conditionsPrecedent || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-rose-900">Reporting:</span>{" "}
              <span className="text-slate-700">{params.reportingRequirements || "—"}</span>
            </div>
            <div>
              <span className="font-semibold text-rose-900">Site Visits:</span>{" "}
              <span className="text-slate-700">{params.siteVisitFrequency || "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rationale & Covenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
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
                      ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                      : "bg-rose-50 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  {b.pass ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${b.pass ? "text-emerald-900" : "text-rose-900"} font-medium`}>
                    {b.text}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                <strong>Passed:</strong>{" "}
                {rationale.bullets.filter((b) => b.pass).length} / {rationale.bullets.length} criteria
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-600 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Recommended Covenants & Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {covenants.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm p-3 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-all duration-200"
                >
                  <div className="w-2 h-2 bg-indigo-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <span className="text-indigo-900">{c}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Credit Metrics Over Time */}
      {hasExistingDebt && (
        <Card className="border-l-4 border-l-purple-600 shadow-sm">
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
                    <YAxis
                      yAxisId="left"
                      domain={[0, "auto"]}
                      tick={{ fontSize: 12 }}
                      label={{ value: "Ratio (x)", angle: -90, position: "insideLeft" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, "auto"]}
                      tick={{ fontSize: 12 }}
                      label={{ value: `Amount (${ccy})`, angle: 90, position: "insideRight" }}
                    />
                    <Tooltip content={<ChartTooltip ccy={ccy} />} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="DSCR" stroke={COLORS.primary.chart} strokeWidth={3} dot={{ r: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="ICR" stroke={COLORS.success.chart} strokeWidth={3} dot={{ r: 4 }} />
                    <Line yAxisId="left" type="monotone" dataKey="NDE" name="Net Debt/EBITDA" stroke={COLORS.danger.chart} strokeWidth={3} dot={{ r: 4 }} />
                    <Bar yAxisId="right" dataKey="EBITDA" fill="url(#ebitdaFill)" name="EBITDA (raw)" radius={[8, 8, 0, 0]} />
                    <Area yAxisId="right" type="monotone" dataKey="FCF" fill="url(#fcfFill)" stroke={COLORS.info.chart} name="FCF (raw)" />
                    <ReferenceLine
                      yAxisId="left"
                      y={safe(params.minDSCR, 1.2)}
                      stroke={COLORS.danger.chart}
                      strokeDasharray="4 4"
                      label={{ value: "Min DSCR", position: "right", fontSize: 11 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-slate-600">
                      <strong>Note:</strong> Ratios (DSCR / ICR / Net Debt/EBITDA) use the left axis; EBITDA & FCF use the
                      right axis (raw values from projections).
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-slate-400 mb-2">
                  <BarChart3 className="w-12 h-12 mx-auto" />
                </div>
                <div className="text-slate-500 text-sm font-medium">
                  Complete the Financial Parameters and Historical Data sections to generate projections.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI-Powered Capital Structure Recommendations */}
      {hasExistingDebt && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Capital Structure Recommendations</h2>
            <div className="px-3 py-1 bg-indigo-100 border border-indigo-300 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-900">AI-Powered Analysis</span>
            </div>
          </div>
          
          <CapitalStructurePanel 
            recommendations={capitalStructureRecs}
            ccy={ccy}
            isLoading={isLoadingCapStructure}
          />
        </div>
      )}
    </div>
  );
}