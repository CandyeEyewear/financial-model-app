// utils/dcfComparator.js

/**
 * DCF Engine Comparator & Divergence Detector
 * 
 * Compares two DCF calculation paths (Path A: valuationCalculations.js vs Path B: buildProjection.js)
 * and identifies the exact point where results diverge.
 * 
 * Usage:
 *   import { compareDCFEngines } from './utils/dcfComparator.js';
 *   import { calculateDCF } from './utils/valuationCalculations.js';
 *   import { buildProjection } from './utils/buildProjection.js';
 * 
 *   const projectionResult = buildProjection(params);
 *   const dcfResult = calculateDCF({
 *     projectedFCFs: projectionResult.rows.map(r => r.fcf),
 *     wacc: params.wacc,
 *     terminalGrowthRate: params.terminalGrowth,
 *     netDebt: projectionResult.netDebtAtValuation,
 *     // ... other params
 *   });
 * 
 *   const comparison = compareDCFEngines(projectionResult, dcfResult, {
 *     tolerance: 1e-6,
 *     verbose: true
 *   });
 */

/**
 * Compare two DCF calculation engines and detect divergence
 * 
 * @param {Object} pathBResult - Result from buildProjection()
 * @param {Object} pathAResult - Result from calculateDCF()
 * @param {Object} options - Comparison options
 * @param {number} [options.tolerance=1e-6] - Numeric tolerance for equality
 * @param {boolean} [options.verbose=true] - Enable detailed logging
 * @param {Function} [options.logger=console.log] - Custom logger
 * @param {number} [options.precision=6] - Decimal places for display
 * @returns {Object} Comparison result with divergence analysis
 */
export function compareDCFEngines(pathBResult, pathAResult, options = {}) {
  const {
    tolerance = 1e-6,
    verbose = true,
    logger = console.log,
    precision = 6
  } = options;
  
  const log = (...args) => verbose && logger(...args);
  const df = (n) => typeof n === 'number' ? n.toFixed(precision) : 'N/A';
  const pct = (n) => typeof n === 'number' ? (n * 100).toFixed(4) + '%' : 'N/A';
  
  log('\n' + '='.repeat(80));
  log('DCF ENGINE COMPARISON - DIVERGENCE ANALYSIS');
  log('='.repeat(80) + '\n');
  
  const divergences = [];
  const summary = {
    fcfMatch: true,
    discountFactorMatch: true,
    pvMatch: true,
    terminalValueMatch: true,
    pvTerminalMatch: true,
    enterpriseValueMatch: true,
    equityValueMatch: true,
    firstDivergence: null
  };
  
  // Extract data from both paths
  const fcfB = pathBResult.rows.map(r => r.fcf);
  const fcfA = pathAResult.breakdownByYear.map(y => y.fcf);
  
  const wacc = pathBResult.rows[0]?.discountFactor 
    ? Math.pow(1 / pathBResult.rows[0].discountFactor, 1) - 1
    : null;
  
  log('📊 INPUT VALIDATION');
  log('-'.repeat(80));
  log(`Path A (DCF Utility) - Projection Years: ${fcfA.length}`);
  log(`Path B (Projection)  - Projection Years: ${fcfB.length}`);
  log(`WACC (inferred from Path B): ${pct(wacc)}`);
  log(`Tolerance: ${tolerance}\n`);
  
  // Validate inputs
  if (fcfA.length !== fcfB.length) {
    const error = {
      type: 'INPUT_MISMATCH',
      message: `FCF array length mismatch: Path A has ${fcfA.length} years, Path B has ${fcfB.length} years`,
      severity: 'CRITICAL'
    };
    divergences.push(error);
    summary.firstDivergence = error;
    log('❌ CRITICAL ERROR:', error.message + '\n');
    return { summary, divergences, valid: false };
  }
  
  // ===== 1. COMPARE FCF ARRAYS =====
  log('🔍 STEP 1: FREE CASH FLOW COMPARISON (FCFF)');
  log('-'.repeat(80));
  
  const fcfDiffs = [];
  let fcfDivergenceYear = null;
  
  fcfA.forEach((fcfAVal, i) => {
    const fcfBVal = fcfB[i];
    const diff = Math.abs(fcfAVal - fcfBVal);
    const relDiff = fcfAVal !== 0 ? (diff / Math.abs(fcfAVal)) : 0;
    
    fcfDiffs.push({
      year: i + 1,
      pathA: fcfAVal,
      pathB: fcfBVal,
      absDiff: diff,
      relDiff: relDiff,
      match: diff <= tolerance
    });
    
    if (diff > tolerance && fcfDivergenceYear === null) {
      fcfDivergenceYear = i + 1;
      summary.fcfMatch = false;
      
      const divergence = {
        type: 'FCF_MISMATCH',
        year: i + 1,
        pathA: fcfAVal,
        pathB: fcfBVal,
        difference: diff,
        relDifference: relDiff,
        severity: 'HIGH'
      };
      
      divergences.push(divergence);
      
      if (!summary.firstDivergence) {
        summary.firstDivergence = divergence;
      }
    }
  });
  
  if (fcfDivergenceYear) {
    log(`❌ DIVERGENCE DETECTED at Year ${fcfDivergenceYear}`);
    const d = fcfDiffs[fcfDivergenceYear - 1];
    log(`   Path A: ${df(d.pathA)}`);
    log(`   Path B: ${df(d.pathB)}`);
    log(`   Δ Abs:  ${df(d.absDiff)} (${pct(d.relDiff)} relative)\n`);
    
    // Show all FCF comparisons in table
    log('Year-by-Year FCF Comparison:');
    console.table(fcfDiffs.map(d => ({
      Year: d.year,
      'Path A': df(d.pathA),
      'Path B': df(d.pathB),
      'Δ': df(d.absDiff),
      'Match': d.match ? '✓' : '✗'
    })));
  } else {
    log('✅ FCF arrays are identical (within tolerance)\n');
    fcfDiffs.slice(0, 3).forEach(d => {
      log(`   Year ${d.year}: ${df(d.pathA)} (both paths)`);
    });
    if (fcfDiffs.length > 3) log(`   ... (${fcfDiffs.length - 3} more years)`);
    log('');
  }
  
  // ===== 2. COMPARE DISCOUNT FACTORS =====
  log('🔍 STEP 2: DISCOUNT FACTOR COMPARISON');
  log('-'.repeat(80));
  
  const dfDiffs = [];
  let dfDivergenceYear = null;
  
  pathAResult.breakdownByYear.forEach((yearData, i) => {
    const dfA = yearData.discountFactor;
    const dfB = pathBResult.rows[i].discountFactor;
    const diff = Math.abs(dfA - dfB);
    const relDiff = dfA !== 0 ? (diff / Math.abs(dfA)) : 0;
    
    dfDiffs.push({
      year: i + 1,
      pathA: dfA,
      pathB: dfB,
      absDiff: diff,
      relDiff: relDiff,
      match: diff <= tolerance
    });
    
    if (diff > tolerance && dfDivergenceYear === null) {
      dfDivergenceYear = i + 1;
      summary.discountFactorMatch = false;
      
      const divergence = {
        type: 'DISCOUNT_FACTOR_MISMATCH',
        year: i + 1,
        pathA: dfA,
        pathB: dfB,
        difference: diff,
        relDifference: relDiff,
        severity: 'MEDIUM'
      };
      
      divergences.push(divergence);
      
      if (!summary.firstDivergence) {
        summary.firstDivergence = divergence;
      }
    }
  });
  
  if (dfDivergenceYear) {
    log(`❌ DIVERGENCE DETECTED at Year ${dfDivergenceYear}`);
    const d = dfDiffs[dfDivergenceYear - 1];
    log(`   Path A: ${df(d.pathA)}`);
    log(`   Path B: ${df(d.pathB)}`);
    log(`   Δ:      ${df(d.absDiff)}\n`);
  } else {
    log('✅ Discount factors are identical\n');
  }
  
  // ===== 3. COMPARE PRESENT VALUES =====
  log('🔍 STEP 3: PRESENT VALUE COMPARISON (PV of FCF by Year)');
  log('-'.repeat(80));
  
  const pvDiffs = [];
  let pvDivergenceYear = null;
  
  pathAResult.breakdownByYear.forEach((yearData, i) => {
    const pvA = yearData.presentValue;
    const pvB = pathBResult.rows[i].pvFCF;
    const diff = Math.abs(pvA - pvB);
    const relDiff = pvA !== 0 ? (diff / Math.abs(pvA)) : 0;
    
    pvDiffs.push({
      year: i + 1,
      pathA: pvA,
      pathB: pvB,
      absDiff: diff,
      relDiff: relDiff,
      match: diff <= tolerance
    });
    
    if (diff > tolerance && pvDivergenceYear === null) {
      pvDivergenceYear = i + 1;
      summary.pvMatch = false;
      
      const divergence = {
        type: 'PV_MISMATCH',
        year: i + 1,
        pathA: pvA,
        pathB: pvB,
        difference: diff,
        relDifference: relDiff,
        severity: 'HIGH'
      };
      
      divergences.push(divergence);
      
      if (!summary.firstDivergence) {
        summary.firstDivergence = divergence;
      }
    }
  });
  
  if (pvDivergenceYear) {
    log(`❌ DIVERGENCE DETECTED at Year ${pvDivergenceYear}`);
    const d = pvDiffs[pvDivergenceYear - 1];
    log(`   Path A: ${df(d.pathA)}`);
    log(`   Path B: ${df(d.pathB)}`);
    log(`   Δ:      ${df(d.absDiff)}\n`);
  } else {
    log('✅ Present values are identical\n');
  }
  
  // ===== 4. COMPARE TERMINAL VALUE =====
  log('🔍 STEP 4: TERMINAL VALUE COMPARISON');
  log('-'.repeat(80));
  
  const tvA = pathAResult.terminalValue;
  const tvB = pathBResult.tv;
  const tvDiff = Math.abs(tvA - tvB);
  const tvRelDiff = tvA !== 0 ? (tvDiff / Math.abs(tvA)) : 0;
  
  log(`Path A Terminal Value: ${df(tvA)}`);
  log(`Path B Terminal Value: ${df(tvB)}`);
  log(`Difference:            ${df(tvDiff)} (${pct(tvRelDiff)} relative)`);
  
  if (tvDiff > tolerance) {
    summary.terminalValueMatch = false;
    
    const divergence = {
      type: 'TERMINAL_VALUE_MISMATCH',
      pathA: tvA,
      pathB: tvB,
      difference: tvDiff,
      relDifference: tvRelDiff,
      severity: 'CRITICAL'
    };
    
    divergences.push(divergence);
    
    if (!summary.firstDivergence) {
      summary.firstDivergence = divergence;
    }
    
    log('❌ TERMINAL VALUE MISMATCH\n');
  } else {
    log('✅ Terminal values match\n');
  }
  
  // ===== 5. COMPARE PV OF TERMINAL VALUE =====
  log('🔍 STEP 5: PV(TERMINAL VALUE) COMPARISON');
  log('-'.repeat(80));
  
  const pvTvA = pathAResult.pvOfTerminalValue;
  const pvTvB = pathBResult.tvPV;
  const pvTvDiff = Math.abs(pvTvA - pvTvB);
  const pvTvRelDiff = pvTvA !== 0 ? (pvTvDiff / Math.abs(pvTvA)) : 0;
  
  log(`Path A PV(TV): ${df(pvTvA)}`);
  log(`Path B PV(TV): ${df(pvTvB)}`);
  log(`Difference:    ${df(pvTvDiff)} (${pct(pvTvRelDiff)} relative)`);
  
  if (pvTvDiff > tolerance) {
    summary.pvTerminalMatch = false;
    
    const divergence = {
      type: 'PV_TERMINAL_MISMATCH',
      pathA: pvTvA,
      pathB: pvTvB,
      difference: pvTvDiff,
      relDifference: pvTvRelDiff,
      severity: 'CRITICAL'
    };
    
    divergences.push(divergence);
    
    if (!summary.firstDivergence) {
      summary.firstDivergence = divergence;
    }
    
    log('❌ PV(TERMINAL VALUE) MISMATCH\n');
  } else {
    log('✅ PV(Terminal Value) matches\n');
  }
  
  // ===== 6. COMPARE ENTERPRISE VALUE =====
  log('🔍 STEP 6: ENTERPRISE VALUE COMPARISON');
  log('-'.repeat(80));
  
  const evA = pathAResult.enterpriseValue;
  const evB = pathBResult.enterpriseValue;
  const evDiff = Math.abs(evA - evB);
  const evRelDiff = evA !== 0 ? (evDiff / Math.abs(evA)) : 0;
  
  log(`Path A Enterprise Value: ${df(evA)}`);
  log(`Path B Enterprise Value: ${df(evB)}`);
  log(`Difference:              ${df(evDiff)} (${pct(evRelDiff)} relative)`);
  
  if (evDiff > tolerance) {
    summary.enterpriseValueMatch = false;
    
    const divergence = {
      type: 'ENTERPRISE_VALUE_MISMATCH',
      pathA: evA,
      pathB: evB,
      difference: evDiff,
      relDifference: evRelDiff,
      severity: 'CRITICAL'
    };
    
    divergences.push(divergence);
    
    if (!summary.firstDivergence) {
      summary.firstDivergence = divergence;
    }
    
    log('❌ ENTERPRISE VALUE MISMATCH\n');
  } else {
    log('✅ Enterprise values match\n');
  }
  
  // ===== 7. COMPARE EQUITY VALUE =====
  log('🔍 STEP 7: EQUITY VALUE COMPARISON');
  log('-'.repeat(80));
  
  const eqA = pathAResult.equityValue;
  const eqB = pathBResult.equityValue;
  const eqDiff = Math.abs(eqA - eqB);
  const eqRelDiff = eqA !== 0 ? (eqDiff / Math.abs(eqA)) : 0;
  
  log(`Path A Equity Value: ${df(eqA)}`);
  log(`Path B Equity Value: ${df(eqB)}`);
  log(`Difference:          ${df(eqDiff)} (${pct(eqRelDiff)} relative)`);
  
  if (eqDiff > tolerance) {
    summary.equityValueMatch = false;
    
    const divergence = {
      type: 'EQUITY_VALUE_MISMATCH',
      pathA: eqA,
      pathB: eqB,
      difference: eqDiff,
      relDifference: eqRelDiff,
      severity: 'CRITICAL',
      note: 'Check equity bridge assumptions (net debt timing, cash treatment, associates, minority interest)'
    };
    
    divergences.push(divergence);
    
    if (!summary.firstDivergence) {
      summary.firstDivergence = divergence;
    }
    
    log('❌ EQUITY VALUE MISMATCH');
    log('   ⚠️  This may be due to different equity bridge assumptions:');
    log('       - Path A should use: EV - NetDebt(t=0) + Associates - Minority');
    log('       - Path B should use: EV - NetDebt(t=0) + Associates - Minority');
    log('       - Check if netDebt = (Debt - Cash) at valuation date in both\n');
  } else {
    log('✅ Equity values match\n');
  }
  
  // ===== FINAL SUMMARY =====
  log('='.repeat(80));
  log('📋 COMPARISON SUMMARY');
  log('='.repeat(80));
  
  const allMatch = Object.values(summary).every(v => v === true || v === null);
  
  if (allMatch) {
    log('✅ ALL CHECKS PASSED - Both paths produce identical results!');
    log(`   Tolerance: ±${tolerance}`);
  } else {
    log('❌ DIVERGENCES DETECTED');
    log(`   Total divergences found: ${divergences.length}`);
    log(`   First divergence: ${summary.firstDivergence?.type || 'Unknown'}`);
    
    if (summary.firstDivergence) {
      log('\n🎯 ROOT CAUSE ANALYSIS:');
      log('-'.repeat(80));
      
      switch (summary.firstDivergence.type) {
        case 'FCF_MISMATCH':
          log('The FCF arrays differ. Possible causes:');
          log('  1. Path A received FCFE instead of FCFF');
          log('  2. Different treatment of working capital changes');
          log('  3. Different day-count convention effects on interest expense');
          log('  4. Tax calculation differences');
          break;
          
        case 'DISCOUNT_FACTOR_MISMATCH':
          log('The discount factors differ. Possible causes:');
          log('  1. Different WACC values used');
          log('  2. Different period counting (mid-year vs end-of-year)');
          break;
          
        case 'TERMINAL_VALUE_MISMATCH':
          log('The terminal values differ. Possible causes:');
          log('  1. Different terminal growth rates');
          log('  2. Different final year FCF (propagated from earlier FCF mismatch)');
          log('  3. One path using exit multiple vs perpetuity growth');
          break;
          
        case 'EQUITY_VALUE_MISMATCH':
          log('The equity values differ despite matching EV. Root cause:');
          log('  1. Path A: Check if cash is being double-counted in equity bridge');
          log('  2. Path B: Check if using ending debt instead of opening net debt');
          log('  3. Different treatment of associates/minority interest');
          break;
          
        default:
          log('Review the detailed divergence data above.');
      }
    }
  }
  
  log('='.repeat(80) + '\n');
  
  return {
    summary,
    divergences,
    valid: true,
    allMatch,
    fcfComparison: fcfDiffs,
    discountFactorComparison: dfDiffs,
    pvComparison: pvDiffs,
    terminalValueComparison: { pathA: tvA, pathB: tvB, diff: tvDiff },
    pvTerminalComparison: { pathA: pvTvA, pathB: pvTvB, diff: pvTvDiff },
    enterpriseValueComparison: { pathA: evA, pathB: evB, diff: evDiff },
    equityValueComparison: { pathA: eqA, pathB: eqB, diff: eqDiff }
  };
}

/**
 * Generate a formatted comparison report
 * 
 * @param {Object} comparisonResult - Result from compareDCFEngines()
 * @returns {string} Formatted report text
 */
export function generateComparisonReport(comparisonResult) {
  if (!comparisonResult.valid) {
    return 'Invalid comparison - check input data';
  }
  
  const lines = [];
  lines.push('DCF ENGINE COMPARISON REPORT');
  lines.push('='.repeat(80));
  lines.push('');
  
  if (comparisonResult.allMatch) {
    lines.push('✅ RESULT: Both calculation paths produce identical valuations');
    lines.push('');
    lines.push(`Enterprise Value: ${comparisonResult.enterpriseValueComparison.pathA.toFixed(2)}`);
    lines.push(`Equity Value:     ${comparisonResult.equityValueComparison.pathA.toFixed(2)}`);
  } else {
    lines.push('❌ RESULT: Divergences detected between calculation paths');
    lines.push('');
    lines.push(`Total Divergences: ${comparisonResult.divergences.length}`);
    lines.push(`First Divergence:  ${comparisonResult.summary.firstDivergence?.type || 'Unknown'}`);
    lines.push('');
    
    lines.push('Divergence Details:');
    comparisonResult.divergences.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.type} ${d.year ? `(Year ${d.year})` : ''}`);
      lines.push(`   Path A: ${d.pathA?.toFixed(6) || 'N/A'}`);
      lines.push(`   Path B: ${d.pathB?.toFixed(6) || 'N/A'}`);
      lines.push(`   Diff:   ${d.difference?.toFixed(6) || 'N/A'}`);
      if (d.note) lines.push(`   Note:   ${d.note}`);
      lines.push('');
    });
  }
  
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

/**
 * Export comparison data to JSON for external analysis
 * 
 * @param {Object} comparisonResult - Result from compareDCFEngines()
 * @param {string} filepath - Optional filepath to save JSON
 * @returns {Object} JSON-serializable comparison data
 */
export function exportComparisonJSON(comparisonResult) {
  return {
    timestamp: new Date().toISOString(),
    summary: comparisonResult.summary,
    divergences: comparisonResult.divergences,
    allMatch: comparisonResult.allMatch,
    fcfYearByYear: comparisonResult.fcfComparison,
    enterpriseValue: comparisonResult.enterpriseValueComparison,
    equityValue: comparisonResult.equityValueComparison,
  };
}