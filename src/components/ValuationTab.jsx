// ============================================================================
// ValuationTab.jsx - DCF Valuation Analysis
// ============================================================================
// REWRITTEN: Uses projections data directly from buildProjection.js
// - No local recalculation of values already computed
// - All values sourced from params or projections with clear indicators
// - Comprehensive sanity checks for data quality
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  TrendingUp, DollarSign, Building, AlertTriangle,
  AlertCircle, Info, CheckCircle, XCircle, Download,
  Calculator, Percent
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './Card.jsx';
import { Button } from './Button.jsx';
import { currencyFmtMM, numFmt, pctFmt } from '../utils/formatters.js';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ValuationTab({ projections, params, ccy }) {
  // =========================================================================
  // STATE: Only for user-controllable options (NOT calculations)
  // =========================================================================
  const [options, setOptions] = useState({
    // Terminal value method toggle
    terminalMethod: 'perpetuity', // 'perpetuity' or 'exitMultiple'
    exitMultiple: 8.0,

    // Shares override (if user wants different from params)
    sharesOverride: null, // null = use params.sharesOutstanding
  });

  const [exportStatus, setExportStatus] = useState('');

  // =========================================================================
  // VALIDATION: Check for valid data
  // =========================================================================
  const hasValidData = projections?.rows?.length > 0 && params;

  if (!hasValidData) {
    return (
      <Card className="border-l-4 border-l-amber-500">
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
    );
  }

  // =========================================================================
  // DERIVED DATA: Use projections directly, don't recalculate!
  // =========================================================================
  const valuationData = useMemo(() => {
    // ----- DEBT: From projections (already calculated correctly) -----
    const debtBreakdown = getDebtBreakdown(projections, params);

    // ----- CASH: From params with source tracking -----
    const cashData = {
      value: params.openingCash ?? 0,
      source: params.openingCash !== undefined ? 'From Parameters' : 'Not Provided (Default: 0)',
      isMissing: params.openingCash === undefined
    };

    // ----- VALUATION: From projections (already calculated!) -----
    const enterpriseValue = projections.enterpriseValue;
    const equityValue = projections.equityValue;
    const terminalValue = projections.terminalValue;
    const pvProjectedFCFs = projections.pvProjectedCashFlows;
    const pvTerminal = projections.pvTerminal;
    const netDebt = projections.finalNetDebt;

    // ----- SHARES & PRICE PER SHARE -----
    const sharesOutstanding = options.sharesOverride ?? params.sharesOutstanding ?? 0;
    const pricePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : null;

    // ----- TV PERCENTAGE (for sanity check) -----
    const tvPercent = enterpriseValue > 0 ? (pvTerminal / enterpriseValue) * 100 : 0;

    // ----- IMPLIED MULTIPLES -----
    const firstYear = projections.rows[0];
    const impliedMultiples = {
      evRevenue: firstYear.revenue > 0 ? enterpriseValue / firstYear.revenue : null,
      evEbitda: firstYear.ebitda > 0 ? enterpriseValue / firstYear.ebitda : null,
      evEbit: firstYear.ebit > 0 ? enterpriseValue / firstYear.ebit : null,
      pe: firstYear.netIncome > 0 ? equityValue / firstYear.netIncome : null,
    };

    // ----- SANITY CHECKS -----
    const sanityChecks = runSanityChecks(projections, params, debtBreakdown, tvPercent, ccy);

    return {
      // Valuation (from projections)
      enterpriseValue,
      equityValue,
      terminalValue,
      pvProjectedFCFs,
      pvTerminal,
      tvPercent,

      // Debt (from projections)
      debtBreakdown,
      totalDebt: debtBreakdown.totalDebt,
      blendedRate: debtBreakdown.blendedRate,
      netDebt,

      // Cash
      cash: cashData,
      finalCash: projections.finalCash,

      // Shares & Price
      sharesOutstanding,
      sharesSource: options.sharesOverride ? 'Manual Override' :
                    params.sharesOutstanding ? 'From Parameters' : 'Not Provided',
      pricePerShare,

      // Multiples
      impliedMultiples,

      // WACC & Growth (from params)
      wacc: params.wacc,
      terminalGrowth: params.terminalGrowth,

      // Year data (for tables)
      years: projections.rows,

      // Sanity checks
      sanityChecks,
      hasCriticalIssues: sanityChecks.some(c => c.type === 'critical'),

      // Flags
      hasDebt: debtBreakdown.totalDebt > 0,
      hasMultipleTranches: projections.hasMultipleTranches,
      isWACCValid: projections.isWACCValid
    };
  }, [projections, params, options]);

  // =========================================================================
  // EXPORT HANDLER
  // =========================================================================
  const handleExport = (type) => {
    if (!valuationData) {
      alert("No valid valuation data available to export.");
      return;
    }

    try {
      setExportStatus('Exporting...');

      let csv = '';
      const filename = `valuation_${type}_${new Date().toISOString().split('T')[0]}.csv`;

      if (type === 'full') {
        csv = `DCF Valuation Summary\n\n`;
        csv += `Metric,Value\n`;
        csv += `Enterprise Value,${valuationData.enterpriseValue}\n`;
        csv += `Equity Value,${valuationData.equityValue}\n`;
        csv += `Net Debt,${valuationData.netDebt}\n`;
        csv += `Total Debt,${valuationData.totalDebt}\n`;
        csv += `WACC,${(valuationData.wacc * 100).toFixed(2)}%\n`;
        csv += `Terminal Growth,${(valuationData.terminalGrowth * 100).toFixed(2)}%\n`;
        csv += `TV % of EV,${valuationData.tvPercent.toFixed(1)}%\n`;
        csv += `Price per Share,${valuationData.pricePerShare || 'N/A'}\n`;
        csv += `Shares Outstanding,${valuationData.sharesOutstanding}\n`;
        csv += `\nYear-by-Year FCF\n`;
        csv += `Year,Unlevered FCF,EBITDA,Debt Balance\n`;
        valuationData.years.forEach(row => {
          csv += `${row.year},${row.unleveredFCF},${row.ebitda},${row.debtBalance}\n`;
        });
      } else if (type === 'sensitivity') {
        csv = `Sensitivity Analysis\n\n`;
        csv += `Base Case Equity Value: ${valuationData.equityValue}\n`;
        csv += `Base WACC: ${(valuationData.wacc * 100).toFixed(2)}%\n`;
        csv += `Base Terminal Growth: ${(valuationData.terminalGrowth * 100).toFixed(2)}%\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      setExportStatus('Exported');
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus('Failed');
      setTimeout(() => setExportStatus(''), 3000);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* 1. Sanity Check Warnings */}
      <SanityCheckAlerts checks={valuationData.sanityChecks} ccy={ccy} />

      {/* 2. Summary Cards */}
      <SummaryCards data={valuationData} ccy={ccy} />

      {/* 3. Capital Structure (Debt Breakdown) */}
      <CapitalStructureSection data={valuationData} ccy={ccy} params={params} />

      {/* 4. DCF Build-Up */}
      <DCFBuildUpSection data={valuationData} ccy={ccy} />

      {/* 5. Year-by-Year Table */}
      <YearByYearTable data={valuationData} ccy={ccy} />

      {/* 6. Implied Multiples */}
      <ImpliedMultiplesSection data={valuationData} ccy={ccy} />

      {/* 7. Sensitivity Analysis */}
      <SensitivityAnalysis data={valuationData} params={params} ccy={ccy} />

      {/* 8. Export Options */}
      <ExportSection
        data={valuationData}
        params={params}
        ccy={ccy}
        exportStatus={exportStatus}
        onExport={handleExport}
      />
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get debt breakdown from projections (NOT from params)
 * This uses what buildProjection.js already calculated
 */
function getDebtBreakdown(projections, params) {
  // PRIORITY 1: Use multiTrancheInfo from projections (most accurate)
  if (projections.multiTrancheInfo?.tranches?.length > 0) {
    return {
      components: projections.multiTrancheInfo.tranches.map(t => ({
        name: t.name,
        amount: t.amount,
        rate: t.rate,
        seniority: t.seniority || 'Senior',
        source: 'From Projection'
      })),
      totalDebt: projections.multiTrancheInfo.totalDebt,
      blendedRate: projections.multiTrancheInfo.blendedRate,
      source: 'Multi-Tranche (Auto-calculated)'
    };
  }

  // PRIORITY 2: Use finalDebt from projections
  if (projections.finalDebt > 0) {
    // Build components from params for display, but use projection total
    const components = [];

    // Check both openingDebt and existingDebtAmount (they should be synced, but fallback to either)
    const existingDebt = params.openingDebt || params.existingDebtAmount || 0;
    if (existingDebt > 0) {
      components.push({
        name: 'Existing Debt',
        amount: existingDebt,
        rate: params.existingDebtRate || params.interestRate || 0,
        seniority: 'Senior',
        source: 'From Parameters'
      });
    }

    if ((params.requestedLoanAmount || 0) > 0) {
      components.push({
        name: 'New Facility',
        amount: params.requestedLoanAmount,
        rate: params.proposedPricing || params.interestRate || 0,
        seniority: 'Senior',
        source: 'From Parameters'
      });
    }

    const totalFromComponents = components.reduce((sum, c) => sum + c.amount, 0);

    // Warn if mismatch
    if (Math.abs(totalFromComponents - projections.finalDebt) > 1000) {
      console.warn('ValuationTab: Debt mismatch', {
        fromComponents: totalFromComponents,
        fromProjection: projections.finalDebt
      });
    }

    const totalDebt = projections.finalDebt; // Trust projection
    const blendedRate = totalDebt > 0
      ? components.reduce((sum, c) => sum + (c.amount / totalDebt) * c.rate, 0)
      : 0;

    return {
      components,
      totalDebt,
      blendedRate,
      source: 'Single/Combined Debt'
    };
  }

  // No debt
  return {
    components: [],
    totalDebt: 0,
    blendedRate: 0,
    source: 'No Debt'
  };
}

/**
 * Run sanity checks on valuation
 */
function runSanityChecks(projections, params, debtBreakdown, tvPercent, ccy) {
  const checks = [];

  // Check 1: Terminal Value Dominance
  if (tvPercent > 85) {
    checks.push({
      type: 'critical',
      code: 'TV_DOMINATES',
      title: 'Terminal Value Dominates Valuation',
      message: `Terminal value is ${tvPercent.toFixed(0)}% of enterprise value. Consider extending projection period or reviewing growth assumptions.`,
      value: tvPercent
    });
  } else if (tvPercent > 75) {
    checks.push({
      type: 'warning',
      code: 'TV_HIGH',
      title: 'High Terminal Value Contribution',
      message: `Terminal value is ${tvPercent.toFixed(0)}% of enterprise value.`,
      value: tvPercent
    });
  }

  // Check 2: Negative FCFs
  const negativeFCFYears = projections.rows.filter(r => r.unleveredFCF < 0);
  if (negativeFCFYears.length > 0) {
    checks.push({
      type: negativeFCFYears.length > 2 ? 'critical' : 'warning',
      code: 'NEGATIVE_FCF',
      title: 'Negative Free Cash Flows',
      message: `${negativeFCFYears.length} year(s) have negative unlevered FCF: ${negativeFCFYears.map(r => r.year).join(', ')}`,
      years: negativeFCFYears.map(r => r.year)
    });
  }

  // Check 3: Negative Equity Value
  if (projections.equityValue < 0) {
    checks.push({
      type: 'critical',
      code: 'NEGATIVE_EQUITY',
      title: 'Negative Equity Value',
      message: 'Enterprise value does not cover net debt. The company may be insolvent under these projections.',
      value: projections.equityValue
    });
  }

  // Check 4: WACC vs Terminal Growth
  if (!projections.isWACCValid) {
    checks.push({
      type: 'critical',
      code: 'WACC_INVALID',
      title: 'Invalid WACC/Growth Relationship',
      message: `WACC (${pctFmt(params.wacc)}) must exceed terminal growth (${pctFmt(params.terminalGrowth)}).`
    });
  }

  // Check 5: High Terminal Growth
  if (params.terminalGrowth > 0.03) {
    checks.push({
      type: 'warning',
      code: 'HIGH_TERMINAL_GROWTH',
      title: 'High Terminal Growth Rate',
      message: `Terminal growth of ${pctFmt(params.terminalGrowth)} exceeds typical long-term GDP growth (~3%).`
    });
  }

  // Check 6: Missing Shares Outstanding
  if (!params.sharesOutstanding || params.sharesOutstanding <= 0) {
    checks.push({
      type: 'info',
      code: 'NO_SHARES',
      title: 'Shares Outstanding Not Specified',
      message: 'Price per share cannot be calculated. Set sharesOutstanding in Financial Parameters.'
    });
  }

  // Check 7: Missing Opening Cash
  if (params.openingCash === undefined || params.openingCash === null) {
    checks.push({
      type: 'info',
      code: 'NO_CASH',
      title: 'Opening Cash Not Specified',
      message: 'Opening cash defaults to 0. Set openingCash in Parameters if company has cash.'
    });
  }

  // Check 8: New Facility might be missing
  if (params.requestedLoanAmount > 0) {
    const facilityInDebt = debtBreakdown.components.some(c =>
      c.name.toLowerCase().includes('new') ||
      c.name.toLowerCase().includes('facility') ||
      Math.abs(c.amount - params.requestedLoanAmount) < 1000
    );

    if (!facilityInDebt && debtBreakdown.totalDebt > 0) {
      checks.push({
        type: 'critical',
        code: 'FACILITY_MISSING',
        title: 'New Facility May Not Be in Valuation',
        message: `New facility of ${currencyFmtMM(params.requestedLoanAmount, ccy || 'JMD')} may not be included in the debt calculation.`
      });
    }
  }

  // Check 9: Debt mismatch between params and projections
  const paramsDebt = (params.openingDebt || 0) + (params.requestedLoanAmount || 0);
  const projDebt = projections.multiTrancheInfo?.totalDebt || projections.finalDebt || 0;

  if (paramsDebt > 0 && projDebt > 0 && Math.abs(paramsDebt - projDebt) > paramsDebt * 0.05) {
    checks.push({
      type: 'warning',
      code: 'DEBT_MISMATCH',
      title: 'Debt Calculation Discrepancy',
      message: `Parameters suggest ${currencyFmtMM(paramsDebt, 'JMD')} debt but projection uses ${currencyFmtMM(projDebt, 'JMD')}.`
    });
  }

  return checks;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SanityCheckAlerts({ checks }) {
  if (!checks || checks.length === 0) return null;

  const critical = checks.filter(c => c.type === 'critical');
  const warnings = checks.filter(c => c.type === 'warning');
  const info = checks.filter(c => c.type === 'info');

  return (
    <div className="space-y-3">
      {critical.length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 mb-2">Critical Issues</h3>
              <ul className="space-y-2">
                {critical.map((c, i) => (
                  <li key={i} className="text-sm text-red-800">
                    <span className="font-semibold">{c.title}:</span> {c.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900 mb-2">Warnings</h3>
              <ul className="space-y-2">
                {warnings.map((c, i) => (
                  <li key={i} className="text-sm text-amber-800">
                    <span className="font-semibold">{c.title}:</span> {c.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {info.length > 0 && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <ul className="space-y-1">
                {info.map((c, i) => (
                  <li key={i} className="text-sm text-blue-800">
                    <span className="font-semibold">{c.title}:</span> {c.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ data, ccy }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Enterprise Value */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
        <div className="text-purple-100 text-sm font-medium mb-1">Enterprise Value</div>
        <div className="text-2xl font-bold">{currencyFmtMM(data.enterpriseValue, ccy)}</div>
        <div className="text-purple-200 text-xs mt-2">DCF Valuation (from projections)</div>
      </div>

      {/* Equity Value */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
        <div className="text-indigo-100 text-sm font-medium mb-1">Equity Value</div>
        <div className="text-2xl font-bold">{currencyFmtMM(data.equityValue, ccy)}</div>
        <div className="text-indigo-200 text-xs mt-2">
          {data.hasDebt ? 'After Net Debt' : 'No Leverage'}
        </div>
      </div>

      {/* Price Per Share - CORRECT FORMATTING */}
      <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white shadow-lg">
        <div className="text-pink-100 text-sm font-medium mb-1">Price per Share</div>
        <div className="text-2xl font-bold">
          {data.pricePerShare !== null
            ? `${ccy} ${data.pricePerShare.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}`
            : 'N/A'}
        </div>
        <div className="text-pink-200 text-xs mt-2">
          {data.sharesOutstanding > 0
            ? `${(data.sharesOutstanding / 1000000).toFixed(2)}M shares (${data.sharesSource})`
            : 'No shares specified'}
        </div>
      </div>

      {/* WACC */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
        <div className="text-blue-100 text-sm font-medium mb-1">WACC</div>
        <div className="text-2xl font-bold">{pctFmt(data.wacc)}</div>
        <div className="text-blue-200 text-xs mt-2">
          Terminal Growth: {pctFmt(data.terminalGrowth)}
        </div>
      </div>
    </div>
  );
}

function CapitalStructureSection({ data, ccy }) {
  return (
    <Card className="border-l-4 border-l-slate-600">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5 text-slate-600" />
          Capital Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Debt Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Debt Components
              <span className="ml-2 text-xs font-normal text-slate-500">
                ({data.debtBreakdown.source})
              </span>
            </h3>

            {data.debtBreakdown.components.length > 0 ? (
              <div className="space-y-2">
                {data.debtBreakdown.components.map((comp, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-medium text-slate-800">{comp.name}</span>
                      <span className="ml-2 text-xs text-slate-500">@ {pctFmt(comp.rate)}</span>
                      <div className="text-xs text-slate-400">{comp.source}</div>
                    </div>
                    <span className="font-bold text-slate-900">{currencyFmtMM(comp.amount, ccy)}</span>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-between items-center p-3 bg-slate-800 text-white rounded-lg">
                  <div>
                    <span className="font-bold">Total Debt</span>
                    {data.blendedRate > 0 && (
                      <span className="ml-2 text-xs text-slate-300">
                        (Blended: {pctFmt(data.blendedRate)})
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-bold">{currencyFmtMM(data.totalDebt, ccy)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                No debt configured - unlevered analysis
              </div>
            )}
          </div>

          {/* Net Debt Calculation */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Net Debt Calculation
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-700">Total Debt</span>
                <span className="font-semibold">{currencyFmtMM(data.totalDebt, ccy)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-700">Less: Cash</span>
                  {data.cash.isMissing && (
                    <span className="ml-2 text-xs text-amber-600 font-medium">(Not provided)</span>
                  )}
                  <div className="text-xs text-slate-400">{data.cash.source}</div>
                </div>
                <span className="font-semibold text-green-600">
                  ({currencyFmtMM(data.finalCash, ccy)})
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-indigo-600 text-white rounded-lg">
                <span className="font-bold">= Net Debt</span>
                <span className="text-xl font-bold">{currencyFmtMM(data.netDebt, ccy)}</span>
              </div>
            </div>

            {/* Missing Cash Warning */}
            {data.cash.isMissing && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Opening cash not specified.</strong> Add <code className="bg-amber-100 px-1 rounded">openingCash</code> to
                    your parameters to include cash in net debt calculation.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DCFBuildUpSection({ data, ccy }) {
  // Color code TV percentage
  const getTVColor = (pct) => {
    if (pct > 85) return 'bg-red-50 text-red-700 border-red-200';
    if (pct > 75) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <Card className="border-l-4 border-l-purple-600">
      <CardHeader className="bg-purple-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          DCF Build-Up
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Enterprise Value Build-Up */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Enterprise Value Build-Up</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-700">PV of Projected FCFs</span>
                <span className="font-semibold">{currencyFmtMM(data.pvProjectedFCFs, ccy)}</span>
              </div>

              <div className={`flex justify-between items-center p-3 rounded-lg border ${getTVColor(data.tvPercent)}`}>
                <div>
                  <span>+ PV of Terminal Value</span>
                  <span className="ml-2 text-xs font-bold">
                    ({data.tvPercent.toFixed(1)}% of EV)
                  </span>
                </div>
                <span className="font-semibold">{currencyFmtMM(data.pvTerminal, ccy)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-purple-600 text-white rounded-lg">
                <span className="font-bold">= Enterprise Value</span>
                <span className="text-xl font-bold">{currencyFmtMM(data.enterpriseValue, ccy)}</span>
              </div>
            </div>
          </div>

          {/* Bridge to Equity */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-4">Bridge to Equity Value</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-700">Enterprise Value</span>
                <span className="font-semibold">{currencyFmtMM(data.enterpriseValue, ccy)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-red-600">- Net Debt</span>
                <span className="font-semibold text-red-600">
                  ({currencyFmtMM(Math.abs(data.netDebt), ccy)})
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-indigo-600 text-white rounded-lg">
                <span className="font-bold">= Equity Value</span>
                <span className="text-xl font-bold">{currencyFmtMM(data.equityValue, ccy)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Source indicator */}
        <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-purple-900">
              <div className="font-semibold mb-1">Data Source: buildProjection.js</div>
              <div>All valuation figures are computed by the projection engine using WACC ({pctFmt(data.wacc)}) and Terminal Growth ({pctFmt(data.terminalGrowth)}) from parameters.</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function YearByYearTable({ data, ccy }) {
  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardHeader className="bg-blue-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Year-by-Year Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Year</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">EBITDA</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Unlevered FCF</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Debt Service</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Debt Balance</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {data.years.map((row, idx) => (
                <tr key={row.year} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.year}</td>
                  <td className="px-4 py-3 text-right">{currencyFmtMM(row.revenue, ccy)}</td>
                  <td className="px-4 py-3 text-right">{currencyFmtMM(row.ebitda, ccy)}</td>
                  <td className={`px-4 py-3 text-right ${row.unleveredFCF < 0 ? 'text-red-600 font-semibold' : ''}`}>
                    {currencyFmtMM(row.unleveredFCF, ccy)}
                  </td>
                  <td className="px-4 py-3 text-right">{currencyFmtMM(row.debtService, ccy)}</td>
                  <td className="px-4 py-3 text-right">{currencyFmtMM(row.debtBalance, ccy)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${
                    row.dscr === null ? 'text-slate-400' :
                    row.dscr < 1.2 ? 'text-red-600' :
                    row.dscr < 1.5 ? 'text-amber-600' :
                    'text-emerald-600'
                  }`}>
                    {row.dscr === null ? 'N/A' : `${row.dscr.toFixed(2)}x`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ImpliedMultiplesSection({ data, ccy }) {
  return (
    <Card className="border-l-4 border-l-pink-600">
      <CardHeader className="bg-pink-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-pink-600" />
          Implied Valuation Multiples
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">EV/Revenue</div>
            <div className="text-2xl font-bold text-slate-800">
              {data.impliedMultiples.evRevenue ? `${data.impliedMultiples.evRevenue.toFixed(2)}x` : 'N/A'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">EV/EBITDA</div>
            <div className="text-2xl font-bold text-slate-800">
              {data.impliedMultiples.evEbitda ? `${data.impliedMultiples.evEbitda.toFixed(2)}x` : 'N/A'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">EV/EBIT</div>
            <div className="text-2xl font-bold text-slate-800">
              {data.impliedMultiples.evEbit ? `${data.impliedMultiples.evEbit.toFixed(2)}x` : 'N/A'}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">P/E Ratio</div>
            <div className="text-2xl font-bold text-slate-800">
              {data.impliedMultiples.pe ? `${data.impliedMultiples.pe.toFixed(2)}x` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Price Per Share - CORRECT FORMATTING */}
        <div className="mt-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-bold text-pink-900">Implied Price per Share</div>
              <div className="text-xs text-pink-700">{data.sharesSource}</div>
            </div>
            <div className="text-2xl font-bold text-pink-600">
              {data.pricePerShare !== null
                ? `${ccy} ${data.pricePerShare.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}`
                : 'N/A'}
            </div>
          </div>
          {data.sharesOutstanding > 0 && (
            <div className="text-xs text-pink-600 mt-1">
              Based on {numFmt(data.sharesOutstanding)} shares outstanding
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SensitivityAnalysis({ data, params, ccy }) {
  // Generate sensitivity matrix using projections data
  const waccSteps = [-0.02, -0.01, 0, 0.01, 0.02];
  const growthSteps = [-0.01, -0.005, 0, 0.005, 0.01];

  const baseWACC = params.wacc;
  const baseGrowth = params.terminalGrowth;

  // Use last year's FCF for terminal value calc
  const lastYear = data.years[data.years.length - 1];
  const terminalFCF = lastYear.unleveredFCF * (1 + baseGrowth);

  const matrix = growthSteps.map(gDelta => {
    return waccSteps.map(wDelta => {
      const testWACC = baseWACC + wDelta;
      const testGrowth = baseGrowth + gDelta;

      if (testWACC <= testGrowth) return null; // Invalid

      // Recalculate terminal value and EV
      const tv = terminalFCF * (1 + gDelta) / (testWACC - testGrowth);
      const pvTV = tv / Math.pow(1 + testWACC, data.years.length);

      // Approximate PV of FCFs (simplified - scales with WACC change)
      const waccRatio = baseWACC / testWACC;
      const approxPvFCFs = data.pvProjectedFCFs * Math.pow(waccRatio, data.years.length / 2);

      const ev = approxPvFCFs + pvTV;
      const equity = ev - data.netDebt;

      return equity;
    });
  });

  return (
    <Card className="border-l-4 border-l-indigo-600">
      <CardHeader className="bg-indigo-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-indigo-600" />
          Sensitivity Analysis: Equity Value
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left bg-slate-100 border border-slate-200 font-bold">
                  WACC ↓ / Growth →
                </th>
                {growthSteps.map((g, i) => (
                  <th key={i} className={`px-3 py-2 text-center border border-slate-200 ${
                    g === 0 ? 'bg-indigo-100 font-bold' : 'bg-slate-100'
                  }`}>
                    {pctFmt(baseGrowth + g)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className={`px-3 py-2 font-bold border border-slate-200 ${
                    waccSteps[i] === 0 ? 'bg-indigo-100' : 'bg-slate-50'
                  }`}>
                    {pctFmt(baseWACC + waccSteps[i])}
                  </td>
                  {row.map((val, j) => {
                    const isBase = waccSteps[i] === 0 && growthSteps[j] === 0;

                    return (
                      <td
                        key={j}
                        className={`px-3 py-2 text-center border border-slate-200 ${
                          val === null ? 'bg-slate-200 text-slate-400' :
                          isBase ? 'bg-indigo-200 font-bold ring-2 ring-indigo-500' :
                          val > data.equityValue * 1.05 ? 'bg-green-50' :
                          val < data.equityValue * 0.95 ? 'bg-red-50' :
                          'bg-yellow-50'
                        }`}
                      >
                        {val === null ? 'N/A' : currencyFmtMM(val, ccy)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-slate-300 rounded"></div>
            <span>Higher than base (+5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border border-slate-300 rounded"></div>
            <span>Similar to base (±5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-slate-300 rounded"></div>
            <span>Lower than base (-5%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-200 border-2 border-indigo-500 rounded"></div>
            <span className="font-bold">Base Case</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportSection({ data, exportStatus, onExport }) {
  return (
    <Card className="border-l-4 border-l-blue-600">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-semibold text-slate-800">Export Valuation Analysis</span>
              {exportStatus && (
                <span className={`ml-3 text-sm ${
                  exportStatus === 'Exported' ? 'text-green-600' :
                  exportStatus === 'Failed' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {exportStatus === 'Exported' ? '✓ Exported successfully!' :
                   exportStatus === 'Failed' ? '✗ Export failed' : exportStatus}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              leftIcon={Download}
              onClick={() => onExport('full')}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md"
            >
              Full DCF Export
            </Button>
            <Button
              size="sm"
              leftIcon={Download}
              onClick={() => onExport('sensitivity')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md"
            >
              Sensitivity Matrix
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Export comprehensive valuation data to CSV for validation and further analysis
        </p>
      </CardContent>
    </Card>
  );
}

export default ValuationTab;
