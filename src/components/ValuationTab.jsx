// components/ValuationTab.jsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Calculator, AlertCircle, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './Card.jsx';
import { Button } from './Button.jsx';
import { currencyFmtMM, numFmt, pctFmt } from '../utils/formatters.js';
import { 
  exportValuationToCSV, 
  exportSensitivityMatrix, 
  exportDCFBuildUp 
} from '../utils/exportValuationData.js';
import {
  calculateCostOfEquity,
  calculateAfterTaxCostOfDebt,
  calculateWACC,
  calculateDCF,
  generateSensitivityMatrix,
  createSensitivityRanges,
  calculateImpliedMultiples
} from '../utils/valuationCalculations.js';

export function ValuationTab({ projections, params, ccy }) {
  const [exportStatus, setExportStatus] = useState("");
  
  const [valuationInputs, setValuationInputs] = useState({
    riskFreeRate: 0.05,
    beta: 1.2,
    marketRiskPremium: 0.08,
    targetDebtRatio: 0.30,
    useExitMultiple: false,
    exitMultiple: 8.0,
    sharesOutstanding: 1000000
  });

  const valuationResults = useMemo(() => {
    // Validate inputs
    if (!projections || !projections.rows || projections.rows.length === 0) {
      console.warn('ValuationTab: No projection data available');
      return null;
    }
    
    if (!params) {
      console.error('ValuationTab: params object is missing');
      return null;
    }

    try {
      const rows = projections.rows;
      const finalYear = rows[rows.length - 1];
      
      // Extract FCFs (FCFF) from projection rows
      const projectedFCFs = rows.map(row => {
        if (typeof row.fcf !== 'number') {
          console.warn('ValuationTab: Invalid FCF value detected', row);
          return 0;
        }
        return row.fcf;
      });

      console.log('ValuationTab: Computing CAPM cost of equity', {
        riskFreeRate: valuationInputs.riskFreeRate,
        beta: valuationInputs.beta,
        marketRiskPremium: valuationInputs.marketRiskPremium
      });

      // Calculate cost of equity using CAPM
      const costOfEquity = calculateCostOfEquity(
        valuationInputs.riskFreeRate,
        valuationInputs.beta,
        valuationInputs.marketRiskPremium
      );

      // Calculate after-tax cost of debt
      const afterTaxCostOfDebt = calculateAfterTaxCostOfDebt(
        params.interestRate,
        params.taxRate
      );

      console.log('ValuationTab: Calculated capital costs', {
        costOfEquity: (costOfEquity * 100).toFixed(2) + '%',
        afterTaxCostOfDebt: (afterTaxCostOfDebt * 100).toFixed(2) + '%'
      });

      // Calculate WACC based on target capital structure
      const targetEquityRatio = 1 - valuationInputs.targetDebtRatio;
      const wacc = calculateWACC({
        equityValue: targetEquityRatio * 1000,
        debtValue: valuationInputs.targetDebtRatio * 1000,
        costOfEquity,
        afterTaxCostOfDebt
      });

      console.log('ValuationTab: Calculated WACC', {
        wacc: (wacc * 100).toFixed(2) + '%',
        targetDebtRatio: (valuationInputs.targetDebtRatio * 100).toFixed(1) + '%'
      });

      // Calculate net debt at valuation date (t=0)
      // CRITICAL: Use opening debt, not ending debt
      const currentDebt = params.openingDebt || 0;
      const currentCash = rows[0]?.cash || 0;
      const netDebt = currentDebt - currentCash;

      console.log('ValuationTab: Net debt calculation', {
        currentDebt,
        currentCash,
        netDebt
      });

      // Validate terminal growth rate vs WACC
      if (params.terminalGrowth >= wacc) {
        console.error('ValuationTab: Terminal growth >= WACC, this will produce invalid results', {
          terminalGrowth: params.terminalGrowth,
          wacc
        });
        return null;
      }

      // Run DCF valuation (Path A)
      console.log('ValuationTab: Running DCF calculation', {
        projectionYears: projectedFCFs.length,
        wacc: (wacc * 100).toFixed(2) + '%',
        terminalGrowth: (params.terminalGrowth * 100).toFixed(2) + '%',
        useExitMultiple: valuationInputs.useExitMultiple
      });

      const dcfResult = calculateDCF({
        projectedFCFs,
        wacc,
        terminalGrowthRate: params.terminalGrowth,
        finalYearEBITDA: finalYear.ebitda,
        useMultiple: valuationInputs.useExitMultiple,
        exitMultiple: valuationInputs.exitMultiple,
        netDebt,
        // FIXED: Don't pass cash separately - it's already in netDebt
        associatesValue: 0,
        minorityInterest: 0
      }, {
        debug: false, // Set to true for detailed DCF logging
        precision: 6
      });

      console.log('ValuationTab: DCF calculation complete', {
        enterpriseValue: dcfResult.enterpriseValue.toFixed(2),
        equityValue: dcfResult.equityValue.toFixed(2),
        terminalValue: dcfResult.terminalValue.toFixed(2)
      });

      // Calculate implied multiples
      const impliedMultiples = calculateImpliedMultiples(
        dcfResult.equityValue,
        dcfResult.enterpriseValue,
        {
          currentRevenue: rows[0]?.revenue || 0,
          currentEBITDA: rows[0]?.ebitda || 0,
          currentEBIT: rows[0]?.ebit || 0,
          currentNetIncome: rows[0]?.netIncome || 0,
          sharesOutstanding: valuationInputs.sharesOutstanding
        }
      );

      // Generate sensitivity analysis
      const waccRange = createSensitivityRanges(wacc, 5, 0.01);
      const growthRange = createSensitivityRanges(params.terminalGrowth, 5, 0.005);
      
      console.log('ValuationTab: Generating sensitivity matrix', {
        waccRange: waccRange.map(v => (v * 100).toFixed(2) + '%'),
        growthRange: growthRange.map(v => (v * 100).toFixed(2) + '%')
      });

      const sensitivityMatrix = generateSensitivityMatrix(
        {
          projectedFCFs,
          wacc,
          terminalGrowthRate: params.terminalGrowth,
          finalYearEBITDA: finalYear.ebitda,
          useMultiple: valuationInputs.useExitMultiple,
          exitMultiple: valuationInputs.exitMultiple,
          netDebt,
          associatesValue: 0,
          minorityInterest: 0
        },
        waccRange,
        growthRange
      );

      console.log('ValuationTab: Sensitivity matrix generated', {
        matrixSize: `${sensitivityMatrix.length}x${sensitivityMatrix[0].length}`,
        nullCells: sensitivityMatrix.flat().filter(v => v === null).length
      });

      return {
        costOfEquity,
        afterTaxCostOfDebt,
        wacc,
        netDebt,
        ...dcfResult,
        impliedMultiples,
        sensitivityMatrix,
        waccRange,
        growthRange
      };
    } catch (error) {
      console.error('ValuationTab: Error computing valuation', error);
      return null;
    }
  }, [projections, params, valuationInputs]);

  const handleExport = async (exportType) => {
    if (!valuationResults) {
      alert("No valuation data available to export. Please enter financial parameters first.");
      return;
    }
    
    try {
      setExportStatus("Exporting...");
      let success = false;
      
      switch (exportType) {
        case 'full':
          success = exportValuationToCSV(valuationResults, valuationInputs, params, ccy);
          break;
        case 'sensitivity':
          success = exportSensitivityMatrix(valuationResults, ccy);
          break;
        case 'buildup':
          success = exportDCFBuildUp(valuationResults, ccy);
          break;
        default:
          console.warn('ValuationTab: Unknown export type', exportType);
          break;
      }
      
      if (success) {
        setExportStatus("✓ Exported successfully!");
        setTimeout(() => setExportStatus(""), 3000);
      } else {
        setExportStatus("✗ Export failed");
        setTimeout(() => setExportStatus(""), 3000);
      }
    } catch (error) {
      console.error("ValuationTab: Export error", error);
      setExportStatus("✗ Export failed");
      setTimeout(() => setExportStatus(""), 3000);
    }
  };

  const PctInput = ({ label, value, onChange }) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={(value * 100).toFixed(2)}
          onChange={(e) => {
            const newValue = Number(e.target.value) / 100;
            if (!isNaN(newValue) && isFinite(newValue)) {
              onChange(newValue);
            }
          }}
          step="0.1"
          className="w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
        />
        <span className="text-slate-600 text-sm font-semibold">%</span>
      </div>
    </div>
  );

  const NumberInput = ({ label, value, onChange, step = 0.1 }) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const newValue = Number(e.target.value);
          if (!isNaN(newValue) && isFinite(newValue)) {
            onChange(newValue);
          }
        }}
        step={step}
        className="w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Export Buttons Bar */}
      <Card className="border-l-4 border-l-blue-600">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" />
              <div>
                <span className="font-semibold text-slate-800">Export Valuation Analysis</span>
                {exportStatus && (
                  <span className={`ml-3 text-sm ${
                    exportStatus.includes('✓') ? 'text-green-600' : 
                    exportStatus.includes('✗') ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {exportStatus}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleExport('full')}
                disabled={!valuationResults}
                className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 shadow-md font-semibold ${
                  !valuationResults ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                Full DCF Export
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('sensitivity')}
                disabled={!valuationResults}
                className={`bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 shadow-md font-semibold ${
                  !valuationResults ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                Sensitivity Matrix
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('buildup')}
                disabled={!valuationResults}
                className={`bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 shadow-md font-semibold ${
                  !valuationResults ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                DCF Build-Up
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Export comprehensive valuation data to CSV for validation and further analysis in Excel
            {!valuationResults && <span className="text-amber-600 font-semibold"> (Enter financial data to enable exports)</span>}
          </p>
        </CardContent>
      </Card>

      {!valuationResults ? (
        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">No projection data available for valuation analysis</p>
                <p className="text-sm text-slate-600 mt-1">
                  Enter financial parameters in the "Financial Parameters" section or add historical data to generate projections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Valuation Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Enterprise Value</div>
              <div className="text-3xl font-bold mb-1">{currencyFmtMM(valuationResults.enterpriseValue, ccy)}</div>
              <div className="text-xs opacity-80">DCF Valuation</div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Equity Value</div>
              <div className="text-3xl font-bold mb-1">{currencyFmtMM(valuationResults.equityValue, ccy)}</div>
              <div className="text-xs opacity-80">{currencyFmtMM(valuationResults.equityValue / valuationInputs.sharesOutstanding, ccy)} per share</div>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">WACC</div>
              <div className="text-3xl font-bold mb-1">{pctFmt(valuationResults.wacc)}</div>
              <div className="text-xs opacity-80">Discount Rate</div>
            </div>
          </div>

          {/* Valuation Inputs */}
          <Card className="border-l-4 border-l-purple-600">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-6 h-6 text-purple-600" />
                Valuation Inputs
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Configure terminal value assumptions. WACC of {pctFmt(params.wacc)} from Financial Parameters is used for consistency.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">WACC Components (Reference)</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-slate-600 font-semibold mb-1">Model WACC (Used in Valuation)</div>
                      <div className="text-2xl font-bold text-blue-600">{pctFmt(params.wacc)}</div>
                      <div className="text-xs text-slate-500 mt-1">From Financial Parameters</div>
                    </div>
                    
                    <div className="text-xs text-slate-600 font-semibold border-t pt-3 mt-3">CAPM Analysis (For Reference):</div>
                    
                    <PctInput
                      label="Risk-Free Rate"
                      value={valuationInputs.riskFreeRate}
                      onChange={(v) => setValuationInputs({...valuationInputs, riskFreeRate: v})}
                    />
                    <NumberInput
                      label="Beta"
                      value={valuationInputs.beta}
                      onChange={(v) => setValuationInputs({...valuationInputs, beta: v})}
                    />
                    <PctInput
                      label="Market Risk Premium"
                      value={valuationInputs.marketRiskPremium}
                      onChange={(v) => setValuationInputs({...valuationInputs, marketRiskPremium: v})}
                    />
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600 font-semibold">Implied Cost of Equity</div>
                      <div className="text-lg font-bold text-purple-600">{pctFmt(valuationResults.costOfEquity)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">Capital Structure</h4>
                  <div className="space-y-3">
                    <PctInput
                      label="Target Debt Ratio"
                      value={valuationInputs.targetDebtRatio}
                      onChange={(v) => setValuationInputs({...valuationInputs, targetDebtRatio: v})}
                    />
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600 font-semibold">After-Tax Cost of Debt</div>
                      <div className="text-lg font-bold text-purple-600">{pctFmt(valuationResults.afterTaxCostOfDebt)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {pctFmt(params.interestRate)} × (1 - {pctFmt(params.taxRate)})
                      </div>
                    </div>
                    <div className="pt-2">
                      <div className="text-xs text-slate-600 font-semibold">Net Debt</div>
                      <div className="text-lg font-bold text-slate-700">{currencyFmtMM(valuationResults.netDebt, ccy)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">Terminal Value</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Method</label>
                      <select
                        value={valuationInputs.useExitMultiple ? 'multiple' : 'perpetual'}
                        onChange={(e) => setValuationInputs({
                          ...valuationInputs,
                          useExitMultiple: e.target.value === 'multiple'
                        })}
                        className="w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                      >
                        <option value="perpetual">Perpetuity Growth</option>
                        <option value="multiple">Exit Multiple</option>
                      </select>
                    </div>

                    {valuationInputs.useExitMultiple ? (
                      <NumberInput
                        label="Exit Multiple (EV/EBITDA)"
                        value={valuationInputs.exitMultiple}
                        onChange={(v) => setValuationInputs({...valuationInputs, exitMultiple: v})}
                      />
                    ) : (
                      <div className="pt-2">
                        <div className="text-xs text-slate-600 font-semibold">Terminal Growth Rate</div>
                        <div className="text-lg font-bold text-slate-700">{pctFmt(params.terminalGrowth)}</div>
                        <div className="text-xs text-slate-500 mt-1">From Financial Parameters</div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600 font-semibold">Terminal Value</div>
                      <div className="text-lg font-bold text-purple-600">{currencyFmtMM(valuationResults.terminalValue, ccy)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DCF Build-Up */}
          <Card className="border-l-4 border-l-indigo-600">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                DCF Build-Up
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Value Components */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-4">Enterprise Value Components</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-700">PV of Projected FCFs</span>
                      <span className="text-sm font-bold text-slate-900">{currencyFmtMM(valuationResults.pvOfProjectedFCFs, ccy)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-700">PV of Terminal Value</span>
                      <span className="text-sm font-bold text-slate-900">{currencyFmtMM(valuationResults.pvOfTerminalValue, ccy)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-purple-50 px-3 rounded-lg">
                      <span className="text-sm font-bold text-purple-900">Enterprise Value</span>
                      <span className="text-lg font-bold text-purple-600">{currencyFmtMM(valuationResults.enterpriseValue, ccy)}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800 mb-4 mt-6">Bridge to Equity Value</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-700">Enterprise Value</span>
                      <span className="text-sm font-bold text-slate-900">{currencyFmtMM(valuationResults.enterpriseValue, ccy)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-red-600">Less: Net Debt</span>
                      <span className="text-sm font-bold text-red-600">({currencyFmtMM(Math.abs(valuationResults.netDebt), ccy)})</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-indigo-50 px-3 rounded-lg">
                      <span className="text-sm font-bold text-indigo-900">Equity Value</span>
                      <span className="text-lg font-bold text-indigo-600">{currencyFmtMM(valuationResults.equityValue, ccy)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Implied Multiples */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-4">Implied Valuation Multiples</h4>
                  <div className="space-y-3">
                    {valuationResults.impliedMultiples.evToRevenue && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">EV / Revenue</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToRevenue, 1)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.evToEBITDA && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">EV / EBITDA</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToEBITDA, 1)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.evToEBIT && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">EV / EBIT</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToEBIT, 1)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.peRatio && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">P / E</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.peRatio, 1)}x</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3 bg-pink-50 px-3 rounded-lg mt-4">
                      <span className="text-sm font-bold text-pink-900">Price per Share</span>
                      <span className="text-lg font-bold text-pink-600">
                        {currencyFmtMM(valuationResults.impliedMultiples.pricePerShare, ccy)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-900">
                        <div className="font-semibold mb-1">Valuation Note</div>
                        <div>These multiples are implied by the DCF valuation. Compare with industry benchmarks to validate assumptions.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sensitivity Analysis */}
          <Card className="border-l-4 border-l-pink-600">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-pink-600" />
                Sensitivity Analysis: Equity Value
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                How equity value changes with different WACC and terminal growth rate assumptions
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-300 bg-slate-100 p-2 text-left font-bold sticky left-0">
                        WACC ↓ / Growth →
                      </th>
                      {valuationResults.growthRange.map((growth, i) => (
                        <th key={i} className="border border-slate-300 bg-slate-100 p-2 text-center font-bold">
                          {pctFmt(growth)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {valuationResults.sensitivityMatrix.map((row, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 bg-slate-50 p-2 font-bold sticky left-0">
                          {pctFmt(valuationResults.waccRange[i])}
                        </td>
                        {row.map((value, j) => {
                          if (value === null) {
                            return (
                              <td key={j} className="border border-slate-300 p-2 text-center bg-slate-200 text-slate-500 text-xs">
                                N/A
                              </td>
                            );
                          }
                          
                          const baseValue = valuationResults.equityValue;
                          const percentDiff = ((value - baseValue) / baseValue) * 100;
                          
                          let bgColor = 'bg-white';
                          if (Math.abs(percentDiff) < 5) {
                            bgColor = 'bg-yellow-50';
                          } else if (percentDiff > 5) {
                            bgColor = 'bg-green-50';
                          } else {
                            bgColor = 'bg-red-50';
                          }
                          
                          const isBaseCase = i === Math.floor(valuationResults.waccRange.length / 2) && 
                                            j === Math.floor(valuationResults.growthRange.length / 2);
                          
                          return (
                            <td 
                              key={j} 
                              className={`border border-slate-300 p-2 text-center text-xs ${bgColor} ${isBaseCase ? 'font-bold ring-2 ring-purple-500' : ''}`}
                            >
                              {currencyFmtMM(value, ccy)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-50 border border-slate-300 rounded"></div>
                  <span className="text-slate-700">Higher (+5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-50 border border-slate-300 rounded"></div>
                  <span className="text-slate-700">Similar (±5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 border border-slate-300 rounded"></div>
                  <span className="text-slate-700">Lower (-5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 border-purple-500 rounded"></div>
                  <span className="text-slate-700 font-bold">Base Case</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Year-by-Year DCF Table */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Year-by-Year DCF Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-2 text-left font-bold">Year</th>
                      <th className="border border-slate-300 p-2 text-right font-bold">Free Cash Flow</th>
                      <th className="border border-slate-300 p-2 text-right font-bold">Discount Factor</th>
                      <th className="border border-slate-300 p-2 text-right font-bold">Present Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuationResults.breakdownByYear.map((row) => (
                      <tr key={row.year} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2 font-semibold">Year {row.year}</td>
                        <td className="border border-slate-300 p-2 text-right">{currencyFmtMM(row.fcf, ccy)}</td>
                        <td className="border border-slate-300 p-2 text-right">{numFmt(row.discountFactor, 4)}</td>
                        <td className="border border-slate-300 p-2 text-right font-semibold">{currencyFmtMM(row.presentValue, ccy)}</td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50 font-bold">
                      <td className="border border-slate-300 p-2" colSpan={3}>Total PV of Projected FCFs</td>
                      <td className="border border-slate-300 p-2 text-right text-purple-700">
                        {currencyFmtMM(valuationResults.pvOfProjectedFCFs, ccy)}
                      </td>
                    </tr>
                    <tr className="bg-indigo-50">
                      <td className="border border-slate-300 p-2">Terminal Year</td>
                      <td className="border border-slate-300 p-2 text-right">{currencyFmtMM(valuationResults.terminalValue, ccy)}</td>
                      <td className="border border-slate-300 p-2 text-right">
                        {numFmt(1 / Math.pow(1 + valuationResults.wacc, valuationResults.breakdownByYear.length), 4)}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-semibold">
                        {currencyFmtMM(valuationResults.pvOfTerminalValue, ccy)}
                      </td>
                    </tr>
                    <tr className="bg-purple-100 font-bold text-purple-900">
                      <td className="border border-slate-300 p-3" colSpan={3}>Enterprise Value</td>
                      <td className="border border-slate-300 p-3 text-right text-lg">
                        {currencyFmtMM(valuationResults.enterpriseValue, ccy)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}