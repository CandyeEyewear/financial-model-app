import React, { useState } from "react";
import FinancialModelAndStressTester from "./FinancialModelAndStressTester.js";
import ChatAssistant from "./ChatAssistant.js";
import { currencyFmtMM, numFmt, pctFmt } from "./utils/formatters.js";
import "./index.css";

// Add this function to generate comprehensive tab summaries
const generateTabSummaries = (modelData) => {
  if (!modelData) return "No model data available yet. Please configure the financial model first.";

  const { projections, params, historicalData } = modelData;
  
  let summaries = [];

  // Historical Data Summary
  if (historicalData && historicalData.length > 0) {
    const validHistorical = historicalData.filter(d => d.revenue > 0);
    if (validHistorical.length > 0) {
      const latestYear = validHistorical[validHistorical.length - 1];
      const revenueGrowth = validHistorical.length >= 2 
        ? ((latestYear.revenue - validHistorical[validHistorical.length - 2].revenue) / validHistorical[validHistorical.length - 2].revenue * 100).toFixed(1)
        : 'N/A';
      
      summaries.push(`📈 HISTORICAL DATA: ${validHistorical.length} years of data. Latest year ${latestYear.year}: Revenue ${currencyFmtMM(latestYear.revenue)}, EBITDA ${currencyFmtMM(latestYear.ebitda)}, Net Income ${currencyFmtMM(latestYear.netIncome)}. Revenue growth: ${revenueGrowth}%`);
    } else {
      summaries.push("📈 HISTORICAL DATA: Data entered but no valid revenue figures yet.");
    }
  } else {
    summaries.push("📈 HISTORICAL DATA: No historical data entered.");
  }

  // Capital Structure Summary
  if (params) {
    const debtToEquity = params.equityContribution > 0 ? (params.openingDebt / params.equityContribution).toFixed(2) : "N/A";
    summaries.push(`🏛️ CAPITAL STRUCTURE: Base Revenue ${currencyFmtMM(params.baseRevenue)}, Debt ${currencyFmtMM(params.openingDebt)}, Equity ${currencyFmtMM(params.equityContribution)}, Debt/Equity Ratio ${debtToEquity}x, WACC ${pctFmt(params.wacc)}`);
  }

  // Credit Dashboard Summary
  if (projections?.base) {
    const base = projections.base;
    const minDSCR = Math.min(...base.rows.map(r => r.dscr));
    const maxLeverage = Math.max(...base.rows.map(r => r.ndToEbitda));
    summaries.push(`📊 CREDIT DASHBOARD: Enterprise Value ${currencyFmtMM(base.enterpriseValue)}, Equity Value ${currencyFmtMM(base.equityValue)}, MOIC ${base.moic.toFixed(2)}x, IRR ${pctFmt(base.irr)}, Min DSCR ${minDSCR.toFixed(2)}, Max Leverage ${maxLeverage.toFixed(2)}x`);
  }

  // Scenario Analysis Summary
  if (projections) {
    const scenarioKeys = Object.keys(projections).filter(key => key !== 'base');
    if (scenarioKeys.length > 0) {
      const scenarioImpacts = scenarioKeys.map(key => {
        const proj = projections[key];
        const baseIrr = projections.base?.irr || 0;
        const irrChange = baseIrr > 0 ? ((proj.irr - baseIrr) / baseIrr * 100).toFixed(1) : "N/A";
        return `${key}: IRR ${pctFmt(proj.irr)} (${irrChange}% vs base)`;
      });
      summaries.push(`🔄 SCENARIO ANALYSIS: ${scenarioKeys.length} stress scenarios tested: ${scenarioImpacts.join(', ')}`);
    } else {
      summaries.push("🔄 SCENARIO ANALYSIS: No stress scenarios configured yet.");
    }
  }

  // Debt Stress Testing Summary
  if (projections?.base) {
    const base = projections.base;
    const maxLeverage = Math.max(...base.rows.map(r => r.ndToEbitda));
    const minDSCR = Math.min(...base.rows.map(r => r.dscr));
    const minICR = Math.min(...base.rows.map(r => r.icr));
    const maxICR = Math.max(...base.rows.map(r => r.icr));
    
    const covenantStatus = [];
    if (params?.minDSCR && minDSCR < params.minDSCR) covenantStatus.push("DSCR breach");
    if (params?.maxNDToEBITDA && maxLeverage > params.maxNDToEBITDA) covenantStatus.push("Leverage breach");
    if (params?.targetICR && minICR < params.targetICR) covenantStatus.push("ICR breach");
    
    const covenantText = covenantStatus.length > 0 
      ? `⚠️ COVENANT ISSUES: ${covenantStatus.join(', ')}`
      : "✅ All covenants maintained";
    
    summaries.push(`⚡ DEBT STRESS: Peak leverage ${maxLeverage.toFixed(2)}x EBITDA, Minimum DSCR ${minDSCR.toFixed(2)}, ICR range ${minICR.toFixed(2)}-${maxICR.toFixed(2)}. ${covenantText}`);
  }

  // Deal Structure Summary
  if (params) {
    summaries.push(`💼 DEAL STRUCTURE: ${params.dealStructure || 'Term loan'}, ${params.proposedTenor || 5}-year tenor, ${pctFmt(params.proposedPricing || 0.12)} interest rate, ${params.requestedLoanAmount ? currencyFmtMM(params.requestedLoanAmount) : 'No loan'} requested`);
  }

  return summaries.join('\n\n');
};

function App() {
  const [showAssistant, setShowAssistant] = useState(false);

  // 🔹 Store model data in parent so both tester + assistant can access
  const [modelData, setModelData] = useState(null);

  return (
    <div className="App h-screen flex relative">
      {/* Main financial model section */}
      <div
        className={`flex-1 overflow-y-auto p-4 transition-all duration-300 ${
          showAssistant ? "mr-96" : ""
        }`}
      >
        {/* Pass callback so tester can push updates up */}
        <FinancialModelAndStressTester onDataUpdate={setModelData} />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setShowAssistant(!showAssistant)}
        className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-3 py-1 rounded shadow hover:bg-indigo-700"
      >
        {showAssistant ? "Hide Assistant" : "Show Assistant"}
      </button>

      {/* Chat assistant sidebar */}
      {showAssistant && (
        <div className="w-96 border-l bg-slate-50 flex flex-col fixed right-0 top-0 bottom-0 shadow-lg">
          {/* 🔹 Pass modelData AND tabSummaries down into ChatAssistant */}
          <ChatAssistant 
            modelData={modelData}
            tabSummaries={generateTabSummaries(modelData)}
          />
        </div>
      )}
    </div>
  );
}

export default App;