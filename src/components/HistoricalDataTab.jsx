import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./Card";
import { Button } from "./Button.jsx";
import { Input } from "./Input.jsx";
import { Label } from "./Label.jsx";
import { ConfirmDialog } from "./ConfirmDialog";
import { calculateHistoricalAssumptions } from "../utils/calculations";
import { currencyFmt, currencyFmtMM, pctFmt, numFmt } from "../utils/formatters";
import { Download, Upload, AlertCircle, TrendingUp, TrendingDown, Check, X } from "lucide-react";
import { FinancialStatementUpload } from './FinancialStatementUpload';

// Helper function
function formatDate(date) {
  if (!date) return "";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("en-US");
  } catch {
    return date;
  }
}

const formatNumberForInput = (value) => {
  if (value === "" || value === null || value === undefined || value === 0 || value === "0") return "";
  const num = Number(value);
  if (isNaN(num)) return value;
  
  if (Number.isInteger(num)) {
    return num.toLocaleString('en-US');
  }
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseFormattedNumber = (formattedValue) => {
  if (formattedValue === "" || formattedValue === null || formattedValue === undefined) return "";
  return formattedValue.toString().replace(/,/g, '');
};

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
  taxExpense: "",
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
  data: historicalData = [],
  onChange: setHistoricalData,
  onApplyAssumptions,
  ccy,
}) {
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showMonthlyData, setShowMonthlyData] = useState(false);

  // HANDLER FOR AI-EXTRACTED DATA
  const handleExtractedData = (years) => {
    const newHistoricalData = [...historicalData];
    
    years.forEach(yearData => {
      const existingIndex = newHistoricalData.findIndex(d => d.year === yearData.year);
      
      const formattedYear = {
        ...yearData,
        dateEntered: new Date(),
        ebitda: yearData.revenue - yearData.cogs - yearData.opex,
        ebit: (yearData.revenue - yearData.cogs - yearData.opex) - yearData.depreciation,
        netIncome: ((yearData.revenue - yearData.cogs - yearData.opex - yearData.depreciation - yearData.interestExpense) - (yearData.taxExpense || 0)),
        totalAssets: yearData.cash + yearData.receivables + yearData.inventory + yearData.otherCurrentAssets + yearData.ppe,
        workingCapital: (yearData.cash + yearData.receivables + yearData.inventory + yearData.otherCurrentAssets) - (yearData.accountsPayable + yearData.accruedExp),
        fcf: yearData.opCashFlow - yearData.capex,
        monthlyCashFlows: Array(12).fill(null).map(() => ({ 
          operatingCashFlow: null,
          revenue: null,
          workingCapitalChange: null 
        })),
        grossMargin: yearData.revenue > 0 ? (yearData.revenue - yearData.cogs) / yearData.revenue : 0,
        ebitdaMargin: yearData.revenue > 0 ? (yearData.revenue - yearData.cogs - yearData.opex) / yearData.revenue : 0,
        netMargin: yearData.revenue > 0 ? ((yearData.revenue - yearData.cogs - yearData.opex - yearData.depreciation - yearData.interestExpense - (yearData.taxExpense || 0)) / yearData.revenue) : 0,
      };
      
      if (existingIndex >= 0) {
        newHistoricalData[existingIndex] = formattedYear;
      } else {
        newHistoricalData.push(formattedYear);
      }
    });
    
    setHistoricalData(newHistoricalData.sort((a, b) => a.year - b.year));
  };

  const parseValue = (value) => {
    const parsed = parseFormattedNumber(value);
    return parsed === '' ? 0 : Number(parsed);
  };

  const handleInputFocus = (field, value) => {
    const rawValue = parseFormattedNumber(value);
    setForm((f) => ({ ...f, [field]: rawValue }));
  };

  const handleInputBlur = (field, value) => {
    const formattedValue = formatNumberForInput(value);
    setForm((f) => ({ ...f, [field]: formattedValue }));
  };

  const exportToCSV = () => {
    try {
      const headers = [
        "Year", "Revenue", "COGS", "Operating Expenses", "Depreciation", "Interest Expense",
        "EBITDA", "EBIT", "Net Income", "Cash", "Accounts Receivable", "Inventory",
        "Other Current Assets", "PPE", "Total Assets", "Accounts Payable", "Accrued Expenses",
        "Short-term Debt", "Long-term Debt", "Working Capital", "Operating Cash Flow",
        "Capital Expenditures", "Free Cash Flow", "Investing Cash Flow", "Financing Cash Flow",
        "Date Entered"
      ];

      const rows = historicalData.map(year => [
        year.year, year.revenue || 0, year.cogs || 0, year.opex || 0, year.depreciation || 0,
        year.interestExpense || 0, year.ebitda || 0, year.ebit || 0, year.netIncome || 0,
        year.cash || 0, year.receivables || 0, year.inventory || 0, year.otherCurrentAssets || 0,
        year.ppe || 0, year.totalAssets || 0, year.accountsPayable || 0, year.accruedExp || 0,
        year.shortTermDebt || 0, year.longTermDebt || 0, year.workingCapital || 0,
        year.opCashFlow || 0, year.capex || 0, year.fcf || 0, year.investCF || 0,
        year.financeCF || 0, formatDate(year.dateEntered)
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `historical_financial_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  const exportToJSON = () => {
    try {
      const dataStr = JSON.stringify(historicalData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historical_financial_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  const handleAddYear = () => {
    setForm({ 
      ...initialForm, 
      year: (historicalData.at(-1)?.year || new Date().getFullYear() - 1) + 1 
    });
    setEditIdx(historicalData.length);
  };

  const handleEdit = (idx) => {
    const data = historicalData[idx];
    setForm({ 
      ...Object.keys(initialForm).reduce((acc, key) => {
        if (key === 'monthlyCashFlows') {
          acc[key] = data[key] || initialForm[key];
        } else {
          acc[key] = data[key] !== undefined && data[key] !== null ? formatNumberForInput(data[key]) : "";
        }
        return acc;
      }, {}),
      dateEntered: data.dateEntered || new Date(),
      year: data.year
    });
    setEditIdx(idx);
  };

  const handleSave = () => {
    const revenue = parseValue(form.revenue);
    const cogs = parseValue(form.cogs);
    const opex = parseValue(form.opex);
    const depreciation = parseValue(form.depreciation);
    const interestExpense = parseValue(form.interestExpense);
    const taxExpense = parseValue(form.taxExpense);
    
    const ebitda = revenue - cogs - opex;
    const ebit = ebitda - depreciation;
    const ebt = ebit - interestExpense;
    const netIncome = ebt - taxExpense;
    
    const cash = parseValue(form.cash);
    const receivables = parseValue(form.receivables);
    const inventory = parseValue(form.inventory);
    const otherCurrentAssets = parseValue(form.otherCurrentAssets);
    const ppe = parseValue(form.ppe);
    const totalAssets = cash + receivables + inventory + otherCurrentAssets + ppe;
    
    const accountsPayable = parseValue(form.accountsPayable);
    const accruedExp = parseValue(form.accruedExp);
    const shortTermDebt = parseValue(form.shortTermDebt);
    const currentAssets = cash + receivables + inventory + otherCurrentAssets;
    const currentOperatingLiabilities = accountsPayable + accruedExp;
    const workingCapital = currentAssets - currentOperatingLiabilities;

    const opCashFlow = parseValue(form.opCashFlow);
    const capex = parseValue(form.capex);
    const fcf = opCashFlow - capex;

    const updated = [...historicalData];
    updated[editIdx] = {
      ...form,
      dateEntered: form.dateEntered || new Date(),
      year: Number(form.year),
      revenue, cogs, opex, depreciation, interestExpense, taxExpense,
      ebitda, ebit, netIncome, totalAssets, workingCapital,
      cash, receivables, inventory, otherCurrentAssets, ppe,
      accountsPayable, accruedExp, shortTermDebt,
      longTermDebt: parseValue(form.longTermDebt),
      opCashFlow, capex, fcf,
      investCF: parseValue(form.investCF),
      financeCF: parseValue(form.financeCF),
      grossMargin: revenue > 0 ? (revenue - cogs) / revenue : 0,
      ebitdaMargin: revenue > 0 ? ebitda / revenue : 0,
      netMargin: revenue > 0 ? netIncome / revenue : 0,
    };
    
    setHistoricalData(updated.sort((a, b) => a.year - b.year));
    setEditIdx(null);
    setForm(initialForm);
    setShowMonthlyData(false);
  };

  const handleCancel = () => {
    setEditIdx(null);
    setForm(initialForm);
    setShowMonthlyData(false);
  };

  const handleDelete = (idx) => setDeleteIdx(idx);
  const confirmDelete = () => {
    setHistoricalData(historicalData.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };
  const cancelDelete = () => setDeleteIdx(null);

  const handleChange = (field, value) => {
    if (field === 'year') {
      setForm((f) => ({ ...f, [field]: value }));
      return;
    }
    
    const parsedValue = parseFormattedNumber(value);
    if (parsedValue === '' || /^-?\d*\.?\d*$/.test(parsedValue)) {
      setForm((f) => ({ ...f, [field]: value }));
    }
  };

  const validYears = historicalData.filter((d) => d.revenue > 0);
  const hasValidData = validYears.length >= 2;
  const assumptions = hasValidData ? calculateHistoricalAssumptions(historicalData) : null;

  const latestYear = validYears.length > 0 ? validYears[validYears.length - 1] : null;
  const avgRevenue = validYears.length > 0 
    ? validYears.reduce((sum, year) => sum + year.revenue, 0) / validYears.length 
    : 0;

  const hasDataToExport = historicalData.length > 0 && validYears.length > 0;

  return (
    <div className="space-y-6">
      {/* AI UPLOAD COMPONENT - ADD THIS FIRST */}
      <Card className="border-l-4 border-l-purple-600 shadow-md">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-6 h-6 text-purple-600" />
            AI-Powered Statement Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <FinancialStatementUpload 
            onDataExtracted={handleExtractedData}
            apiKey={process.env.REACT_APP_DEEPSEEK_API_KEY}
          />
        </CardContent>
      </Card>

      {/* Formatting Help Banner */}
      <div className="text-sm text-slate-600 p-3 bg-blue-50 rounded border border-blue-200">
        <strong>Formatting Tip:</strong> Numbers are automatically formatted with commas. 
        Just type the numbers normally (e.g., 1000000 will display as 1,000,000)
      </div>

      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle>Historical Financial Data</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Enter 2-3 years of historical financial data to establish baseline assumptions
            </p>
          </div>
          <div className="flex gap-2">
            {hasDataToExport && (
              <>
                <Button
                  size="sm"
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 font-semibold rounded shadow flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={exportToJSON}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 font-semibold rounded shadow flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={handleAddYear}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 font-semibold rounded shadow"
            >
              + Add Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {hasDataToExport && (
            <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
              <div className="text-sm text-slate-600">
                <strong>Export Options:</strong> Download your historical data as CSV for Excel analysis or JSON for data backup.
              </div>
            </div>
          )}

          <div className="space-y-4">
            {historicalData.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No historical data entered yet. Click "Add Year" to get started or upload financial statements using AI.
              </div>
            ) : (
              historicalData.map((yearData, idx) => (
                <div
                  key={yearData.year || idx}
                  className="bg-white rounded-lg shadow border border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between mb-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                    <div className="mr-8">
                      <div className="font-bold text-base">{yearData.year}</div>
                      <div className="text-xs text-gray-500">
                        Data entered: {formatDate(yearData.dateEntered) || formatDate(new Date())}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-8 mt-2 md:mt-0">
                      <div className="text-sm">
                        <span className="block text-gray-600">Revenue</span>
                        <span className="font-bold">
                          {yearData.revenue ? currencyFmt(yearData.revenue, ccy) : '-'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-600">EBITDA</span>
                        <span className="font-bold">
                          {yearData.ebitda ? currencyFmt(yearData.ebitda, ccy) : '-'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-600">Net Income</span>
                        <span className="font-bold">
                          {yearData.netIncome ? currencyFmt(yearData.netIncome, ccy) : '-'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-600">Total Assets</span>
                        <span className="font-bold">
                          {yearData.totalAssets ? currencyFmt(yearData.totalAssets, ccy) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex gap-2">
                    <Button
                      size="sm"
                      className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 font-semibold"
                      onClick={() => handleEdit(idx)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 font-semibold"
                      onClick={() => handleDelete(idx)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal - keep your existing modal code exactly as is */}
      {editIdx !== null && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-lg border-b">
        <h2 className="text-xl font-bold">
          {editIdx === historicalData.length ? 'Add New Year' : `Edit Year ${form.year}`}
        </h2>
        <p className="text-sm opacity-90 mt-1">Enter financial data for the year</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Year Field */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <Label className="text-xs font-semibold text-slate-700 mb-2 block">Year</Label>
          <Input
            type="number"
            value={form.year}
            onChange={(e) => handleChange('year', e.target.value)}
            className="w-full h-12 text-lg font-bold border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-md"
            placeholder="e.g., 2023"
          />
        </div>

        {/* Income Statement */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-200">
            Income Statement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Revenue</Label>
              <Input
                type="text"
                value={form.revenue}
                onFocus={() => handleInputFocus('revenue', form.revenue)}
                onBlur={() => handleInputBlur('revenue', form.revenue)}
                onChange={(e) => handleChange('revenue', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">COGS</Label>
              <Input
                type="text"
                value={form.cogs}
                onFocus={() => handleInputFocus('cogs', form.cogs)}
                onBlur={() => handleInputBlur('cogs', form.cogs)}
                onChange={(e) => handleChange('cogs', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Operating Expenses</Label>
              <Input
                type="text"
                value={form.opex}
                onFocus={() => handleInputFocus('opex', form.opex)}
                onBlur={() => handleInputBlur('opex', form.opex)}
                onChange={(e) => handleChange('opex', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Depreciation</Label>
              <Input
                type="text"
                value={form.depreciation}
                onFocus={() => handleInputFocus('depreciation', form.depreciation)}
                onBlur={() => handleInputBlur('depreciation', form.depreciation)}
                onChange={(e) => handleChange('depreciation', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Interest Expense</Label>
              <Input
                type="text"
                value={form.interestExpense}
                onFocus={() => handleInputFocus('interestExpense', form.interestExpense)}
                onBlur={() => handleInputBlur('interestExpense', form.interestExpense)}
                onChange={(e) => handleChange('interestExpense', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Tax Expense</Label>
              <Input
                type="text"
                value={form.taxExpense}
                onFocus={() => handleInputFocus('taxExpense', form.taxExpense)}
                onBlur={() => handleInputBlur('taxExpense', form.taxExpense)}
                onChange={(e) => handleChange('taxExpense', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Balance Sheet - Assets */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-emerald-200">
            Balance Sheet - Assets
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Cash</Label>
              <Input
                type="text"
                value={form.cash}
                onFocus={() => handleInputFocus('cash', form.cash)}
                onBlur={() => handleInputBlur('cash', form.cash)}
                onChange={(e) => handleChange('cash', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Accounts Receivable</Label>
              <Input
                type="text"
                value={form.receivables}
                onFocus={() => handleInputFocus('receivables', form.receivables)}
                onBlur={() => handleInputBlur('receivables', form.receivables)}
                onChange={(e) => handleChange('receivables', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Inventory</Label>
              <Input
                type="text"
                value={form.inventory}
                onFocus={() => handleInputFocus('inventory', form.inventory)}
                onBlur={() => handleInputBlur('inventory', form.inventory)}
                onChange={(e) => handleChange('inventory', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Other Current Assets</Label>
              <Input
                type="text"
                value={form.otherCurrentAssets}
                onFocus={() => handleInputFocus('otherCurrentAssets', form.otherCurrentAssets)}
                onBlur={() => handleInputBlur('otherCurrentAssets', form.otherCurrentAssets)}
                onChange={(e) => handleChange('otherCurrentAssets', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">PP&E</Label>
              <Input
                type="text"
                value={form.ppe}
                onFocus={() => handleInputFocus('ppe', form.ppe)}
                onBlur={() => handleInputBlur('ppe', form.ppe)}
                onChange={(e) => handleChange('ppe', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Balance Sheet - Liabilities */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-200">
            Balance Sheet - Liabilities
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Accounts Payable</Label>
              <Input
                type="text"
                value={form.accountsPayable}
                onFocus={() => handleInputFocus('accountsPayable', form.accountsPayable)}
                onBlur={() => handleInputBlur('accountsPayable', form.accountsPayable)}
                onChange={(e) => handleChange('accountsPayable', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Accrued Expenses</Label>
              <Input
                type="text"
                value={form.accruedExp}
                onFocus={() => handleInputFocus('accruedExp', form.accruedExp)}
                onBlur={() => handleInputBlur('accruedExp', form.accruedExp)}
                onChange={(e) => handleChange('accruedExp', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Short-term Debt</Label>
              <Input
                type="text"
                value={form.shortTermDebt}
                onFocus={() => handleInputFocus('shortTermDebt', form.shortTermDebt)}
                onBlur={() => handleInputBlur('shortTermDebt', form.shortTermDebt)}
                onChange={(e) => handleChange('shortTermDebt', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Long-term Debt</Label>
              <Input
                type="text"
                value={form.longTermDebt}
                onFocus={() => handleInputFocus('longTermDebt', form.longTermDebt)}
                onBlur={() => handleInputBlur('longTermDebt', form.longTermDebt)}
                onChange={(e) => handleChange('longTermDebt', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Cash Flow Statement */}
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-200">
            Cash Flow Statement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Operating Cash Flow</Label>
              <Input
                type="text"
                value={form.opCashFlow}
                onFocus={() => handleInputFocus('opCashFlow', form.opCashFlow)}
                onBlur={() => handleInputBlur('opCashFlow', form.opCashFlow)}
                onChange={(e) => handleChange('opCashFlow', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Capital Expenditures</Label>
              <Input
                type="text"
                value={form.capex}
                onFocus={() => handleInputFocus('capex', form.capex)}
                onBlur={() => handleInputBlur('capex', form.capex)}
                onChange={(e) => handleChange('capex', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Investing Cash Flow</Label>
              <Input
                type="text"
                value={form.investCF}
                onFocus={() => handleInputFocus('investCF', form.investCF)}
                onBlur={() => handleInputBlur('investCF', form.investCF)}
                onChange={(e) => handleChange('investCF', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Financing Cash Flow</Label>
              <Input
                type="text"
                value={form.financeCF}
                onFocus={() => handleInputFocus('financeCF', form.financeCF)}
                onBlur={() => handleInputBlur('financeCF', form.financeCF)}
                onChange={(e) => handleChange('financeCF', e.target.value)}
                className="w-full h-10 text-sm border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-md"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t flex justify-end gap-3 rounded-b-lg">
        <button
          onClick={handleCancel}
          className="bg-white border-2 border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 px-6 py-2 font-semibold transition-all duration-200 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white px-6 py-2 shadow-md font-semibold transition-all duration-200 transform hover:scale-105 rounded-md"
        >
          Save Year
        </button>
      </div>
    </div>
  </div>
)}

      {/* Data Quality Summary */}
      <div className="border border-green-400 bg-green-50 rounded p-5 mt-2">
        <div className="text-green-900 font-semibold mb-2">Data Quality Summary:</div>
        <ul className="list-disc pl-5 text-green-900 text-sm space-y-1">
          <li>
            {validYears.length} year{validYears.length !== 1 && "s"} of historical data entered
          </li>
          {validYears.length > 0 && (
            <>
              <li>
                Most recent revenue: <strong>{latestYear?.revenue ? currencyFmt(latestYear.revenue, ccy) : 'N/A'}</strong>
              </li>
              <li>
                Average revenue: <strong>{avgRevenue ? currencyFmt(avgRevenue, ccy) : 'N/A'}</strong>
              </li>
              {assumptions?.growth && (
                <li>
                  Historical revenue growth: <strong>{pctFmt(assumptions.growth)}</strong>
                </li>
              )}
            </>
          )}
          <li>
            Working capital assumptions will be auto-calculated from most recent year
          </li>
          <li>
            Multi-year trend analysis available for validation
          </li>
          {hasDataToExport && (
            <li>
              Data can be exported for external analysis and backup
            </li>
          )}
        </ul>
      </div>

      <ConfirmDialog
        open={deleteIdx !== null}
        message="Are you sure you want to delete this year?"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}