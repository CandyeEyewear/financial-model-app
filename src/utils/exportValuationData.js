// utils/exportValuationData.js

/**
 * Export comprehensive DCF valuation data to CSV for Excel analysis
 * Includes all inputs, calculations, and sensitivity analysis
 */
export function exportValuationToCSV(valuationResults, valuationInputs, params, ccy) {
  try {
    const sections = [];

    // Section 1: Summary Metrics
    sections.push("VALUATION SUMMARY");
    sections.push("Metric,Value,Currency");
    sections.push(`Enterprise Value,${valuationResults.enterpriseValue},${ccy}`);
    sections.push(`Equity Value,${valuationResults.equityValue},${ccy}`);
    sections.push(`WACC,${(valuationResults.wacc * 100).toFixed(2)},%`);
    sections.push(`Cost of Equity,${(valuationResults.costOfEquity * 100).toFixed(2)},%`);
    sections.push(`After-Tax Cost of Debt,${(valuationResults.afterTaxCostOfDebt * 100).toFixed(2)},%`);
    sections.push(`Net Debt,${valuationResults.netDebt},${ccy}`);
    sections.push("");

    // Section 2: Valuation Inputs
    sections.push("VALUATION INPUTS");
    sections.push("Parameter,Value,Unit");
    sections.push(`Risk-Free Rate,${(valuationInputs.riskFreeRate * 100).toFixed(2)},%`);
    sections.push(`Beta,${valuationInputs.beta.toFixed(2)},`);
    sections.push(`Market Risk Premium,${(valuationInputs.marketRiskPremium * 100).toFixed(2)},%`);
    sections.push(`Target Debt Ratio,${(valuationInputs.targetDebtRatio * 100).toFixed(2)},%`);
    sections.push(`Terminal Method,${valuationInputs.useExitMultiple ? 'Exit Multiple' : 'Perpetuity Growth'},`);
    if (valuationInputs.useExitMultiple) {
      sections.push(`Exit Multiple,${valuationInputs.exitMultiple.toFixed(1)},x`);
    } else {
      sections.push(`Terminal Growth Rate,${(params.terminalGrowth * 100).toFixed(2)},%`);
    }
    sections.push(`Shares Outstanding,${valuationInputs.sharesOutstanding.toLocaleString()},`);
    sections.push("");

    // Section 3: Year-by-Year DCF Analysis
    sections.push("YEAR-BY-YEAR DCF ANALYSIS");
    sections.push("Year,Free Cash Flow,Discount Factor,Present Value,Currency");
    valuationResults.breakdownByYear.forEach(row => {
      sections.push(
        `Year ${row.year},${row.fcf.toFixed(0)},${row.discountFactor.toFixed(6)},${row.presentValue.toFixed(0)},${ccy}`
      );
    });
    sections.push(`Terminal Value,${valuationResults.terminalValue.toFixed(0)},${
      (1 / Math.pow(1 + valuationResults.wacc, valuationResults.breakdownByYear.length)).toFixed(6)
    },${valuationResults.pvOfTerminalValue.toFixed(0)},${ccy}`);
    sections.push("");
    sections.push(`Total PV of Projected FCFs,${valuationResults.pvOfProjectedFCFs.toFixed(0)},,${ccy}`);
    sections.push(`PV of Terminal Value,${valuationResults.pvOfTerminalValue.toFixed(0)},,${ccy}`);
    sections.push(`Enterprise Value,${valuationResults.enterpriseValue.toFixed(0)},,${ccy}`);
    sections.push("");

    // Section 4: Enterprise to Equity Value Bridge
    sections.push("ENTERPRISE TO EQUITY VALUE BRIDGE");
    sections.push("Component,Value,Currency");
    sections.push(`Enterprise Value,${valuationResults.enterpriseValue.toFixed(0)},${ccy}`);
    sections.push(`Less: Net Debt,${valuationResults.netDebt.toFixed(0)},${ccy}`);
    sections.push(`Equity Value,${valuationResults.equityValue.toFixed(0)},${ccy}`);
    sections.push("");

    // Section 5: Implied Multiples
    sections.push("IMPLIED VALUATION MULTIPLES");
    sections.push("Multiple,Value,Unit");
    if (valuationResults.impliedMultiples.evToRevenue) {
      sections.push(`EV / Revenue,${valuationResults.impliedMultiples.evToRevenue.toFixed(2)},x`);
    }
    if (valuationResults.impliedMultiples.evToEBITDA) {
      sections.push(`EV / EBITDA,${valuationResults.impliedMultiples.evToEBITDA.toFixed(2)},x`);
    }
    if (valuationResults.impliedMultiples.evToEBIT) {
      sections.push(`EV / EBIT,${valuationResults.impliedMultiples.evToEBIT.toFixed(2)},x`);
    }
    if (valuationResults.impliedMultiples.peRatio) {
      sections.push(`P / E,${valuationResults.impliedMultiples.peRatio.toFixed(2)},x`);
    }
    sections.push(`Price per Share,${valuationResults.impliedMultiples.pricePerShare.toFixed(2)},${ccy}`);
    sections.push("");

    // Section 6: Sensitivity Analysis - Equity Value
    sections.push("SENSITIVITY ANALYSIS - EQUITY VALUE");
    sections.push(`Currency: ${ccy}`);
    
    // Header row with growth rates
    const headerRow = ["WACC \\ Terminal Growth"];
    valuationResults.growthRange.forEach(growth => {
      headerRow.push(`${(growth * 100).toFixed(2)}%`);
    });
    sections.push(headerRow.join(","));
    
    // Data rows
    valuationResults.sensitivityMatrix.forEach((row, i) => {
      const dataRow = [`${(valuationResults.waccRange[i] * 100).toFixed(2)}%`];
      row.forEach(value => {
        dataRow.push(value !== null ? value.toFixed(0) : "N/A");
      });
      sections.push(dataRow.join(","));
    });
    sections.push("");

    // Section 7: WACC Calculation Detail
    sections.push("WACC CALCULATION DETAIL");
    sections.push("Component,Weight,Cost,Weighted Cost");
    const totalValue = (1 - valuationInputs.targetDebtRatio) + valuationInputs.targetDebtRatio;
    const equityWeight = (1 - valuationInputs.targetDebtRatio) / totalValue;
    const debtWeight = valuationInputs.targetDebtRatio / totalValue;
    sections.push(
      `Equity,${(equityWeight * 100).toFixed(2)}%,${(valuationResults.costOfEquity * 100).toFixed(2)}%,${
        (equityWeight * valuationResults.costOfEquity * 100).toFixed(2)
      }%`
    );
    sections.push(
      `Debt (After-Tax),${(debtWeight * 100).toFixed(2)}%,${(valuationResults.afterTaxCostOfDebt * 100).toFixed(2)}%,${
        (debtWeight * valuationResults.afterTaxCostOfDebt * 100).toFixed(2)
      }%`
    );
    sections.push(`WACC,,,${(valuationResults.wacc * 100).toFixed(2)}%`);
    sections.push("");

    // Section 8: CAPM Calculation Detail
    sections.push("CAPM COST OF EQUITY CALCULATION");
    sections.push("Component,Value");
    sections.push(`Risk-Free Rate,${(valuationInputs.riskFreeRate * 100).toFixed(2)}%`);
    sections.push(`Beta,${valuationInputs.beta.toFixed(2)}`);
    sections.push(`Market Risk Premium,${(valuationInputs.marketRiskPremium * 100).toFixed(2)}%`);
    sections.push(`Beta × Market Risk Premium,${(valuationInputs.beta * valuationInputs.marketRiskPremium * 100).toFixed(2)}%`);
    sections.push(`Cost of Equity,${(valuationResults.costOfEquity * 100).toFixed(2)}%`);
    sections.push("");

    // Section 9: Metadata
    sections.push("EXPORT METADATA");
    sections.push("Field,Value");
    sections.push(`Export Date,${new Date().toISOString()}`);
    sections.push(`Currency,${ccy}`);
    sections.push(`Projection Years,${valuationResults.breakdownByYear.length}`);
    sections.push(`Terminal Value Method,${valuationInputs.useExitMultiple ? 'Exit Multiple' : 'Perpetuity Growth'}`);
    sections.push("");

    // Create CSV content
    const csvContent = sections.join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `dcf_valuation_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error("Error exporting valuation data:", error);
    return false;
  }
}

/**
 * Export sensitivity analysis as a separate Excel-friendly matrix
 */
export function exportSensitivityMatrix(valuationResults, ccy) {
  try {
    const sections = [];

    sections.push(`SENSITIVITY ANALYSIS - EQUITY VALUE (${ccy})`);
    sections.push("");
    
    // Header row
    const headerRow = ["WACC \\ Growth"];
    valuationResults.growthRange.forEach(growth => {
      headerRow.push(`${(growth * 100).toFixed(2)}%`);
    });
    sections.push(headerRow.join(","));
    
    // Data rows
    valuationResults.sensitivityMatrix.forEach((row, i) => {
      const dataRow = [`${(valuationResults.waccRange[i] * 100).toFixed(2)}%`];
      row.forEach(value => {
        dataRow.push(value !== null ? value.toFixed(0) : "N/A");
      });
      sections.push(dataRow.join(","));
    });

    const csvContent = sections.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `sensitivity_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error("Error exporting sensitivity matrix:", error);
    return false;
  }
}

/**
 * Export just the DCF build-up for detailed modeling
 */
export function exportDCFBuildUp(valuationResults, ccy) {
  try {
    const sections = [];

    sections.push("DCF BUILD-UP ANALYSIS");
    sections.push(`Currency: ${ccy}`);
    sections.push(`WACC: ${(valuationResults.wacc * 100).toFixed(2)}%`);
    sections.push("");

    sections.push("Year,Free Cash Flow,Growth Rate,Discount Period,Discount Factor,Present Value");
    
    valuationResults.breakdownByYear.forEach((row, index) => {
      const growthRate = index > 0 
        ? ((row.fcf - valuationResults.breakdownByYear[index - 1].fcf) / valuationResults.breakdownByYear[index - 1].fcf * 100).toFixed(2)
        : "N/A";
      
      sections.push(
        `${row.year},${row.fcf.toFixed(0)},${growthRate}%,${row.year},${row.discountFactor.toFixed(6)},${row.presentValue.toFixed(0)}`
      );
    });

    sections.push("");
    sections.push("Terminal Value Calculation");
    sections.push(`Terminal Value,${valuationResults.terminalValue.toFixed(0)}`);
    sections.push(`Discount Period,${valuationResults.breakdownByYear.length}`);
    sections.push(`Discount Factor,${(1 / Math.pow(1 + valuationResults.wacc, valuationResults.breakdownByYear.length)).toFixed(6)}`);
    sections.push(`PV of Terminal Value,${valuationResults.pvOfTerminalValue.toFixed(0)}`);
    sections.push("");

    sections.push("Summary");
    sections.push(`PV of Projected FCFs,${valuationResults.pvOfProjectedFCFs.toFixed(0)}`);
    sections.push(`PV of Terminal Value,${valuationResults.pvOfTerminalValue.toFixed(0)}`);
    sections.push(`Enterprise Value,${valuationResults.enterpriseValue.toFixed(0)}`);
    sections.push(`Less: Net Debt,${valuationResults.netDebt.toFixed(0)}`);
    sections.push(`Equity Value,${valuationResults.equityValue.toFixed(0)}`);

    const csvContent = sections.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `dcf_buildup_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error("Error exporting DCF build-up:", error);
    return false;
  }
}