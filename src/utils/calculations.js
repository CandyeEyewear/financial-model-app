// Re-export shared math utilities from centralized module
export { clamp, num } from './mathUtils';

/**
 * FIXED: Calculate historical assumptions with better CAPEX logic
 */
export function calculateHistoricalAssumptions(historicalData) {
  if (!Array.isArray(historicalData) || historicalData.length < 2) return null;
  
  const validYears = historicalData.filter(
    (d) => typeof d.revenue === "number" && d.revenue > 0
  );
  
  if (validYears.length < 2) return null;
  
  const sorted = [...validYears].sort((a, b) => a.year - b.year);

  // Calculate revenue growth rates
  const growthRates = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].revenue;
    const curr = sorted[i].revenue;
    if (prev > 0) {
      growthRates.push((curr - prev) / prev);
    }
  }
  
  const avgGrowth = growthRates.length > 0
    ? growthRates.reduce((s, g) => s + g, 0) / growthRates.length
    : 0;

  // Calculate average margins
  const margins = sorted.map(d => ({
    ebitdaMargin: d.ebitda && d.revenue > 0 ? d.ebitda / d.revenue : 0,
    netMargin: d.netIncome && d.revenue > 0 ? d.netIncome / d.revenue : 0,
    wcPct: d.workingCapital && d.revenue > 0 ? d.workingCapital / d.revenue : 0,
  }));
  
  const avgEbitdaMargin = margins.reduce((s, m) => s + m.ebitdaMargin, 0) / margins.length;
  const avgNetMargin = margins.reduce((s, m) => s + m.netMargin, 0) / margins.length;
  const avgWcPct = margins.reduce((s, m) => s + m.wcPct, 0) / margins.length;

  // FIXED: Better CAPEX calculation using actual capex if available
  const capexRates = [];
  for (let i = 0; i < sorted.length; i++) {
    const year = sorted[i];
    if (year.capex && year.revenue > 0) {
      // If actual capex is available, use it
      capexRates.push(year.capex / year.revenue);
    } else if (year.ppe && sorted[i - 1]?.ppe && year.revenue > 0) {
      // Estimate from PP&E change + depreciation
      const ppeDelta = year.ppe - sorted[i - 1].ppe;
      const depreciation = year.depreciation || (year.ppe * 0.1); // Estimate 10% if not available
      const estimatedCapex = ppeDelta + depreciation;
      capexRates.push(Math.max(0, estimatedCapex / year.revenue));
    }
  }
  
  const avgCapexPct = capexRates.length > 0
    ? capexRates.reduce((s, c) => s + c, 0) / capexRates.length
    : 0.04; // Default to 4% if no data

  // Derive COGS and OpEx from EBITDA margin
  // EBITDA margin = (Revenue - COGS - OpEx) / Revenue
  // Assuming OpEx is typically 15-25% for most businesses
  const estimatedOpEx = 0.20;
  const cogsPct = Math.max(0, Math.min(0.95, 1 - avgEbitdaMargin - estimatedOpEx));

  // Get most recent year (last in sorted array which is oldest->newest)
  const mostRecentYear = sorted[sorted.length - 1];
  
  // Calculate average revenue across all years
  const avgRevenue = sorted.reduce((sum, d) => sum + d.revenue, 0) / sorted.length;

  return {
    // Use most recent year's revenue as the base (more representative for projections)
    baseRevenue: mostRecentYear.revenue,
    // Also provide average revenue for reference
    avgRevenue: avgRevenue,
    growth: avgGrowth,
    cogsPct,
    opexPct: estimatedOpEx,
    wcPctOfRev: avgWcPct,
    capexPct: avgCapexPct,
    avgNetMargin,
    avgEbitdaMargin,
    dataQuality: {
      years: sorted.length,
      hasCapex: sorted.some(d => d.capex),
      hasPPE: sorted.some(d => d.ppe),
      hasDepreciation: sorted.some(d => d.depreciation),
    },
  };
}
