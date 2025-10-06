import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./Card";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";
import { Label } from "./Label.jsx";
import { ConfirmDialog } from "./ConfirmDialog";
import { calculateHistoricalAssumptions } from "../utils/calculations";
import { 
  calculateAllFinancialMetrics, 
  calculateMonthlyCashFlowSummary
} from "../utils/financialCalculations";
import { validateFinancialInputs } from "../utils/validation";import { currencyFmt, currencyFmtMM, pctFmt, numFmt } from "../utils/formatters";
import { Upload, Download, AlertCircle, TrendingUp, TrendingDown, Check, X } from "lucide-react";

// Helper function to format dates
function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("en-US");
  } catch {
    return date;
  }
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const initialForm = {
  year: "",
  revenue: "",
  cogs: "",
  opex: "",
  depreciation: "",
  interestExpense: "",
  taxExpense: "", // ADDED
  cash: "",
  receivables: "",
  inventory: "",
  otherCurrentAssets: "",
  ppe: "",
  accountsPayable: "",
  accruedExp: "",
  shortTermDebt: "",
  longTermDebt: "",
  opCashFlow: "",
  capex: "",
  investCF: "",
  financeCF: "",
  monthlyCashFlows: Array(12).fill(null).map(() => ({ 
    operatingCashFlow: null,
    revenue: null,
    workingCapitalChange: null 
  }))
};

export function HistoricalDataTab({
  historicalData,
  setHistoricalData,
  onApplyAssumptions,
  ccy,
}) {
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showMonthlyData, setShowMonthlyData] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // FIXED: Calculate derived metrics using centralized utility
  const derivedMetrics = useMemo(() => {
    return calculateAllFinancialMetrics({
      revenue: Number(form.revenue) || 0,
      cogs: Number(form.cogs) || 0,
      opex: Number(form.opex) || 0,
      depreciation: Number(form.depreciation) || 0,
      interestExpense: Number(form.interestExpense) || 0,
      taxExpense: Number(form.taxExpense) || 0,
      cash: Number(form.cash) || 0,
      receivables: Number(form.receivables) || 0,
      inventory: Number(form.inventory) || 0,
      otherCurrentAssets: Number(form.otherCurrentAssets) || 0,
      ppe: Number(form.ppe) || 0,
      accountsPayable: Number(form.accountsPayable) || 0,
      accruedExp: Number(form.accruedExp) || 0,
      shortTermDebt: Number(form.shortTermDebt) || 0,
      longTermDebt: Number(form.longTermDebt) || 0,
      opCashFlow: Number(form.opCashFlow) || 0,
      capex: Number(form.capex) || 0,
    });
  }, [form]);

  // FIXED: Validation logic using centralized utility
  const validateForm = () => {
    return validateFinancialInputs({
      year: form.year,
      revenue: Number(form.revenue) || 0,
      cogs: Number(form.cogs) || 0,
      opex: Number(form.opex) || 0,
    });
  };

  // Add Year handler
  const handleAddYear = () => {
    const nextYear = historicalData.length > 0 
      ? Math.max(...historicalData.map(d => d.year)) + 1
      : new Date().getFullYear() - 1;
      
    setForm({ 
      ...initialForm, 
      year: nextYear,
    });
    setEditIdx(historicalData.length);
    setValidationErrors([]);
  };

  // Edit handler
  const handleEdit = (idx) => {
    const yearData = historicalData[idx];
    setForm({ 
      ...yearData,
      monthlyCashFlows: yearData.monthlyCashFlows || Array(12).fill(null).map(() => ({ 
        operatingCashFlow: null,
        revenue: null,
        workingCapitalChange: null 
      }))
    });
    setEditIdx(idx);
    setValidationErrors([]);
  };

  // FIXED: Save handler using centralized utilities
  const handleSave = () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Sanitize monthly entries (numbers or null)
    const monthlyCashFlows = (form.monthlyCashFlows || []).map(month => ({
      operatingCashFlow: month?.operatingCashFlow === "" ? null : (Number(month?.operatingCashFlow) || null),
      revenue: month?.revenue === "" ? null : (Number(month?.revenue) || null),
      workingCapitalChange: month?.workingCapitalChange === "" ? null : (Number(month?.workingCapitalChange) || null)
    }));

    // Calculate all financial metrics using utility functions
    const inputs = {
      revenue: Number(form.revenue) || 0,
      cogs: Number(form.cogs) || 0,
      opex: Number(form.opex) || 0,
      depreciation: Number(form.depreciation) || 0,
      interestExpense: Number(form.interestExpense) || 0,
      taxExpense: Number(form.taxExpense) || 0,
      cash: Number(form.cash) || 0,
      receivables: Number(form.receivables) || 0,
      inventory: Number(form.inventory) || 0,
      otherCurrentAssets: Number(form.otherCurrentAssets) || 0,
      ppe: Number(form.ppe) || 0,
      accountsPayable: Number(form.accountsPayable) || 0,
      accruedExp: Number(form.accruedExp) || 0,
      shortTermDebt: Number(form.shortTermDebt) || 0,
      longTermDebt: Number(form.longTermDebt) || 0,
      opCashFlow: Number(form.opCashFlow) || 0,
      capex: Number(form.capex) || 0,
    };

    const calculatedMetrics = calculateAllFinancialMetrics(inputs);
    const monthlySummary = calculateMonthlyCashFlowSummary(monthlyCashFlows);

    // Use monthly total if provided and reasonable, otherwise use annual input
    const finalOpCashFlow = monthlySummary.hasMonthlyData && Math.abs(monthlySummary.totalMonthlyOpCashFlow) > 0
      ? monthlySummary.totalMonthlyOpCashFlow 
      : inputs.opCashFlow;

    const updated = [...historicalData];
    updated[editIdx] = {
      ...form,
      dateEntered: form.dateEntered || new Date(),
      year: Number(form.year),

      // Raw inputs
      ...inputs,

      // Calculated metrics (EBITDA, margins, WC, ratios, etc.)
      ...calculatedMetrics,

      // Monthly summaries (hasMonthlyData, monthsWithData, totals, burns, minMonthlyCashFlow, etc.)
      ...monthlySummary,

      // Store sanitized monthly rows and the chosen op CF
      opCashFlow: finalOpCashFlow,
      monthlyCashFlows,

      // Keep these explicit if you want to persist them as entered
      investCF: Number(form.investCF) || 0,
      financeCF: Number(form.financeCF) || 0,
    };
    
    setHistoricalData(updated.sort((a, b) => a.year - b.year)); // Sort by year
    setEditIdx(null);
    setForm(initialForm);
    setShowMonthlyData(false);
    setValidationErrors([]);
  };

  // Cancel handler
  const handleCancel = () => {
    setEditIdx(null);
    setForm(initialForm);
    setShowMonthlyData(false);
    setValidationErrors([]);
  };

  // Delete handler
  const handleDelete = (idx) => setDeleteIdx(idx);
  const confirmDelete = () => {
    setHistoricalData(historicalData.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };
  const cancelDelete = () => setDeleteIdx(null);

  // Controlled input helper
  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Monthly data input handlers
  const handleMonthlyChange = (monthIndex, field, value) => {
    const updatedMonthly = [...form.monthlyCashFlows];
    updatedMonthly[monthIndex] = {
      ...updatedMonthly[monthIndex],
      [field]: value === "" ? null : Number(value)
    };
    setForm((f) => ({ ...f, monthlyCashFlows: updatedMonthly }));
  };

  // Auto-distribute annual values across months
  const autoDistributeRevenue = () => {
    const annualRevenue = Number(form.revenue) || 0;
    if (annualRevenue === 0) return;

    const monthlyRevenue = annualRevenue / 12;
    const updatedMonthly = form.monthlyCashFlows.map(month => ({
      ...month,
      revenue: monthlyRevenue
    }));

    setForm((f) => ({ ...f, monthlyCashFlows: updatedMonthly }));
  };

  // Calculate trend analysis
  const trendAnalysis = useMemo(() => {
    if (historicalData.length < 2) return null;
    
    const sorted = [...historicalData].sort((a, b) => a.year - b.year);
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    
    return {
      revenueGrowth: previous.revenue > 0 ? (latest.revenue - previous.revenue) / previous.revenue : 0,
      ebitdaGrowth: previous.ebitda > 0 ? (latest.ebitda - previous.ebitda) / previous.ebitda : 0,
      marginTrend: (latest.ebitdaMargin || 0) - (previous.ebitdaMargin || 0),
    };
  }, [historicalData]);

  // Summary logic
  const validYears = historicalData.filter((d) => d.revenue > 0);
  const hasValidData = validYears.length >= 2;
  const assumptions = hasValidData ? calculateHistoricalAssumptions(historicalData) : null;

  // Historical burn rate summary
  const historicalBurnSummary = useMemo(() => {
    return historicalData.reduce((acc, year) => {
      if (year.avgMonthlyBurn > 0) {
        acc.totalBurnYears++;
        acc.totalMonthlyBurn += year.avgMonthlyBurn;
      }
      if (year.hasMonthlyData) {
        acc.yearsWithMonthlyData++;
        acc.totalMonthsWithData += year.monthsWithData;
      }
      return acc;
    }, { totalBurnYears: 0, totalMonthlyBurn: 0, yearsWithMonthlyData: 0, totalMonthsWithData: 0 });
  }, [historicalData]);

  const avgHistoricalBurn = historicalBurnSummary.totalBurnYears > 0 
    ? historicalBurnSummary.totalMonthlyBurn / historicalBurnSummary.totalBurnYears 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-l-4 border-l-blue-600 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <div className="flex flex-row justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Historical Financial Data
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Enter 2-3 years of historical data to establish baseline assumptions and validate projections
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddYear}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 font-semibold shadow-md"
              >
                + Add Year
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          {/* Historical Data Cards */}
          <div className="space-y-4">
            {historicalData.length === 0 ? (
              <div className="text-center p-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No historical data yet</p>
                <p className="text-sm text-slate-500 mt-2">Add 2-3 years of historical financial data to improve projection accuracy</p>
              </div>
            ) : (
              historicalData.map((yearData, idx) => (
                <div
                  key={yearData.year || idx}
                  className="bg-white rounded-lg shadow-sm border-2 border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">
                        {yearData.year}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">
                          Entered: {formatDate(yearData.dateEntered) || formatDate(new Date())}
                        </div>
                        {yearData.hasMonthlyData && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-1">
                            <Check className="w-3 h-3" />
                            {yearData.monthsWithData} months of granular data
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 font-semibold shadow-sm"
                        onClick={() => handleEdit(idx)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 font-semibold shadow-sm"
                        onClick={() => handleDelete(idx)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Financial Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <MetricCard label="Revenue" value={currencyFmtMM(yearData.revenue, ccy)} />
                    <MetricCard label="EBITDA" value={currencyFmtMM(yearData.ebitda, ccy)} />
                    <MetricCard label="Net Income" value={currencyFmtMM(yearData.netIncome, ccy)} />
                    <MetricCard 
                      label="Op Cash Flow" 
                      value={currencyFmtMM(yearData.opCashFlow, ccy)}
                      valueColor={yearData.opCashFlow < 0 ? 'text-red-600' : 'text-emerald-600'}
                    />
                    <MetricCard label="EBITDA Margin" value={pctFmt(yearData.ebitdaMargin || 0)} />
                    {yearData.avgMonthlyBurn > 0 && (
                      <MetricCard 
                        label="Monthly Burn" 
                        value={currencyFmt(yearData.avgMonthlyBurn, ccy)}
                        valueColor="text-orange-600"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 border-b z-10">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Financial Data for {form.year}
                </h2>
                <div className="flex gap-2">
                  {!showMonthlyData && (
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                      onClick={() => setShowMonthlyData(!showMonthlyData)}
                    >
                      Add Monthly Data
                    </Button>
                  )}
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    onClick={handleSave}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Year
                  </Button>
                  <Button
                    className="bg-slate-600 hover:bg-slate-700 text-white font-semibold"
                    onClick={handleCancel}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-red-800 mb-2">Please fix the following errors:</div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                        {validationErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Calculated Metrics Summary */}
              <div className="mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-sm mb-3 text-slate-800">Calculated Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <div className="text-slate-600">Gross Margin</div>
                    <div className="font-bold text-slate-800">{pctFmt(derivedMetrics.grossMargin)}</div>
                  </div>
                  <div>
                    <div className="text-slate-600">EBITDA Margin</div>
                    <div className={`font-bold ${
                      derivedMetrics.ebitdaMargin > 0.2 ? 'text-emerald-600' :
                      derivedMetrics.ebitdaMargin > 0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {pctFmt(derivedMetrics.ebitdaMargin)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600">Net Margin</div>
                    <div className="font-bold text-slate-800">{pctFmt(derivedMetrics.netMargin)}</div>
                  </div>
                  <div>
                    <div className="text-slate-600">Working Capital</div>
                    <div className="font-bold text-slate-800">{currencyFmtMM(derivedMetrics.workingCapital, ccy)}</div>
                  </div>
                  <div>
                    <div className="text-slate-600">Current Ratio</div>
                    <div className={`font-bold ${
                      derivedMetrics.currentRatio >= 1.5 ? 'text-emerald-600' :
                      derivedMetrics.currentRatio >= 1.0 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {numFmt(derivedMetrics.currentRatio)}x
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600">Free Cash Flow</div>
                    <div className={`font-bold ${derivedMetrics.freeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {currencyFmtMM(derivedMetrics.freeCashFlow, ccy)}
                    </div>
                  </div>
                </div>
              </div>

              {!showMonthlyData ? (
                // Annual Data View
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Income Statement */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-5 rounded-lg border-2 border-blue-200">
                    <div className="font-bold mb-4 text-blue-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Income Statement
                    </div>
                    
                    <FormField 
                      label="Year" 
                      value={form.year} 
                      onChange={e => handleChange("year", e.target.value)}
                      type="number"
                      required
                    />
                    
                    <FormField 
                      label="Revenue" 
                      value={form.revenue} 
                      onChange={e => handleChange("revenue", e.target.value)}
                      type="number"
                      helper="Total annual revenue"
                      required
                    />

                    <FormField 
                      label="Cost of Goods Sold (COGS)" 
                      value={form.cogs} 
                      onChange={e => handleChange("cogs", e.target.value)}
                      type="number"
                      helper="Direct costs of producing goods/services"
                    />

                    <FormField 
                      label="Operating Expenses" 
                      value={form.opex} 
                      onChange={e => handleChange("opex", e.target.value)}
                      type="number"
                      helper="SG&A, R&D, marketing, etc."
                    />

                    <FormField 
                      label="Depreciation & Amortization" 
                      value={form.depreciation} 
                      onChange={e => handleChange("depreciation", e.target.value)}
                      type="number"
                      helper="Annual depreciation expense"
                    />

                    <FormField 
                      label="Interest Expense" 
                      value={form.interestExpense} 
                      onChange={e => handleChange("interestExpense", e.target.value)}
                      type="number"
                      helper="Interest paid on debt"
                    />

                    <FormField 
                      label="Tax Expense" 
                      value={form.taxExpense} 
                      onChange={e => handleChange("taxExpense", e.target.value)}
                      type="number"
                      helper="Income tax paid"
                    />
                  </div>

                  {/* Balance Sheet - Assets */}
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-5 rounded-lg border-2 border-emerald-200">
                    <div className="font-bold mb-4 text-emerald-900">Balance Sheet - Assets</div>
                    
                    <FormField 
                      label="Cash & Cash Equivalents" 
                      value={form.cash} 
                      onChange={e => handleChange("cash", e.target.value)}
                      type="number"
                      helper="Liquid cash and short-term investments"
                    />

                    <FormField 
                      label="Accounts Receivable" 
                      value={form.receivables} 
                      onChange={e => handleChange("receivables", e.target.value)}
                      type="number"
                      helper="Money owed by customers"
                    />

                    <FormField 
                      label="Inventory" 
                      value={form.inventory} 
                      onChange={e => handleChange("inventory", e.target.value)}
                      type="number"
                      helper="Raw materials, WIP, finished goods"
                    />

                    <FormField 
                      label="Other Current Assets" 
                      value={form.otherCurrentAssets} 
                      onChange={e => handleChange("otherCurrentAssets", e.target.value)}
                      type="number"
                      helper="Prepaid expenses, other short-term assets"
                    />

                    <FormField 
                      label="Property, Plant & Equipment (Net)" 
                      value={form.ppe} 
                      onChange={e => handleChange("ppe", e.target.value)}
                      type="number"
                      helper="Net book value of fixed assets"
                    />
                  </div>

                  {/* Balance Sheet - Liabilities */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-lg border-2 border-amber-200">
                    <div className="font-bold mb-4 text-amber-900">Liabilities & Cash Flow</div>
                    
                    <FormField 
                      label="Accounts Payable" 
                      value={form.accountsPayable} 
                      onChange={e => handleChange("accountsPayable", e.target.value)}
                      type="number"
                      helper="Money owed to suppliers"
                    />

                    <FormField 
                      label="Accrued Expenses" 
                      value={form.accruedExp} 
                      onChange={e => handleChange("accruedExp", e.target.value)}
                      type="number"
                      helper="Wages payable, accrued interest, etc."
                    />

                    <FormField 
                      label="Short-term Debt" 
                      value={form.shortTermDebt} 
                      onChange={e => handleChange("shortTermDebt", e.target.value)}
                      type="number"
                      helper="Current portion of long-term debt"
                    />

                    <FormField 
                      label="Long-term Debt" 
                      value={form.longTermDebt} 
                      onChange={e => handleChange("longTermDebt", e.target.value)}
                      type="number"
                      helper="Term loans, mortgages, bonds"
                    />

                    <div className="border-t border-amber-300 my-4" />

                    <FormField 
                      label="Operating Cash Flow" 
                      value={form.opCashFlow} 
                      onChange={e => handleChange("opCashFlow", e.target.value)}
                      type="number"
                      helper="Net income + D&A ± WC changes"
                    />

                    <FormField 
                      label="Capital Expenditures" 
                      value={form.capex} 
                      onChange={e => handleChange("capex", e.target.value)}
                      type="number"
                      helper="Money spent on PP&E"
                    />
                  </div>
                </div>
              ) : (
                // Monthly Data View
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-lg border-2 border-purple-200">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="font-bold text-lg text-purple-900">Monthly Cash Flow Details</div>
                      <p className="text-sm text-purple-700 mt-1">
                        Enter monthly data for accurate burn rate and seasonality analysis
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={autoDistributeRevenue}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Auto-Distribute Revenue
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowMonthlyData(false)}
                        className="bg-slate-600 hover:bg-slate-700 text-white"
                      >
                        Back to Annual
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {form.monthlyCashFlows.map((month, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border-2 border-slate-200 hover:border-purple-300 transition-colors">
                        <div className="font-semibold mb-3 text-slate-800 flex items-center justify-between">
                          {MONTH_NAMES[index]}
                          {month.operatingCashFlow !== null && (
                            month.operatingCashFlow < 0 ? 
                              <TrendingDown className="w-4 h-4 text-red-500" /> :
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Revenue</Label>
                            <Input 
                              type="number" 
                              value={month.revenue || ""} 
                              onChange={e => handleMonthlyChange(index, "revenue", e.target.value)}
                              placeholder="0"
                              className="text-sm"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs">Op Cash Flow</Label>
                            <Input 
                              type="number" 
                              value={month.operatingCashFlow || ""} 
                              onChange={e => handleMonthlyChange(index, "operatingCashFlow", e.target.value)}
                              placeholder="0"
                              className={`text-sm ${month.operatingCashFlow < 0 ? "border-red-300 bg-red-50" : ""}`}
                            />
                          </div>
                          
                          <div>
                            <Label className="text-xs">WC Change</Label>
                            <Input 
                              type="number" 
                              value={month.workingCapitalChange || ""} 
                              onChange={e => handleMonthlyChange(index, "workingCapitalChange", e.target.value)}
                              placeholder="0"
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Monthly Summary */}
                  <div className="mt-6 p-5 bg-white rounded-lg border-2 border-purple-200">
                    <div className="font-semibold mb-3 text-purple-900">Monthly Data Summary</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="text-xs text-slate-600 mb-1">Total Revenue</div>
                        <div className="font-bold text-slate-800">
                          {currencyFmtMM(
                            form.monthlyCashFlows.reduce((sum, month) => sum + (month.revenue || 0), 0), 
                            ccy
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="text-xs text-slate-600 mb-1">Total Op Cash Flow</div>
                        <div className={`font-bold ${
                          form.monthlyCashFlows.reduce((sum, month) => sum + (month.operatingCashFlow || 0), 0) < 0 
                            ? 'text-red-600' 
                            : 'text-emerald-600'
                        }`}>
                          {currencyFmtMM(
                            form.monthlyCashFlows.reduce((sum, month) => sum + (month.operatingCashFlow || 0), 0), 
                            ccy
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="text-xs text-slate-600 mb-1">Months with Data</div>
                        <div className="font-bold text-blue-600">
                          {form.monthlyCashFlows.filter(month => month.operatingCashFlow !== null).length}/12
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded">
                        <div className="text-xs text-slate-600 mb-1">Burn Months</div>
                        <div className="font-bold text-orange-600">
                          {form.monthlyCashFlows.filter(month => month.operatingCashFlow < 0).length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trend Analysis Card */}
      {trendAnalysis && (
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Historical Trend Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrendCard
                label="Revenue Growth"
                value={pctFmt(trendAnalysis.revenueGrowth)}
                isPositive={trendAnalysis.revenueGrowth > 0}
              />
              <TrendCard
                label="EBITDA Growth"
                value={pctFmt(trendAnalysis.ebitdaGrowth)}
                isPositive={trendAnalysis.ebitdaGrowth > 0}
              />
              <TrendCard
                label="Margin Trend"
                value={`${trendAnalysis.marginTrend > 0 ? '+' : ''}${pctFmt(trendAnalysis.marginTrend)}`}
                isPositive={trendAnalysis.marginTrend > 0}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Quality Summary */}
      <Card className="border-l-4 border-l-blue-600 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-blue-600" />
            Data Quality & Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">Coverage</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {validYears.length >= 2 ? 
                    <Check className="w-4 h-4 text-emerald-600" /> : 
                    <X className="w-4 h-4 text-red-600" />
                  }
                  <span className={validYears.length >= 2 ? "text-emerald-700" : "text-red-700"}>
                    {validYears.length} year{validYears.length !== 1 && "s"} of valid data
                    {validYears.length < 2 && " (minimum 2 required)"}
                  </span>
                </li>
                {historicalBurnSummary.yearsWithMonthlyData > 0 && (
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">
                      {historicalBurnSummary.totalMonthsWithData} months of granular cash flow data
                    </span>
                  </li>
                )}
                {avgHistoricalBurn > 0 && (
                  <li className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-700">
                      Avg monthly burn: {currencyFmt(avgHistoricalBurn, ccy)}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-slate-800">What This Enables</h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  Auto-calculated baseline assumptions for projections
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  Historical trend validation against forward projections
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  Enhanced liquidity runway calculations in stress tests
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  Seasonality and burn rate pattern recognition
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteIdx !== null}
        message={`Are you sure you want to delete data for year ${historicalData[deleteIdx]?.year}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

// Helper Components
function FormField({ label, value, onChange, type = "text", helper, required }) {
  return (
    <div className="mb-3">
      <Label className="text-xs font-semibold">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input 
        type={type} 
        value={value} 
        onChange={onChange}
        className="text-sm"
      />
      {helper && <div className="text-xs text-slate-500 mt-0.5">{helper}</div>}
    </div>
  );
}

function MetricCard({ label, value, valueColor = "text-slate-800" }) {
  return (
    <div className="p-3 bg-slate-50 rounded border border-slate-200">
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      <div className={`font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

function TrendCard({ label, value, isPositive }) {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      isPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        {isPositive ? 
          <TrendingUp className="w-5 h-5 text-emerald-600" /> :
          <TrendingDown className="w-5 h-5 text-red-600" />
        }
      </div>
      <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
        {value}
      </div>
    </div>
  );
}
