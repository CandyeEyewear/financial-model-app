// components/ValuationTab.jsx
import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Calculator, AlertCircle, Download, Info, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './Card.jsx';
import { Button } from './Button.jsx';
import { currencyFmtMM, numFmt, pctFmt } from '../utils/formatters.js';

// ============================================================================
// VALUATION CALCULATIONS (Self-contained for reliability)
// ============================================================================

/**
 * Calculate Cost of Equity using CAPM
 * Ke = Rf + β × (Rm - Rf)
 */
function calculateCostOfEquity(riskFreeRate, beta, marketRiskPremium) {
  return riskFreeRate + (beta * marketRiskPremium);
}

/**
 * Calculate After-Tax Cost of Debt
 * Kd(1-T) = Interest Rate × (1 - Tax Rate)
 */
function calculateAfterTaxCostOfDebt(interestRate, taxRate) {
  return interestRate * (1 - taxRate);
}

/**
 * Calculate WACC
 * WACC = (E/V) × Ke + (D/V) × Kd(1-T)
 * where V = E + D
 */
function calculateWACC(equityValue, debtValue, costOfEquity, afterTaxCostOfDebt) {
  const totalValue = equityValue + debtValue;
  if (totalValue === 0) return costOfEquity; // No capital structure, use cost of equity
  
  const equityWeight = equityValue / totalValue;
  const debtWeight = debtValue / totalValue;
  
  return (equityWeight * costOfEquity) + (debtWeight * afterTaxCostOfDebt);
}

/**
 * Calculate total debt from params (handles multi-tranche)
 */
function getTotalDebt(params) {
  if (!params) return 0;
  
  // Multi-tranche case
  if (params.hasMultipleTranches && params.debtTranches?.length > 0) {
    return params.debtTranches.reduce((sum, tranche) => sum + (tranche.amount || 0), 0);
  }
  
  // Single debt case - combine opening debt + new facility
  return (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
}

/**
 * Calculate DCF Valuation
 * Returns: { enterpriseValue, equityValue, terminalValue, pvProjectedFCFs, pvTerminal, breakdownByYear }
 */
function calculateDCF(fcfs, wacc, terminalGrowth, finalYearFCF, netDebt, useExitMultiple = false, exitMultiple = 8.0, finalYearEBITDA = 0) {
  // Validate inputs
  if (wacc <= terminalGrowth) {
    console.error('DCF Error: WACC must be greater than terminal growth rate');
    return null;
  }
  
  if (!fcfs || fcfs.length === 0) {
    console.error('DCF Error: No cash flows provided');
    return null;
  }
  
  // Calculate PV of projected cash flows
  let pvProjectedFCFs = 0;
  const breakdownByYear = [];
  
  fcfs.forEach((fcf, index) => {
    const year = index + 1;
    const discountFactor = Math.pow(1 + wacc, year);
    const presentValue = fcf / discountFactor;
    pvProjectedFCFs += presentValue;
    
    breakdownByYear.push({
      year,
      fcf,
      discountFactor: 1 / discountFactor,
      presentValue
    });
  });
  
  // Calculate terminal value
  let terminalValue;
  if (useExitMultiple) {
    // Exit Multiple Method: TV = EBITDA(final) × Exit Multiple
    terminalValue = finalYearEBITDA * exitMultiple;
  } else {
    // Perpetuity Growth Method: TV = FCF(n+1) / (WACC - g)
    const terminalFCF = finalYearFCF * (1 + terminalGrowth);
    terminalValue = terminalFCF / (wacc - terminalGrowth);
  }
  
  // Discount terminal value to present
  const terminalDiscountFactor = Math.pow(1 + wacc, fcfs.length);
  const pvTerminal = terminalValue / terminalDiscountFactor;
  
  // Calculate Enterprise Value
  const enterpriseValue = pvProjectedFCFs + pvTerminal;
  
  // Calculate Equity Value
  // EV - Net Debt = Equity Value
  const equityValue = enterpriseValue - netDebt;
  
  return {
    enterpriseValue,
    equityValue,
    terminalValue,
    pvProjectedFCFs,
    pvTerminal,
    breakdownByYear,
    terminalMethod: useExitMultiple ? 'Exit Multiple' : 'Perpetuity Growth'
  };
}

/**
 * Calculate implied valuation multiples
 */
function calculateImpliedMultiples(equityValue, enterpriseValue, financials, sharesOutstanding) {
  const { revenue, ebitda, ebit, netIncome } = financials;
  
  return {
    evToRevenue: revenue > 0 ? enterpriseValue / revenue : null,
    evToEBITDA: ebitda > 0 ? enterpriseValue / ebitda : null,
    evToEBIT: ebit > 0 ? enterpriseValue / ebit : null,
    peRatio: netIncome > 0 ? equityValue / netIncome : null,
    pricePerShare: sharesOutstanding > 0 ? equityValue / sharesOutstanding : null,
    sharesOutstanding
  };
}

/**
 * Generate sensitivity analysis matrix
 */
function generateSensitivityMatrix(baseParams, waccRange, growthRange) {
  const matrix = [];
  
  for (let i = 0; i < waccRange.length; i++) {
    const row = [];
    const testWACC = waccRange[i];
    
    for (let j = 0; j < growthRange.length; j++) {
      const testGrowth = growthRange[j];
      
      // Skip invalid combinations (WACC <= growth)
      if (testWACC <= testGrowth) {
        row.push(null);
        continue;
      }
      
      // Calculate DCF with test parameters
      const result = calculateDCF(
        baseParams.fcfs,
        testWACC,
        testGrowth,
        baseParams.finalYearFCF,
        baseParams.netDebt,
        baseParams.useExitMultiple,
        baseParams.exitMultiple,
        baseParams.finalYearEBITDA
      );
      
      row.push(result ? result.equityValue : null);
    }
    
    matrix.push(row);
  }
  
  return matrix;
}

/**
 * Create ranges for sensitivity analysis
 */
function createSensitivityRange(baseValue, steps, stepSize) {
  const range = [];
  const halfSteps = Math.floor(steps / 2);
  
  for (let i = -halfSteps; i <= halfSteps; i++) {
    range.push(Math.max(0.001, baseValue + (i * stepSize))); // Ensure positive
  }
  
  return range;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ValuationTab({ projections, params, ccy }) {
  const [exportStatus, setExportStatus] = useState("");
  
  const [valuationInputs, setValuationInputs] = useState({
    // CAPM Inputs (for reference comparison)
    riskFreeRate: 0.05,
    beta: 1.2,
    marketRiskPremium: 0.08,
    
    // Capital Structure (for independent WACC calculation)
    targetDebtRatio: 0.30,
    
    // Terminal Value
    useExitMultiple: false,
    exitMultiple: 8.0,
    
    // Share Info
    sharesOutstanding: params?.sharesOutstanding || 1000000,
    
    // Use Model WACC or Calculate Independent?
    useModelWACC: true  // Default to using consistent model WACC
  });

  // Check if projection data is valid
  const hasValidData = projections && projections.rows && projections.rows.length > 0 && params;
  
  // Check if debt exists
  const totalDebt = getTotalDebt(params);
  const hasDebt = totalDebt > 0;

  const valuationResults = useMemo(() => {
    if (!hasValidData) {
      console.warn('ValuationTab: No valid projection data available');
      return null;
    }

    try {
      const rows = projections.rows;
      const finalYear = rows[rows.length - 1];
      
      // =========================================================================
      // CRITICAL FIX #1: Use UNLEVERED FCF (for Enterprise Value calculation)
      // =========================================================================
      const projectedFCFs = rows.map(row => {
        // Use unleveredFCF if available, otherwise calculate it
        if (typeof row.unleveredFCF === 'number') {
          return row.unleveredFCF;
        }
        
        // Fallback calculation: EBIT(1-T) + D&A - Capex - WC Change
        const nopat = (row.ebit || 0) * (1 - (params.taxRate || 0));
        const fcf = nopat + (row.depreciation || 0) - (row.capex || 0) - (row.wcDelta || 0);
        
        console.warn('ValuationTab: Using calculated unlevered FCF (unleveredFCF not in projection)', {
          year: row.year,
          calculatedFCF: fcf
        });
        
        return fcf;
      });
      
      const finalYearFCF = projectedFCFs[projectedFCFs.length - 1];
      
      // =========================================================================
      // CRITICAL FIX #2: Proper Net Debt Calculation
      // =========================================================================
      const totalDebtAmount = getTotalDebt(params);
      
      // Opening cash - typically zero unless specified
      // Use params.openingCash if it exists, otherwise assume 0
      const openingCash = params.openingCash || 0;
      
      // Net Debt = Total Debt - Cash
      const netDebt = totalDebtAmount - openingCash;
      
      console.log('ValuationTab: Net Debt Calculation', {
        totalDebt: totalDebtAmount,
        openingCash: openingCash,
        netDebt: netDebt,
        hasMultipleTranches: params.hasMultipleTranches,
        trancheCount: params.debtTranches?.length || 0
      });
      
      // =========================================================================
      // WACC Determination
      // =========================================================================
      let effectiveWACC;
      let waccSource;
      let capmCostOfEquity;
      let afterTaxCostOfDebt;
      
      if (valuationInputs.useModelWACC) {
        // Use model's consistent WACC
        effectiveWACC = params.wacc;
        waccSource = 'Model Parameters';
        
        // Calculate CAPM for reference only
        capmCostOfEquity = calculateCostOfEquity(
          valuationInputs.riskFreeRate,
          valuationInputs.beta,
          valuationInputs.marketRiskPremium
        );
        
        afterTaxCostOfDebt = calculateAfterTaxCostOfDebt(
          params.interestRate || 0,
          params.taxRate || 0
        );
        
      } else {
        // Calculate independent WACC using CAPM
        capmCostOfEquity = calculateCostOfEquity(
          valuationInputs.riskFreeRate,
          valuationInputs.beta,
          valuationInputs.marketRiskPremium
        );
        
        afterTaxCostOfDebt = calculateAfterTaxCostOfDebt(
          params.interestRate || 0,
          params.taxRate || 0
        );
        
        const targetEquityRatio = 1 - valuationInputs.targetDebtRatio;
        effectiveWACC = calculateWACC(
          targetEquityRatio * 1000,
          valuationInputs.targetDebtRatio * 1000,
          capmCostOfEquity,
          afterTaxCostOfDebt
        );
        
        waccSource = 'Independent CAPM Calculation';
      }
      
      // =========================================================================
      // Validation: WACC vs Terminal Growth
      // =========================================================================
      if (params.terminalGrowth >= effectiveWACC) {
        console.error('ValuationTab: Terminal growth >= WACC, cannot calculate DCF', {
          terminalGrowth: params.terminalGrowth,
          wacc: effectiveWACC
        });
        return {
          error: 'WACC_INVALID',
          message: `Terminal growth rate (${pctFmt(params.terminalGrowth)}) must be less than WACC (${pctFmt(effectiveWACC)}). Please adjust parameters.`
        };
      }
      
      // =========================================================================
      // DCF Calculation
      // =========================================================================
      console.log('ValuationTab: Running DCF', {
        fcfCount: projectedFCFs.length,
        wacc: effectiveWACC,
        terminalGrowth: params.terminalGrowth,
        netDebt: netDebt,
        useExitMultiple: valuationInputs.useExitMultiple
      });
      
      const dcfResult = calculateDCF(
        projectedFCFs,
        effectiveWACC,
        params.terminalGrowth,
        finalYearFCF,
        netDebt,
        valuationInputs.useExitMultiple,
        valuationInputs.exitMultiple,
        finalYear.ebitda
      );
      
      if (!dcfResult) {
        return {
          error: 'DCF_CALCULATION_FAILED',
          message: 'DCF calculation failed. Check console for details.'
        };
      }
      
      // =========================================================================
      // Implied Multiples
      // =========================================================================
      const impliedMultiples = calculateImpliedMultiples(
        dcfResult.equityValue,
        dcfResult.enterpriseValue,
        {
          revenue: rows[0]?.revenue || 0,
          ebitda: rows[0]?.ebitda || 0,
          ebit: rows[0]?.ebit || 0,
          netIncome: rows[0]?.netIncome || 0
        },
        valuationInputs.sharesOutstanding
      );
      
      // =========================================================================
      // Sensitivity Analysis
      // =========================================================================
      const waccRange = createSensitivityRange(effectiveWACC, 5, 0.01);
      const growthRange = createSensitivityRange(params.terminalGrowth, 5, 0.005);
      
      const sensitivityMatrix = generateSensitivityMatrix(
        {
          fcfs: projectedFCFs,
          finalYearFCF: finalYearFCF,
          netDebt: netDebt,
          useExitMultiple: valuationInputs.useExitMultiple,
          exitMultiple: valuationInputs.exitMultiple,
          finalYearEBITDA: finalYear.ebitda
        },
        waccRange,
        growthRange
      );
      
      // =========================================================================
      // Comparison with Model Valuation (if different WACC used)
      // =========================================================================
      let modelComparison = null;
      if (!valuationInputs.useModelWACC && projections.enterpriseValue) {
        const variance = ((dcfResult.enterpriseValue - projections.enterpriseValue) / projections.enterpriseValue) * 100;
        modelComparison = {
          modelEV: projections.enterpriseValue,
          dcfEV: dcfResult.enterpriseValue,
          variance: variance,
          modelWACC: params.wacc,
          dcfWACC: effectiveWACC
        };
      }
      
      // =========================================================================
      // Return Complete Results
      // =========================================================================
      return {
        ...dcfResult,
        wacc: effectiveWACC,
        waccSource,
        costOfEquity: capmCostOfEquity,
        afterTaxCostOfDebt,
        netDebt,
        totalDebt: totalDebtAmount,
        openingCash,
        impliedMultiples,
        sensitivityMatrix,
        waccRange,
        growthRange,
        modelComparison,
        hasDebt,
        
        // Metadata
        fcfType: 'Unlevered Free Cash Flow',
        projectionYears: rows.length,
        
        // Multi-tranche info (if applicable)
        multiTrancheInfo: projections.multiTrancheInfo || null
      };
      
    } catch (error) {
      console.error('ValuationTab: Error computing valuation', error);
      return {
        error: 'CALCULATION_ERROR',
        message: `Error: ${error.message}`
      };
    }
  }, [projections, params, valuationInputs, hasValidData]);

  // =========================================================================
  // Export Functions (Simplified - you can expand these)
  // =========================================================================
  const handleExport = (exportType) => {
    if (!valuationResults || valuationResults.error) {
      alert("No valid valuation data available to export.");
      return;
    }
    
    try {
      setExportStatus("Exporting...");
      
      let csvContent = '';
      const filename = `valuation_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;
      
      switch (exportType) {
        case 'full':
          csvContent = generateFullExport(valuationResults, params, ccy);
          break;
        case 'sensitivity':
          csvContent = generateSensitivityExport(valuationResults, ccy);
          break;
        case 'buildup':
          csvContent = generateBuildUpExport(valuationResults, ccy);
          break;
        default:
          console.warn('Unknown export type:', exportType);
          return;
      }
      
      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      
      setExportStatus("✓ Exported successfully!");
      setTimeout(() => setExportStatus(""), 3000);
      
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus("✗ Export failed");
      setTimeout(() => setExportStatus(""), 3000);
    }
  };

  // Helper export functions (simplified)
  const generateFullExport = (results, params, ccy) => {
    let csv = 'DCF Valuation Analysis\n\n';
    csv += 'Metric,Value\n';
    csv += `Enterprise Value (${ccy}),${results.enterpriseValue}\n`;
    csv += `Equity Value (${ccy}),${results.equityValue}\n`;
    csv += `WACC,${(results.wacc * 100).toFixed(2)}%\n`;
    csv += `Terminal Growth,${(params.terminalGrowth * 100).toFixed(2)}%\n`;
    csv += `Net Debt (${ccy}),${results.netDebt}\n`;
    csv += `Price per Share (${ccy}),${results.impliedMultiples.pricePerShare || 'N/A'}\n`;
    return csv;
  };

  const generateSensitivityExport = (results, ccy) => {
    let csv = 'Sensitivity Analysis - Equity Value\n\n';
    csv += `WACC / Growth,${results.growthRange.map(g => (g*100).toFixed(2)+'%').join(',')}\n`;
    results.sensitivityMatrix.forEach((row, i) => {
      csv += `${(results.waccRange[i]*100).toFixed(2)}%,`;
      csv += row.map(v => v !== null ? v.toFixed(2) : 'N/A').join(',');
      csv += '\n';
    });
    return csv;
  };

  const generateBuildUpExport = (results, ccy) => {
    let csv = 'DCF Build-Up\n\n';
    csv += 'Year,FCF,Discount Factor,Present Value\n';
    results.breakdownByYear.forEach(row => {
      csv += `${row.year},${row.fcf},${row.discountFactor.toFixed(4)},${row.presentValue}\n`;
    });
    csv += `\nTerminal Value,${results.terminalValue}\n`;
    csv += `PV of Terminal Value,${results.pvTerminal}\n`;
    csv += `Enterprise Value,${results.enterpriseValue}\n`;
    return csv;
  };

  // =========================================================================
  // Input Components
  // =========================================================================
  const PctInput = ({ label, value, onChange, disabled = false }) => (
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
          disabled={disabled}
          step="0.1"
          className={`w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 ${
            disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
          }`}
        />
        <span className="text-slate-600 text-sm font-semibold">%</span>
      </div>
    </div>
  );

  const NumberInput = ({ label, value, onChange, step = 0.1, disabled = false }) => (
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
        disabled={disabled}
        step={step}
        className={`w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 ${
          disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );

  // =========================================================================
  // RENDER
  // =========================================================================
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
                disabled={!valuationResults || valuationResults.error}
                className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 shadow-md font-semibold ${
                  (!valuationResults || valuationResults.error) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                Full DCF Export
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('sensitivity')}
                disabled={!valuationResults || valuationResults.error}
                className={`bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 shadow-md font-semibold ${
                  (!valuationResults || valuationResults.error) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                Sensitivity Matrix
              </Button>
              <Button
                size="sm"
                onClick={() => handleExport('buildup')}
                disabled={!valuationResults || valuationResults.error}
                className={`bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 shadow-md font-semibold ${
                  (!valuationResults || valuationResults.error) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                DCF Build-Up
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">
            Export comprehensive valuation data to CSV for validation and further analysis
            {(!valuationResults || valuationResults.error) && <span className="text-amber-600 font-semibold"> (Fix errors to enable exports)</span>}
          </p>
        </CardContent>
      </Card>

      {/* Error State */}
      {valuationResults?.error && (
        <Card className="border-l-4 border-l-red-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900 text-lg">{valuationResults.error}</p>
                <p className="text-sm text-red-700 mt-1">{valuationResults.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!hasValidData && (
        <Card className="border-l-4 border-l-amber-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">No projection data available for valuation analysis</p>
                <p className="text-sm text-slate-600 mt-1">
                  Enter financial parameters in the "Financial Parameters" section to generate projections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Valuation Display */}
      {hasValidData && valuationResults && !valuationResults.error && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Enterprise Value</div>
              <div className="text-3xl font-bold mb-1">{currencyFmtMM(valuationResults.enterpriseValue, ccy)}</div>
              <div className="text-xs opacity-80">DCF Valuation</div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Equity Value</div>
              <div className="text-3xl font-bold mb-1">{currencyFmtMM(valuationResults.equityValue, ccy)}</div>
              <div className="text-xs opacity-80">{hasDebt ? 'After Debt Adjustment' : 'No Leverage'}</div>
            </div>

            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">Price per Share</div>
              <div className="text-3xl font-bold mb-1">
                {valuationResults.impliedMultiples.pricePerShare 
  ? `${ccy} ${valuationResults.impliedMultiples.pricePerShare.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  : '—'}
              </div>
              <div className="text-xs opacity-80">
                {numFmt(valuationResults.impliedMultiples.sharesOutstanding)} shares
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-5 text-white transform transition-all duration-200 hover:scale-105 hover:shadow-xl">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-2">WACC</div>
              <div className="text-3xl font-bold mb-1">{pctFmt(valuationResults.wacc)}</div>
              <div className="text-xs opacity-80">{valuationResults.waccSource}</div>
            </div>
          </div>

          {/* WACC Source Warning (if not using model WACC) */}
          {valuationResults.modelComparison && (
            <Card className="border-l-4 border-l-amber-600 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-amber-900 mb-2">Valuation Comparison</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-amber-700 font-semibold">Model EV</div>
                        <div className="text-lg font-bold text-amber-900">
                          {currencyFmtMM(valuationResults.modelComparison.modelEV, ccy)}
                        </div>
                        <div className="text-xs text-amber-600">
                          WACC: {pctFmt(valuationResults.modelComparison.modelWACC)}
                        </div>
                      </div>
                      <div>
                        <div className="text-amber-700 font-semibold">Independent DCF EV</div>
                        <div className="text-lg font-bold text-amber-900">
                          {currencyFmtMM(valuationResults.modelComparison.dcfEV, ccy)}
                        </div>
                        <div className="text-xs text-amber-600">
                          WACC: {pctFmt(valuationResults.modelComparison.dcfWACC)}
                        </div>
                      </div>
                      <div>
                        <div className="text-amber-700 font-semibold">Variance</div>
                        <div className={`text-lg font-bold ${
                          Math.abs(valuationResults.modelComparison.variance) < 5 ? 'text-green-700' :
                          Math.abs(valuationResults.modelComparison.variance) < 15 ? 'text-amber-900' :
                          'text-red-700'
                        }`}>
                          {valuationResults.modelComparison.variance >= 0 ? '+' : ''}{valuationResults.modelComparison.variance.toFixed(1)}%
                        </div>
                        <div className="text-xs text-amber-600">
                          {Math.abs(valuationResults.modelComparison.variance) < 5 ? 'Aligned' :
                           Math.abs(valuationResults.modelComparison.variance) < 15 ? 'Minor difference' :
                           'Significant divergence'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valuation Inputs */}
          <Card className="border-l-4 border-l-purple-600">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-6 h-6 text-purple-600" />
                Valuation Inputs & Assumptions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* WACC Selection */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">
                    Discount Rate (WACC)
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">WACC Source</label>
                      <select
                        value={valuationInputs.useModelWACC ? 'model' : 'independent'}
                        onChange={(e) => setValuationInputs({
                          ...valuationInputs,
                          useModelWACC: e.target.value === 'model'
                        })}
                        className="w-full h-10 text-sm border-2 border-slate-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200"
                      >
                        <option value="model">Use Model WACC (Recommended)</option>
                        <option value="independent">Calculate Independent WACC</option>
                      </select>
                    </div>
                    
                    {valuationInputs.useModelWACC ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-xs text-blue-700 font-semibold mb-1">Model WACC</div>
                        <div className="text-2xl font-bold text-blue-600">{pctFmt(params.wacc)}</div>
                        <div className="text-xs text-blue-600 mt-1">From Financial Parameters (Consistent)</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-slate-600 font-semibold">CAPM Inputs:</div>
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
                        <PctInput
                          label="Target Debt Ratio"
                          value={valuationInputs.targetDebtRatio}
                          onChange={(v) => setValuationInputs({...valuationInputs, targetDebtRatio: v})}
                        />
                        <div className="pt-2 border-t border-slate-200">
                          <div className="text-xs text-slate-600 font-semibold">Calculated WACC</div>
                          <div className="text-lg font-bold text-purple-600">{pctFmt(valuationResults.wacc)}</div>
                        </div>
                      </>
                    )}
                    
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600 font-semibold">Cost of Equity (CAPM)</div>
                      <div className="text-lg font-bold text-slate-700">{pctFmt(valuationResults.costOfEquity)}</div>
                    </div>
                    <div className="pt-2">
                      <div className="text-xs text-slate-600 font-semibold">After-Tax Cost of Debt</div>
                      <div className="text-lg font-bold text-slate-700">{pctFmt(valuationResults.afterTaxCostOfDebt)}</div>
                    </div>
                  </div>
                </div>

                {/* Capital Structure */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">
                    Capital Structure
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-600 font-semibold mb-1">Total Debt</div>
                      <div className="text-xl font-bold text-slate-800">{currencyFmtMM(valuationResults.totalDebt, ccy)}</div>
                      {valuationResults.multiTrancheInfo && (
                        <div className="text-xs text-slate-600 mt-1">
                          {valuationResults.multiTrancheInfo.totalTranches} tranches @ {pctFmt(valuationResults.multiTrancheInfo.blendedRate)} blended
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-xs text-slate-600 font-semibold mb-1">Opening Cash</div>
                      <div className="text-xl font-bold text-slate-800">{currencyFmtMM(valuationResults.openingCash, ccy)}</div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-700 font-semibold mb-1">Net Debt</div>
                      <div className="text-xl font-bold text-blue-600">{currencyFmtMM(valuationResults.netDebt, ccy)}</div>
                      <div className="text-xs text-blue-600 mt-1">= Debt - Cash</div>
                    </div>
                    
                    {!hasDebt && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-green-800">
                          <div className="font-semibold mb-1">No Leverage</div>
                          <div>Enterprise Value = Equity Value (no debt adjustment required)</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Terminal Value & Shares */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-purple-200">
                    Terminal Value & Shares
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Terminal Value Method</label>
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
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-600 font-semibold mb-1">Terminal Growth Rate</div>
                        <div className="text-xl font-bold text-slate-800">{pctFmt(params.terminalGrowth)}</div>
                        <div className="text-xs text-slate-600 mt-1">From Financial Parameters</div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600 font-semibold mb-1">Terminal Value</div>
                      <div className="text-lg font-bold text-purple-600">{currencyFmtMM(valuationResults.terminalValue, ccy)}</div>
                      <div className="text-xs text-slate-500 mt-1">{valuationResults.terminalMethod}</div>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200">
                      <NumberInput
                        label="Shares Outstanding"
                        value={valuationInputs.sharesOutstanding}
                        onChange={(v) => setValuationInputs({...valuationInputs, sharesOutstanding: v})}
                        step={1000}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* FCF Type Notice */}
              <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-purple-900">
                    <div className="font-semibold mb-1">Cash Flow Type: {valuationResults.fcfType}</div>
                    <div>Valuation uses unlevered free cash flow (NOPAT + D&A - Capex - ΔWC) for enterprise value calculation, then adjusts for net debt to derive equity value.</div>
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
                  <h4 className="text-sm font-bold text-slate-800 mb-4">Enterprise Value Build-Up</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-700">PV of Projected FCFs</span>
                      <span className="text-sm font-bold text-slate-900">{currencyFmtMM(valuationResults.pvProjectedFCFs, ccy)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-sm text-slate-700">+ PV of Terminal Value</span>
                      <span className="text-sm font-bold text-slate-900">{currencyFmtMM(valuationResults.pvTerminal, ccy)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-purple-50 px-3 rounded-lg">
                      <span className="text-sm font-bold text-purple-900">= Enterprise Value</span>
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
                      <span className="text-sm text-red-600">− Net Debt</span>
                      <span className="text-sm font-bold text-red-600">({currencyFmtMM(Math.abs(valuationResults.netDebt), ccy)})</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-indigo-50 px-3 rounded-lg">
                      <span className="text-sm font-bold text-indigo-900">= Equity Value</span>
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
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToRevenue, 2)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.evToEBITDA && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">EV / EBITDA</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToEBITDA, 2)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.evToEBIT && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">EV / EBIT</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.evToEBIT, 2)}x</span>
                      </div>
                    )}
                    {valuationResults.impliedMultiples.peRatio && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-sm text-slate-700">P / E Ratio</span>
                        <span className="text-sm font-bold text-slate-900">{numFmt(valuationResults.impliedMultiples.peRatio, 2)}x</span>
                      </div>
                    )}
                    
                    <div className="pt-4 border-t-2 border-slate-300">
                      <div className="flex justify-between items-center py-3 bg-pink-50 px-3 rounded-lg">
                        <span className="text-sm font-bold text-pink-900">Price per Share</span>
                        <span className="text-xl font-bold text-pink-600">
                          {valuationResults.impliedMultiples.pricePerShare 
                            ? currencyFmtMM(valuationResults.impliedMultiples.pricePerShare, ccy)
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="text-xs text-center text-slate-600 mt-2">
                        Based on {numFmt(valuationResults.impliedMultiples.sharesOutstanding)} shares outstanding
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-900">
                        <div className="font-semibold mb-1">Valuation Note</div>
                        <div>These multiples are implied by the DCF valuation. Compare with industry trading comps and transaction multiples to validate assumptions.</div>
                      </div>
                    </div>
                  </div>
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
              <p className="text-sm text-slate-600 mt-2">
                Detailed breakdown of free cash flow discounting using {valuationResults.fcfType}
              </p>
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
                        {currencyFmtMM(valuationResults.pvProjectedFCFs, ccy)}
                      </td>
                    </tr>
                    <tr className="bg-indigo-50">
                      <td className="border border-slate-300 p-2">Terminal Year</td>
                      <td className="border border-slate-300 p-2 text-right">{currencyFmtMM(valuationResults.terminalValue, ccy)}</td>
                      <td className="border border-slate-300 p-2 text-right">
                        {numFmt(1 / Math.pow(1 + valuationResults.wacc, valuationResults.breakdownByYear.length), 4)}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-semibold">
                        {currencyFmtMM(valuationResults.pvTerminal, ccy)}
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

          {/* Sensitivity Analysis */}
          <Card className="border-l-4 border-l-pink-600">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-purple-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-pink-600" />
                Sensitivity Analysis: Equity Value
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Impact of different WACC and terminal growth assumptions on equity value
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
        </>
      )}
    </div>
  );
}
