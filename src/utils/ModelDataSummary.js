// utils/ModelDataSummary.js

import { currencyFmtMM, numFmt, pctFmt } from "./formatters";

/**
 * Get total debt from all sources
 * Priority: projection data > params multi-tranche > params single debt
 */
function getTotalDebt(params, projection) {
  // Priority 1: Projection data (most accurate - reflects actual calculations)
  if (projection?.multiTrancheInfo?.totalDebt > 0) {
    return {
      total: projection.multiTrancheInfo.totalDebt,
      source: 'projection.multiTrancheInfo',
      breakdown: projection.multiTrancheInfo.tranches || []
    };
  }

  if (projection?.finalDebt > 0) {
    return {
      total: projection.finalDebt,
      source: 'projection.finalDebt',
      breakdown: []
    };
  }

  // Priority 2: Params multi-tranche
  if (params?.hasMultipleTranches && params?.debtTranches?.length > 0) {
    const total = params.debtTranches.reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      total,
      source: 'params.debtTranches',
      breakdown: params.debtTranches
    };
  }

  // Priority 3: Params single debt (check BOTH openingDebt AND existingDebtAmount)
  const existingDebt = params?.openingDebt || params?.existingDebtAmount || 0;
  const newFacility = params?.requestedLoanAmount || 0;

  return {
    total: existingDebt + newFacility,
    source: 'params (single debt)',
    breakdown: [
      { name: 'Existing Debt', amount: existingDebt },
      { name: 'New Facility', amount: newFacility }
    ].filter(t => t.amount > 0)
  };
}

/**
 * Generate comprehensive, AI-optimized model data summary
 * Structured for maximum clarity and minimal token usage
 */
export function generateModelDataSummary(modelData) {
  if (!modelData || !modelData.projections || !modelData.params) {
    return "No data available";
  }

  const { projections, params, historicalData, valuationResults, customShocks, stressTestResults } = modelData;
  const baseProjection = projections.base;

  if (!projections || !params) {
    return "ERROR: Incomplete model data. Missing projections or parameters.";
  }

  const sections = [];

  // === COMPANY OVERVIEW ===
  sections.push(generateCompanyOverview(params));

  // === TRANSACTION STRUCTURE (ENHANCED) ===
  sections.push(generateTransactionStructure(params, baseProjection));

  // === BASE CASE FINANCIALS ===
  if (baseProjection) {
    sections.push(generateBaseCase(baseProjection, params));
  }

  // === DCF VALUATION ANALYSIS (ENHANCED) ===
  if (valuationResults) {
    sections.push(generateValuationAnalysis(valuationResults, params));
  }

  // === STRESS TEST SUMMARY (NEW) ===
  if (Object.keys(projections).length > 1) {
    sections.push(generateStressTestSummary(projections, params));
  }

  // === SCENARIO ANALYSIS ===
  if (Object.keys(projections).length > 1) {
    sections.push(generateScenarioComparison(projections, params));
  }

  // === COVENANT ANALYSIS (ENHANCED with breach years) ===
  if (baseProjection) {
    sections.push(generateCovenantAnalysis(baseProjection, params));
  }

  // === CUSTOM SHOCKS (NEW) ===
  if (customShocks && Object.values(customShocks).some(v => v !== 0)) {
    sections.push(generateCustomShocksSection(customShocks));
  }

  // === HISTORICAL CONTEXT ===
  if (historicalData && historicalData.length > 0) {
    sections.push(generateHistoricalContext(historicalData, params));
  }

  // === QUALITATIVE ASSESSMENT ===
  sections.push(generateQualitativeAssessment(params));

  // === RISK FACTORS ===
  sections.push(generateRiskAssessment(params, baseProjection));

  // === MISSING DATA WARNINGS (NEW) ===
  sections.push(generateMissingDataWarnings(params, baseProjection));

  return sections.filter(s => s).join("\n\n" + "=".repeat(80) + "\n\n");
}

function generateCompanyOverview(params) {
  const fields = {
    "Legal Name": params.companyLegalName,
    "Operating Name": params.companyOperatingName,
    "Industry": params.industry,
    "Business Age": params.businessAge ? `${params.businessAge} years` : null,
    "Total Assets": params.totalAssets ? currencyFmtMM(params.totalAssets, params.currency || "USD") : null,
    "Credit History": params.creditHistory,
    "Management Experience": params.managementExperience,
  };

  return formatSection("COMPANY OVERVIEW", fields);
}

function generateTransactionStructure(params, projection) {
  const ccy = params.currency || "USD";
  const debtInfo = getTotalDebt(params, projection);

  const fields = {
    // === DEAL OVERVIEW ===
    "Facility Type": params.dealStructure,
    "Loan Purpose": params.loanPurpose,
    "Use of Proceeds": params.useOfProceeds,

    // === TOTAL DEBT (from all sources) ===
    "Total Debt": currencyFmtMM(debtInfo.total, ccy),
    "Debt Source": debtInfo.source,

    // === EXISTING DEBT ===
    "Existing Debt": (params.openingDebt || params.existingDebtAmount)
      ? currencyFmtMM(params.openingDebt || params.existingDebtAmount, ccy)
      : "None",
    "Existing Debt Rate": params.existingDebtRate ? pctFmt(params.existingDebtRate) : null,
    "Existing Debt Maturity": params.openingDebtMaturityDate || null,

    // === NEW FACILITY ===
    "New Facility Amount": params.requestedLoanAmount
      ? currencyFmtMM(params.requestedLoanAmount, ccy)
      : "None",
    "Proposed Rate": params.proposedPricing ? pctFmt(params.proposedPricing) : null,
    "Proposed Tenor": params.proposedTenor ? `${params.proposedTenor} years` : null,

    // === MULTI-TRANCHE (if applicable) ===
    "Multi-Tranche": params.hasMultipleTranches ? "Yes" : "No",

    // === STRUCTURE DETAILS ===
    "Payment Frequency": params.paymentFrequency,
    "Day Count Convention": params.dayCountConvention,
    "Interest-Only Period": params.interestOnlyYears ? `${params.interestOnlyYears} years` : "None",

    // === BALLOON PAYMENT ===
    "Balloon Payment": params.useBalloonPayment || params.balloonPercentage > 0
      ? `${params.balloonPercentage}% (${currencyFmtMM(debtInfo.total * (params.balloonPercentage || 0) / 100, ccy)})`
      : "None",

    // === CASH POSITION ===
    "Opening Cash": params.openingCash !== undefined ? currencyFmtMM(params.openingCash, ccy) : "Not specified",
    "Net Debt": currencyFmtMM(debtInfo.total - (params.openingCash || 0), ccy),
  };

  // Add tranche breakdown if multi-tranche
  if (debtInfo.breakdown.length > 1) {
    fields["Tranche Breakdown"] = debtInfo.breakdown
      .map(t => `${t.name || t.trancheName}: ${currencyFmtMM(t.amount, ccy)}`)
      .join("; ");
  }

  // Calculate effective all-in rate
  const effectiveRate = params.dayCountConvention === "Actual/360"
    ? params.proposedPricing * (365/360)
    : params.proposedPricing;

  if (effectiveRate && effectiveRate !== params.proposedPricing) {
    fields["Effective Rate (Actual/360 adj)"] = pctFmt(effectiveRate);
  }

  return formatSection("TRANSACTION STRUCTURE", fields);
}

function generateBaseCase(projection, params) {
  const ccy = params.currency || "USD";
  
  const fields = {
    "Enterprise Value": currencyFmtMM(projection.enterpriseValue || 0, ccy),
    "Equity Value": currencyFmtMM(projection.equityValue || 0, ccy),
    "Equity MOIC": `${numFmt(projection.moic || 0)}x`,
    "Equity IRR": pctFmt(projection.irr || 0),
    "Terminal Value": currencyFmtMM(projection.tv || 0, ccy),
    "Terminal Value (PV)": currencyFmtMM(projection.tvPV || 0, ccy),
  };

  // Add year-by-year summary (first, middle, last years)
  if (projection.rows && projection.rows.length > 0) {
    const years = projection.rows;
    const firstYear = years[0];
    const midYear = years[Math.floor(years.length / 2)];
    const lastYear = years[years.length - 1];

    fields["Year 1 Revenue"] = currencyFmtMM(firstYear.revenue || 0, ccy);
    fields["Year 1 EBITDA"] = currencyFmtMM(firstYear.ebitda || 0, ccy);
    fields[`Year ${lastYear.year} Revenue`] = currencyFmtMM(lastYear.revenue || 0, ccy);
    fields[`Year ${lastYear.year} EBITDA`] = currencyFmtMM(lastYear.ebitda || 0, ccy);
    fields["EBITDA CAGR"] = pctFmt((Math.pow(lastYear.ebitda / firstYear.ebitda, 1 / (years.length - 1)) - 1));
  }

  return formatSection("BASE CASE PROJECTIONS", fields);
}

function generateScenarioComparison(projections, params) {
  const scenarios = Object.keys(projections);
  const comparisons = [];

  scenarios.forEach(scenario => {
    const proj = projections[scenario];
    const stats = proj.creditStats || {};
    
    comparisons.push({
      "Scenario": scenario,
      "IRR": pctFmt(proj.irr || 0),
      "MOIC": `${numFmt(proj.moic || 0)}x`,
      "Min DSCR": numFmt(stats.minDSCR || 0),
      "Max Leverage": `${numFmt(stats.maxLeverage || 0)}x`,
      "Breaches": ((proj.breaches?.dscrBreaches || 0) + (proj.breaches?.icrBreaches || 0) + (proj.breaches?.ndBreaches || 0)),
    });
  });

  let output = "SCENARIO COMPARISON\n";
  output += JSON.stringify(comparisons, null, 2);
  
  // Add scenario sensitivity analysis
  const base = projections.base;
  if (base) {
    output += "\n\nSENSITIVITY ANALYSIS:\n";
    scenarios.filter(s => s !== 'base').forEach(scenario => {
      const proj = projections[scenario];
      const irrDelta = ((proj.irr - base.irr) / base.irr) * 100;
      const dscrDelta = ((proj.creditStats?.minDSCR || 0) - (base.creditStats?.minDSCR || 0));
      output += `- ${scenario}: IRR ${irrDelta > 0 ? '+' : ''}${numFmt(irrDelta)}%, DSCR ${dscrDelta > 0 ? '+' : ''}${numFmt(dscrDelta)}\n`;
    });
  }

  return output;
}

function generateCovenantAnalysis(projection, params) {
  const stats = projection.creditStats || {};
  const breaches = projection.breaches || {};

  const minDSCR = stats.minDSCR || 0;
  const minICR = stats.minICR || 0;
  const maxLeverage = stats.maxLeverage || 0;

  const dscrThreshold = params.minDSCR || 1.2;
  const icrThreshold = params.targetICR || 2.0;
  const leverageLimit = params.maxNDToEBITDA || 3.5;

  const dscrCushion = minDSCR - dscrThreshold;
  const icrCushion = minICR - icrThreshold;
  const leverageCushion = leverageLimit - maxLeverage;

  const fields = {
    "Min DSCR": `${numFmt(minDSCR)}x (covenant: ${numFmt(dscrThreshold)}x, cushion: ${dscrCushion >= 0 ? '+' : ''}${numFmt(dscrCushion)})`,
    "DSCR Status": dscrCushion >= 0.3 ? "STRONG" : dscrCushion >= 0 ? "ADEQUATE" : "BREACH",
    "Min ICR": `${numFmt(minICR)}x (covenant: ${numFmt(icrThreshold)}x, cushion: ${icrCushion >= 0 ? '+' : ''}${numFmt(icrCushion)})`,
    "ICR Status": icrCushion >= 0.5 ? "STRONG" : icrCushion >= 0 ? "ADEQUATE" : "BREACH",
    "Max Leverage": `${numFmt(maxLeverage)}x (limit: ${numFmt(leverageLimit)}x, cushion: ${leverageCushion >= 0 ? '+' : ''}${numFmt(leverageCushion)})`,
    "Leverage Status": leverageCushion >= 0.5 ? "STRONG" : leverageCushion >= 0 ? "ADEQUATE" : "BREACH",
    "Total Covenant Breaches": (breaches.dscrBreaches || 0) + (breaches.icrBreaches || 0) + (breaches.ndBreaches || 0),
    "DSCR Breaches": breaches.dscrBreaches || 0,
    "ICR Breaches": breaches.icrBreaches || 0,
    "Leverage Breaches": breaches.ndBreaches || 0,
  };

  // Add specific breach year details (NEW)
  if (breaches.dscrBreachYears?.length > 0) {
    fields["DSCR Breach Years"] = breaches.dscrBreachYears.join(", ");

    // Add what the DSCR was in each breach year
    const breachDetails = breaches.dscrBreachYears.map(year => {
      const row = projection.rows?.find(r => r.year === year);
      return row ? `Year ${year}: ${numFmt(row.dscr)}x` : `Year ${year}`;
    });
    fields["DSCR Breach Details"] = breachDetails.join("; ");
  }

  if (breaches.icrBreachYears?.length > 0) {
    fields["ICR Breach Years"] = breaches.icrBreachYears.join(", ");

    const breachDetails = breaches.icrBreachYears.map(year => {
      const row = projection.rows?.find(r => r.year === year);
      return row ? `Year ${year}: ${numFmt(row.icr)}x` : `Year ${year}`;
    });
    fields["ICR Breach Details"] = breachDetails.join("; ");
  }

  if (breaches.leverageBreachYears?.length > 0) {
    fields["Leverage Breach Years"] = breaches.leverageBreachYears.join(", ");

    const breachDetails = breaches.leverageBreachYears.map(year => {
      const row = projection.rows?.find(r => r.year === year);
      return row ? `Year ${year}: ${numFmt(row.leverage || row.ndToEbitda)}x` : `Year ${year}`;
    });
    fields["Leverage Breach Details"] = breachDetails.join("; ");
  }

  // Add overall credit assessment
  const totalBreaches = (breaches.dscrBreaches || 0) + (breaches.icrBreaches || 0) + (breaches.ndBreaches || 0);
  if (totalBreaches === 0 && dscrCushion >= 0.3 && leverageCushion >= 0.5) {
    fields["Overall Credit Quality"] = "STRONG - Significant covenant cushion";
  } else if (totalBreaches === 0) {
    fields["Overall Credit Quality"] = "ADEQUATE - Limited covenant cushion";
  } else {
    fields["Overall Credit Quality"] = `WEAK - ${totalBreaches} covenant breach(es)`;
  }

  return formatSection("COVENANT COMPLIANCE ANALYSIS", fields);
}

function generateHistoricalContext(historicalData, params) {
  if (!historicalData || historicalData.length === 0) return null;

  const validData = historicalData.filter(d => d.revenue > 0);
  if (validData.length === 0) return null;

  const sorted = [...validData].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  
  // Calculate growth rates
  const growthRates = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i-1].revenue > 0) {
      growthRates.push((sorted[i].revenue - sorted[i-1].revenue) / sorted[i-1].revenue);
    }
  }
  const avgGrowth = growthRates.length > 0 ? growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length : 0;

  const fields = {
    "Historical Years": `${sorted.length} years (${sorted[0].year} - ${latest.year})`,
    "Latest Revenue": currencyFmtMM(latest.revenue, params.currency || "USD"),
    "Latest EBITDA": latest.ebitda ? currencyFmtMM(latest.ebitda, params.currency || "USD") : "Not available",
    "Latest Net Income": latest.netIncome ? currencyFmtMM(latest.netIncome, params.currency || "USD") : "Not available",
    "Avg Historical Growth": pctFmt(avgGrowth),
    "Projected Growth": pctFmt(params.growth || 0),
    "Growth Delta": pctFmt((params.growth || 0) - avgGrowth),
  };

  // Add margin analysis
  if (latest.ebitda && latest.revenue > 0) {
    fields["Latest EBITDA Margin"] = pctFmt(latest.ebitda / latest.revenue);
  }
  if (latest.netIncome && latest.revenue > 0) {
    fields["Latest Net Margin"] = pctFmt(latest.netIncome / latest.revenue);
  }

  return formatSection("HISTORICAL PERFORMANCE", fields);
}

function generateQualitativeAssessment(params) {
  const fields = {};

  // Only include fields with actual data
  if (params.businessModel) fields["Business Model"] = params.businessModel;
  if (params.competitivePosition) fields["Competitive Position"] = params.competitivePosition;
  if (params.keyCustomers) fields["Key Customers"] = params.keyCustomers;
  if (params.marketShare) fields["Market Share"] = params.marketShare;
  if (params.keyManagementNames) fields["Management Team"] = params.keyManagementNames;
  if (params.managementTrackRecord) fields["Management Track Record"] = params.managementTrackRecord;
  if (params.creditStrengths) fields["Credit Strengths"] = params.creditStrengths;
  if (params.relationshipManager) fields["Relationship Manager"] = params.relationshipManager;
  if (params.existingRelationshipYears) fields["Relationship Duration"] = `${params.existingRelationshipYears} years`;

  return Object.keys(fields).length > 0 
    ? formatSection("QUALITATIVE ASSESSMENT", fields)
    : null;
}

function generateRiskAssessment(params, projection) {
  const fields = {};

  // Risk factors
  if (params.keyRisks) fields["Key Risks"] = params.keyRisks;
  if (params.mitigatingFactors) fields["Mitigating Factors"] = params.mitigatingFactors;

  // Collateral
  if (params.collateralDescription) fields["Collateral"] = params.collateralDescription;
  if (params.collateralValue) {
    const ccy = params.currency || "USD";
    fields["Collateral Value"] = currencyFmtMM(params.collateralValue, ccy);
    
    if (params.requestedLoanAmount > 0) {
      const ltv = (params.requestedLoanAmount / params.collateralValue) * 100;
      fields["LTV Ratio"] = `${numFmt(ltv)}%`;
      fields["LTV Assessment"] = ltv <= 60 ? "STRONG" : ltv <= 75 ? "ADEQUATE" : "WEAK";
    }
  }
  if (params.lienPosition) fields["Lien Position"] = params.lienPosition;

  // Repayment sources
  if (params.primaryRepaymentSource) fields["Primary Repayment Source"] = params.primaryRepaymentSource;
  if (params.secondaryRepaymentSource) fields["Secondary Repayment Source"] = params.secondaryRepaymentSource;

  // Financial commentary
  if (params.revenueCommentary) fields["Revenue Commentary"] = params.revenueCommentary;
  if (params.marginCommentary) fields["Margin Commentary"] = params.marginCommentary;
  if (params.workingCapitalCommentary) fields["Working Capital Commentary"] = params.workingCapitalCommentary;

  return Object.keys(fields).length > 0 
    ? formatSection("RISK ASSESSMENT & COLLATERAL", fields)
    : null;
}

/**
/**
 * Format a section with consistent structure
 */
function formatSection(title, fields) {
  if (!fields || Object.keys(fields).length === 0) return null;
  
  let output = `${title}:\n`;
  
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      output += `- ${key}: ${value}\n`;
    }
  });

  return output;  // This was at the bottom - moved it here
}

function generateValuationAnalysis(valuationResults, params) {
  const ccy = params.currency || "USD";

  const fields = {
    "Valuation Method": "Discounted Cash Flow (DCF)",
    "Enterprise Value": currencyFmtMM(valuationResults.enterpriseValue, ccy),
    "Equity Value": currencyFmtMM(valuationResults.equityValue, ccy),
    "PV of Projected FCFs": currencyFmtMM(valuationResults.pvOfProjectedFCFs, ccy),
    "PV of Terminal Value": currencyFmtMM(valuationResults.pvOfTerminalValue, ccy),
    "Terminal Value": currencyFmtMM(valuationResults.terminalValue, ccy),
  };

  fields["WACC"] = pctFmt(valuationResults.wacc);
  fields["Cost of Equity (CAPM)"] = pctFmt(valuationResults.costOfEquity);
  fields["After-Tax Cost of Debt"] = pctFmt(valuationResults.afterTaxCostOfDebt);
  fields["Net Debt"] = currencyFmtMM(valuationResults.netDebt, ccy);

  // Add shares and price per share (ENHANCED)
  if (params.sharesOutstanding > 0) {
    fields["Shares Outstanding"] = numFmt(params.sharesOutstanding, 0);

    const pricePerShare = valuationResults.equityValue / params.sharesOutstanding;
    fields["Price per Share"] = `${ccy} ${pricePerShare.toFixed(2)}`;
  } else {
    fields["Shares Outstanding"] = "NOT SET - Price per share cannot be calculated";
  }

  // Add opening cash context (ENHANCED)
  if (params.openingCash !== undefined) {
    fields["Opening Cash"] = currencyFmtMM(params.openingCash, ccy);
  } else {
    fields["Opening Cash"] = "NOT SET - Defaulting to 0 (may affect net debt calculation)";
  }

  // Add debt breakdown in valuation (ENHANCED)
  const debtInfo = getTotalDebt(params, null);
  fields["Total Debt in Valuation"] = currencyFmtMM(debtInfo.total, ccy);
  fields["Calculated Net Debt"] = currencyFmtMM(debtInfo.total - (params.openingCash || 0), ccy);

  const multiples = valuationResults.impliedMultiples;
  if (multiples) {
    if (multiples.evToRevenue) {
      fields["EV/Revenue"] = `${numFmt(multiples.evToRevenue, 1)}x`;
    }
    if (multiples.evToEBITDA) {
      fields["EV/EBITDA"] = `${numFmt(multiples.evToEBITDA, 1)}x`;

      const evEbitda = multiples.evToEBITDA;
      if (evEbitda < 5) {
        fields["EV/EBITDA Assessment"] = "BELOW MARKET - Potentially undervalued or distressed";
      } else if (evEbitda >= 5 && evEbitda < 8) {
        fields["EV/EBITDA Assessment"] = "FAIR VALUE - Within typical market range";
      } else if (evEbitda >= 8 && evEbitda < 12) {
        fields["EV/EBITDA Assessment"] = "PREMIUM - Above market, quality business";
      } else {
        fields["EV/EBITDA Assessment"] = "HIGH MULTIPLE - Growth stock or hot sector";
      }
    }
    if (multiples.evToEBIT) {
      fields["EV/EBIT"] = `${numFmt(multiples.evToEBIT, 1)}x`;
    }
    if (multiples.peRatio) {
      fields["P/E Ratio"] = `${numFmt(multiples.peRatio, 1)}x`;
    }
    if (multiples.pricePerShare) {
      fields["Price per Share"] = currencyFmtMM(multiples.pricePerShare, ccy);
    }
  }

  if (valuationResults.enterpriseValue < 0) {
    fields["VALUATION WARNING"] = "Enterprise value is NEGATIVE - business is destroying value. Review assumptions.";
  }
  if (valuationResults.equityValue < 0) {
    fields["EQUITY WARNING"] = "Equity value is NEGATIVE - debt exceeds business value. Distressed situation.";
  }

  const tvPercentage = valuationResults.enterpriseValue !== 0
    ? (valuationResults.pvOfTerminalValue / valuationResults.enterpriseValue) * 100
    : 0;
  fields["Terminal Value % of EV"] = `${numFmt(tvPercentage, 1)}%`;

  if (Math.abs(tvPercentage) > 80) {
    fields["TERMINAL VALUE NOTE"] = "Terminal value dominates valuation (>80%). Projection assumptions are critical.";
  }

  return formatSection("DCF VALUATION ANALYSIS", fields);
}

/**
 * Generate stress test summary for AI context (NEW)
 */
function generateStressTestSummary(projections, params) {
  if (!projections || Object.keys(projections).length <= 1) {
    return null;
  }

  const scenarios = Object.entries(projections)
    .filter(([key]) => key !== 'base')
    .map(([key, proj]) => {
      const stats = proj.creditStats || {};
      const breaches = proj.breaches || {};
      const totalBreaches = (breaches.dscrBreaches || 0) +
                           (breaches.icrBreaches || 0) +
                           (breaches.ndBreaches || 0);

      return {
        name: key,
        minDSCR: stats.minDSCR || 0,
        maxLeverage: stats.maxLeverage || 0,
        breaches: totalBreaches,
        irr: proj.irr || 0,
        equityValue: proj.equityValue || 0
      };
    });

  // Find worst case
  const worstCase = scenarios.reduce((worst, s) =>
    s.minDSCR < (worst?.minDSCR || Infinity) ? s : worst
  , null);

  // Count scenarios with breaches
  const breachCount = scenarios.filter(s => s.breaches > 0).length;

  const fields = {
    "Scenarios Tested": scenarios.length,
    "Scenarios with Breaches": `${breachCount} of ${scenarios.length}`,
    "Worst Case Scenario": worstCase?.name || "N/A",
    "Worst Case DSCR": worstCase ? numFmt(worstCase.minDSCR) : "N/A",
    "Worst Case Breaches": worstCase?.breaches || 0,
  };

  // Add each scenario summary
  scenarios.forEach(s => {
    fields[`${s.name} DSCR`] = numFmt(s.minDSCR);
    fields[`${s.name} Breaches`] = s.breaches;
  });

  return formatSection("STRESS TEST SUMMARY", fields);
}

/**
 * Generate custom shocks section (NEW)
 */
function generateCustomShocksSection(customShocks) {
  const fields = {};

  if (customShocks.growthDelta !== 0) {
    fields["Revenue Growth Shock"] = pctFmt(customShocks.growthDelta);
  }
  if (customShocks.cogsDelta !== 0) {
    fields["COGS Shock"] = pctFmt(customShocks.cogsDelta);
  }
  if (customShocks.opexDelta !== 0) {
    fields["OpEx Shock"] = pctFmt(customShocks.opexDelta);
  }
  if (customShocks.capexDelta !== 0) {
    fields["CapEx Shock"] = pctFmt(customShocks.capexDelta);
  }
  if (customShocks.rateDelta !== 0) {
    fields["Interest Rate Shock"] = pctFmt(customShocks.rateDelta);
  }
  if (customShocks.waccDelta !== 0) {
    fields["WACC Shock"] = pctFmt(customShocks.waccDelta);
  }
  if (customShocks.termGDelta !== 0) {
    fields["Terminal Growth Shock"] = pctFmt(customShocks.termGDelta);
  }

  if (Object.keys(fields).length === 0) return null;

  return formatSection("CUSTOM STRESS SCENARIO APPLIED", fields);
}

/**
 * Generate warnings about missing/default data (NEW)
 */
function generateMissingDataWarnings(params, projection) {
  const warnings = [];

  if (params.openingCash === undefined || params.openingCash === null) {
    warnings.push("Opening Cash: NOT SET (defaulting to 0, may affect net debt calculation)");
  }

  if (!params.sharesOutstanding) {
    warnings.push("Shares Outstanding: NOT SET (price per share cannot be calculated)");
  }

  if (!params.collateralValue) {
    warnings.push("Collateral Value: NOT SET (LTV cannot be calculated)");
  }

  if (!params.existingDebtAmount && !params.openingDebt && !params.requestedLoanAmount) {
    warnings.push("No Debt Configured: Model running with zero debt");
  }

  if (params.openingDebt && params.existingDebtAmount && params.openingDebt !== params.existingDebtAmount) {
    warnings.push(`Debt Mismatch: openingDebt (${params.openingDebt}) differs from existingDebtAmount (${params.existingDebtAmount})`);
  }

  if (!params.industry) {
    warnings.push("Industry: NOT SET (industry benchmarks unavailable)");
  }

  if (!params.companyLegalName && !params.companyOperatingName) {
    warnings.push("Company Name: NOT SET");
  }

  if (warnings.length === 0) return null;

  return formatSection("DATA WARNINGS (AI should flag these to user)",
    Object.fromEntries(warnings.map((w, i) => [`Warning ${i + 1}`, w]))
  );
}