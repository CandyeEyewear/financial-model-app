import React, { useState, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./components/Card";
import { Button } from "./components/Button";
import { KPI } from "./components/KPI";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/Tabs";
import { NumberField, MoneyField, PctField } from "./components/Fields";
import { HistoricalDataTab } from "./components/HistoricalDataTab";
import { CapitalStructureAnalysis } from "./components/CapitalStructureAnalysis";
import { CreditDashboard } from "./components/CreditDashboard";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { DataTable } from "./components/DataTable";
import ChatAssistant from "./src/ChatAssistant";
import { currencyFmtMM, pctFmt, numFmt } from "./utils/formatters";
import { calculateHistoricalAssumptions } from "./utils/calculations";
import { Download, MessageSquare } from "lucide-react";

// NOTE: You'll need to import your buildProjection and applyShocks functions from utils/calculations.js

// Dummy PRESETS for ScenarioComparison (customize as needed)
const PRESETS = {
  base: { label: "Base Case", shocks: { growthDelta: 0, cogsDelta: 0, opexDelta: 0, capexDelta: 0, rateDelta: 0, waccDelta: 0, termGDelta: 0 } },
  mild: { label: "Mild Recession", shocks: { growthDelta: -0.03, cogsDelta: 0.01, opexDelta: 0.005, capexDelta: -0.003, rateDelta: 0.01, waccDelta: 0.01, termGDelta: -0.002 } },
  severe: { label: "Severe Recession", shocks: { growthDelta: -0.08, cogsDelta: 0.03, opexDelta: 0.015, capexDelta: -0.01, rateDelta: 0.02, waccDelta: 0.02, termGDelta: -0.01 } },
  costShock: { label: "Cost Inflation", shocks: { growthDelta: -0.02, cogsDelta: 0.05, opexDelta: 0.01, capexDelta: 0, rateDelta: 0, waccDelta: 0.005, termGDelta: -0.003 } },
  rateHike: { label: "Rate Shock", shocks: { growthDelta: -0.01, cogsDelta: 0, opexDelta: 0, capexDelta: 0, rateDelta: 0.03, waccDelta: 0.015, termGDelta: -0.002 } },
};

function download(filename, text) {
  const element = document.createElement("a");
  const file = new Blob([text], { type: "text/csv;charset=utf-8;" });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default function App({ buildProjection, applyShocks }) {
  const [ccy, setCcy] = useState("JMD");
  const [params, setParams] = useState({
    startYear: new Date().getFullYear(),
    years: 5,
    baseRevenue: 300_000_000,
    growth: 0.10,
    cogsPct: 0.52,
    opexPct: 0.20,
    capexPct: 0.04,
    daPctOfPPE: 0.12,
    wcPctOfRev: 0.12,
    openingDebt: 120_000_000,
    interestRate: 0.12,
    taxRate: 0.25,
    wacc: 0.16,
    terminalGrowth: 0.03,
    debtTenorYears: 5,
    interestOnlyYears: 1,
    minDSCR: 1.2,
    maxNDToEBITDA: 3.5,
    targetICR: 2.0,
    equityContribution: 50_000_000,
    entryMultiple: 8.0,
    currency: "JMD",
  });

  const [customShocks, setCustomShocks] = useState({
    growthDelta: 0, cogsDelta: 0, opexDelta: 0, capexDelta: 0,
    rateDelta: 0, waccDelta: 0, termGDelta: 0,
  });

  const [showInputs, setShowInputs] = useState(false);
  const [activeTab, setActiveTab] = useState("historical");
  const [showChat, setShowChat] = useState(false);

  // Historical data state
  const [historicalData, setHistoricalData] = useState([
    { year: 2021, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0 },
    { year: 2022, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0 },
    { year: 2023, revenue: 0, ebitda: 0, netIncome: 0, totalAssets: 0, workingCapital: 0 },
  ]);

  // Param update handler with debt field synchronization
  const handleParamUpdate = useCallback((paramName, newValue) => {
    setParams(prev => {
      const updated = { ...prev, [paramName]: newValue };

      // Sync debt fields to maintain consistency
      if (paramName === 'openingDebt') {
        updated.existingDebtAmount = newValue;
        updated.hasExistingDebt = newValue > 0;
      }
      if (paramName === 'existingDebtAmount') {
        updated.openingDebt = newValue;
        updated.hasExistingDebt = newValue > 0;
      }

      return updated;
    });
  }, []);

  // Stress test handler
  const handleRunStressTest = useCallback((shocks) => {
    setCustomShocks(prev => ({ ...prev, ...shocks }));
    // Navigate to custom stress tab to show results
    setActiveTab('custom');
  }, []);

  // Tab navigation handler
  const handleNavigateToTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Apply historical assumptions to model parameters
  const applyHistoricalAssumptions = () => {
    const assumptions = calculateHistoricalAssumptions(historicalData);
    if (assumptions) {
      setParams({
        ...params,
        baseRevenue: assumptions.baseRevenue,
        growth: assumptions.growth,
        cogsPct: assumptions.cogsPct,
        opexPct: assumptions.opexPct,
        wcPctOfRev: assumptions.wcPctOfRev,
        capexPct: assumptions.capexPct,
      });
      setShowInputs(true); // Show inputs so user can see what was applied
    }
  };

  // Build projections (memoized)
  const projections = useMemo(() => {
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
  }, [params, customShocks, buildProjection, applyShocks]);

  // Create complete modelData object for AI context
  const modelData = useMemo(() => ({
    params: { ...params, currency: ccy },
    projections,
    historicalData,
    customShocks,
    valuationResults: projections.base ? {
      enterpriseValue: projections.base.enterpriseValue,
      equityValue: projections.base.equityValue,
      pvOfProjectedFCFs: projections.base.pvOfProjectedFCFs,
      pvOfTerminalValue: projections.base.tvPV,
      terminalValue: projections.base.tv,
      wacc: params.wacc,
      costOfEquity: projections.base.costOfEquity,
      afterTaxCostOfDebt: projections.base.afterTaxCostOfDebt,
      netDebt: projections.base.netDebt || params.openingDebt,
      impliedMultiples: projections.base.impliedMultiples
    } : null,
    stressTestResults: Object.keys(projections).length > 1 ? projections : null
  }), [params, ccy, projections, historicalData, customShocks]);

  const exportToCSV = () => {
    const headers = ["Scenario", "Enterprise Value", "Equity Value", "Equity MOIC", "Equity IRR", "Min DSCR", "Max Leverage"];
    const rows = Object.keys(projections).map(key => [
      PRESETS[key]?.label || key,
      projections[key].enterpriseValue,
      projections[key].equityValue,
      projections[key].equityMOIC,
      projections[key].irr,
      projections[key].creditStats.minDSCR,
      projections[key].creditStats.maxLeverage,
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    download("financial_model_summary.csv", csv);
  };

  return (
    <div className="p-4 max-w-[1800px] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img
            src="https://salesmasterjm.com/hs-fs/hubfs/Udemy%20Logo.png?width=100&height=100&name=Udemy%20Logo.png"
            alt="SalesMaster Logo"
            className="h-12 w-12"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">SM Investment Banking Model</h1>
            <p className="text-sm text-slate-600">Capital Structure & Stress Testing Platform</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setShowInputs(!showInputs)}
            className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-2 shadow-md"
          >
            {showInputs ? "Hide" : "Show"} Inputs
          </Button>
          <Button
            size="sm"
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 shadow-md"
          >
            <Download className="w-3 h-3 mr-1" />
            Export Summary
          </Button>
          <Button
            size="sm"
            onClick={() => setShowChat(!showChat)}
            className={`${showChat ? 'bg-indigo-700' : 'bg-indigo-600'} hover:bg-indigo-700 text-white text-xs px-3 py-2 shadow-md`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            {showChat ? 'Hide' : 'AI'} Assistant
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          label="Enterprise Value"
          value={currencyFmtMM(projections.base?.enterpriseValue, ccy)}
        />
        <KPI
          label="Equity Value"
          value={currencyFmtMM(projections.base?.equityValue, ccy)}
        />
        <KPI
          label="Equity MOIC"
          value={numFmt(projections.base?.equityMOIC) + "x"}
          trend={projections.base?.equityMOIC > 2 ? 'up' : 'down'}
        />
        <KPI
          label="Equity IRR"
          value={pctFmt(projections.base?.irr)}
          trend={projections.base?.irr > 0.15 ? 'up' : 'down'}
        />
      </div>

      {showInputs && (
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle>Model Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs" htmlFor="currency">Currency</label>
                <select
                  id="currency"
                  value={ccy}
                  onChange={(e) => setCcy(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="JMD">JMD - Jamaican Dollar</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                </select>
              </div>
              <MoneyField label="Base Revenue" value={params.baseRevenue} onChange={(v) => setParams({ ...params, baseRevenue: v })} ccy={ccy} />
              <PctField label="Revenue Growth" value={params.growth} onChange={(v) => setParams({ ...params, growth: v })} />
              <PctField label="COGS %" value={params.cogsPct} onChange={(v) => setParams({ ...params, cogsPct: v })} />
              <PctField label="Opex %" value={params.opexPct} onChange={(v) => setParams({ ...params, opexPct: v })} />
              <PctField label="Capex %" value={params.capexPct} onChange={(v) => setParams({ ...params, capexPct: v })} />
              <MoneyField label="Opening Debt" value={params.openingDebt} onChange={(v) => setParams({ ...params, openingDebt: v })} ccy={ccy} />
              <PctField label="Interest Rate" value={params.interestRate} onChange={(v) => setParams({ ...params, interestRate: v })} />
              <PctField label="WACC" value={params.wacc} onChange={(v) => setParams({ ...params, wacc: v })} />
              <PctField label="Tax Rate" value={params.taxRate} onChange={(v) => setParams({ ...params, taxRate: v })} />
              <PctField label="Terminal Growth" value={params.terminalGrowth} onChange={(v) => setParams({ ...params, terminalGrowth: v })} />
              <NumberField label="Entry Multiple" value={params.entryMultiple} onChange={(v) => setParams({ ...params, entryMultiple: v })} step={0.1} />
              <MoneyField label="Equity Contribution" value={params.equityContribution} onChange={(v) => setParams({ ...params, equityContribution: v })} ccy={ccy} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        {/* Main content area */}
        <div className={`${showChat ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="historical">Historical Data</TabsTrigger>
              <TabsTrigger value="capital">Capital Structure</TabsTrigger>
              <TabsTrigger value="dashboard">Credit Dashboard</TabsTrigger>
              <TabsTrigger value="scenarios">Scenario Analysis</TabsTrigger>
              <TabsTrigger value="custom">Custom Stress</TabsTrigger>
              <TabsTrigger value="tables">Data Tables</TabsTrigger>
            </TabsList>

            <TabsContent value="historical">
              <HistoricalDataTab
                historicalData={historicalData}
                setHistoricalData={setHistoricalData}
                onApplyAssumptions={applyHistoricalAssumptions}
                ccy={ccy}
              />
            </TabsContent>

            <TabsContent value="capital">
              <CapitalStructureAnalysis params={params} ccy={ccy} buildProjection={buildProjection} />
            </TabsContent>

            <TabsContent value="dashboard">
              <CreditDashboard projections={projections} ccy={ccy} />
            </TabsContent>

            <TabsContent value="scenarios">
              <ScenarioComparison projections={projections} ccy={ccy} PRESETS={PRESETS} />
            </TabsContent>

            <TabsContent value="custom">
              {/* Custom stress test UI */}
              <Card>
                <CardHeader>
                  <CardTitle>Custom Stress Test</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <PctField
                      label="Revenue Growth Δ"
                      value={customShocks.growthDelta}
                      onChange={(v) => setCustomShocks(prev => ({ ...prev, growthDelta: v }))}
                    />
                    <PctField
                      label="COGS Δ"
                      value={customShocks.cogsDelta}
                      onChange={(v) => setCustomShocks(prev => ({ ...prev, cogsDelta: v }))}
                    />
                    <PctField
                      label="OpEx Δ"
                      value={customShocks.opexDelta}
                      onChange={(v) => setCustomShocks(prev => ({ ...prev, opexDelta: v }))}
                    />
                    <PctField
                      label="Interest Rate Δ"
                      value={customShocks.rateDelta}
                      onChange={(v) => setCustomShocks(prev => ({ ...prev, rateDelta: v }))}
                    />
                  </div>
                  {projections.custom && (
                    <DataTable projection={projections.custom} ccy={ccy} title="Custom Stress Results" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tables">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Base Case Projection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable projection={projections.base} ccy={ccy} title="Base Case" />
                  </CardContent>
                </Card>
                {projections.custom && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Custom Stress Projection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DataTable projection={projections.custom} ccy={ccy} title="Custom Stress" />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* AI Chat Panel */}
        {showChat && (
          <div className="w-1/3 transition-all duration-300">
            <Card className="h-[calc(100vh-280px)] sticky top-4">
              <ChatAssistant
                modelData={modelData}
                onParamUpdate={handleParamUpdate}
                onRunStressTest={handleRunStressTest}
                onNavigateToTab={handleNavigateToTab}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}