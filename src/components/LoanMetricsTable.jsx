import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { currencyFmt, currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import { Download, CheckCircle, XCircle, AlertTriangle, Calendar, DollarSign, TrendingUp, Shield, Info } from "lucide-react";
import { exportLoanMetricsCSV } from "../utils/exportLoanMetrics";

// Color palette for consistency
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', chart: '#2563eb' },
  success: { from: 'emerald-500', to: 'emerald-600', chart: '#10b981' },
  warning: { from: 'amber-500', to: 'amber-600', chart: '#f59e0b' },
  danger: { from: 'red-500', to: 'red-600', chart: '#ef4444' },
};
// Import or duplicate the helper
function expand4IntervalsToPerYear(tenorYears, interestOnlyYears, intervals) {
  if (!Array.isArray(intervals) || intervals.length !== 4) return null;
  
  const ioYrs = Math.max(0, Math.min(tenorYears, interestOnlyYears || 0));
  const amortYears = Math.max(tenorYears - ioYrs, 1);
  const base = Math.floor(amortYears / 4);
  const rem = amortYears % 4;
  
  const perYear = [];
  for (let y = 0; y < ioYrs; y++) perYear.push(0);
  
  for (let k = 0; k < 4; k++) {
    const bucketYears = base + (k < rem ? 1 : 0);
    const pctPerYear = bucketYears > 0 ? (intervals[k] || 0) / bucketYears : 0;
    for (let y = 0; y < bucketYears; y++) perYear.push(pctPerYear);
  }
  
  while (perYear.length < tenorYears) perYear.push(0);
  
  const sum = perYear.reduce((s, v) => s + v, 0);
  if (Math.abs(sum - 100) > 0.01 && sum > 0) {
    for (let i = perYear.length - 1; i >= ioYrs; i--) {
      if (perYear[i] > 0) {
        perYear[i] += (100 - sum);
        break;
      }
    }
  }
  
  return perYear;
}
export default function LoanMetricsTable({ projection, params, title, ccy }) {
  const [showDetailedSchedule, setShowDetailedSchedule] = useState(false);

  // FIXED: Build new facility schedule with proper balloon and day count
  const newFacilitySchedule = useMemo(() => {
    if (!params.requestedLoanAmount || !projection?.rows?.length) return null;
    
    const paymentsPerYear = params.paymentFrequency === "Monthly" ? 12 :
      params.paymentFrequency === "Quarterly" ? 4 :
      params.paymentFrequency === "Semi-Annually" ? 2 : 
      params.paymentFrequency === "Annually" ? 1 : 4;

    // Apply day count convention to interest rate
    const effectiveRate = params.dayCountConvention === "Actual/360" 
      ? (params.proposedPricing ?? params.interestRate ?? 0) * (365/360)
      : (params.proposedPricing ?? params.interestRate ?? 0);

    const loanAmount = params.requestedLoanAmount;
    const tenor = params.debtTenorYears || 5;
    const interestOnlyYears = params.interestOnlyYears || 0;
    const balloonPercentage = (params.paymentFrequency === "Balloon" && params.useBalloonPayment) 
  ? (params.balloonPercentage || 0) 
  : 0;
    
    // FIXED: Calculate amortization period correctly
    const amortizationYears = tenor - interestOnlyYears;
    const balloonAmount = loanAmount * (balloonPercentage / 100);
    const amortizingAmount = loanAmount - balloonAmount;
// Check for custom amortization
    let customAmortizationSchedule = null;
    if (params.paymentFrequency === "customAmortization" && 
        Array.isArray(params.customAmortizationIntervals)) {
      customAmortizationSchedule = expand4IntervalsToPerYear(
        tenor,
        interestOnlyYears,
        params.customAmortizationIntervals
      );
    }
    
    let beginningBalance = loanAmount;
    
    return projection.rows.map((r, idx) => {
      const year = idx + 1;
      const isInterestOnly = year <= interestOnlyYears;
      const isFinalYear = year === tenor;
      
      // Interest calculation
      const interestPayment = beginningBalance * effectiveRate;
      
      // FIXED: Principal payment logic
      let principalPayment = 0;
      if (customAmortizationSchedule && customAmortizationSchedule[idx]) {
        // Use custom schedule
        principalPayment = (customAmortizationSchedule[idx] / 100) * loanAmount;
      } else if (!isInterestOnly && amortizationYears > 0) {
        // Regular amortization (excluding balloon)
        principalPayment = amortizingAmount / amortizationYears;
      }
      
      // FIXED: Add balloon payment in final year
      let balloonPayment = 0;
if (isFinalYear && params.paymentFrequency === "Balloon" && params.useBalloonPayment && balloonAmount > 0) {
  balloonPayment = balloonAmount;
}
      
      const totalPrincipal = principalPayment + balloonPayment;
      const totalPayment = interestPayment + totalPrincipal;
      const endingBalance = Math.max(0, beginningBalance - totalPrincipal);

      const schedule = {
        year: r.year,
        beginningBalance,
        principalPayment,
        balloonPayment,
        totalPrincipal,
        interestPayment,
        totalPayment,
        endingBalance,
        paymentPerPeriod: paymentsPerYear > 0 ? totalPayment / paymentsPerYear : totalPayment,
        paymentsPerYear,
        hasBalloon: isFinalYear && balloonAmount > 0,
        isInterestOnly,
        effectiveRate: effectiveRate * 100 // Convert to percentage
      };

      beginningBalance = endingBalance;
      return schedule;
    });
  }, [params, projection]);

  // Build existing schedule
  const existingSchedule = useMemo(() => {
    if (!params.openingDebt || !projection?.rows?.length) return null;
    
    let beginningBalance = params.openingDebt;
    
    return projection.rows.map((r) => {
      const schedule = {
        year: r.year,
        beginningBalance,
        principal: r.principal || 0,
        interest: r.interest || 0,
        total: r.debtService || 0,
        endingBalance: r.endingDebt ?? Math.max(0, beginningBalance - (r.principal || 0)),
      };
      beginningBalance = schedule.endingBalance;
      return schedule;
    });
  }, [params.openingDebt, projection]);

  // FIXED: Combined metrics calculation
  const combinedMetrics = useMemo(() => {
    if (!projection?.rows?.length) return null;
    
    return projection.rows.map((r, idx) => {
      const existingDebtService = r.debtService || 0;
      const newFacilityPayment = newFacilitySchedule?.[idx]?.totalPayment || 0;
      const totalDebtService = existingDebtService + newFacilityPayment;
      
      const existingPrincipal = r.principal || 0;
      const newPrincipal = newFacilitySchedule?.[idx]?.totalPrincipal || 0;
      const totalPrincipal = existingPrincipal + newPrincipal;
      
      const existingInterest = r.interest || 0;
      const newInterest = newFacilitySchedule?.[idx]?.interestPayment || 0;
      const totalInterest = existingInterest + newInterest;
      
      // FIXED: Total debt calculation
      const existingDebt = r.endingDebt || 0;
      const newDebt = newFacilitySchedule?.[idx]?.endingBalance || 0;
      const totalDebt = existingDebt + newDebt;
      
      // FIXED: LTV calculation with proper debt balance
      const ltv = params.collateralValue ? (totalDebt / params.collateralValue) * 100 : 0;
      
      // FIXED: Cash after debt service (using EBITDA - Capex - Taxes - WC Change - Debt Service)
      const ebitda = r.ebitda || 0;
      const capex = r.capex || 0;
      const taxes = r.taxes || 0;
      const wcChange = r.wcChange || 0;
      const operatingCashFlow = ebitda - capex - taxes - wcChange;
      const cashAfterDS = operatingCashFlow - totalDebtService;
      
      // Recalculate coverage ratios with combined debt service
      const dscr = totalDebtService > 0 ? operatingCashFlow / totalDebtService : 0;
      const icr = totalInterest > 0 ? ebitda / totalInterest : 0;
      const ndToEbitda = ebitda > 0 ? totalDebt / ebitda : 0;
      
      return {
        year: r.year,
        dscr,
        icr,
        ndToEbitda,
        totalDebtService,
        totalPrincipal,
        totalInterest,
        totalDebt,
        ltv,
        cashAfterDS,
        ebitda,
        operatingCashFlow,
        hasBalloon: newFacilitySchedule?.[idx]?.hasBalloon || false,
        balloonAmount: newFacilitySchedule?.[idx]?.balloonPayment || 0
      };
    });
  }, [projection, newFacilitySchedule, params.collateralValue]);

  if (!projection || !projection.rows?.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading loan metrics...</p>
        </div>
      </div>
    );
  }

  // Normalize rate (0.12 -> 12%)
  const effectiveRate = params.dayCountConvention === "Actual/360" 
    ? (params.proposedPricing ?? params.interestRate ?? 0) * (365/360)
    : (params.proposedPricing ?? params.interestRate ?? 0);
    
  const ratePct = effectiveRate < 1 ? effectiveRate * 100 : effectiveRate;
  const loanAmount = params.requestedLoanAmount ?? params.facilityAmount ?? 0;

  // Covenant thresholds
  const minDSCR = params.minDSCR ?? 1.2;
  const targetICR = params.targetICR ?? 2.0;
  const maxLTV = params.maxLTV ?? 75;
  const maxLeverage = params.maxNDToEBITDA ?? 4.0;

  // Summary stats from combined metrics
  const minDscrVal = combinedMetrics ? Math.min(...combinedMetrics.map(m => m.dscr)) : 0;
  const minIcrVal = combinedMetrics ? Math.min(...combinedMetrics.map(m => m.icr)) : 0;
  const maxLevVal = combinedMetrics ? Math.max(...combinedMetrics.map(m => m.ndToEbitda)) : 0;
  const maxLtvVal = combinedMetrics ? Math.max(...combinedMetrics.map(m => m.ltv)) : 0;
  
  // Breach detection
  const dscrBreaches = combinedMetrics?.filter(m => m.dscr < minDSCR).length || 0;
  const icrBreaches = combinedMetrics?.filter(m => m.icr < targetICR).length || 0;
  const leverageBreaches = combinedMetrics?.filter(m => m.ndToEbitda > maxLeverage).length || 0;
  const ltvBreaches = combinedMetrics?.filter(m => m.ltv > maxLTV).length || 0;
  const totalBreaches = dscrBreaches + icrBreaches + leverageBreaches + ltvBreaches;

  return (
    <div className="space-y-6">
      {/* Enhanced Header Card */}
      <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              {title || "Loan Metrics & Covenant Analysis"}
            </CardTitle>
            <button
              onClick={() => exportLoanMetricsCSV(
                projection,
                params,
                title,
                ccy,
                { newFacilitySchedule, existingSchedule, combinedMetrics }
              )}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-semibold"
            >
              <Download className="w-4 h-4" />
              Export Summary
            </button>
          </div>
        </CardHeader>
        
        {/* Facility Overview */}
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <OverviewItem 
              label="Loan Amount" 
              value={currencyFmtMM(loanAmount, ccy)}
              icon={<DollarSign className="w-4 h-4" />}
              color="blue"
            />
            <OverviewItem 
              label="Interest Rate" 
              value={`${numFmt(ratePct)}%`}
              subtitle={params.dayCountConvention === "Actual/360" ? "Actual/360" : "Standard"}
              icon={<TrendingUp className="w-4 h-4" />}
              color="emerald"
            />
            <OverviewItem 
              label="Tenor" 
              value={`${params.debtTenorYears} years`}
              icon={<Calendar className="w-4 h-4" />}
              color="purple"
            />
            <OverviewItem 
              label="Payment Frequency" 
              value={params.paymentFrequency || "Quarterly"}
              icon={<Calendar className="w-4 h-4" />}
              color="indigo"
            />
            <OverviewItem 
              label="Interest-Only Period" 
              value={`${params.interestOnlyYears || 0} years`}
              color="amber"
            />
            <OverviewItem 
              label="Balloon Payment" 
              value={`${params.balloonPercentage || 0}%`}
              subtitle={params.balloonPercentage > 0 ? currencyFmtMM(loanAmount * (params.balloonPercentage / 100), ccy) : "None"}
              color="red"
            />
          </div>
        </CardContent>
      </Card>

      {/* Covenant Compliance Summary */}
      <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Covenant Compliance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CovenantMetric
              label="Min DSCR"
              value={numFmt(minDscrVal)}
              threshold={minDSCR}
              breaches={dscrBreaches}
              isBetter={(val, thresh) => val >= thresh}
            />
            <CovenantMetric
              label="Min ICR"
              value={numFmt(minIcrVal)}
              threshold={targetICR}
              breaches={icrBreaches}
              isBetter={(val, thresh) => val >= thresh}
            />
            <CovenantMetric
              label="Max Leverage"
              value={numFmt(maxLevVal) + "x"}
              threshold={maxLeverage}
              breaches={leverageBreaches}
              isBetter={(val, thresh) => val <= thresh}
            />
            <CovenantMetric
              label="Max LTV"
              value={numFmt(maxLtvVal) + "%"}
              threshold={maxLTV}
              breaches={ltvBreaches}
              isBetter={(val, thresh) => val <= thresh}
            />
          </div>
          
          {totalBreaches > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-red-800 text-sm">Covenant Breaches Detected</div>
                <div className="text-red-700 text-xs mt-1">
                  {totalBreaches} breach{totalBreaches > 1 ? 'es' : ''} across {params.debtTenorYears} years. Review structure immediately.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Metrics Table */}
      <Card className="shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Year-by-Year Analysis
            </CardTitle>
            <button
              onClick={() => setShowDetailedSchedule(!showDetailedSchedule)}
              className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              <Info className="w-4 h-4" />
              {showDetailedSchedule ? 'Hide' : 'Show'} Payment Schedule
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Year</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">DSCR</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Cushion</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">ICR</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Cushion</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">ND/EBITDA</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Cushion</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Debt Service</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Principal</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Interest</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">LTV</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Cash After DS</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {combinedMetrics?.map((m, idx) => {
                  const dscrBreach = m.dscr < minDSCR;
                  const icrBreach = m.icr < targetICR;
                  const levBreach = m.ndToEbitda > maxLeverage;
                  const ltvBreach = m.ltv > maxLTV;
                  const anyBreach = dscrBreach || icrBreach || levBreach || ltvBreach;

                  return (
                    <tr 
                      key={m.year}
                      className={`hover:bg-slate-50 transition-colors ${
                        anyBreach ? 'bg-red-50' : ''
                      } ${m.hasBalloon ? 'bg-amber-50 font-semibold' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          {m.year}
                          {m.hasBalloon && (
                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                              BALLOON
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${dscrBreach ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(m.dscr)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        m.dscr - minDSCR < 0 ? 'text-red-600' : 
                        m.dscr - minDSCR < 0.2 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {m.dscr - minDSCR >= 0 ? '+' : ''}{numFmt(m.dscr - minDSCR)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${icrBreach ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(m.icr)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        m.icr - targetICR < 0 ? 'text-red-600' : 
                        m.icr - targetICR < 0.5 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {m.icr - targetICR >= 0 ? '+' : ''}{numFmt(m.icr - targetICR)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${levBreach ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(m.ndToEbitda)}x
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        maxLeverage - m.ndToEbitda < 0 ? 'text-red-600' : 
                        maxLeverage - m.ndToEbitda < 0.5 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {maxLeverage - m.ndToEbitda >= 0 ? '+' : ''}{numFmt(maxLeverage - m.ndToEbitda)}x
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {currencyFmt(m.totalDebtService, ccy)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {currencyFmt(m.totalPrincipal, ccy)}
                        {m.hasBalloon && m.balloonAmount > 0 && (
                          <div className="text-[10px] text-amber-600">
                            (incl. {currencyFmtMM(m.balloonAmount, ccy)} balloon)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {currencyFmt(m.totalInterest, ccy)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${ltvBreach ? 'text-red-600' : 'text-slate-800'}`}>
                        {numFmt(m.ltv)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        m.cashAfterDS < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {currencyFmt(m.cashAfterDS, ccy)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {anyBreach ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-bold border border-red-200">
                            <XCircle className="w-3 h-3" />
                            BREACH
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            PASS
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary footer */}
              <tfoot className="bg-gradient-to-r from-slate-100 to-slate-200 border-t-2 border-slate-300">
                <tr className="font-bold">
                  <td className="px-3 py-2 text-slate-800">Summary</td>
                  <td className={`px-3 py-2 text-right ${minDscrVal < minDSCR ? 'text-red-600' : 'text-emerald-600'}`}>
                    {numFmt(minDscrVal)}
                  </td>
                  <td></td>
                  <td className={`px-3 py-2 text-right ${minIcrVal < targetICR ? 'text-red-600' : 'text-emerald-600'}`}>
                    {numFmt(minIcrVal)}
                  </td>
                  <td></td>
                  <td className={`px-3 py-2 text-right ${maxLevVal > maxLeverage ? 'text-red-600' : 'text-emerald-600'}`}>
                    {numFmt(maxLevVal)}x
                  </td>
                  <td colSpan="7"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Payment Schedule (Collapsible) */}
      {showDetailedSchedule && newFacilitySchedule && (
        <Card className="border-l-4 border-l-purple-600 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Detailed Payment Schedule - New Facility
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Year</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Beginning Balance</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Principal</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Balloon</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Interest</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Total Payment</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Ending Balance</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Per Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {newFacilitySchedule.map((s) => (
                    <tr 
                      key={s.year}
                      className={`hover:bg-slate-50 ${s.hasBalloon ? 'bg-amber-50 font-semibold' : ''} ${s.isInterestOnly ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          {s.year}
                          {s.isInterestOnly && (
                            <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">
                              I/O
                            </span>
                          )}
                          {s.hasBalloon && (
                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                              BALLOON
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">{currencyFmt(s.beginningBalance, ccy)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{currencyFmt(s.principalPayment, ccy)}</td>
                      <td className="px-3 py-2 text-right font-bold text-amber-700">{currencyFmt(s.balloonPayment, ccy)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{currencyFmt(s.interestPayment, ccy)}</td>
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{currencyFmt(s.totalPayment, ccy)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{currencyFmt(s.endingBalance, ccy)}</td><td className="px-3 py-2 text-right text-slate-600">
                        {currencyFmt(s.paymentPerPeriod, ccy)}
                        <div className="text-[10px] text-slate-500">
                          ({s.paymentsPerYear}x/year)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-slate-100 to-slate-200 border-t-2 border-slate-300">
                  <tr className="font-bold">
                    <td className="px-3 py-2 text-slate-800">Totals</td>
                    <td></td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {currencyFmt(newFacilitySchedule.reduce((sum, s) => sum + s.principalPayment, 0), ccy)}
                    </td>
                    <td className="px-3 py-2 text-right text-amber-700">
                      {currencyFmt(newFacilitySchedule.reduce((sum, s) => sum + s.balloonPayment, 0), ccy)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">
                      {currencyFmt(newFacilitySchedule.reduce((sum, s) => sum + s.interestPayment, 0), ccy)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">
                      {currencyFmt(newFacilitySchedule.reduce((sum, s) => sum + s.totalPayment, 0), ccy)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="mt-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-sm mb-3 text-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Payment Schedule Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-medium text-slate-600">Effective Rate: </span>
                  <span className="font-bold text-slate-800">
                    {numFmt(newFacilitySchedule[0]?.effectiveRate || 0)}%
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-medium text-slate-600">Total Interest: </span>
                  <span className="font-bold text-slate-800">
                    {currencyFmtMM(newFacilitySchedule.reduce((sum, s) => sum + s.interestPayment, 0), ccy)}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-medium text-slate-600">Total Payments: </span>
                  <span className="font-bold text-slate-800">
                    {currencyFmtMM(newFacilitySchedule.reduce((sum, s) => sum + s.totalPayment, 0), ccy)}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="font-medium text-slate-600">All-In Cost: </span>
                  <span className="font-bold text-slate-800">
                    {pctFmt((newFacilitySchedule.reduce((sum, s) => sum + s.interestPayment, 0) / loanAmount) / params.debtTenorYears)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- Enhanced Reusable Components --- */

function OverviewItem({ label, value, subtitle, icon, color = "blue" }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className={`p-4 bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-md text-white transform transition-all duration-200 hover:scale-105`}>
      <div className="flex items-center gap-2 mb-1 opacity-90">
        {icon}
        <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-xl font-bold mb-1">{value}</div>
      {subtitle && <div className="text-xs opacity-80">{subtitle}</div>}
    </div>
  );
}

function CovenantMetric({ label, value, threshold, breaches, isBetter }) {
  const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  const isCompliant = isBetter(numValue, threshold);
  const cushion = isBetter === ((v, t) => v >= t) ? numValue - threshold : threshold - numValue;
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      !isCompliant ? 'bg-red-50 border-red-300' : 
      cushion < 0.2 ? 'bg-amber-50 border-amber-300' : 
      'bg-emerald-50 border-emerald-300'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        {isCompliant ? (
          <CheckCircle className="w-4 h-4 text-emerald-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600" />
        )}
      </div>
      <div className={`text-2xl font-bold mb-1 ${
        !isCompliant ? 'text-red-700' : 
        cushion < 0.2 ? 'text-amber-700' : 
        'text-emerald-700'
      }`}>
        {value}
      </div>
      <div className="text-xs text-slate-600">
        Covenant: {typeof threshold === 'number' ? numFmt(threshold) : threshold}
        {typeof threshold === 'number' && !value.includes('%') && 'x'}
        {value.includes('%') && '%'}
      </div>
      {breaches > 0 && (
        <div className="mt-2 pt-2 border-t border-current text-xs font-semibold text-red-700">
          {breaches} breach{breaches > 1 ? 'es' : ''}
        </div>
      )}
    </div>
  );
}