import React, { useMemo, useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Download, FileText, DollarSign, Landmark, BarChart3, Shield, Building, TrendingUp, CheckCircle2, Calendar, Info, Save, FolderOpen, Trash2, Copy, X, AlertTriangle, Zap, Wallet, CreditCard, Clock, Lightbulb, RefreshCw, Layers, ChevronRight, Sliders } from "lucide-react";

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

// Auth and database imports
import { useAuth } from "./contexts/AuthContext";
import { db } from "./lib/supabase";

// NEW: Phase 1 component imports
import { SmartPctField } from "./components/SmartFields";
import { SmartSuggestion, OpeningDebtWarning } from "./components/SmartSuggestions";

/**
 * Check if a field has been manually edited
 * Works with both Set and Array (for backwards compatibility)
 */
const hasEditedField = (editedFields, fieldName) => {
  if (!editedFields) return false;
  if (editedFields instanceof Set) return editedFields.has(fieldName);
  if (Array.isArray(editedFields)) return editedFields.includes(fieldName);
  return false;
};

/**
 * Add a field to the edited fields list
 * Returns an Array (for JSON serialization compatibility)
 */
const addEditedField = (editedFields, fieldName) => {
  const existing = editedFields instanceof Set 
    ? [...editedFields] 
    : Array.isArray(editedFields) 
      ? editedFields 
      : [];
  return [...new Set([...existing, fieldName])];
};

/**
 * Ensure _editedFields is an Array when loading from storage
 */
const ensureEditedFieldsArray = (params) => {
  if (!params) return params;
  return {
    ...params,
    _editedFields: Array.isArray(params._editedFields)
      ? params._editedFields
      : params._editedFields instanceof Set
        ? [...params._editedFields]
        : []
  };
};

// Backwards compatibility alias
const isFieldEdited = hasEditedField;

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
  const safeValue = value ?? 0;
  const [displayValue, setDisplayValue] = React.useState(safeValue.toLocaleString('en-US', { maximumFractionDigits: 0 }));

  React.useEffect(() => {
    const safeVal = value ?? 0;
    setDisplayValue(safeVal.toLocaleString('en-US', { maximumFractionDigits: 0 }));
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
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
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
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
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
}

// === SAVE DIALOG COMPONENT ===
function SaveDialog({ show, onClose, onSave, currentName }) {
  const [name, setName] = useState(currentName || '');
  const [description, setDescription] = useState('');
  
  useEffect(() => {
    if (show) {
      setName(currentName || '');
      setDescription('');
    }
  }, [show, currentName]);
  
  if (!show) return null;
  
  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    onSave(name, description);
    setName('');
    setDescription('');
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Save className="w-5 h-5 text-emerald-600" />
            {currentName ? 'Update Scenario' : 'Save Scenario'}
          </h2>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Scenario Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ABC Manufacturing - Base Case"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this scenario..."
              className="w-full px-3 py-2 border rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded flex items-start gap-2">
            <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Use descriptive names for easy retrieval later</span>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {currentName ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// === LOAD DIALOG COMPONENT ===
function LoadDialog({ show, onClose, scenarios, onLoad, onDelete, onDuplicate }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  if (!show) return null;
  
  const filteredScenarios = scenarios.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full sm:max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            Load Scenario
          </h2>
        </div>
        
        <div className="p-4 sm:p-6 flex-1 overflow-auto space-y-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search scenarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Scenarios List */}
          {filteredScenarios.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm 
                ? 'No scenarios match your search' 
                : 'No saved scenarios yet. Create your first one!'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredScenarios.map(scenario => (
                <div 
                  key={scenario.id}
                  className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => onLoad(scenario.id)}
                    >
                      <h3 className="font-bold text-slate-900 mb-1">{scenario.name}</h3>
                      {scenario.description && (
                        <p className="text-sm text-slate-600 mb-2">{scenario.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Updated: {new Date(scenario.updatedAt).toLocaleDateString()}</span>
                        {scenario.tags && scenario.tags.length > 0 && (
                          <div className="flex gap-1">
                            {scenario.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(scenario.id);
                        }}
                        className="p-2 hover:bg-slate-100 rounded"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(scenario.id);
                        }}
                        className="p-2 hover:bg-red-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 sm:p-6 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// === CLEAR CONFIRM DIALOG ===
function ClearConfirmDialog({ show, onClose, onConfirm }) {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Clear All Fields?
          </h2>
        </div>
        
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-slate-700">
            This will reset all input fields to their default values. 
            Any unsaved changes will be lost.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> Consider saving your work before clearing.
            </p>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// LOCAL STORAGE PERSISTENCE
// ==========================================
const STORAGE_KEY_PARAMS = 'finsight_params';
const STORAGE_KEY_HISTORICAL = 'finsight_historical_data';

// Default params for initialization and reset
const getDefaultParams = () => ({
  // TIER 1: CORE ASSUMPTIONS
  startYear: new Date().getFullYear(),
  years: 5,
  baseRevenue: 0,
  growth: 0.08,
  cogsPct: 0.40,
  opexPct: 0.25,
  capexPct: 0.05,
  daPctOfPPE: 0.10,
  wcPctOfRev: 0.15,
  taxRate: 0.21,
  wacc: 0.10,
  terminalGrowth: 0.03,
  equityContribution: 0,
  entryMultiple: 8.0,
  sharesOutstanding: 1_000_000,
  industry: "Manufacturing",

  // NEW FACILITY
  requestedLoanAmount: 0,
  proposedPricing: 0.12,
  proposedTenor: 5,
  facilityAmortizationType: 'amortizing',
  interestOnlyPeriod: 0,
  paymentFrequency: "Quarterly",
  balloonPercentage: 0,

  // EXISTING DEBT
  hasExistingDebt: false,
  existingDebtAmount: 0,
  existingDebtRate: 0.08,
  existingDebtTenor: 5,
  existingDebtAmortizationType: 'amortizing',

  // OPENING BALANCE SHEET
  openingCash: 0,

  // COVENANTS
  minDSCR: 1.2,
  maxNDToEBITDA: 3.5,
  targetICR: 2.0,

  // LEGACY FIELDS (for backward compatibility)
  openingDebt: 0,
  interestRate: 0.12,
  debtTenorYears: 5,
  interestOnlyYears: 0,

  // FACILITY DETAILS
  facilityType: "Senior Secured Term Loan",
  useBalloonPayment: false,
  dayCountConvention: "Actual/365",
  openingDate: new Date().toISOString().split('T')[0],
  issueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  prepaymentNoticeDays: 30,
  prepaymentPenaltyPct: 0,
  arrangerBroker: "ABC Wealth Limited",
  legalCounsel: "",
  trustee: "",
  registrar: "",
  payingAgent: "",
  distributionMethod: "Private Placement",
  investorType: "Accredited Investors",
  possibleUpsizeAmount: 0,

  // COMPANY INFORMATION
  companyLegalName: "",
  companyOperatingName: "",
  companyAddress: "",
  taxId: "",
  loanPurpose: "",
  useOfProceeds: "",
  dealStructure: "Term loan, revolving credit etc",
  customAmortization: [20, 20, 20, 20, 20],

  // BUSINESS DESCRIPTION
  businessModel: "",
  productsServices: "",
  keyCustomers: "",
  competitivePosition: "",
  marketShare: "",

  // MANAGEMENT
  keyManagementNames: "",
  managementTrackRecord: "",

  // CREDIT ASSESSMENT
  creditHistory: "Clean",
  totalAssets: 0,
  collateralValue: 0,
  businessAge: 0,
  managementExperience: "Strong",
  creditStrengths: "",
  keyRisks: "",
  mitigatingFactors: "",

  // COLLATERAL
  collateralDescription: "",
  lienPosition: "First Lien",
  appraisalValue: 0,
  appraisalDate: "",

  // RELATIONSHIP
  relationshipManager: "",
  existingRelationshipYears: 0,
  referralSource: "",

  // FINANCIAL COMMENTARY
  revenueCommentary: "",
  marginCommentary: "",
  workingCapitalCommentary: "",
  seasonalityFactors: "",

  // EXIT STRATEGY
  primaryRepaymentSource: "",
  secondaryRepaymentSource: "",

  // CONDITIONS & MONITORING
  conditionsPrecedent: "",
  reportingRequirements: "",
  siteVisitFrequency: "",

  // OPENING DEBT DATE MANAGEMENT
  openingDebtStartDate: new Date().toISOString().split('T')[0],
  openingDebtMaturityDate: `${new Date().getFullYear() + 5}-12-31`,
  openingDebtAmortizationType: 'amortizing',
  openingDebtPaymentFrequency: 'Quarterly',

  // MULTI-TRANCHE SUPPORT
  hasMultipleTranches: false,
  debtTranches: [],

  // INTERNAL TRACKING
  _editedFields: [],
  _historicalValues: null,
  _industryBenchmarks: null,
});

// Default historical data
const getDefaultHistoricalData = () => [
  { year: 2021, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date().toISOString() },
  { year: 2022, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date().toISOString() },
  { year: 2023, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0, dateEntered: new Date().toISOString() },
];

/**
 * Load saved params from localStorage, merging with defaults
 */
const loadSavedParams = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PARAMS);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all fields exist
      const merged = { ...getDefaultParams(), ...parsed };
      // Ensure _editedFields is an array
      return ensureEditedFieldsArray(merged);
    }
  } catch (error) {
    console.error('Error loading params from localStorage:', error);
  }
  return getDefaultParams();
};

/**
 * Load saved historical data from localStorage
 */
const loadSavedHistoricalData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HISTORICAL);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert dateEntered strings back to proper format if needed
      return parsed.map(row => ({
        ...row,
        dateEntered: row.dateEntered ? new Date(row.dateEntered) : new Date()
      }));
    }
  } catch (error) {
    console.error('Error loading historical data from localStorage:', error);
  }
  return getDefaultHistoricalData();
};

const FinancialModelAndStressTester = forwardRef(({ onDataUpdate, accessToken }, ref) => {
  // Get authentication state for database persistence
  const { user, isAuthenticated } = useAuth();

  const [ccy, setCcy] = useState("JMD");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);

  // Main params state - loads from localStorage if available
  const [params, setParams] = useState(loadSavedParams);

  // Save/Load state variables
  const [scenarios, setScenarios] = useState([]);
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [currentScenarioName, setCurrentScenarioName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Default params for reset - uses shared helper function
  const DEFAULT_PARAMS = getDefaultParams();

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

  // Historical data state - loads from localStorage if available
  const [historicalData, setHistoricalData] = useState(loadSavedHistoricalData);

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

  // ==========================================
  // EXPOSE METHODS VIA REF FOR CHATASSISTANT
  // ==========================================
  useImperativeHandle(ref, () => ({
    /**
     * Update a model parameter
     * @param {string} paramName - The parameter to update
     * @param {number} newValue - The new value
     */
    updateParam: (paramName, newValue) => {
      console.log(`[FinancialModel] Updating param: ${paramName} = ${newValue}`);
      setParams(prev => {
        const updated = { ...prev, [paramName]: newValue };

        // Sync related debt fields to maintain consistency
        if (paramName === 'openingDebt') {
          updated.existingDebtAmount = newValue;
        }
        if (paramName === 'existingDebtAmount') {
          updated.openingDebt = newValue;
        }

        // CRITICAL: When setting new facility amount, ensure pricing and tenor are set
        if (paramName === 'requestedLoanAmount' && newValue > 0) {
          // Set defaults if not already specified
          if (!updated.proposedPricing || updated.proposedPricing === 0) {
            updated.proposedPricing = 0.12; // 12% default rate
            console.log('[FinancialModel] Auto-set proposedPricing to 12%');
          }
          if (!updated.proposedTenor || updated.proposedTenor === 0) {
            updated.proposedTenor = 5; // 5 year default tenor
            console.log('[FinancialModel] Auto-set proposedTenor to 5 years');
          }
        }

        return updated;
      });

      // Also update draft params to prevent debounce issues
      setDraftParams(prev => {
        const updated = { ...prev, [paramName]: newValue };

        if (paramName === 'openingDebt') {
          updated.existingDebtAmount = newValue;
        }
        if (paramName === 'existingDebtAmount') {
          updated.openingDebt = newValue;
        }

        // CRITICAL: When setting new facility amount, ensure pricing and tenor are set
        if (paramName === 'requestedLoanAmount' && newValue > 0) {
          if (!updated.proposedPricing || updated.proposedPricing === 0) {
            updated.proposedPricing = 0.12;
          }
          if (!updated.proposedTenor || updated.proposedTenor === 0) {
            updated.proposedTenor = 5;
          }
        }

        return updated;
      });
    },

    /**
     * Run a stress test with custom shocks
     * @param {object} shocks - Object with growthDelta, cogsDelta, rateDelta, etc.
     */
    runStressTest: (shocks) => {
      console.log('[FinancialModel] Running stress test with shocks:', shocks);
      setCustomShocks(shocks);
      setDraftCustomShocks(shocks);
      setActiveTab('custom-stress');
    },

    /**
     * Navigate to a specific tab
     * @param {string} tabId - The tab ID to navigate to
     */
    navigateToTab: (tabId) => {
      console.log(`[FinancialModel] Navigating to tab: ${tabId}`);
      setActiveTab(tabId);
    },
  }));

  // ==========================================
  // LOCAL STORAGE PERSISTENCE - Save on change
  // ==========================================

  // Save params to localStorage whenever they change
  useEffect(() => {
    try {
      // Serialize params, converting Date objects to ISO strings
      const paramsToSave = {
        ...params,
        // Ensure dates are strings for JSON serialization
        openingDate: params.openingDate,
        issueDate: params.issueDate,
        openingDebtStartDate: params.openingDebtStartDate,
        openingDebtMaturityDate: params.openingDebtMaturityDate,
        appraisalDate: params.appraisalDate,
      };
      localStorage.setItem(STORAGE_KEY_PARAMS, JSON.stringify(paramsToSave));
    } catch (error) {
      console.error('Error saving params to localStorage:', error);
    }
  }, [params]);

  // Save historical data to localStorage whenever it changes
  useEffect(() => {
    try {
      // Serialize historicalData, converting Date objects to ISO strings
      const dataToSave = historicalData.map(row => ({
        ...row,
        dateEntered: row.dateEntered instanceof Date
          ? row.dateEntered.toISOString()
          : row.dateEntered
      }));
      localStorage.setItem(STORAGE_KEY_HISTORICAL, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving historical data to localStorage:', error);
    }
  }, [historicalData]);

  // ==========================================
  // PARAMS UPDATE HELPER - Syncs debt fields
  // ==========================================

  /**
   * Update params with automatic debt field synchronization.
   * Use this instead of setParams when updating debt-related fields
   * to ensure openingDebt, existingDebtAmount, and hasExistingDebt stay in sync.
   */
  const updateParams = (updates) => {
    setParams(prev => {
      const newParams = { ...prev, ...updates };

      // Sync debt fields bidirectionally
      if ('openingDebt' in updates) {
        newParams.existingDebtAmount = updates.openingDebt;
        newParams.hasExistingDebt = updates.openingDebt > 0;
      }
      if ('existingDebtAmount' in updates) {
        newParams.openingDebt = updates.existingDebtAmount;
        newParams.hasExistingDebt = updates.existingDebtAmount > 0;
      }

      return newParams;
    });
  };

  // Auto-sync new facility terms to legacy fields for buildProjection compatibility
  // CRITICAL: Only sync when there's NO existing debt to avoid overwriting existing debt parameters
  useEffect(() => {
    setParams(prev => {
      const hasExisting = (prev.openingDebt || 0) > 0 || (prev.existingDebtAmount || 0) > 0;
      const hasNew = (prev.requestedLoanAmount || 0) > 0;

      // CASE 1: Only new facility (no existing debt) - sync new facility to legacy fields
      if (hasNew && !hasExisting) {
        return {
          ...prev,
          interestRate: prev.proposedPricing,
          debtTenorYears: prev.proposedTenor,
          interestOnlyYears: prev.interestOnlyPeriod,
        };
      }

      // CASE 2: Only existing debt (no new facility) - keep existing debt in openingDebt
      if (hasExisting && !hasNew) {
        return {
          ...prev,
          openingDebt: prev.hasMultipleTranches ? 0 : prev.existingDebtAmount,
        };
      }

      // CASE 3: BOTH existing and new facility - DON'T overwrite anything
      // buildProjection will auto-create multi-tranche structure
      // Each tranche uses its own rate/tenor (existingDebtRate/proposedPricing, etc.)
      return prev;
    });
  }, [params.proposedPricing, params.proposedTenor, params.interestOnlyPeriod,
      params.hasExistingDebt, params.existingDebtAmount, params.hasMultipleTranches,
      params.requestedLoanAmount, params.openingDebt,
      params.existingDebtRate, params.existingDebtTenor, params.existingDebtAmortizationType]);

  // Load scenarios from database (if authenticated) or localStorage on mount
  useEffect(() => {
    const loadScenarios = async () => {
      setIsLoadingScenarios(true);
      
      if (isAuthenticated && user) {
        // Load from database for authenticated users
        try {
          const { data: models, error } = await db.listSavedModels();
          
          if (error) {
            console.error('Error loading scenarios from database:', error);
            // Fall back to localStorage
            loadFromLocalStorage();
          } else if (models) {
            // Transform database models to scenario format
            const dbScenarios = models.map(model => ({
              id: model.id,
              name: model.name,
              description: model.description,
              params: model.model_data?.params || model.model_data || {},
              historicalData: model.model_data?.historicalData || [],
              ccy: model.model_data?.ccy || 'JMD',
              tags: model.model_data?.tags || [],
              createdAt: model.created_at,
              updatedAt: model.updated_at,
              isFromDatabase: true
            }));
            setScenarios(dbScenarios);
          }
        } catch (error) {
          console.error('Error loading scenarios:', error);
          loadFromLocalStorage();
        }
      } else {
        // Load from localStorage for non-authenticated users
        loadFromLocalStorage();
      }
      
      setIsLoadingScenarios(false);
    };

    const loadFromLocalStorage = () => {
      const savedScenarios = localStorage.getItem('finsight_scenarios');
      if (savedScenarios) {
        try {
          setScenarios(JSON.parse(savedScenarios));
        } catch (error) {
          console.error('Error loading scenarios from localStorage:', error);
          setScenarios([]);
        }
      }
      
      // Load last active scenario ID
      const lastScenarioId = localStorage.getItem('finsight_last_scenario');
      if (lastScenarioId) {
        setCurrentScenarioId(lastScenarioId);
      }
    };

    loadScenarios();
  }, [isAuthenticated, user]);

  // Save scenarios to localStorage whenever they change (only for non-authenticated users)
  useEffect(() => {
    // Only save to localStorage for non-authenticated users or local scenarios
    if (!isAuthenticated && scenarios.length > 0) {
      localStorage.setItem('finsight_scenarios', JSON.stringify(scenarios));
    }
  }, [scenarios, isAuthenticated]);

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
      const mostRecent = validYears[validYears.length - 1];

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
            cogsPct: !isFieldEdited(prev._editedFields, 'cogsPct') ? assumptions.cogsPct : prev.cogsPct,
            opexPct: !isFieldEdited(prev._editedFields, 'opexPct') ? assumptions.opexPct : prev.opexPct,
            capexPct: !isFieldEdited(prev._editedFields, 'capexPct') ? assumptions.capexPct : prev.capexPct,
            wcPctOfRev: !isFieldEdited(prev._editedFields, 'wcPctOfRev') ? assumptions.wcPctOfRev : prev.wcPctOfRev,
            growth: !isFieldEdited(prev._editedFields, 'growth') ? assumptions.growth : prev.growth,

            // Optional auto-updates
            openingDebt: prev.openingDebt === 0 ? totalHistoricalDebt : prev.openingDebt,
            interestRate: prev.interestRate === 0 && historicalRate ? historicalRate : prev.interestRate,
            
            // Auto-populate Total Assets from historical financials
            totalAssets: prev.totalAssets === 0 && mostRecent?.totalAssets > 0 
              ? mostRecent.totalAssets 
              : prev.totalAssets,
            
            // Auto-populate Collateral Value from total assets if not set (conservative estimate at 50%)
            collateralValue: prev.collateralValue === 0 && mostRecent?.totalAssets > 0
              ? mostRecent.totalAssets * 0.5
              : prev.collateralValue,
            
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
      
      // Get most recent year with data for total assets
      const validYears = [...historicalData]
        .filter(d => d.revenue > 0)
        .sort((a, b) => a.year - b.year);
      const mostRecentYear = validYears.length > 0 ? validYears[validYears.length - 1] : null;
      
      if (assumptions) {
        // Get the most recent year from historical data for revenue
        const validYears = [...historicalData]
          .filter(d => d.revenue > 0)
          .sort((a, b) => a.year - b.year);
        const mostRecentYear = validYears[validYears.length - 1];
        
        setDraftParams(prev => ({
          ...prev,
          // Use most recent year's revenue, falling back to calculated assumption
          baseRevenue: prev.baseRevenue === 0
            ? (mostRecentYear?.revenue || assumptions.baseRevenue)
            : prev.baseRevenue,

          growth:     prev.growth     === 0.08 ? assumptions.growth     : prev.growth,
          cogsPct:    prev.cogsPct    === 0.40 ? assumptions.cogsPct    : prev.cogsPct,
          opexPct:    prev.opexPct    === 0.25 ? assumptions.opexPct    : prev.opexPct,
          wcPctOfRev: prev.wcPctOfRev === 0.15 ? assumptions.wcPctOfRev : prev.wcPctOfRev,
          capexPct:   prev.capexPct   === 0.05 ? assumptions.capexPct   : prev.capexPct,

          // Apply total assets from historical data
          totalAssets: prev.totalAssets === 0 && mostRecentYear?.totalAssets > 0 
            ? mostRecentYear.totalAssets 
            : prev.totalAssets,
          
          // Apply collateral value estimate if not set
          collateralValue: prev.collateralValue === 0 && mostRecentYear?.totalAssets > 0
            ? mostRecentYear.totalAssets * 0.5
            : prev.collateralValue,
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

  // === SAVE/LOAD FUNCTIONS ===
  const saveScenario = async (name, description = '') => {
    const timestamp = new Date().toISOString();
    setIsSaving(true);
    
    try {
      if (isAuthenticated && user) {
        // Save to database for authenticated users
        // Include ALL model data: params, historicalData, and metadata
        const modelData = {
          params: { ...params },
          historicalData: [...historicalData],
          ccy: ccy,
          tags: [params.industry, params.facilityType].filter(Boolean),
        };
        
        if (currentScenarioId) {
          // Check if current scenario is from database (UUID format)
          const isDbScenario = scenarios.find(s => s.id === currentScenarioId)?.isFromDatabase;
          
          if (isDbScenario) {
            // Update existing database model
            const { data, error } = await db.updateSavedModel(
              currentScenarioId,
              name,
              description,
              modelData
            );
            
            if (error) {
              console.error('Error updating scenario in database:', error);
              setSuccessMessage('Failed to save scenario');
              setShowSuccessToast(true);
              setIsSaving(false);
              return;
            }
            
            // Update local state
            setScenarios(prev => prev.map(s => 
              s.id === currentScenarioId 
                ? {
                    ...s,
                    name,
                    description,
                    params: { ...params },
                    updatedAt: data.updated_at,
                  }
                : s
            ));
            setSuccessMessage(`Scenario "${name}" saved to cloud`);
          } else {
            // Migrate local scenario to database
            const { data, error } = await db.createSavedModel(name, description, modelData);
            
            if (error) {
              console.error('Error saving scenario to database:', error);
              setSuccessMessage('Failed to save scenario');
              setShowSuccessToast(true);
              setIsSaving(false);
              return;
            }
            
            // Remove old local scenario and add new db scenario
            setScenarios(prev => [
              ...prev.filter(s => s.id !== currentScenarioId),
              {
                id: data.id,
                name: data.name,
                description: data.description,
                params: modelData.params,
                tags: modelData.tags,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                isFromDatabase: true
              }
            ]);
            setCurrentScenarioId(data.id);
            setSuccessMessage(`Scenario "${name}" saved to cloud`);
          }
        } else {
          // Create new scenario in database
          const { data, error } = await db.createSavedModel(name, description, modelData);
          
          if (error) {
            console.error('Error creating scenario in database:', error);
            setSuccessMessage('Failed to save scenario');
            setShowSuccessToast(true);
            setIsSaving(false);
            return;
          }
          
          const newScenario = {
            id: data.id,
            name: data.name,
            description: data.description,
            params: modelData.params,
            tags: modelData.tags,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            isFromDatabase: true
          };
          
          setScenarios(prev => [...prev, newScenario]);
          setCurrentScenarioId(data.id);
          setCurrentScenarioName(name);
          setSuccessMessage(`Scenario "${name}" saved to cloud`);
        }
      } else {
        // Save to localStorage for non-authenticated users
        // Include ALL model data: params, historicalData, and metadata
        if (currentScenarioId) {
          setScenarios(prev => prev.map(s => 
            s.id === currentScenarioId 
              ? {
                  ...s,
                  name,
                  description,
                  params: { ...params },
                  historicalData: [...historicalData],
                  ccy: ccy,
                  updatedAt: timestamp,
                }
              : s
          ));
          setSuccessMessage(`Scenario "${name}" updated`);
        } else {
          const newScenario = {
            id: `scenario_${Date.now()}`,
            name,
            description,
            params: { ...params },
            historicalData: [...historicalData],
            ccy: ccy,
            createdAt: timestamp,
            updatedAt: timestamp,
            tags: [params.industry, params.facilityType].filter(Boolean),
          };
          
          setScenarios(prev => [...prev, newScenario]);
          setCurrentScenarioId(newScenario.id);
          setCurrentScenarioName(name);
          localStorage.setItem('finsight_last_scenario', newScenario.id);
          setSuccessMessage(`Scenario "${name}" saved`);
        }
      }
      
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Error saving scenario:', error);
      setSuccessMessage('Failed to save scenario');
      setShowSuccessToast(true);
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  };

  // === LOAD FUNCTION ===
  const loadScenario = (scenarioId) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      setSuccessMessage('Scenario not found');
      setShowSuccessToast(true);
      return;
    }
    
    // Load params into state, ensuring _editedFields is an Array
    const loadedParams = ensureEditedFieldsArray(scenario.params);
    setParams(loadedParams);
    setDraftParams(loadedParams);
    
    // Load historical data if available
    if (scenario.historicalData && Array.isArray(scenario.historicalData)) {
      setHistoricalData(scenario.historicalData);
    }
    
    // Load currency if available
    if (scenario.ccy) {
      setCcy(scenario.ccy);
    }
    
    setCurrentScenarioId(scenario.id);
    setCurrentScenarioName(scenario.name);
    localStorage.setItem('finsight_last_scenario', scenario.id);
    
    // Update last accessed
    setScenarios(prev => prev.map(s => 
      s.id === scenarioId 
        ? { ...s, lastAccessed: new Date().toISOString() }
        : s
    ));
    
    setSuccessMessage(`Loaded "${scenario.name}"`);
    setShowSuccessToast(true);
    setShowLoadDialog(false);
  };

  // === DELETE FUNCTION ===
  const deleteScenario = async (scenarioId) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!confirm(`Delete "${scenario?.name}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete from database if it's a database scenario
      if (isAuthenticated && scenario?.isFromDatabase) {
        const { error } = await db.deleteSavedModel(scenarioId);
        
        if (error) {
          console.error('Error deleting scenario from database:', error);
          setSuccessMessage('Failed to delete scenario');
          setShowSuccessToast(true);
          return;
        }
      }
      
      setScenarios(prev => prev.filter(s => s.id !== scenarioId));
      
      if (scenarioId === currentScenarioId) {
        setCurrentScenarioId(null);
        setCurrentScenarioName('');
        localStorage.removeItem('finsight_last_scenario');
      }
      
      setSuccessMessage('Scenario deleted successfully');
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Error deleting scenario:', error);
      setSuccessMessage('Failed to delete scenario');
      setShowSuccessToast(true);
    }
  };

  // === DUPLICATE FUNCTION ===
  const duplicateScenario = async (scenarioId) => {
    const original = scenarios.find(s => s.id === scenarioId);
    if (!original) return;
    
    const timestamp = new Date().toISOString();
    
    try {
      if (isAuthenticated && original?.isFromDatabase) {
        // Duplicate in database
        const { data, error } = await db.duplicateSavedModel(
          scenarioId, 
          `${original.name} (Copy)`
        );
        
        if (error) {
          console.error('Error duplicating scenario in database:', error);
          setSuccessMessage('Failed to duplicate scenario');
          setShowSuccessToast(true);
          return;
        }
        
        const duplicate = {
          id: data.id,
          name: data.name,
          description: data.description,
          params: data.model_data?.params || data.model_data || {},
          tags: data.model_data?.tags || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          isFromDatabase: true
        };
        
        setScenarios(prev => [...prev, duplicate]);
        setSuccessMessage(`Created copy of "${original.name}"`);
      } else {
        // Duplicate locally
        const duplicate = {
          ...original,
          id: `scenario_${Date.now()}`,
          name: `${original.name} (Copy)`,
          createdAt: timestamp,
          updatedAt: timestamp,
          isFromDatabase: false
        };
        
        setScenarios(prev => [...prev, duplicate]);
        setSuccessMessage(`Created copy of "${original.name}"`);
      }
      
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Error duplicating scenario:', error);
      setSuccessMessage('Failed to duplicate scenario');
      setShowSuccessToast(true);
    }
  };

  // === CLEAR ALL FUNCTION ===
  const handleClearAll = () => {
    const freshParams = getDefaultParams();
    setParams(freshParams);
    setDraftParams(freshParams);
    setHistoricalData(getDefaultHistoricalData());
    setCurrentScenarioId(null);
    setCurrentScenarioName('');
    // Clear localStorage for fresh start
    localStorage.removeItem('finsight_last_scenario');
    localStorage.removeItem(STORAGE_KEY_PARAMS);
    localStorage.removeItem(STORAGE_KEY_HISTORICAL);
    setShowClearConfirm(false);
    setSuccessMessage('All fields cleared');
    setShowSuccessToast(true);
  };

  // === NEW SCENARIO FUNCTION ===
  const startNewScenario = () => {
    if (currentScenarioId && !confirm('Start new scenario? Unsaved changes will be lost.')) {
      return;
    }
    handleClearAll();
  };

  // === AUTO-SAVE (Optional) ===
  useEffect(() => {
    if (!currentScenarioId || !currentScenarioName) return;
    
    const autoSaveInterval = setInterval(async () => {
      const currentScenario = scenarios.find(s => s.id === currentScenarioId);
      
      if (isAuthenticated && currentScenario?.isFromDatabase) {
        // Auto-save to database for authenticated users
        try {
          const modelData = {
            params: { ...params },
            historicalData: [...historicalData],
            ccy: ccy,
            tags: [params.industry, params.facilityType].filter(Boolean),
          };
          
          await db.updateSavedModel(
            currentScenarioId,
            currentScenarioName,
            currentScenario.description || '',
            modelData
          );
          
          // Update local state silently
          setScenarios(prev => prev.map(s => 
            s.id === currentScenarioId 
              ? {
                  ...s,
                  params: { ...params },
                  historicalData: [...historicalData],
                  ccy: ccy,
                  updatedAt: new Date().toISOString(),
                }
              : s
          ));
        } catch (error) {
          console.error('Auto-save to database failed:', error);
        }
      } else {
        // Auto-save to local state (localStorage sync happens via effect)
        setScenarios(prev => prev.map(s => 
          s.id === currentScenarioId 
            ? {
                ...s,
                params: { ...params },
                historicalData: [...historicalData],
                ccy: ccy,
                updatedAt: new Date().toISOString(),
              }
            : s
        ));
      }
    }, 30000); // Auto-save every 30 seconds
    
    return () => clearInterval(autoSaveInterval);
  }, [currentScenarioId, currentScenarioName, params, historicalData, ccy, isAuthenticated, scenarios]);

  // Auto-populate covenant ratios when industry changes
  useEffect(() => {
    if (draftParams.industry) {
      const benchmarks = getBenchmarksForIndustry(draftParams.industry);
      
      setDraftParams(prev => ({
        ...prev,
        // Only update if not manually edited
        minDSCR: !isFieldEdited(prev._editedFields, 'minDSCR') ? benchmarks.minDSCR : prev.minDSCR,
        targetICR: !isFieldEdited(prev._editedFields, 'targetICR') ? benchmarks.targetICR : prev.targetICR,
        maxNDToEBITDA: !isFieldEdited(prev._editedFields, 'maxNDToEBITDA') ? benchmarks.maxNDToEBITDA : prev.maxNDToEBITDA,
        
        // Store benchmarks for variance display
        _industryBenchmarks: benchmarks
      }));
    }
  }, [draftParams.industry]);

  // Auto-populate debt tenor from new facility
  useEffect(() => {
    if (draftParams.proposedTenor && !isFieldEdited(draftParams._editedFields, 'debtTenorYears')) {
      setDraftParams(prev => ({
        ...prev,
        debtTenorYears: prev.proposedTenor
      }));
    }
  }, [draftParams.proposedTenor]);

  // Helper to check if we have valid historical data for auto-population
  const hasValidHistoricalData = historicalData.some(d => d.revenue > 0);

  if (!projections || !projections.base) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded">
        <h2 className="text-xl font-bold text-red-800">Error: Failed to build projections</h2>
        <p className="text-red-600">Check the console for details</p>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-[1800px] mx-auto space-y-4 sm:space-y-6 bg-slate-50">
      {/* Success Toast */}
      <SuccessToast 
        message={successMessage}
        show={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
      />

      {/* Sticky Header - Clean Design */}
      <div className="sticky top-0 z-40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {/* Current Scenario Badge */}
          {currentScenarioName && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs">
              <FileText className="w-3 h-3 text-slate-500" />
              <span className="text-slate-700 font-medium max-w-[150px] truncate">{currentScenarioName}</span>
              <button
                onClick={startNewScenario}
                className="text-slate-400 hover:text-slate-600"
                title="New scenario"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact action buttons */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{currentScenarioName ? 'Update' : 'Save'}</span>
          </button>

          <button
            onClick={() => setShowLoadDialog(true)}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Load</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="h-8 px-3 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs rounded font-medium transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />

          <button
            onClick={() => setShowInputs(!showInputs)}
            className={`h-8 px-3 text-xs rounded font-medium transition-colors flex items-center gap-1.5 ${
              showInputs 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {showInputs ? "Hide Inputs" : "Show Inputs"}
          </button>
        </div>
      </div>

      {/* Clean KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Enterprise Value</div>
          <div className="text-2xl font-semibold text-slate-900">{currencyFmtMM(projections.base.enterpriseValue, ccy)}</div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Equity Value</div>
          <div className="text-2xl font-semibold text-slate-900">{currencyFmtMM(projections.base.equityValue, ccy)}</div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Equity MOIC</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-900">
              {Number.isFinite(projections.base.moic) && projections.base.moic > 0 && projections.base.moic < 999
                ? `${numFmt(projections.base.moic)}x`
                : 'N/A'}
            </span>
            {Number.isFinite(projections.base.moic) && projections.base.moic > 2 && (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          {!Number.isFinite(projections.base.moic) || projections.base.moic === null ? (
            <div className="text-xs text-slate-500 mt-1">Set Equity Contribution to calculate</div>
          ) : null}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Equity IRR</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold ${
              Number.isFinite(projections.base.irr) && projections.base.irr > 0.15 ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {Number.isFinite(projections.base.irr) && projections.base.irr !== null
                ? pctFmt(projections.base.irr)
                : 'N/A'}
            </span>
            {Number.isFinite(projections.base.irr) && projections.base.irr > 0.15 && (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          {!Number.isFinite(projections.base.irr) || projections.base.irr === null ? (
            <div className="text-xs text-slate-500 mt-1">Set Equity Contribution to calculate</div>
          ) : null}
        </div>
      </div>

            {showInputs && (
        <div className="space-y-6 animate-fade-in">
          
          {/* ============================================ */}
          {/* QUICK START - Always Open */}
          {/* ============================================ */}
          <Card className="border-l-2 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-blue-600" />
                Core Assumptions
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Essential inputs for financial projections
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <MoneyField 
                  label="Annual Revenue" 
                  value={draftParams.baseRevenue} 
                  onChange={(v) => setDraftParams({...draftParams, baseRevenue: v})} 
                  ccy={ccy}
                />
                
                <SmartPctField 
                  label="Revenue Growth Rate"
                  value={draftParams.growth}
                  onChange={(v) => {
                    setDraftParams({
                      ...draftParams, 
                      growth: v,
                      _editedFields: addEditedField(draftParams._editedFields, 'growth')
                    });
                  }}
                  isAutoPop={true}
                  historicalValue={draftParams._historicalValues?.growth}
                  helper="Expected annual revenue growth"
                />
                
                <SmartPctField 
                  label="EBITDA Margin"
                  value={(1 - draftParams.cogsPct - draftParams.opexPct)}
                  onChange={(v) => {
                    // Auto-calculate COGS and OPEX to achieve target EBITDA margin
                    // Assume 60% COGS, 40% OPEX of total operating costs
                    const totalOpCosts = 1 - v;
                    setDraftParams({
                      ...draftParams, 
                      cogsPct: totalOpCosts * 0.60,
                      opexPct: totalOpCosts * 0.40,
                      _editedFields: addEditedField(draftParams._editedFields, 'ebitdaMargin')
                    });
                  }}
                  helper="EBITDA as % of revenue (auto-calculates cost structure)"
                />
                
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
                        minDSCR: !isFieldEdited(draftParams._editedFields, 'minDSCR') ? benchmarks.minDSCR : draftParams.minDSCR,
                        targetICR: !isFieldEdited(draftParams._editedFields, 'targetICR') ? benchmarks.targetICR : draftParams.targetICR,
                        maxNDToEBITDA: !isFieldEdited(draftParams._editedFields, 'maxNDToEBITDA') ? benchmarks.maxNDToEBITDA : draftParams.maxNDToEBITDA,
                        _industryBenchmarks: benchmarks
                      });
                    }}
                    className="w-full h-10 text-sm border-2 border-slate-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
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
                  <p className="text-xs text-slate-500">Auto-populates covenant thresholds</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">Currency</Label>
                  <select
                    value={ccy}
                    onChange={(e) => setCcy(e.target.value)}
                    className="w-full h-10 text-sm border-2 border-slate-300 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
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
              
              {/* Quick Preview */}
              {draftParams.baseRevenue > 0 && (
                <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-blue-900 mb-2">Quick Calculation</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-blue-700">Revenue</p>
                          <p className="text-lg font-bold text-blue-900">
                            {currencyFmtMM(draftParams.baseRevenue, ccy)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-700">EBITDA ({pctFmt((1 - draftParams.cogsPct - draftParams.opexPct))})</p>
                          <p className="text-lg font-bold text-blue-900">
                            {currencyFmtMM(draftParams.baseRevenue * (1 - draftParams.cogsPct - draftParams.opexPct), ccy)}
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-700">Est. Debt Capacity</p>
                          <p className="text-lg font-bold text-blue-900">
                            {currencyFmtMM(
                              draftParams.baseRevenue * (1 - draftParams.cogsPct - draftParams.opexPct) * 
                              (draftParams._industryBenchmarks?.maxNDToEBITDA || 3.5), 
                              ccy
                            )}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Based on {(draftParams._industryBenchmarks?.maxNDToEBITDA || 3.5).toFixed(1)}x EBITDA ({draftParams.industry || 'Manufacturing'} benchmark)
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 mt-3 border-t border-blue-200 pt-2">
                        <strong>Note:</strong> Debt capacity is a rough estimate based on industry leverage multiples. 
                        Actual capacity depends on DSCR requirements, interest rates, and loan terms. 
                        See Capital Structure Analysis for detailed capacity analysis.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* NEW FACILITY DESIGN - Always Open */}
          {/* ============================================ */}
          <Card className="border-l-2 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="w-4 h-4 text-emerald-600" />
                New Facility Design
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Configure the debt facility terms
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Core Terms */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Core Terms
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MoneyField 
                    label="Loan Amount" 
                    value={draftParams.requestedLoanAmount} 
                    onChange={(v) => setDraftParams({...draftParams, requestedLoanAmount: v})} 
                    ccy={ccy}
                  />
                  <PctField 
                    label="Interest Rate (Annual)" 
                    value={draftParams.proposedPricing} 
                    onChange={(v) => setDraftParams({...draftParams, proposedPricing: v})}
                  />
                  <NumberField 
                    label="Loan Term (Years)" 
                    value={draftParams.proposedTenor} 
                    onChange={(v) => setDraftParams({...draftParams, proposedTenor: v})} 
                    min={1} 
                    max={30}
                  />
                </div>
              </div>
              
              {/* AMORTIZATION STRUCTURE */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Repayment Structure
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AMORTIZATION TYPE - PRIMARY SELECTOR */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">
                      Amortization Type
                      <span className="ml-2 text-xs text-slate-500">(How principal is repaid)</span>
                    </Label>
                    <select
                      value={draftParams.facilityAmortizationType}
                      onChange={(e) => {
                        const type = e.target.value;
                        setDraftParams(prev => ({
                          ...prev,
                          facilityAmortizationType: type,
                          // Auto-adjust related fields
                          interestOnlyPeriod: type === 'interest-only' ? prev.proposedTenor : 
                                             type === 'bullet' ? prev.proposedTenor : 0,
                          balloonPercentage: type === 'balloon' ? 50 : 0,
                        }));
                      }}
                      className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
                    >
                      <option value="amortizing">Fully Amortizing (Principal + Interest)</option>
                      <option value="interest-only">Interest-Only (Balloon at Maturity)</option>
                      <option value="bullet">Bullet Payment (All Principal at Maturity)</option>
                      <option value="balloon">Balloon Payment (Partial Amortization + Final Balloon)</option>
                    </select>
                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                      {draftParams.facilityAmortizationType === 'amortizing' && 
                        "Principal and interest paid every period. Loan fully repaid at maturity."}
                      {draftParams.facilityAmortizationType === 'interest-only' && 
                        "Only interest paid each period. All principal due at maturity."}
                      {draftParams.facilityAmortizationType === 'bullet' && 
                        "No payments until maturity. All principal + accrued interest due at end."}
                      {draftParams.facilityAmortizationType === 'balloon' && 
                        "Partial principal + interest paid each period. Large balloon payment at maturity."}
                    </div>
                  </div>
                  
                  {/* PAYMENT FREQUENCY */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Payment Frequency</Label>
                    <select
                      value={draftParams.paymentFrequency}
                      onChange={(e) => setDraftParams({...draftParams, paymentFrequency: e.target.value})}
                      className="w-full h-12 px-4 text-base font-semibold border-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annually">Semi-Annually</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>
                </div>
                
                {/* Conditional: Interest-Only Period for Amortizing */}
                {draftParams.facilityAmortizationType === 'amortizing' && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <Label className="text-sm font-semibold text-emerald-900 mb-2">
                      Interest-Only Period (Optional)
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <NumberField 
                        label="Interest-Only Years" 
                        value={draftParams.interestOnlyPeriod} 
                        onChange={(v) => setDraftParams({...draftParams, interestOnlyPeriod: v})} 
                        min={0} 
                        max={draftParams.proposedTenor}
                      />
                      <div className="flex items-end">
                        <div className="text-xs text-emerald-800 bg-emerald-100 p-3 rounded">
                          <strong>Effect:</strong> First {draftParams.interestOnlyPeriod} years = interest only. 
                          Then {draftParams.proposedTenor - draftParams.interestOnlyPeriod} years of principal + interest.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Conditional: Balloon Percentage */}
                {draftParams.facilityAmortizationType === 'balloon' && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <Label className="text-sm font-semibold text-amber-900 mb-2">
                      Balloon Payment Configuration
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">
                          Balloon Amount (% of Principal)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={draftParams.balloonPercentage}
                          onChange={(e) => setDraftParams({...draftParams, balloonPercentage: Number(e.target.value)})}
                          className="h-10 text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="text-xs text-amber-800 bg-amber-100 p-3 rounded">
                          <strong>Balloon payment at maturity:</strong><br/>
                          {currencyFmtMM(draftParams.requestedLoanAmount * (draftParams.balloonPercentage / 100), ccy)}
                          <br/>
                          <strong>Regular amortization:</strong><br/>
                          {currencyFmtMM(draftParams.requestedLoanAmount * (1 - draftParams.balloonPercentage / 100), ccy)} 
                          over {draftParams.proposedTenor} years
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Debt Service Preview */}
              {draftParams.requestedLoanAmount > 0 && draftParams.proposedPricing > 0 && (
                <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-emerald-900 mb-2">Estimated Annual Debt Service</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-emerald-700">Interest Payment</p>
                          <p className="text-lg font-bold text-emerald-900">
                            {currencyFmtMM(draftParams.requestedLoanAmount * draftParams.proposedPricing, ccy)}
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">
                            {draftParams.facilityAmortizationType === 'amortizing' 
                              ? "Year 1 (decreases as principal is paid)"
                              : "Annual interest on principal"}
                          </p>
                        </div>
                        <div>
                          <p className="text-emerald-700">Principal Payment (Avg)</p>
                          <p className="text-lg font-bold text-emerald-900">
                            {draftParams.facilityAmortizationType === 'amortizing' 
                              ? currencyFmtMM(
                                  draftParams.requestedLoanAmount / 
                                  Math.max(1, draftParams.proposedTenor - draftParams.interestOnlyPeriod), 
                                  ccy
                                )
                              : draftParams.facilityAmortizationType === 'balloon'
                              ? currencyFmtMM(
                                  draftParams.requestedLoanAmount * (1 - draftParams.balloonPercentage/100) / 
                                  draftParams.proposedTenor, 
                                  ccy
                                )
                              : currencyFmtMM(0, ccy)}
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">
                            {draftParams.facilityAmortizationType === 'amortizing' 
                              ? "Straight-line amortization"
                              : draftParams.facilityAmortizationType === 'balloon'
                              ? "Excluding balloon payment"
                              : "No scheduled principal"}
                          </p>
                        </div>
                        <div>
                          <p className="text-emerald-700">Total Debt Service</p>
                          <p className="text-xl font-bold text-emerald-900">
                            {currencyFmtMM(
                              (draftParams.requestedLoanAmount * draftParams.proposedPricing) + 
                              (draftParams.facilityAmortizationType === 'amortizing' 
                                ? draftParams.requestedLoanAmount / Math.max(1, draftParams.proposedTenor - draftParams.interestOnlyPeriod)
                                : draftParams.facilityAmortizationType === 'balloon'
                                ? draftParams.requestedLoanAmount * (1 - draftParams.balloonPercentage/100) / draftParams.proposedTenor
                                : 0), 
                              ccy
                            )}
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">
                            Year 1 estimate (P+I)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* EXISTING DEBT - Conditional */}
          {/* ============================================ */}
          <Card className="border-l-2 border-l-slate-400">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building className="w-4 h-4 text-slate-600" />
                    Existing Debt
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Toggle if company has existing debt obligations
                  </p>
                </div>
                
                {/* Toggle Switch - Simplified */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={draftParams.hasExistingDebt}
                    onChange={(e) => {
                      setDraftParams({
                        ...draftParams, 
                        hasExistingDebt: e.target.checked,
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </CardHeader>
            
            {draftParams.hasExistingDebt && (
              <CardContent className="p-6 space-y-6">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                  <strong>Note:</strong> The projection will model BOTH existing debt service AND the new facility.
                </div>
                
                {/* Simple Existing Debt Inputs (when multi-tranche is OFF) */}
                {!draftParams.hasMultipleTranches && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      Single Existing Debt Facility
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <MoneyField 
                        label="Outstanding Balance" 
                        value={draftParams.existingDebtAmount} 
                        onChange={(v) => setDraftParams({...draftParams, existingDebtAmount: v})} 
                        ccy={ccy}
                      />
                      <PctField 
                        label="Interest Rate" 
                        value={draftParams.existingDebtRate} 
                        onChange={(v) => setDraftParams({...draftParams, existingDebtRate: v})}
                      />
                      <NumberField 
                        label="Years Remaining" 
                        value={draftParams.existingDebtTenor} 
                        onChange={(v) => setDraftParams({...draftParams, existingDebtTenor: v})} 
                        min={1} 
                        max={30}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Amortization Type</Label>
                        <select
                          value={draftParams.existingDebtAmortizationType}
                          onChange={(e) => setDraftParams({...draftParams, existingDebtAmortizationType: e.target.value})}
                          className="w-full h-10 px-3 text-sm border-2 border-slate-300 rounded-md"
                        >
                          <option value="amortizing">Amortizing (Principal + Interest)</option>
                          <option value="interest-only">Interest-Only</option>
                          <option value="bullet">Bullet Payment</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700">Payment Frequency</Label>
                        <select
                          value={draftParams.openingDebtPaymentFrequency}
                          onChange={(e) => setDraftParams({...draftParams, openingDebtPaymentFrequency: e.target.value})}
                          className="w-full h-10 px-3 text-sm border-2 border-slate-300 rounded-md"
                        >
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                          <option value="Semi-Annually">Semi-Annually</option>
                          <option value="Annually">Annually</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Multi-Tranche Toggle */}
                <div className="mt-6 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2"><Layers className="w-4 h-4" /> Multiple Debt Tranches</h4>
                      <p className="text-xs text-indigo-700 mt-1">
                        Enable if company has multiple loans with different terms (e.g., senior + subordinated)
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={draftParams.hasMultipleTranches}
                        onChange={(e) => {
                          const isEnabled = e.target.checked;
                          // Helper function to create tranches using current form values
                          const createDefaultTranches = () => {
                            const tranches = [];

                            // Add existing debt tranche if present
                            if (draftParams.hasExistingDebt && (draftParams.existingDebtAmount || draftParams.openingDebt) > 0) {
                              tranches.push({
                                id: Date.now(),
                                name: 'Existing Debt',
                                amount: draftParams.existingDebtAmount || draftParams.openingDebt || 0,
                                rate: draftParams.existingDebtRate || draftParams.interestRate || 0.08,
                                tenorYears: draftParams.existingDebtTenor || draftParams.debtTenorYears || 5,
                                maturityDate: draftParams.openingDebtMaturityDate || `${new Date().getFullYear() + 5}-12-31`,
                                amortizationType: draftParams.existingDebtAmortizationType || 'amortizing',
                                paymentFrequency: draftParams.openingDebtPaymentFrequency || 'Quarterly',
                                interestOnlyYears: 0,
                                seniority: 'Senior Secured'
                              });
                            }

                            // Add new facility tranche if present
                            if (draftParams.requestedLoanAmount > 0) {
                              tranches.push({
                                id: Date.now() + 1,
                                name: 'New Facility',
                                amount: draftParams.requestedLoanAmount || 0,
                                rate: draftParams.proposedPricing || draftParams.interestRate || 0.08,
                                tenorYears: draftParams.proposedTenor || draftParams.debtTenorYears || 5,
                                maturityDate: `${new Date().getFullYear() + (draftParams.proposedTenor || 5)}-12-31`,
                                amortizationType: draftParams.facilityAmortizationType || 'amortizing',
                                paymentFrequency: draftParams.paymentFrequency || 'Quarterly',
                                interestOnlyYears: draftParams.interestOnlyPeriod || 0,
                                seniority: 'Senior Secured'
                              });
                            }

                            // If no debt configured, create a default placeholder tranche
                            if (tranches.length === 0) {
                              tranches.push({
                                id: Date.now(),
                                name: 'Tranche 1',
                                amount: 0,
                                rate: draftParams.interestRate || 0.08,
                                tenorYears: draftParams.debtTenorYears || 5,
                                maturityDate: `${new Date().getFullYear() + 5}-12-31`,
                                amortizationType: 'amortizing',
                                paymentFrequency: 'Quarterly',
                                interestOnlyYears: 0,
                                seniority: 'Senior Secured'
                              });
                            }

                            return tranches;
                          };

                          setDraftParams({
                            ...draftParams,
                            hasMultipleTranches: isEnabled,
                            debtTranches: isEnabled
                              ? (draftParams.debtTranches?.length > 0
                                  ? draftParams.debtTranches
                                  : createDefaultTranches())
                              : draftParams.debtTranches
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-sm"></div>
                    </label>
                  </div>
                </div>
                
                {/* Multi-Tranche Manager (your existing component) */}
                {draftParams.hasMultipleTranches && (
                  <div className="mt-4">
                    <DebtTrancheManager 
                      tranches={draftParams.debtTranches || []}
                      onChange={(tranches) => setDraftParams({ ...draftParams, debtTranches: tranches })}
                      ccy={ccy}
                    />
                    
                    {draftParams.debtTranches?.length > 0 && (
                      <div className="mt-4">
                        <BlendedDebtMetrics 
                          tranches={draftParams.debtTranches} 
                          ccy={ccy}
                          startYear={draftParams.startYear}
                          projectionYears={draftParams.years}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ============================================ */}
          {/* OPENING BALANCE SHEET */}
          {/* ============================================ */}
          <Card className="border-l-2 border-l-teal-400">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="w-4 h-4 text-teal-600" />
                Opening Balance Sheet
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Initial cash balance affects Net Debt calculation
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MoneyField
                  label="Opening Cash Balance"
                  value={draftParams.openingCash}
                  onChange={(v) => setDraftParams({...draftParams, openingCash: v})}
                  ccy={ccy}
                />
                <div className="flex items-end">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-700">
                    <strong>Why this matters:</strong> Net Debt = Gross Debt - Cash.
                    If you have opening cash, your leverage ratios will be more accurate.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* TIER 2: COLLAPSED BY DEFAULT SECTIONS */}
          {/* ============================================ */}

          {/* Historical Data & Assumptions - COLLAPSED */}
          <CollapsibleCard 
            title="Historical Data & Assumptions" 
            icon={BarChart3} 
            color="blue" 
            defaultOpen={false}
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
                  ccy={ccy}
                  accessToken={accessToken}
                />
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Financial Parameters - COLLAPSED */}
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
                  
                  <SmartPctField 
                    label="COGS %"
                    value={draftParams.cogsPct}
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        cogsPct: v,
                        _editedFields: addEditedField(draftParams._editedFields, 'cogsPct')
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
                        _editedFields: addEditedField(draftParams._editedFields, 'opexPct')
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
                        _editedFields: addEditedField(draftParams._editedFields, 'capexPct')
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
                        _editedFields: addEditedField(draftParams._editedFields, 'wcPctOfRev')
                      });
                    }}
                    isAutoPop={true}
                    historicalValue={draftParams._historicalValues?.wcPctOfRev}
                    helper="Working capital as % of revenue"
                  />
                  <PctField label="Tax Rate" value={draftParams.taxRate} onChange={(v) => setDraftParams({...draftParams, taxRate: v})}/>
                  <PctField label="WACC" value={draftParams.wacc} onChange={(v) => setDraftParams({...draftParams, wacc: v})}/>
                  <PctField label="Terminal Growth" value={draftParams.terminalGrowth} onChange={(v) => setDraftParams({...draftParams, terminalGrowth: v})}/>
                  <MoneyField label="Equity Contribution" value={draftParams.equityContribution} onChange={(v) => setDraftParams({...draftParams, equityContribution: v})} ccy={ccy}/>
                  <NumberField label="Entry Multiple" value={draftParams.entryMultiple} onChange={(v) => setDraftParams({...draftParams, entryMultiple: v})} min={1} max={20} step={0.1}/>
                  <NumberField 
                    label="Shares Outstanding" 
                    value={draftParams.sharesOutstanding || 1000000} 
                    onChange={(v) => setDraftParams({...draftParams, sharesOutstanding: v})} 
                    min={1} 
                    step={1000}
                  />
                </div>
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Credit Assessment & Covenants - COLLAPSED */}
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
                    label="Min DSCR" 
                    value={draftParams.minDSCR} 
                    onChange={(v) => {
                      setDraftParams({
                        ...draftParams, 
                        minDSCR: v,
                        _editedFields: addEditedField(draftParams._editedFields, 'minDSCR')
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
                        _editedFields: addEditedField(draftParams._editedFields, 'targetICR')
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
                        _editedFields: addEditedField(draftParams._editedFields, 'maxNDToEBITDA')
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

          {/* ============================================ */}
          {/* TIER 3: DEAL DOCUMENTATION (Collapsed) */}
          {/* ============================================ */}

          {/* Deal Information & Structure - COLLAPSED */}
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
              </CardContent>
            </Card>
          </CollapsibleCard>

          {/* Business & Credit Information - COLLAPSED */}
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
        <TabsList className="flex overflow-x-auto lg:grid lg:grid-cols-8 w-full bg-slate-100 p-1 rounded-lg shadow-sm scrollbar-hide">
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
    <span className="hidden sm:inline">Debt Stress</span>
    <span className="sm:hidden">Debt</span>
  </TabsTrigger>
  <TabsTrigger value="custom-stress" className="flex-shrink-0 text-sm whitespace-nowrap">
    <Sliders className="w-4 h-4 mr-2" />
    <span className="hidden sm:inline">Custom Stress</span>
    <span className="sm:hidden">Custom</span>
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
              accessToken={accessToken}
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
              accessToken={accessToken}
            />
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <p className="text-yellow-800 font-semibold">Loading stress testing data...</p>
            </div>
          )}
        </TabsContent>

        {/* Custom Stress Testing */}
        <TabsContent value="custom-stress" className="space-y-6">
          {projections?.base ? (
            <CustomStressTesting
              projections={projections}
              params={params}
              customShocks={customShocks}
              onShocksChange={setCustomShocks}
              ccy={ccy}
            />
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <p className="text-yellow-800 font-semibold">Loading custom stress testing...</p>
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
            accessToken={accessToken}
          />
        </TabsContent>
      </Tabs>


      {/* Render Dialogs */}
      <SaveDialog
        show={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={saveScenario}
        currentName={currentScenarioName}
      />

      <LoadDialog
        show={showLoadDialog}
        onClose={() => setShowLoadDialog(false)}
        scenarios={scenarios}
        onLoad={loadScenario}
        onDelete={deleteScenario}
        onDuplicate={duplicateScenario}
      />

      <ClearConfirmDialog
        show={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
      />
    </div>
  );
});

FinancialModelAndStressTester.displayName = 'FinancialModelAndStressTester';

export default FinancialModelAndStressTester;
