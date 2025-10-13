import React, { useMemo, useState, useEffect, useRef } from "react";
import { Download, FileText, DollarSign, Landmark, BarChart3, Shield, Building, TrendingUp, CheckCircle2, Calendar, Info } from "lucide-react";

// Component imports
import { Card, CardHeader, CardTitle, CardContent } from "./components/Card.jsx";
import { Button } from "./components/Button.jsx";
import { Input } from "./components/Input.jsx";
import { Label } from "./components/Label.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/Tabs.jsx";
import { KPI } from "./components/KPI.jsx";
import { HistoricalDataTab } from "./components/HistoricalDataTab.jsx";
import CapitalStructureAnalysis from "./components/CapitalStructureAnalysis.jsx";
import { CreditDashboard } from "./components/CreditDashboard.jsx";
import { ScenarioComparison } from "./components/ScenarioComparison.jsx";
import   DebtStressTesting  from "./components/DebtStressTesting.jsx";
import { DataTable } from "./components/DataTable.jsx";
import { ReportGenerator } from "./components/ReportGenerator.jsx";
import { CustomStressTesting } from "./components/CustomStressTesting.jsx";
import LoanMetricsTable from "./components/LoanMetricsTable.jsx";
import { generateModelDataSummary } from "./utils/ModelDataSummary.js";
import ChatAssistant from "./ChatAssistant.js";
import CollapsibleCard from "./components/CollapsibleCard.jsx";
import { DealBookExport } from "./components/DealBookExport.js";
import { ValuationTab } from "./components/ValuationTab.jsx";
import { SmartNumberField } from "./components/SmartFields";
import { DebtTrancheManager } from "./components/DebtTrancheManager.jsx";
import { BlendedDebtMetrics } from "./components/BlendedDebtMetrics.jsx";

// Utility imports
import { currencyFmtMM, numFmt, pctFmt } from "./utils/formatters.js";
import { calculateHistoricalAssumptions } from "./utils/calculations.js";
import { buildProjection } from "./utils/buildProjection.js";
import { applyShocks } from "./utils/applyShocks.js";
import { getBenchmarksForIndustry } from "./utils/industryBenchmarks.js";

// Hook imports
import { useDebounce } from "./hooks/debounce.js";

// NEW: Phase 1 component imports
import { SmartPctField } from "./components/SmartFields";
import { SmartSuggestion, OpeningDebtWarning } from "./components/SmartSuggestions";

// Color palette for consistency
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', hover: 'blue-700' },
  success: { from: 'emerald-500', to: 'emerald-600', hover: 'emerald-700' },
  warning: { from: 'amber-500', to: 'amber-600', hover: 'amber-700' },
  danger: { from: 'red-500', to: 'red-600', hover: 'red-700' },
  info: { from: 'indigo-500', to: 'indigo-600', hover: 'indigo-700' },
  purple: { from: 'purple-500', to: 'purple-600', hover: 'purple-700' },
};

const PRESETS = {
  base: { 
    label: "Base Case", 
    shocks: { growthDelta: 0, cogsDelta: 0, opexDelta: 0, capexDelta: 0, rateDelta: 0, waccDelta: 0, termGDelta: 0 } 
  },
  mild: { 
    label: "Mild Recession", 
    shocks: { growthDelta: -0.03, cogsDelta: 0.01, opexDelta: 0.005, capexDelta: -0.003, rateDelta: 0.01, waccDelta: 0.01, termGDelta: -0.002 } 
  },
  severe: { 
    label: "Severe Recession", 
    shocks: { growthDelta: -0.08, cogsDelta: 0.03, opexDelta: 0.015, capexDelta: -0.01, rateDelta: 0.02, waccDelta: 0.02, termGDelta: -0.01 } 
  },
  costShock: { 
    label: "Cost Inflation", 
    shocks: { growthDelta: -0.02, cogsDelta: 0.05, opexDelta: 0.01, capexDelta: 0, rateDelta: 0, waccDelta: 0.005, termGDelta: -0.003 } 
  },
  rateHike: { 
    label: "Rate Shock", 
    shocks: { growthDelta: -0.01, cogsDelta: 0, opexDelta: 0, capexDelta: 0, rateDelta: 0.03, waccDelta: 0.015, termGDelta: -0.002 } 
  },
};

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input 
        type="number" 
        value={value} 
        className="h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
        onChange={(e) => {
          const val = e.target.value === "" ? 0 : Number(e.target.value);
          onChange(Math.min(max ?? 1e12, Math.max(min ?? -1e12, val)));
        }}
        step={step} 
      />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm border border-slate-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
      />
    </div>
  );
}

function MoneyField({ label, value, onChange, ccy }) {
  const [displayValue, setDisplayValue] = React.useState(value.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  
  React.useEffect(() => {
    setDisplayValue(value.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input 
        type="text" 
        value={displayValue}
        onChange={(e) => {
          const rawValue = e.target.value.replace(/,/g, '');
          setDisplayValue(e.target.value);
          const numValue = Number(rawValue);
          if (!isNaN(numValue)) {
            onChange(numValue);
          }
        }}
        onBlur={(e) => {
          const rawValue = e.target.value.replace(/,/g, '');
          const numValue = Number(rawValue) || 0;
          onChange(numValue);
          setDisplayValue(numValue.toLocaleString('en-US', { maximumFractionDigits: 0 }));
        }}
        className="h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200" 
      />
      <div className="text-xs text-slate-500 font-medium">Currency: {ccy}</div>
    </div>
  );
}

function PctField({ label, value, onChange, min = -100, max = 100 }) {
  // Display value is the percentage number (12 for 12%, not 0.12)
  const [displayValue, setDisplayValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  
  // Sync display when prop changes from outside (but not when user is typing)
  React.useEffect(() => {
    if (!isFocused) {
      const pctValue = (value * 100).toFixed(2);
      setDisplayValue(pctValue);
    }
  }, [value, isFocused]);
  
  // Initialize on mount
  React.useEffect(() => {
    setDisplayValue((value * 100).toFixed(2));
  }, []);
  
  const handleChange = (e) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    
    // Convert percentage to decimal for storage
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && isFinite(numValue)) {
      // Clamp to reasonable range
      const clamped = Math.min(max, Math.max(min, numValue));
      onChange(clamped / 100); // Store as decimal (12 becomes 0.12)
    }
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    // Format to 2 decimal places on blur
    const numValue = parseFloat(displayValue);
    if (!isNaN(numValue) && isFinite(numValue)) {
      const clamped = Math.min(max, Math.max(min, numValue));
      setDisplayValue(clamped.toFixed(2));
      onChange(clamped / 100);
    } else {
      // Invalid input, reset to current value
      setDisplayValue((value * 100).toFixed(2));
    }
  };
  
  const handleFocus = (e) => {
    setIsFocused(true);
    // Select all text on focus for easy editing
    e.target.select();
  };
  
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <div className="flex items-center gap-2">
        <Input 
          type="number" 
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          step="0.01"
          className="h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
          placeholder="e.g., 12"
        />
        <span className="text-slate-600 text-sm font-semibold">%</span>
      </div>
      <div className="text-xs text-slate-500">
        Enter whole numbers (e.g., 12 for 12%)
      </div>
    </div>
  );
}
// Success Toast Component
function SuccessToast({ message, show, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5" />
        <span className="font-semibold">{message}</span>
      </div>
    </div>
  );
}

function ValidationErrors({ params }) {
  const errors = [];
  
  // Check WACC
  if (params.wacc <= 0) {
    errors.push({
      field: "WACC",
      message: "WACC must be greater than 0% for DCF calculations to work.",
      severity: "critical"
    });
  }
  
  // Check Terminal Growth vs WACC
  if (params.terminalGrowth >= params.wacc) {
    errors.push({
      field: "Terminal Growth",
      message: `Terminal growth (${(params.terminalGrowth * 100).toFixed(2)}%) must be less than WACC (${(params.wacc * 100).toFixed(2)}%).`,
      severity: "critical"
    });
  }
  
  // Check reasonable WACC range
  if (params.wacc > 0.50) {
    errors.push({
      field: "WACC",
      message: `WACC of ${(params.wacc * 100).toFixed(2)}% seems unusually high. Typical range is 5-25%.`,
      severity: "warning"
    });
  }
  
  if (errors.length === 0) return null;
  
  const criticalErrors = errors.filter(e => e.severity === "critical");
  const warnings = errors.filter(e => e.severity === "warning");
  
  return (
    <div className="space-y-3">
      {criticalErrors.length > 0 && (
        <Card className="border-l-4 border-l-red-600 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0">{'⚠️'}</div>
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-2">Critical Errors - Calculations Disabled</h3>
                <ul className="space-y-2">
                  {criticalErrors.map((error, i) => (
                    <li key={i} className="text-sm text-red-800">
                      <span className="font-semibold">{error.field}:</span> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {warnings.length > 0 && (
        <Card className="border-l-4 border-l-amber-600 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0">{'⚠️'}</div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-2">Warnings</h3>
                <ul className="space-y-2">
                  {warnings.map((error, i) => (
                    <li key={i} className="text-sm text-amber-800">
                      <span className="font-semibold">{error.field}:</span> {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}  export default function FinancialModelAndStressTester({ onDataUpdate }) {
  const [ccy, setCcy] = useState("JMD");
  
  // Main params state
  const [params, setParams] = useState({
    // Financial Parameters
    startYear: new Date().getFullYear(),
    years: 5,
    baseRevenue: 0,
    growth: 0.08,              // 8% - FIXED
    cogsPct: 0.40,             // 40% - FIXED
    opexPct: 0.25,             // 25% - FIXED
    capexPct: 0.05,            // 5% - FIXED
    daPctOfPPE: 0.10,          // 10% - FIXED
    wcPctOfRev: 0.15,          // 15% - FIXED
    openingDebt: 0,
    interestRate: 0.12,        // 12% - FIXED
    taxRate: 0.21,             // 21% - FIXED
    wacc: 0.10,                // 10% - FIXED (was 1.0 = 100%!)
    terminalGrowth: 0.03,      // 3% - FIXED
    debtTenorYears: 5,         // FIXED
    interestOnlyYears: 0,
    minDSCR: 1.2,              // FIXED
    maxNDToEBITDA: 3.5,        // FIXED
    targetICR: 2.0,            // FIXED
    equityContribution: 0,
    entryMultiple: 8.0,
    
        // FIXED
    
    // Credit Assessment
    industry: "Manufacturing",
    creditHistory: "Clean",
    totalAssets: 0,
    collateralValue: 0,
    businessAge: 0,
    managementExperience: "Strong",
    
    // NEW: Qualitative Deal Information
    companyLegalName: "",
    companyOperatingName: "",
    companyAddress: "",
    taxId: "",
    loanPurpose: "",
    useOfProceeds: "",
    dealStructure: "Term loan, revolving credit etc",
    requestedLoanAmount: 0,
    proposedTenor: 5,          // FIXED
    proposedPricing: 0.12,     // 12% - FIXED
    balloonPercentage: 50,
    customAmortization: [20, 20, 20, 20, 20],
    
    // Business Description
    businessModel: "",
    productsServices: "",
    keyCustomers: "",
    competitivePosition: "",
    marketShare: "",

    
    // Management
    keyManagementNames: "",
    managementTrackRecord: "",
    
    // Credit Analysis
    creditStrengths: "",
    keyRisks: "",
    mitigatingFactors: "",
    
    // Collateral
    collateralDescription: "",
    lienPosition: "First Lien",
    appraisalValue: 0,
    appraisalDate: "",
    
    // Relationship
    relationshipManager: "",
    existingRelationshipYears: 0,
    referralSource: "",
    
    // Financial Commentary
    revenueCommentary: "",
    marginCommentary: "",
    workingCapitalCommentary: "",
    seasonalityFactors: "",
    
    // Exit Strategy
    primaryRepaymentSource: "",
    secondaryRepaymentSource: "",
    
    // Conditions & Monitoring
    conditionsPrecedent: "",
    reportingRequirements: "",
    siteVisitFrequency: "",

    // Universal Debt Terms
    facilityType: "Senior Secured Term Loan",
    paymentFrequency: "Quarterly",
    useBalloonPayment: false,
    balloonPercentage: 0,
    dayCountConvention: "Actual/365",
    openingDate: new Date().toISOString().split('T')[0],
    issueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    prepaymentNoticeDays: 30,
   prepaymentPenaltyPct: 0,
    
    // Parties & Administration
    arrangerBroker: "ABC Wealth Limited",
    legalCounsel: "",
    trustee: "",
    registrar: "",
    payingAgent: "",
    
    // Bond-Specific Distribution
    distributionMethod: "Private Placement",
    investorType: "Accredited Investors",
    possibleUpsizeAmount: 0,
    
    // Opening Debt Date Management
  openingDebtStartDate: '2023-01-01',
  openingDebtMaturityDate: '2028-12-31',
  openingDebtAmortizationType: 'amortizing', // NEW: 'amortizing' or 'interest-only'
  openingDebtPaymentFrequency: 'Quarterly', // NEW: Match new facility options
   
// NEW: Multiple-Tranche fields
  hasMultipleTranches: false,
  debtTranches: [], 

    // NEW: Track which fields user edited manually
    _editedFields: new Set(),
    _historicalValues: null,
  });  // ← CLOSE THE PARAMS OBJECT HERE!

  // Now declare custom shocks state
  const [customShocks, setCustomShocks] = useState({
    growthDelta: 0, 
    cogsDelta: 0, 
    opexDelta: 0, 
    capexDelta: 0,
    rateDelta: 0, 
    waccDelta: 0, 
    termGDelta: 0,
  });

  

  // Draft states for debounced updates
  const [draftParams, setDraftParams] = useState(params);
  const [draftCustomShocks, setDraftCustomShocks] = useState({
    growthDelta: 0, cogsDelta: 0, opexDelta: 0, capexDelta: 0,
    rateDelta: 0, waccDelta: 0, termGDelta: 0,
  });

  const [showInputs, setShowInputs] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [historicalData, setHistoricalData] = useState([
    { year: 2021, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date() },
    { year: 2022, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date() },
    { year: 2023, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date() },
  ]);

 // Refs for PDF export
  const loanMetricsRef = useRef();
  const scenarioComparisonRef = useRef();
  const creditDashboardRef = useRef();
  const financialAssumptionsRef = useRef();
  const covenantAnalysisRef = useRef();

  // Debounced states
  const debouncedParams = useDebounce(draftParams, 400);
  const debouncedCustomShocks = useDebounce(draftCustomShocks, 400);

  // Add this new state
  const [activeTab, setActiveTab] = useState("capital-structure");

// Add this useEffect
useEffect(() => {
  const tabTitles = {
    "capital-structure": "Capital Structure",
    "credit-dashboard": "Credit Dashboard", 
    "scenario-comparison": "Scenario Analysis",
    "stress-testing": "Stress Testing",
    "loan-metrics": "Loan Metrics",
    "valuation": "Valuation",
    "report-generator": "Reports"
  };
  
  document.title = `${tabTitles[activeTab] || "FinSight"} - FinSight`;
}, [activeTab]);

  // Sync draft params with actual params when debounced
  useEffect(() => {
    setParams(debouncedParams);
  }, [debouncedParams]);

  // Sync draft custom shocks with actual custom shocks when debounced
  useEffect(() => {
    setCustomShocks(debouncedCustomShocks);
  }, [debouncedCustomShocks]);

  // Initialize draft states when component mounts
  useEffect(() => {
    setDraftParams(params);
  }, []);

  // Visual feedback when parameters change
  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 300);
    return () => clearTimeout(timer);
  }, [debouncedParams]);

  // Auto-populate financial parameters when historical data changes
useEffect(() => {
  const validYears = [...historicalData]
  .filter(d => d.revenue > 0)
  .sort((a, b) => a.year - b.year); // oldest -> newest


  // Only run if at least one valid year of data exists
  if (validYears.length >= 1) {
    // Get assumptions for averages (growth, opex, etc.)
    const assumptions = calculateHistoricalAssumptions(historicalData);

    // ✅ Get the most recent (last) year in the list
    const mostRecent = validYears[validYears.length - 2];

    // ✅ Compute the average revenue across all years (backup)
    const avgRevenue =
      validYears.reduce((sum, yr) => sum + (yr.revenue || 0), 0) /
      validYears.length;

    if (assumptions) {
      setDraftParams((prev) => {
        // Calculate total debt from most recent historical year
        const totalHistoricalDebt =
          (mostRecent.shortTermDebt || 0) + (mostRecent.longTermDebt || 0);

        // Calculate implied interest rate from interest expense
        const historicalRate =
          mostRecent.interestExpense && totalHistoricalDebt > 0
            ? mostRecent.interestExpense / totalHistoricalDebt
            : null;

        // NEW: Store historical values for comparison
        const historicalValues = {
          cogsPct: assumptions.cogsPct,
          opexPct: assumptions.opexPct,
          capexPct: assumptions.capexPct,
          wcPctOfRev: assumptions.wcPctOfRev,
          growth: assumptions.growth
        };

        return {
          ...prev,

          // Base Revenue
          baseRevenue:
            prev.baseRevenue === 0
              ? mostRecent.revenue || avgRevenue || assumptions.baseRevenue
              : prev.baseRevenue,

          // Only update if not manually edited
          cogsPct: !prev._editedFields?.has('cogsPct') ? assumptions.cogsPct : prev.cogsPct,
          opexPct: !prev._editedFields?.has('opexPct') ? assumptions.opexPct : prev.opexPct,
          capexPct: !prev._editedFields?.has('capexPct') ? assumptions.capexPct : prev.capexPct,
          wcPctOfRev: !prev._editedFields?.has('wcPctOfRev') ? assumptions.wcPctOfRev : prev.wcPctOfRev,
          growth: !prev._editedFields?.has('growth') ? assumptions.growth : prev.growth,

          // Optional auto-updates
          openingDebt: prev.openingDebt === 0 ? totalHistoricalDebt : prev.openingDebt,
          interestRate: prev.interestRate === 0 && historicalRate ? historicalRate : prev.interestRate,
          
          // NEW: Store historical values for variance display
          _historicalValues: historicalValues
        };
      });
    }
  }
}, [historicalData]);


  const applyHistoricalAssumptions = () => {
    try {
      const assumptions = calculateHistoricalAssumptions(historicalData);
      if (assumptions) {
        setDraftParams(prev => ({
          ...prev,
          baseRevenue: prev.baseRevenue === 0
  ? (mostRecent.revenue || assumptions.baseRevenue)
  : prev.baseRevenue,

          growth:     prev.growth     === 0.08 ? assumptions.growth     : prev.growth,
cogsPct:    prev.cogsPct    === 0.40 ? assumptions.cogsPct    : prev.cogsPct,
opexPct:    prev.opexPct    === 0.25 ? assumptions.opexPct    : prev.opexPct,
wcPctOfRev: prev.wcPctOfRev === 0.15 ? assumptions.wcPctOfRev : prev.wcPctOfRev,
capexPct:   prev.capexPct   === 0.05 ? assumptions.capexPct   : prev.capexPct,

        }));
        setShowInputs(true);
        setSuccessMessage("Historical assumptions applied successfully!");
        setShowSuccessToast(true);
      }
    } catch (error) {
      console.error("Error applying historical assumptions:", error);
    }
  };

  const projections = useMemo(() => {
    try {
      const result = {};
      
      result.base = buildProjection(params);
      
      Object.keys(PRESETS).forEach(key => {
        if (key !== 'base') {
          const shocked = applyShocks(params, PRESETS[key].shocks);
          result[key] = buildProjection(shocked);
        }
      });
      
      if (Object.values(customShocks).some(v => v !== 0)) {
        const shocked = applyShocks(params, customShocks);
        result.custom = buildProjection(shocked);
      }
      
      return result;
    } catch (error) {
      console.error("Error building projections:", error);
      return null;
    }
  }, [params, customShocks]);

  useEffect(() => {
    if (onDataUpdate && projections) {
      onDataUpdate({
        params,
        customShocks,
        projections,
        historicalData,
      });
    }
  }, [params, customShocks, projections, historicalData, onDataUpdate]);


  // Calculate derived data for export - USING LIVE PROJECTION DATA
  const facilityParams = useMemo(() => ({
    requestedLoanAmount: params.requestedLoanAmount,
    proposedPricing: params.proposedPricing,
    proposedTenor: params.proposedTenor,
    paymentFrequency: params.paymentFrequency,
    balloonPercentage: params.balloonPercentage,
    interestOnlyYears: params.interestOnlyYears,
    interestRate: params.interestRate,
    debtTenorYears: params.debtTenorYears,
    dayCountConvention: params.dayCountConvention
  }), [params]);

  const creditMetrics = useMemo(() => ({
    minDSCR: projections?.base?.creditStats?.minDSCR || 0,
    minICR: projections?.base?.creditStats?.minICR || 0,
    maxLeverage: projections?.base?.creditStats?.maxLeverage || 0,
    avgDSCR: projections?.base?.creditStats?.avgDSCR || 0,
    breaches: projections?.base?.breaches || { dscrBreaches: 0, icrBreaches: 0, ndBreaches: 0 },
    enterpriseValue: projections?.base?.enterpriseValue || 0,
    equityValue: projections?.base?.equityValue || 0,
    irr: projections?.base?.irr || 0,
    moic: projections?.base?.moic || 0
  }), [projections]);

  const businessData = useMemo(() => ({
    businessModel: params.businessModel,
    productsServices: params.productsServices,
    keyCustomers: params.keyCustomers,
    competitivePosition: params.competitivePosition,
    marketShare: params.marketShare,
    keyManagementNames: params.keyManagementNames,
    managementTrackRecord: params.managementTrackRecord,
    creditStrengths: params.creditStrengths,
    keyRisks: params.keyRisks,
    mitigatingFactors: params.mitigatingFactors,
    collateralDescription: params.collateralDescription,
    lienPosition: params.lienPosition,
    appraisalValue: params.appraisalValue,
    appraisalDate: params.appraisalDate,
    relationshipManager: params.relationshipManager,
    existingRelationshipYears: params.existingRelationshipYears,
    referralSource: params.referralSource,
    revenueCommentary: params.revenueCommentary,
    marginCommentary: params.marginCommentary,
    workingCapitalCommentary: params.workingCapitalCommentary,
    seasonalityFactors: params.seasonalityFactors,
    primaryRepaymentSource: params.primaryRepaymentSource,
    secondaryRepaymentSource: params.secondaryRepaymentSource,
    conditionsPrecedent: params.conditionsPrecedent,
    reportingRequirements: params.reportingRequirements,
    siteVisitFrequency: params.siteVisitFrequency
  }), [params]);

  const covenantData = useMemo(() => ({
    minDSCR: params.minDSCR,
    targetICR: params.targetICR,
    maxNDToEBITDA: params.maxNDToEBITDA
  }), [params]);

  const exportToCSV = () => {
    try {
      const headers = ["Scenario", "Enterprise Value", "Equity Value", "Equity MOIC", "Equity IRR", "Min DSCR", "Max Leverage"];
      const rows = Object.keys(projections).map(key => [
        PRESETS[key]?.label || key,
        projections[key].enterpriseValue,
        projections[key].equityValue,
        projections[key].moic,
        projections[key].irr,
        Math.min(...projections[key].rows.map(r => r.dscr)),
        Math.max(...projections[key].rows.map(r => r.ndToEbitda)),
      ]);
      
      const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
      const element = document.createElement("a");
      const file = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      element.href = URL.createObjectURL(file);
      element.download = "financial_model_summary.csv";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      setSuccessMessage("CSV exported successfully!");
      setShowSuccessToast(true);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  if (!projections || !projections.base) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded">
        <h2 className="text-xl font-bold text-red-800">Error: Failed to build projections</h2>
        <p className="text-red-600">Check the console for details</p>
      </div>
    );
  }

// Add this after your existing useEffects (around line 700)


// Auto-populate covenant ratios when industry changes
useEffect(() => {
  if (draftParams.industry) {
    const benchmarks = getBenchmarksForIndustry(draftParams.industry);
    
    setDraftParams(prev => ({
      ...prev,
      // Only update if not manually edited
      minDSCR: !prev._editedFields?.has('minDSCR') ? benchmarks.minDSCR : prev.minDSCR,
      targetICR: !prev._editedFields?.has('targetICR') ? benchmarks.targetICR : prev.targetICR,
      maxNDToEBITDA: !prev._editedFields?.has('maxNDToEBITDA') ? benchmarks.maxNDToEBITDA : prev.maxNDToEBITDA,
      
      // Store benchmarks for variance display
      _industryBenchmarks: benchmarks
    }));
  }
}, [draftParams.industry]);

// Auto-populate debt tenor from new facility
useEffect(() => {
  if (draftParams.proposedTenor && !draftParams._editedFields?.has('debtTenorYears')) {
    setDraftParams(prev => ({
      ...prev,
      debtTenorYears: prev.proposedTenor
    }));
  }
}, [draftParams.proposedTenor]);

  // Helper to check if we have valid historical data for auto-population
  const hasValidHistoricalData = historicalData.some(d => d.revenue > 0);

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-[1800px] mx-auto space-y-4 sm:space-y-6 bg-slate-50">
      {/* Success Toast */}
      <SuccessToast 
        message={successMessage}
        show={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 flex justify-between items-center bg-white p-4 rounded-lg shadow-md border border-slate-200 backdrop-blur-sm bg-white/95">
        <div className="flex items-center gap-4">
          <img 
            src={`${process.env.PUBLIC_URL}/favicon.ico`} 
            alt="FinSight Logo" 
            className="h-12 w-12 transition-transform duration-300 hover:rotate-12"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">FinSight</h1>
            <p className="text-sm text-slate-600">Capital Structure & Stress Testing Platform</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {isCalculating && (
            <div className="flex items-center gap-2 text-blue-600 animate-pulse">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <span className="text-xs font-semibold">Calculating...</span>
            </div>
          )}
          <Button  
  size="md" 
  onClick={() => setShowInputs(!showInputs)}
  className={`ml-2 bg-gradient-to-r from-${COLORS.primary.from} to-${COLORS.primary.to} hover:from-${COLORS.primary.hover} hover:to-${COLORS.primary.hover} text-white text-xs px-4 py-2 shadow-md font-semibold transition-all duration-200 transform hover:scale-105`}
>
  {showInputs ? "Hide" : "Show"} Inputs
</Button>

        </div>
      </div>

      {/* Enhanced KPI Cards with hover effects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`bg-gradient-to-br from-${COLORS.primary.from} to-${COLORS.primary.to} rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Enterprise Value</div>
          <div className="text-3xl font-bold mb-1">{currencyFmtMM(projections.base.enterpriseValue, ccy)}</div>
          <div className="text-xs opacity-80">Total Business Value</div>
        </div>
        
        <div className={`bg-gradient-to-br from-${COLORS.success.from} to-${COLORS.success.to} rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Equity Value</div>
          <div className="text-3xl font-bold mb-1">{currencyFmtMM(projections.base.equityValue, ccy)}</div>
          <div className="text-xs opacity-80">Shareholder Return</div>
        </div>
        
        <div className={`rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer ${
          projections.base.moic > 3 ? `bg-gradient-to-br from-${COLORS.purple.from} to-${COLORS.purple.to}` : 
          projections.base.moic > 2 ? `bg-gradient-to-br from-${COLORS.info.from} to-${COLORS.info.to}` : 
          'bg-gradient-to-br from-slate-500 to-slate-600'
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Equity MOIC</div>
          <div className="text-3xl font-bold mb-1">
  {Number.isFinite(projections.base.moic) && projections.base.moic < 999
    ? `${numFmt(projections.base.moic)}x`
    : '–'}
</div>

          <div className="text-xs opacity-80 flex items-center gap-1">
            {projections.base.moic > 2 ? '↑ Strong Return' : '↓ Below Target'}
          </div>
        </div>
        
        <div className={`rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl cursor-pointer ${
          projections.base.irr > 0.20 ? `bg-gradient-to-br from-${COLORS.warning.from} to-${COLORS.warning.to}` : 
          projections.base.irr > 0.15 ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 
          `bg-gradient-to-br from-${COLORS.danger.from} to-${COLORS.danger.to}`
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Equity IRR</div>
          <div className="text-3xl font-bold mb-1">{pctFmt(projections.base.irr)}</div>
          <div className="text-xs opacity-80 flex items-center gap-1">
            {projections.base.irr > 0.15 ? '↑ Above Hurdle' : '↓ Below Hurdle'}
          </div>
        </div>
      </div>

      {/* Export button with LIVE data */}
      <DealBookExport
        currentProjections={projections.base}
        currentParams={params}
        currentScenarios={projections}
        facilityParams={facilityParams}
        creditMetrics={creditMetrics}
        businessData={businessData}
        covenantData={covenantData}
        
        loanMetricsRef={loanMetricsRef}
        scenarioComparisonRef={scenarioComparisonRef}
        creditDashboardRef={creditDashboardRef}
        financialAssumptionsRef={financialAssumptionsRef}
        covenantAnalysisRef={covenantAnalysisRef}
      />

      {showInputs && (
        <div className="space-y-6 animate-fade-in">
          {/* Deal Information & Structure */}
          <CollapsibleCard 
            title="Deal Information & Structure" 
            icon={FileText} 
            color="indigo" 
            defaultOpen={false}
          >
            <Card id="deal-information" className="border-l-4 border-l-indigo-600">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-indigo-600" />
                  Deal Information & Structure
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Configure the proposed debt facility terms and structure
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Facility Classification */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
                    <Landmark className="w-5 h-5 text-indigo-600" />
                    Facility Classification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">Facility Type</Label>
                      <select
                        value={draftParams.facilityType}
                        onChange={(e) => setDraftParams({...draftParams, facilityType: e.target.value})}
                        className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      >
                        <optgroup label="Secured Loans">
                          <option value="Senior Secured Term Loan">Senior Secured Term Loan</option>
                          <option value="Senior Secured Revolving Credit">Senior Secured Revolving Credit</option>
                          <option value="Senior Secured Bridge Loan">Senior Secured Bridge Loan</option>
                        </optgroup>
                        <optgroup label="Unsecured Loans">
                          <option value="Senior Unsecured Term Loan">Senior Unsecured Term Loan</option>
                          <option value="Senior Unsecured Revolving Credit">Senior Unsecured Revolving Credit</option>
                          <option value="Subordinated Loan">Subordinated Loan</option>
                        </optgroup>
                        <optgroup label="Secured Bonds">
                          <option value="Senior Secured Fixed Rate Bond">Senior Secured Fixed Rate Bond</option>
                          <option value="Senior Secured Floating Rate Bond">Senior Secured Floating Rate Bond</option>
                          <option value="Senior Secured Callable Bond">Senior Secured Callable Bond</option>
                        </optgroup>
                        <optgroup label="Unsecured Bonds">
                          <option value="Senior Unsecured Fixed Rate Bond">Senior Unsecured Fixed Rate Bond</option>
                          <option value="Senior Unsecured Floating Rate Bond">Senior Unsecured Floating Rate Bond</option>
                          <option value="Senior Unsecured Callable Bond">Senior Unsecured Callable Bond</option>
                          <option value="Subordinated Bond">Subordinated Bond</option>
                          <option value="Convertible Bond">Convertible Bond</option>
                        </optgroup>
                        <optgroup label="Specialized Facilities">
                          <option value="Asset-Based Lending">Asset-Based Lending</option>
                          <option value="Mezzanine Debt">Mezzanine Debt</option>
                          <option value="Project Finance">Project Finance</option>
                          <option value="Trade Finance">Trade Finance</option>
                        </optgroup>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">Currency</Label>
                      <select
                        value={ccy}
                        onChange={(e) => setCcy(e.target.value)}
                        className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      >
                        <option value="JMD">JMD - Jamaican Dollar</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Parties & Administration */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Parties & Administration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextField 
                      label="Arranger / Broker" 
                      value={draftParams.arrangerBroker} 
                      onChange={(v) => setDraftParams({...draftParams, arrangerBroker: v})}
                      placeholder="e.g., ABC Wealth Limited"
                    />
                    <TextField 
                      label="Legal Counsel" 
                      value={draftParams.legalCounsel} 
                      onChange={(v) => setDraftParams({...draftParams, legalCounsel: v})}
                      placeholder="Law firm name"
                    />
                    {draftParams.facilityType?.toLowerCase().includes('bond') && (
                      <>
                        <TextField label="Trustee" value={draftParams.trustee} onChange={(v) => setDraftParams({...draftParams, trustee: v})} placeholder="e.g., JCSD Trustee Services Limited"/>
                        <TextField label="Registrar" value={draftParams.registrar} onChange={(v) => setDraftParams({...draftParams, registrar: v})} placeholder="Registrar name"/>
                        <TextField label="Paying Agent" value={draftParams.payingAgent} onChange={(v) => setDraftParams({...draftParams, payingAgent: v})} placeholder="Paying agent name"/>
                      </>
                    )}
                  </div>
                </div>

                {/* Facility Terms */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-200 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                    Facility Terms
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MoneyField label="Requested Amount" value={draftParams.requestedLoanAmount} onChange={(v) => setDraftParams({...draftParams, requestedLoanAmount: v})} ccy={ccy}/>
                    <PctField label="Interest Rate (Annual)" value={draftParams.proposedPricing} onChange={(v) => setDraftParams({...draftParams, proposedPricing: v})}/>
                    <NumberField label="Tenor (Years)" value={draftParams.proposedTenor} onChange={(v) => setDraftParams({...draftParams, proposedTenor: v})} min={1} max={30}/>
                  </div>
                </div>

                {/* Key Dates */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Key Dates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">Opening Date</Label>
                      <Input
                        type="date"
                        value={draftParams.openingDate}
                        onChange={(e) => setDraftParams({ ...draftParams, openingDate: e.target.value })}
                        className="h-12 text-base font-semibold border-2 focus:border-indigo-500 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">
                        {draftParams.facilityType?.toLowerCase().includes("bond") ? "Issue Date" : "Closing Date"}
                      </Label>
                      <Input
                        type="date"
                        value={draftParams.issueDate}
                        onChange={(e) => setDraftParams({ ...draftParams, issueDate: e.target.value })}
                        className="h-12 text-base font-semibold border-2 focus:border-indigo-500 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">Maturity Date</Label>
                      <Input
                        type="date"
                        value={new Date(
                          new Date(draftParams.issueDate).getTime() + draftParams.proposedTenor * 365 * 24 * 60 * 60 * 1000
                        )
                          .toISOString()
                          .split("T")[0]}
                        disabled
                        className="h-12 text-base font-semibold border-2 bg-slate-100 text-slate-500"
                      />
                    </div>
                  </div>
                </div>

{/* Repayment Structure */}
<div>
  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
    <TrendingUp className="w-5 h-5 text-indigo-600" />
    Repayment Structure
  </h3>

  <div className="space-y-6">
    {/* Payment Frequency */}
    <div className="space-y-2">
      <Label htmlFor="paymentFrequency" className="text-sm font-semibold text-slate-700">
        Payment Frequency
      </Label>

      <select
        id="paymentFrequency"
        value={draftParams.paymentFrequency}
        onChange={(e) => {
          const pf = e.target.value;
          setDraftParams((prev) => ({
            ...prev,
            paymentFrequency: pf,
            ...(pf !== "Balloon" ? { useBalloonPayment: false, balloonPercentage: 0 } : {}),
            ...(pf !== "customAmortization"
              ? {}
              : { customAmortizationIntervals: prev.customAmortizationIntervals ?? [25, 25, 25, 25] }),
          }));
        }}
        className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
      >
        <option value="Monthly">Monthly</option>
        <option value="Quarterly">Quarterly</option>
        <option value="Semi-Annually">Semi-Annually</option>
        <option value="Annually">Annually</option>
        <option value="Bullet">Bullet (Single Payment at Maturity)</option>
        <option value="Balloon">Balloon</option>
        <option value="customAmortization">Custom Amortization</option>
      </select>
    </div>

    {/* Balloon — only when selected */}
    {draftParams.paymentFrequency === "Balloon" && (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <input
            id="useBalloonPayment"
            type="checkbox"
            checked={!!draftParams.useBalloonPayment}
            onChange={(e) =>
              setDraftParams({
                ...draftParams,
                useBalloonPayment: e.target.checked,
              })
            }
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="useBalloonPayment" className="text-sm font-bold text-slate-800 cursor-pointer">
            Include Balloon Payment at Maturity
          </label>
        </div>

        {draftParams.useBalloonPayment && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Balloon Payment (% of Original Principal)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={draftParams.balloonPercentage ?? 50}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
                  setDraftParams({ ...draftParams, balloonPercentage: next });
                }}
                className="w-full h-10 px-3 border rounded-md"
              />
            </div>
          </div>
        )}
      </div>
    )}

    {/* Custom Amortization — only when selected */}
    {draftParams.paymentFrequency === "customAmortization" && (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
        <div className="text-sm font-semibold text-slate-800">
          Custom Amortization Intervals (must total 100%)
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Interval 1", "Interval 2", "Interval 3", "Interval 4"].map((label, idx) => (
            <div key={idx} className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">{label} (%)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={draftParams.customAmortizationIntervals?.[idx] ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  const next = [...(draftParams.customAmortizationIntervals || [0, 0, 0, 0])];
                  next[idx] = val;
                  setDraftParams({
                    ...draftParams,
                    customAmortizationIntervals: next,
                  });
                }}
                className="w-full h-10 px-3 border rounded-md"
              />
            </div>
          ))}
        </div>

        <div className="text-xs">
          Total: {((draftParams.customAmortizationIntervals || []).reduce((s, v) => s + (+v || 0), 0)).toFixed(2)}%
          {Math.abs(((draftParams.customAmortizationIntervals || []).reduce((s, v) => s + (+v || 0), 0)) - 100) > 0.5 && (
            <span className="ml-2 text-amber-700 font-semibold">• Should sum to 100%</span>
          )}
        </div>
      </div>
    )}

    {/* Interest-Only Period */}
    <NumberField
      label="Interest-Only Period (Years)"
      value={draftParams.interestOnlyYears}
      onChange={(v) => setDraftParams({ ...draftParams, interestOnlyYears: v })}
      min={0}
      max={draftParams.proposedTenor}
    />
  </div>
</div>
    

                {/* Bond-Specific Terms */}
                {draftParams.facilityType?.toLowerCase().includes("bond") && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
                      <Shield className="w-5 h-5 text-indigo-600" />
                      Bond-Specific Terms
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Distribution Method</Label>
                        <select
                          value={draftParams.distributionMethod}
                          onChange={(e) => setDraftParams({...draftParams, distributionMethod: e.target.value})}
                          className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                        >
                          <option value="Private Placement">Private Placement</option>
                          <option value="Public Offering">Public Offering</option>
                          <option value="Rights Issue">Rights Issue</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Investor Type</Label>
                        <select
                          value={draftParams.investorType}
                          onChange={(e) => setDraftParams({...draftParams, investorType: e.target.value})}
                          className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                        >
                          <option value="Accredited Investors">Accredited Investors</option>
                          <option value="Institutional Investors">Institutional Investors</option>
                          <option value="Retail Investors">Retail Investors</option>
                          <option value="Qualified Institutional Buyers">Qualified Institutional Buyers</option>
                        </select>
                      </div>
                      <MoneyField label="Possible Upsize Amount" value={draftParams.possibleUpsizeAmount} onChange={(v) => setDraftParams({...draftParams, possibleUpsizeAmount: v})} ccy={ccy}/>
                    </div>
                  </div>
                )}

                {/* Prepayment Terms */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-indigo-200">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Prepayment Terms
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <NumberField label="Prepayment Notice (Days)" value={draftParams.prepaymentNoticeDays} onChange={(v) => setDraftParams({...draftParams, prepaymentNoticeDays: v})} min={0} max={90}/>
                    <PctField label="Prepayment Penalty (%)" value={draftParams.prepaymentPenaltyPct / 100} onChange={(v) => setDraftParams({...draftParams, prepaymentPenaltyPct: v * 100})}/>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">Day Count Convention</Label>
                      <select
                        value={draftParams.dayCountConvention}
                        onChange={(e) => setDraftParams({...draftParams, dayCountConvention: e.target.value})}
                        className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      >
                        <option value="Actual/365">Actual/365</option>
                        <option value="Actual/360">Actual/360</option>
                        <option value="30/360">30/360</option>
                        <option value="Actual/Actual">Actual/Actual</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Historical Data & Assumptions - OPEN BY DEFAULT */}
          <CollapsibleCard 
            title="Historical Data & Assumptions" 
            icon={BarChart3} 
            color="blue" 
            defaultOpen={true}
          >
            <Card id="historical-data" className="border-l-4 border-l-blue-600">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  Historical Data & Assumptions
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  {hasValidHistoricalData 
                    ? "Historical data detected. Review and apply assumptions to your model." 
                    : "Enter historical financial data to auto-populate assumptions"}
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <HistoricalDataTab 
                  data={[...historicalData].sort((a, b) => b.year - a.year)}
                  onChange={setHistoricalData}
                  onApplyAssumptions={applyHistoricalAssumptions}
                  hasValidData={hasValidHistoricalData}
                />
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Financial Parameters */}
          <CollapsibleCard 
            title="Financial Parameters" 
            icon={DollarSign} 
            color="emerald" 
            defaultOpen={false}
          >
            <Card id="financial-parameters" className="border-l-4 border-l-emerald-600">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  Financial Parameters
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Configure revenue, costs, and financial assumptions
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <NumberField label="Start Year" value={draftParams.startYear} onChange={(v) => setDraftParams({...draftParams, startYear: v})} min={2000} max={2100}/>
                  <NumberField label="Projection Years" value={draftParams.years} onChange={(v) => setDraftParams({...draftParams, years: v})} min={1} max={20}/>
                  <MoneyField label="Base Revenue" value={draftParams.baseRevenue} onChange={(v) => setDraftParams({...draftParams, baseRevenue: v})} ccy={ccy}/>
                  
                  <SmartPctField 
                    label="Revenue Growth"
                    value={draftParams.growth}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        growth: v,
                        _editedFields: new Set([...(draftParams._editedFields || []), 'growth'])
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.growth}
                    helper="Annual revenue growth rate"
                  />
                  <SmartPctField 
                    label="COGS %"
                    value={draftParams.cogsPct}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        cogsPct: v,
                        _editedFields: new Set([...(draftParams._editedFields || []), 'cogsPct'])
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.cogsPct}
                    helper="Cost of Goods Sold as % of revenue"
                  />
                  <SmartPctField 
                    label="OPEX %"
                    value={draftParams.opexPct}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        opexPct: v,
                        _editedFields: new Set([...(draftParams._editedFields || []), 'opexPct'])
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.opexPct}
                    helper="Operating expenses as % of revenue"
                  />
                  <SmartPctField 
                    label="CAPEX %"
                    value={draftParams.capexPct}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        capexPct: v,
                        _editedFields: new Set([...(draftParams._editedFields || []), 'capexPct'])
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.capexPct}
                    helper="Capital expenditures as % of revenue"
                  />
                  <PctField label="Depreciation % of PPE" value={draftParams.daPctOfPPE} onChange={(v) => setDraftParams({...draftParams, daPctOfPPE: v})}/>
                  <SmartPctField 
                    label="Working Capital % of Revenue"
                    value={draftParams.wcPctOfRev}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        wcPctOfRev: v,
                        _editedFields: new Set([...(draftParams._editedFields || []), 'wcPctOfRev'])
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.wcPctOfRev}
                    helper="Working capital as % of revenue"
                  />
                  <MoneyField label="Opening Debt" value={draftParams.openingDebt} onChange={(v) => setDraftParams({...draftParams, openingDebt: v})} ccy={ccy}/>
                  <PctField label="Interest Rate" value={draftParams.interestRate} onChange={(v) => setDraftParams({...draftParams, interestRate: v})}/>
                  <PctField label="Tax Rate" value={draftParams.taxRate} onChange={(v) => setDraftParams({...draftParams, taxRate: v})}/>
                  <PctField label="WACC" value={draftParams.wacc} onChange={(v) => setDraftParams({...draftParams, wacc: v})}/>
                  <PctField label="Terminal Growth" value={draftParams.terminalGrowth} onChange={(v) => setDraftParams({...draftParams, terminalGrowth: v})}/>
                  <MoneyField label="Equity Contribution" value={draftParams.equityContribution} onChange={(v) => setDraftParams({...draftParams, equityContribution: v})} ccy={ccy}/>

                  {/* NEW: Equity suggestion helper */}
                  {draftParams.requestedLoanAmount > 0 && (
                    <div className="col-span-full">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                        <div className="text-blue-600 flex-shrink-0 mt-0.5">💡</div>
                        <div className="flex-1 text-sm">
                          <p className="font-semibold text-blue-900 mb-1">Equity Recommendation</p>
                          <p className="text-blue-800">
                            Industry standard: <strong>15-20% of total capital</strong>. 
                            For {ccy} {(draftParams.requestedLoanAmount / 1000000).toFixed(1)}M facility, 
                            consider <strong>{ccy} {((draftParams.requestedLoanAmount * 0.15) / 1000000).toFixed(1)}M - {((draftParams.requestedLoanAmount * 0.20) / 1000000).toFixed(1)}M</strong>.
                          </p>
                          {draftParams.equityContribution > 0 && (
                            <p className="text-blue-700 mt-2 text-xs">
                              Current: <strong>{ccy} {(draftParams.equityContribution / 1000000).toFixed(1)}M</strong> 
                              ({((draftParams.equityContribution / (draftParams.equityContribution + draftParams.requestedLoanAmount)) * 100).toFixed(1)}% of total)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <NumberField label="Entry Multiple" value={draftParams.entryMultiple} onChange={(v) => setDraftParams({...draftParams, entryMultiple: v})} min={1} max={20} step={0.1}/>
         <NumberField 
  label="Shares Outstanding" 
  value={params.sharesOutstanding || 1000000} 
  onChange={(v) => setParams({...params, sharesOutstanding: v})} 
  min={1} 
  step={1000}
/>       

</div>
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Credit Assessment & Covenants */}
          <CollapsibleCard 
            title="Credit Assessment & Covenants" 
            icon={Shield} 
            color="amber" 
            defaultOpen={false}
          >
            <Card id="credit-assessment" className="border-l-4 border-l-amber-600">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-amber-600" />
                  Credit Assessment & Covenants
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Set credit parameters and covenant thresholds
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  <SmartNumberField 
  label="Debt Tenor (Years)" 
  value={draftParams.debtTenorYears} 
  onChange={(v) => {
    setDraftParams({
      ...draftParams, 
      debtTenorYears: v,
      _editedFields: new Set([...(draftParams._editedFields || []), 'debtTenorYears'])
    });
  }}
  isAutoPop={draftParams.proposedTenor > 0}
  benchmarkValue={draftParams.proposedTenor}
  helper={draftParams.proposedTenor > 0 
    ? `Auto-populated from New Facility tenor (${draftParams.proposedTenor} years)` 
    : "Manually set debt tenor"}
  min={1} 
  max={30}
  step={1}
/>

<NumberField 
  label="Interest Only Years" 
  value={draftParams.interestOnlyYears} 
  onChange={(v) => setDraftParams({...draftParams, interestOnlyYears: v})} 
  min={0} 
  max={draftParams.debtTenorYears}
/>

<SmartNumberField 
  label="Min DSCR" 
  value={draftParams.minDSCR} 
  onChange={(v) => {
    setDraftParams({
      ...draftParams, 
      minDSCR: v,
      _editedFields: new Set([...(draftParams._editedFields || []), 'minDSCR'])
    });
  }}
  isAutoPop={true}
  benchmarkValue={draftParams._industryBenchmarks?.minDSCR}
  helper={`${draftParams.industry} industry standard: ${draftParams._industryBenchmarks?.minDSCR?.toFixed(2) || 'N/A'}`}
  min={1} 
  max={5} 
  step={0.1}
/>

<SmartNumberField 
  label="Target ICR" 
  value={draftParams.targetICR} 
  onChange={(v) => {
    setDraftParams({
      ...draftParams, 
      targetICR: v,
      _editedFields: new Set([...(draftParams._editedFields || []), 'targetICR'])
    });
  }}
  isAutoPop={true}
  benchmarkValue={draftParams._industryBenchmarks?.targetICR}
  helper={`${draftParams.industry} industry standard: ${draftParams._industryBenchmarks?.targetICR?.toFixed(2) || 'N/A'}`}
  min={1} 
  max={10} 
  step={0.1}
/>

<SmartNumberField 
  label="Max ND/EBITDA" 
  value={draftParams.maxNDToEBITDA} 
  onChange={(v) => {
    setDraftParams({
      ...draftParams, 
      maxNDToEBITDA: v,
      _editedFields: new Set([...(draftParams._editedFields || []), 'maxNDToEBITDA'])
    });
  }}
  isAutoPop={true}
  benchmarkValue={draftParams._industryBenchmarks?.maxNDToEBITDA}
  helper={`${draftParams.industry} industry standard: ${draftParams._industryBenchmarks?.maxNDToEBITDA?.toFixed(2) || 'N/A'}`}
  min={1} 
  max={10} 
  step={0.1}
/>
                  {/* Credit Assessment Fields */}
                  <div className="space-y-2">
  <Label className="text-sm font-semibold text-slate-700">Industry</Label>
  <select
    value={draftParams.industry}
    onChange={(e) => {
      const newIndustry = e.target.value;
      const benchmarks = getBenchmarksForIndustry(newIndustry);
      
      setDraftParams({
        ...draftParams, 
        industry: newIndustry,
        // Auto-apply benchmarks if not edited
        minDSCR: !draftParams._editedFields?.has('minDSCR') ? benchmarks.minDSCR : draftParams.minDSCR,
        targetICR: !draftParams._editedFields?.has('targetICR') ? benchmarks.targetICR : draftParams.targetICR,
        maxNDToEBITDA: !draftParams._editedFields?.has('maxNDToEBITDA') ? benchmarks.maxNDToEBITDA : draftParams.maxNDToEBITDA,
        _industryBenchmarks: benchmarks
      });
    }}
 className="w-full h-10 text-sm border border-slate-300 rounded-md focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200"

  >
    <option value="Manufacturing">Manufacturing</option>
    <option value="Services">Services</option>
    <option value="Retail">Retail</option>
    <option value="Technology">Technology</option>
    <option value="Healthcare">Healthcare</option>
    <option value="Real Estate">Real Estate</option>
    <option value="Financial Services">Financial Services</option>
    <option value="Agriculture">Agriculture</option>
    <option value="Energy">Energy</option>
    <option value="Transportation">Transportation</option>
  </select>
  <p className="text-xs text-slate-500">
    Changing industry will auto-update covenant ratios to industry standards
  </p>
</div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Credit History</Label>
                    <select
                      value={draftParams.creditHistory}
                      onChange={(e) => setDraftParams({...draftParams, creditHistory: e.target.value})}
                      className="w-full h-10 text-sm border-2 border-slate-300 rounded-md focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200"
                    >
                      <option value="Clean">Clean</option>
                      <option value="Minor Delinquencies">Minor Delinquencies</option>
                      <option value="Restructured">Restructured</option>
                      <option value="Default History">Default History</option>
                    </select>
                  </div>
                  
                  <MoneyField label="Total Assets" value={draftParams.totalAssets} onChange={(v) => setDraftParams({...draftParams, totalAssets: v})} ccy={ccy}/>
                  <MoneyField label="Collateral Value" value={draftParams.collateralValue} onChange={(v) => setDraftParams({...draftParams, collateralValue: v})} ccy={ccy}/>
                  <NumberField label="Business Age (Years)" value={draftParams.businessAge} onChange={(v) => setDraftParams({...draftParams, businessAge: v})} min={0} max={100}/>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Management Experience</Label>
                    <select
                      value={draftParams.managementExperience}
                      onChange={(e) => setDraftParams({...draftParams, managementExperience: e.target.value})}
                      className="w-full h-10 text-sm border-2 border-slate-300 rounded-md focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200"
                    >
                      <option value="Strong">Strong</option>
                      <option value="Adequate">Adequate</option>
                      <option value="Limited">Limited</option>
                      <option value="New Team">New Team</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Opening Debt Schedule - Updated Section */}
<CollapsibleCard 
  title="Opening Debt Schedule" 
  icon={Calendar} 
  color="purple" 
  defaultOpen={false}
>
  <Card id="opening-debt-schedule" className="border-l-4 border-l-purple-600">
    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
      <CardTitle className="flex items-center gap-2">
        <Calendar className="w-6 h-6 text-purple-600" />
        Opening Debt Schedule & Terms
      </CardTitle>
      <p className="text-sm text-slate-600 mt-2">
        Configure existing debt terms for accurate covenant calculations
      </p>
    </CardHeader>
  <CardContent className="p-4 sm:p-6">
  <div className="space-y-6">
    {/* Multi-Tranche Toggle */}
    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Multiple Debt Tranches
          </h4>
          <p className="text-xs text-purple-700 mt-1">
            Enable this if the company has multiple existing loans with different terms (e.g., senior + subordinated debt)
          </p>
        </div>

        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input 
            type="checkbox" 
            checked={draftParams.hasMultipleTranches}
            onChange={(e) => {
              const isEnabled = e.target.checked;
              setDraftParams({
                ...draftParams, 
                hasMultipleTranches: isEnabled,
                debtTranches: isEnabled 
                  ? (draftParams.debtTranches?.length > 0 
                      ? draftParams.debtTranches 
                      : [{
                          id: Date.now(),
                          name: "Primary Debt",
                          amount: draftParams.openingDebt || 0,
                          rate: draftParams.interestRate || 0.10,
                          maturityDate: draftParams.openingDebtMaturityDate || new Date(Date.now() + 5*365*24*60*60*1000).toISOString().split('T')[0],
                          amortizationType: draftParams.openingDebtAmortizationType || 'amortizing',
                          tenorYears: draftParams.debtTenorYears || 5,
                          paymentFrequency: draftParams.openingDebtPaymentFrequency || 'Quarterly',
                          seniority: "Senior Secured",
                          interestOnlyYears: draftParams.interestOnlyYears || 0
                        }])
                  : draftParams.debtTranches // preserve when OFF
              });
            }}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600 shadow-sm"></div>
        </label>
      </div>
    </div>

    {/* Conditional: Multi-Tranche OR Single-Debt */}
    {draftParams.hasMultipleTranches ? (
      <>
        {/* Multi-Tranche Table */}
        <DebtTrancheManager 
          tranches={draftParams.debtTranches || []}
          onChange={(tranches) => setDraftParams({ ...draftParams, debtTranches: tranches })}
          ccy={ccy}
        />

        {/* Blended Summary */}
        {draftParams.debtTranches?.length > 0 && (
          <BlendedDebtMetrics 
            tranches={draftParams.debtTranches} 
            ccy={ccy}
            startYear={draftParams.startYear}
            projectionYears={draftParams.years}
          />
        )}
      </>
    ) : (
      <>
        {/* SINGLE DEBT - Your existing inputs (kept) */}
        {/* Debt Amount & Terms */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">
            Debt Amount & Key Terms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <MoneyField 
              label="Opening Debt Amount" 
              value={draftParams.openingDebt} 
              onChange={(v) => setDraftParams({ ...draftParams, openingDebt: v })} 
              ccy={ccy}
            />
            <PctField 
              label="Interest Rate" 
              value={draftParams.interestRate} 
              onChange={(v) => setDraftParams({ ...draftParams, interestRate: v })}
            />
            <NumberField 
              label="Original Tenor (Years)" 
              value={draftParams.debtTenorYears} 
              onChange={(v) => setDraftParams({ ...draftParams, debtTenorYears: v })} 
              min={1} 
              max={30}
            />
          </div>
        </div>

        {/* Amortization Structure */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">
            Amortization Structure
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Amortization Type</Label>
              <select
                value={draftParams.openingDebtAmortizationType || 'amortizing'}
                onChange={(e) => setDraftParams({ ...draftParams, openingDebtAmortizationType: e.target.value })}
                className="w-full h-10 px-3 text-sm border-2 border-slate-300 rounded-md focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              >
                <option value="amortizing">Amortizing (Principal + Interest)</option>
                <option value="interest-only">Interest-Only</option>
                <option value="bullet">Bullet Payment (All at Maturity)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Payment Frequency</Label>
              <select
                value={draftParams.openingDebtPaymentFrequency || 'Quarterly'}
                onChange={(e) => setDraftParams({ ...draftParams, openingDebtPaymentFrequency: e.target.value })}
                className="w-full h-10 px-3 text-sm border-2 border-slate-300 rounded-md focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Semi-Annually">Semi-Annually</option>
                <option value="Annually">Annually</option>
              </select>
            </div>
          </div>

          {/* Calculated Annual Debt Service */}
          {draftParams.openingDebt > 0 && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-purple-900 mb-2">
                    Calculated Annual Debt Service
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-purple-700 font-semibold">Interest Payment</p>
                      <p className="text-lg font-bold text-purple-900">
                        {currencyFmtMM(draftParams.openingDebt * draftParams.interestRate, ccy)}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-700 font-semibold">Principal Payment</p>
                      <p className="text-lg font-bold text-purple-900">
                        {draftParams.openingDebtAmortizationType === 'amortizing' 
                          ? currencyFmtMM(draftParams.openingDebt / draftParams.debtTenorYears, ccy)
                          : currencyFmtMM(0, ccy)}
                      </p>
                    </div>
                    <div>
                      <p className="text-purple-700 font-semibold">Total Annual Debt Service</p>
                      <p className="text-xl font-bold text-purple-900">
                        {draftParams.openingDebtAmortizationType === 'amortizing'
                          ? currencyFmtMM(
                              (draftParams.openingDebt * draftParams.interestRate) + 
                              (draftParams.openingDebt / draftParams.debtTenorYears), 
                              ccy
                            )
                          : currencyFmtMM(draftParams.openingDebt * draftParams.interestRate, ccy)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Important Dates */}
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">
            Important Dates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Origination Date</Label>
              <Input
                type="date"
                value={draftParams.openingDebtStartDate}
                onChange={(e) => setDraftParams({ ...draftParams, openingDebtStartDate: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className="h-10 text-sm border-2 border-slate-300 rounded-md focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Maturity Date</Label>
              <Input
                type="date"
                value={draftParams.openingDebtMaturityDate}
                onChange={(e) => setDraftParams({ ...draftParams, openingDebtMaturityDate: e.target.value })}
                min={draftParams.openingDebtStartDate}
                className="h-10 text-sm border-2 border-slate-300 rounded-md focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Years Remaining</Label>
              <div className="h-10 px-3 flex items-center bg-slate-50 border-2 border-slate-200 rounded-md text-sm font-semibold text-slate-700">
                {draftParams.openingDebtMaturityDate 
                  ? ((new Date(draftParams.openingDebtMaturityDate) - new Date()) / (365*24*60*60*1000)).toFixed(1) + ' years' 
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </>
    )}
  </div>
</CardContent>

  </Card>
</CollapsibleCard>


          {/* Business & Credit Information */}
          <CollapsibleCard 
            title="Business & Credit Information" 
            icon={Building} 
            color="purple" 
            defaultOpen={false}
          >
            <Card id="business-credit-info" className="border-l-4 border-l-purple-600">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-6 h-6 text-purple-600" />
                  Business & Credit Information
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Provide detailed business and credit analysis information
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Company Information */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Company Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextField label="Company Legal Name" value={draftParams.companyLegalName} onChange={(v) => setDraftParams({...draftParams, companyLegalName: v})} placeholder="Enter full legal name"/>
                    <TextField label="Company Operating Name" value={draftParams.companyOperatingName} onChange={(v) => setDraftParams({...draftParams, companyOperatingName: v})} placeholder="Enter trading name"/>
                    <TextField label="Company Address" value={draftParams.companyAddress} onChange={(v) => setDraftParams({...draftParams, companyAddress: v})} placeholder="Registered address"/>
                    <TextField label="Tax ID/TRN" value={draftParams.taxId} onChange={(v) => setDraftParams({...draftParams, taxId: v})} placeholder="Tax registration number"/>
                  </div>
                </div>

                {/* Loan Purpose & Structure */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Loan Purpose & Structure</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Loan Purpose" value={draftParams.loanPurpose} onChange={(v) => setDraftParams({...draftParams, loanPurpose: v})} placeholder="Detailed description of loan purpose" rows={3}/>
                    <TextAreaField label="Use of Proceeds" value={draftParams.useOfProceeds} onChange={(v) => setDraftParams({...draftParams, useOfProceeds: v})} placeholder="Breakdown of how funds will be used" rows={3}/>
                    <TextField label="Deal Structure" value={draftParams.dealStructure} onChange={(v) => setDraftParams({...draftParams, dealStructure: v})} placeholder="e.g., Term loan, revolving credit"/>
                  </div>
                </div>

                {/* Business Description */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Business Description</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Business Model" value={draftParams.businessModel} onChange={(v) => setDraftParams({...draftParams, businessModel: v})} placeholder="Description of business model and operations" rows={3}/>
                    <TextAreaField label="Products & Services" value={draftParams.productsServices} onChange={(v) => setDraftParams({...draftParams, productsServices: v})} placeholder="Key products and services offered" rows={3}/>
                    <TextAreaField label="Key Customers" value={draftParams.keyCustomers} onChange={(v) => setDraftParams({...draftParams, keyCustomers: v})} placeholder="Major customers and concentration" rows={3}/>
                    <TextAreaField label="Competitive Position" value={draftParams.competitivePosition} onChange={(v) => setDraftParams({...draftParams, competitivePosition: v})} placeholder="Market position and competitive advantages" rows={3}/>
                    <TextField label="Market Share" value={draftParams.marketShare} onChange={(v) => setDraftParams({...draftParams, marketShare: v})} placeholder="Estimated market share and position"/>
                  </div>
                </div>

                {/* Management Team */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Management Team</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Key Management Names & Roles" value={draftParams.keyManagementNames} onChange={(v) => setDraftParams({...draftParams, keyManagementNames: v})} placeholder="Key management team members and their roles" rows={3}/>
                    <TextAreaField label="Management Track Record" value={draftParams.managementTrackRecord} onChange={(v) => setDraftParams({...draftParams, managementTrackRecord: v})} placeholder="Experience and track record of management team" rows={3}/>
                  </div>
                </div>

                {/* Credit Analysis */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Credit Analysis</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Credit Strengths" value={draftParams.creditStrengths} onChange={(v) => setDraftParams({...draftParams, creditStrengths: v})} placeholder="Key credit strengths and positive factors" rows={3}/>
                    <TextAreaField label="Key Risks" value={draftParams.keyRisks} onChange={(v) => setDraftParams({...draftParams, keyRisks: v})} placeholder="Primary risks and concerns" rows={3}/>
                    <TextAreaField label="Mitigating Factors" value={draftParams.mitigatingFactors} onChange={(v) => setDraftParams({...draftParams, mitigatingFactors: v})} placeholder="Risk mitigation strategies and factors" rows={3}/>
                  </div>
                </div>

                {/* Collateral */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Collateral</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextAreaField label="Collateral Description" value={draftParams.collateralDescription} onChange={(v) => setDraftParams({...draftParams, collateralDescription: v})} placeholder="Detailed description of collateral" rows={3}/>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Lien Position</Label>
                        <select
                          value={draftParams.lienPosition}
                          onChange={(e) => setDraftParams({...draftParams, lienPosition: e.target.value})}
                          className="w-full h-10 text-sm border-slate-300 rounded-md focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                        >
                          <option value="First Lien">First Lien</option>
                          <option value="Second Lien">Second Lien</option>
                          <option value="Third Lien">Third Lien</option>
                          <option value="Unsecured">Unsecured</option>
                        </select>
                      </div>
                      <MoneyField label="Appraisal Value" value={draftParams.appraisalValue} onChange={(v) => setDraftParams({...draftParams, appraisalValue: v})} ccy={ccy}/>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Appraisal Date</Label>
                        <Input
                          type="date"
                          value={draftParams.appraisalDate}
                          onChange={(e) => setDraftParams({...draftParams, appraisalDate: e.target.value})}
                          className="h-10 text-sm border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relationship Information */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Relationship Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TextField label="Relationship Manager" value={draftParams.relationshipManager} onChange={(v) => setDraftParams({...draftParams, relationshipManager: v})} placeholder="Primary relationship manager"/>
                    <NumberField label="Existing Relationship (Years)" value={draftParams.existingRelationshipYears} onChange={(v) => setDraftParams({...draftParams, existingRelationshipYears: v})} min={0} max={100}/>
                    <TextField label="Referral Source" value={draftParams.referralSource} onChange={(v) => setDraftParams({...draftParams, referralSource: v})} placeholder="How this deal was referred"/>
                  </div>
                </div>

                {/* Financial Commentary */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Financial Commentary</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Revenue Commentary" value={draftParams.revenueCommentary} onChange={(v) => setDraftParams({...draftParams, revenueCommentary: v})} placeholder="Revenue trends, drivers, and assumptions" rows={3}/>
                    <TextAreaField label="Margin Commentary" value={draftParams.marginCommentary} onChange={(v) => setDraftParams({...draftParams, marginCommentary: v})} placeholder="Margin analysis and cost structure" rows={3}/>
                    <TextAreaField label="Working Capital Commentary" value={draftParams.workingCapitalCommentary} onChange={(v) => setDraftParams({...draftParams, workingCapitalCommentary: v})} placeholder="Working capital trends and management" rows={3}/>
                    <TextAreaField label="Seasonality Factors" value={draftParams.seasonalityFactors} onChange={(v) => setDraftParams({...draftParams, seasonalityFactors: v})} placeholder="Seasonal business patterns and impacts" rows={3}/>
                  </div>
                </div>

                {/* Exit Strategy */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Exit Strategy</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Primary Repayment Source" value={draftParams.primaryRepaymentSource} onChange={(v) => setDraftParams({...draftParams, primaryRepaymentSource: v})} placeholder="Primary source of loan repayment" rows={3}/>
                    <TextAreaField label="Secondary Repayment Source" value={draftParams.secondaryRepaymentSource} onChange={(v) => setDraftParams({...draftParams, secondaryRepaymentSource: v})} placeholder="Secondary/backup repayment sources" rows={3}/>
                  </div>
                </div>

                {/* Conditions & Monitoring */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">Conditions & Monitoring</h3>
                  <div className="grid grid-cols-1 gap-6">
                    <TextAreaField label="Conditions Precedent" value={draftParams.conditionsPrecedent} onChange={(v) => setDraftParams({...draftParams, conditionsPrecedent: v})} placeholder="Conditions to be met before disbursement" rows={3}/>
                    <TextAreaField label="Reporting Requirements" value={draftParams.reportingRequirements} onChange={(v) => setDraftParams({...draftParams, reportingRequirements: v})} placeholder="Ongoing reporting and monitoring requirements" rows={3}/>
                    <TextField label="Site Visit Frequency" value={draftParams.siteVisitFrequency} onChange={(v) => setDraftParams({...draftParams, siteVisitFrequency: v})} placeholder="e.g., Quarterly, Semi-annually"/>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleCard>
        </div>
      )}

      {/* Main Analysis Tabs with improved styling */}
     <Tabs 
  defaultValue="capital-structure" 
  value={activeTab}
  onValueChange={setActiveTab}
  className="space-y-6"
>
        <TabsList className="flex overflow-x-auto lg:grid lg:grid-cols-7 w-full bg-slate-100 p-1 rounded-lg shadow-sm scrollbar-hide">
  <TabsTrigger value="capital-structure" className="flex-shrink-0 text-sm whitespace-nowrap">
    <TrendingUp className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Capital Structure</span>
    <span className="sm:hidden">Capital</span>
  </TabsTrigger>
  <TabsTrigger value="credit-dashboard" className="flex-shrink-0 text-sm whitespace-nowrap">
    <BarChart3 className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Credit Dashboard</span>
    <span className="sm:hidden">Credit</span>
  </TabsTrigger>
  <TabsTrigger value="scenario-comparison" className="flex-shrink-0 text-sm whitespace-nowrap">
    <Shield className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Scenario Analysis</span>
    <span className="sm:hidden">Scenarios</span>
  </TabsTrigger>
  <TabsTrigger value="stress-testing" className="flex-shrink-0 text-sm whitespace-nowrap">
    <Building className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Stress Testing</span>
    <span className="sm:hidden">Stress</span>
  </TabsTrigger>
  <TabsTrigger value="loan-metrics" className="flex-shrink-0 text-sm whitespace-nowrap">
    <DollarSign className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Loan Metrics</span>
    <span className="sm:hidden">Metrics</span>
  </TabsTrigger>
  <TabsTrigger value="valuation" className="flex-shrink-0 text-sm whitespace-nowrap">
    <TrendingUp className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Valuation</span>
    <span className="sm:hidden">Value</span>
  </TabsTrigger>
  <TabsTrigger value="report-generator" className="flex-shrink-0 text-sm whitespace-nowrap">
    <FileText className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Reports</span>
    <span className="sm:hidden">Reports</span>
  </TabsTrigger>
</TabsList>
        
        {/* Capital Structure Analysis */}
        <TabsContent value="capital-structure" className="space-y-6">
          <div ref={financialAssumptionsRef}>
            <CapitalStructureAnalysis 
              projection={projections.base}
              params={params}
              ccy={ccy}
            />
          </div>
        </TabsContent>

        {/* Credit Dashboard */}
        <TabsContent value="credit-dashboard" className="space-y-6">
          <div ref={creditDashboardRef}>
            <CreditDashboard 
              projections={projections.base}
              params={params}
              ccy={ccy}
            />
          </div>
        </TabsContent>

        {/* Scenario Comparison */}
        <TabsContent value="scenario-comparison" className="space-y-6">
          <div ref={scenarioComparisonRef}>
            <ScenarioComparison 
              projections={projections}
              ccy={ccy}
              facilityParams={facilityParams}
            />
          </div>
        </TabsContent>

        {/* Stress Testing */}
        <TabsContent value="stress-testing" className="space-y-6">
          {projections?.base ? (
            <DebtStressTesting 
              params={params}
              ccy={ccy}
              baseProjection={projections.base}
              historicalData={historicalData}
              newFacilityParams={{
                amount: params.requestedLoanAmount,
                rate: params.proposedPricing,
                tenor: params.proposedTenor,
                paymentFrequency: params.paymentFrequency,
                balloonPercentage: params.balloonPercentage,
                dayCountConvention: params.dayCountConvention
              }}
            />
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <p className="text-yellow-800 font-semibold">Loading stress testing data...</p>
            </div>
          )}
        </TabsContent>

        {/* Loan Metrics */}
        <TabsContent value="loan-metrics" className="space-y-6">
          <div ref={loanMetricsRef}>
            <LoanMetricsTable 
              projection={projections.base}
              params={params}
              ccy={ccy}
            />
          </div>
        </TabsContent>

       <TabsContent value="valuation" className="space-y-6">
  <ValuationTab 
    projections={projections.base}
    params={params}
    ccy={ccy}
  />
</TabsContent>


        {/* Report Generator */}
        <TabsContent value="report-generator" className="space-y-6">
          <ReportGenerator 
            projections={projections}
            params={params}
            historicalData={historicalData}
            ccy={ccy}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}