// src/utils/exportLoanMetrics.js
import { currencyFmt, numFmt } from "./formatters";

// Constants
const DEFAULT_MAX_LTV = 75;
const PAYMENT_FREQUENCIES = {
  Monthly: 12,
  Quarterly: 4,
  "Semi-Annually": 2,
  Annually: 1,
  Bullet: 1
};

// CSV-safe escaping
function csvEsc(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function row(array) {
  return array.map(csvEsc).join(",");
}

function getPaymentsPerYear(frequency) {
  return PAYMENT_FREQUENCIES[frequency] || 4; // Default to quarterly
}

function validateExportData(projection, params) {
  if (!projection?.rows?.length) {
    throw new Error("No projection data available for export");
  }
  if (!params) {
    throw new Error("Parameters are required for export");
  }
}

export function exportLoanMetricsCSV(
  projection,
  params,
  scenarioName,
  ccy,
  schedules = {}
) {
  try {
    // Validate inputs
    validateExportData(projection, params);
    
    const { newFacilitySchedule = null, existingSchedule = null } = schedules;

    // Normalize parameters with safe defaults
    const loanAmount = Number(params.requestedLoanAmount ?? params.facilityAmount ?? 0);
    const rawRate = Number(params.proposedPricing ?? params.interestRate ?? 0);
    const ratePct = rawRate < 1 ? rawRate * 100 : rawRate;
    const tenorYears = Number(params.proposedTenor ?? params.debtTenorYears ?? 5);
    const payFreq = params.paymentFrequency || "Quarterly";
    const paymentsPerYear = getPaymentsPerYear(payFreq);
    const ioYears = Number(params.interestOnlyYears ?? 0);
    const balloonPct = Number(params.balloonPercentage ?? 0);
    const dayCount = params.dayCountConvention || "Actual/365";

    // Covenant thresholds
    const minDSCR = params.minDSCR ?? 1.2;
    const targetICR = params.targetICR ?? 2.0;
    const maxLeverage = params.maxNDToEBITDA ?? 3.5;
    const maxLTV = params.maxLTV ?? DEFAULT_MAX_LTV;

    const sections = [];

    // --- Facility Overview ---
    sections.push(row([`Scenario: ${scenarioName}`]));
    sections.push(row(["Export Date", new Date().toISOString().split('T')[0]]));
    sections.push(row(["Currency", ccy]));
    sections.push([]);

    // --- Facility Terms ---
    sections.push(row(["--- Facility Terms ---"]));
    sections.push(row(["New Loan Amount", currencyFmt(loanAmount, ccy)]));
    sections.push(row(["Interest Rate (Annual)", `${numFmt(ratePct)}%`]));
    sections.push(row(["Tenor (Years)", tenorYears]));
    sections.push(row(["Payment Frequency", payFreq]));
    sections.push(row(["Payments per Year", paymentsPerYear]));
    sections.push(row(["Interest-Only Period (Years)", ioYears]));
    sections.push(row(["Balloon Payment", `${balloonPct}%`]));
    sections.push(row(["Day Count Convention", dayCount]));
    sections.push(row(["Existing Debt (Opening)", currencyFmt(params.openingDebt ?? 0, ccy)]));
    sections.push([]);

    // --- New Facility Amortization Schedule ---
    if (newFacilitySchedule?.length) {
      sections.push(row(["--- New Facility Amortization Schedule ---"]));
      sections.push(row([
        "Year",
        "Beginning Balance",
        "Principal Payment",
        "Interest Payment",
        "Total Payment",
        "Ending Balance",
        "Payment per Period",
        "Balloon Payment?"
      ]));
      
      newFacilitySchedule.forEach(schedule => {
        sections.push(row([
          schedule.year,
          currencyFmt(schedule.beginningBalance, ccy),
          currencyFmt(schedule.principalPayment, ccy),
          currencyFmt(schedule.interestPayment, ccy),
          currencyFmt(schedule.totalPayment, ccy),
          currencyFmt(schedule.endingBalance, ccy),
          currencyFmt(schedule.paymentPerPeriod, ccy),
          schedule.hasBalloon ? "Yes" : "No"
        ]));
      });
      sections.push([]);
    }

    // --- Existing Debt Amortization Schedule ---
    if (existingSchedule?.length) {
      sections.push(row(["--- Existing Debt Amortization Schedule ---"]));
      sections.push(row([
        "Year",
        "Beginning Balance",
        "Principal Payment",
        "Interest Payment",
        "Total Payment",
        "Ending Balance"
      ]));
      
      existingSchedule.forEach(schedule => {
        sections.push(row([
          schedule.year,
          currencyFmt(schedule.beginningBalance, ccy),
          currencyFmt(schedule.principal, ccy),
          currencyFmt(schedule.interest, ccy),
          currencyFmt(schedule.total, ccy),
          currencyFmt(schedule.endingBalance, ccy)
        ]));
      });
      sections.push([]);
    }

    // --- Covenant Compliance Analysis ---
    sections.push(row(["--- Covenant Compliance Analysis ---"]));
    sections.push(row([
      "Year",
      "DSCR",
      "DSCR Headroom",
      "DSCR Status",
      "ICR",
      "ICR Headroom",
      "ICR Status",
      "Net Debt/EBITDA",
      "Leverage Status",
      "LTV %",
      "LTV Headroom",
      "Total Debt Service",
      "Cash After Debt Service",
      "Overall Status"
    ]));

    let cumulativeNewPrincipal = 0;
    
    projection.rows.forEach((row, index) => {
      const newFacility = newFacilitySchedule?.[index];
      const newPrincipal = newFacility?.principalPayment ?? 0;
      const newInterest = newFacility?.interestPayment ?? 0;
      const newService = newFacility?.totalPayment ?? 0;
      
      cumulativeNewPrincipal += newPrincipal;
      const remainingNewBalance = Math.max(0, loanAmount - cumulativeNewPrincipal);

      // Calculate combined metrics
      const totalDebtService = (row.debtService ?? 0) + newService;
      const totalDebt = (row.endingDebt ?? 0) + remainingNewBalance;
      const ltvPercent = params.collateralValue 
        ? (totalDebt / params.collateralValue) * 100 
        : 0;
      const cashAfterService = (row.fcfToEquity ?? 0) - newService;

      // Determine status
      const dscrStatus = row.dscr >= minDSCR ? "PASS" : "BREACH";
      const icrStatus = row.icr >= targetICR ? "PASS" : "BREACH";
      const leverageStatus = row.ndToEbitda <= maxLeverage ? "PASS" : "BREACH";
      const overallStatus = (row.dscrBreach || row.icrBreach || row.ndBreach) 
        ? "BREACH" 
        : "PASS";

      sections.push(row([
        row.year,
        numFmt(row.dscr),
        numFmt(row.dscr - minDSCR),
        dscrStatus,
        numFmt(row.icr),
        numFmt(row.icr - targetICR),
        icrStatus,
        numFmt(row.ndToEbitda),
        leverageStatus,
        ltvPercent.toFixed(1) + "%",
        (maxLTV - ltvPercent).toFixed(1) + "%",
        currencyFmt(totalDebtService, ccy),
        currencyFmt(cashAfterService, ccy),
        overallStatus
      ]));
    });
    sections.push([]);

    // --- Covenant Thresholds ---
    sections.push(row(["--- Covenant Thresholds ---"]));
    sections.push(row(["Minimum DSCR", numFmt(minDSCR)]));
    sections.push(row(["Target ICR", numFmt(targetICR)]));
    sections.push(row(["Maximum Net Debt/EBITDA", numFmt(maxLeverage)]));
    sections.push(row(["Maximum LTV", `${maxLTV}%`]));
    sections.push([]);

    // --- Summary Statistics ---
    const actualMinDSCR = Math.min(...projection.rows.map(r => r.dscr));
    const actualMinICR = Math.min(...projection.rows.map(r => r.icr));
    const actualMaxLeverage = Math.max(...projection.rows.map(r => r.ndToEbitda));
    const totalExistingDS = projection.rows.reduce((sum, r) => sum + (r.debtService ?? 0), 0);

    sections.push(row(["--- Summary Statistics ---"]));
    sections.push(row(["Actual Minimum DSCR", numFmt(actualMinDSCR)]));
    sections.push(row(["Actual Minimum ICR", numFmt(actualMinICR)]));
    sections.push(row(["Actual Maximum Leverage", numFmt(actualMaxLeverage)]));
    sections.push(row(["Total Existing Debt Service", currencyFmt(totalExistingDS, ccy)]));
    sections.push(row(["DSCR Breaches", projection.breaches?.dscrBreaches ?? 0]));
    sections.push(row(["ICR Breaches", projection.breaches?.icrBreaches ?? 0]));
    sections.push(row(["Leverage Breaches", projection.breaches?.ndBreaches ?? 0]));

    // --- Generate and Download CSV ---
    const csvContent = sections.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = `${scenarioName.toLowerCase().replace(/\s+/g, "_")}_loan_metrics_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`Successfully exported: ${fileName}`);
    
  } catch (error) {
    console.error("Error exporting loan metrics:", error);
    alert(`Export failed: ${error.message}`);
    throw error;
  }
}