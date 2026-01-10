// src/components/LoanMetricsTable.jsx
import React, { useState, useMemo, useEffect } from 'react';

import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  DollarSign,
  Percent,
  Calendar,
  BarChart3,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { currencyFmtMM, pctFmt, numFmt } from '../utils/formatters';
import { MessageCircle as MessageCircleIcon } from "lucide-react";
import { AITextRenderer } from './AITextRenderer';
 
/**
 * AI-Powered Financial Analysis Component
 * Provides contextual interpretation of debt metrics
 */

// Add this function before the AIInsightPanel component
function generateTableSummary(projection, params, ccy) {
  if (!projection || !projection.rows || projection.rows.length === 0) {
    return "No loan metrics data available.";
  }
  
  const { rows, creditStats, breaches } = projection;
  
  let summary = `LOAN METRICS ANALYSIS\n`;
  summary += `====================\n\n`;
  
  // Summary stats
  summary += `COVENANT PARAMETERS:\n`;
  summary += `• Min DSCR Requirement: ${params.minDSCR}x\n`;
  summary += `• Min ICR Requirement: ${params.targetICR}x\n`;
  summary += `• Max Net Debt/EBITDA: ${params.maxNDToEBITDA}x\n\n`;
  
  // Year-by-year metrics
  summary += `YEAR-BY-YEAR LOAN METRICS:\n`;
  rows.forEach((row) => {
    summary += `\nYear ${row.year}:\n`;
    summary += `  Revenue: ${(row.revenue / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  EBITDA: ${(row.ebitda / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  EBITDA Margin: ${(row.ebitdaMargin * 100).toFixed(1)}%\n`;
    summary += `  Debt Balance: ${(row.debtBalance / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  Interest Expense: ${(row.interestExpense / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  Principal Payment: ${(row.principalPayment / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  Total Debt Service: ${(row.debtService / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `  DSCR: ${row.dscr?.toFixed(2) || 'N/A'}x ${row.dscr < params.minDSCR ? '⚠️ BREACH' : '✅'}\n`;
    summary += `  ICR: ${row.icr?.toFixed(2) || 'N/A'}x ${row.icr < params.targetICR ? '⚠️ BREACH' : '✅'}\n`;
    summary += `  Net Debt/EBITDA: ${row.ndToEbitda?.toFixed(2) || 'N/A'}x ${row.ndToEbitda > params.maxNDToEBITDA ? '⚠️ BREACH' : '✅'}\n`;
    summary += `  Free Cash Flow: ${(row.fcf / 1000000).toFixed(2)}M ${ccy}\n`;
  });
  
  // Credit statistics
  summary += `\n\nCREDIT STATISTICS (Over Projection Period):\n`;
  summary += `• Average DSCR: ${creditStats.avgDSCR?.toFixed(2)}x\n`;
  summary += `• Minimum DSCR: ${creditStats.minDSCR?.toFixed(2)}x\n`;
  summary += `• Average ICR: ${creditStats.avgICR?.toFixed(2)}x\n`;
  summary += `• Minimum ICR: ${creditStats.minICR?.toFixed(2)}x\n`;
  summary += `• Average Leverage: ${creditStats.avgLeverage?.toFixed(2)}x\n`;
  summary += `• Maximum Leverage: ${creditStats.maxLeverage?.toFixed(2)}x\n`;
  summary += `• Average Cash Conversion: ${(creditStats.avgCashConversion * 100).toFixed(1)}%\n`;
  summary += `• Total FCF Generated: ${(creditStats.totalFCFGenerated / 1000000).toFixed(2)}M ${ccy}\n`;
  
  // Covenant breaches
  const totalBreaches = (breaches.dscrBreaches || 0) + (breaches.icrBreaches || 0) + (breaches.ndBreaches || 0);
  summary += `\n\nCOVENANT BREACH SUMMARY:\n`;
  summary += `• Total Breaches: ${totalBreaches}\n`;
  if (breaches.dscrBreaches > 0) {
    summary += `• DSCR Breaches: ${breaches.dscrBreaches} (Years: ${breaches.dscrBreachYears.join(', ')})\n`;
  }
  if (breaches.icrBreaches > 0) {
    summary += `• ICR Breaches: ${breaches.icrBreaches} (Years: ${breaches.icrBreachYears.join(', ')})\n`;
  }
  if (breaches.ndBreaches > 0) {
    summary += `• Leverage Breaches: ${breaches.ndBreaches} (Years: ${breaches.leverageBreachYears.join(', ')})\n`;
  }
  
  // Multi-tranche info if available
  if (projection.hasMultipleTranches && projection.multiTrancheInfo) {
    summary += `\n\nCAPITAL STRUCTURE:\n`;
    summary += `• Total Tranches: ${projection.multiTrancheInfo.totalTranches}\n`;
    summary += `• Total Debt: ${(projection.multiTrancheInfo.totalDebt / 1000000).toFixed(2)}M ${ccy}\n`;
    summary += `• Blended Interest Rate: ${(projection.multiTrancheInfo.blendedRate * 100).toFixed(2)}%\n`;
    projection.multiTrancheInfo.tranches.forEach((tranche, idx) => {
      summary += `\n  Tranche ${idx + 1}: ${tranche.name}\n`;
      summary += `    Seniority: ${tranche.seniority}\n`;
      summary += `    Amount: ${(tranche.amount / 1000000).toFixed(2)}M ${ccy}\n`;
      summary += `    Rate: ${(tranche.rate * 100).toFixed(2)}%\n`;
      summary += `    Type: ${tranche.amortizationType}\n`;
      summary += `    Maturity: ${new Date(tranche.maturityDate).toLocaleDateString()}\n`;
    });
  }
  
  return summary;
}

function AIInsightPanel({ projection, params, ccy }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const insights = useMemo(() => {
    const analysis = [];
    const stats = projection.creditStats;
    const breaches = projection.breaches;
    
    // 1. OVERALL CREDIT QUALITY ASSESSMENT
    const avgDSCR = stats.avgDSCR;
    const minDSCR = stats.minDSCR;
    
    if (avgDSCR >= 1.5) {
      analysis.push({
        type: 'positive',
        category: 'Credit Strength',
        insight: `Strong debt service coverage averaging ${numFmt(avgDSCR)}x demonstrates robust cash generation relative to debt obligations. This provides a substantial cushion for operational volatility.`,
        recommendation: 'Consider this a bankable credit profile suitable for favorable lending terms.'
      });
    } else if (avgDSCR >= 1.2) {
      analysis.push({
        type: 'neutral',
        category: 'Credit Strength',
        insight: `Adequate debt service coverage averaging ${numFmt(avgDSCR)}x meets minimum lending standards but leaves limited margin for error.`,
        recommendation: 'Monitor closely for any revenue deterioration. Consider maintaining higher cash reserves.'
      });
    } else {
      analysis.push({
        type: 'warning',
        category: 'Credit Risk',
        insight: `Below-standard debt service coverage averaging ${numFmt(avgDSCR)}x indicates elevated refinancing risk and potential covenant breach exposure.`,
        recommendation: 'URGENT: Develop deleveraging plan or seek covenant amendment. Consider asset sales or equity injection.'
      });
    }
    
    // 2. COVENANT BREACH ANALYSIS
    if (breaches.dscrBreaches > 0 || breaches.icrBreaches > 0 || breaches.ndBreaches > 0) {
      const totalBreaches = breaches.dscrBreaches + breaches.icrBreaches + breaches.ndBreaches;
      const breachYears = [...new Set([
        ...breaches.dscrBreachYears,
        ...breaches.icrBreachYears,
        ...breaches.leverageBreachYears
      ])].sort();
      
      analysis.push({
        type: 'critical',
        category: 'Covenant Breaches',
        insight: `Projected covenant violations in ${breachYears.length} year(s): ${breachYears.join(', ')}. Total breach instances: ${totalBreaches}.`,
        recommendation: `CRITICAL: Engage lenders proactively for covenant waivers. Breach years suggest structural cash flow inadequacy requiring operational restructuring or capital injection of approximately ${currencyFmtMM(projection.rows[0].cashAvailableForDebtService * 0.2, ccy)}.`
      });
    } else {
      analysis.push({
        type: 'positive',
        category: 'Covenant Compliance',
        insight: 'All financial covenants maintained throughout projection period with no anticipated breaches.',
        recommendation: 'Credit facility remains in good standing. Maintain current operational discipline.'
      });
    }
    
    // 3. LEVERAGE TRAJECTORY ANALYSIS
    const leverageStart = projection.rows[0].ndToEbitda;
    const leverageEnd = projection.rows[projection.rows.length - 1].ndToEbitda;
    const leverageDelta = leverageEnd - leverageStart;
    
    if (leverageDelta < -0.5) {
      analysis.push({
        type: 'positive',
        category: 'Deleveraging Path',
        insight: `Strong deleveraging trajectory with Net Debt/EBITDA declining from ${numFmt(leverageStart)}x to ${numFmt(leverageEnd)}x (${numFmt(Math.abs(leverageDelta))}x improvement).`,
        recommendation: 'Positive credit momentum. Consider refinancing opportunities at improved pricing as leverage declines.'
      });
    } else if (leverageDelta > 0.5) {
      analysis.push({
        type: 'warning',
        category: 'Leverage Concern',
        insight: `Leverage deteriorating from ${numFmt(leverageStart)}x to ${numFmt(leverageEnd)}x. Debt growing faster than EBITDA indicates weakening credit profile.`,
        recommendation: 'Review growth strategy. Consider EBITDA enhancement initiatives or pause debt-funded expansion.'
      });
    } else {
      analysis.push({
        type: 'neutral',
        category: 'Leverage Profile',
        insight: `Stable leverage profile maintaining ~${numFmt((leverageStart + leverageEnd) / 2)}x Net Debt/EBITDA throughout projection.`,
        recommendation: 'Maintain current capital allocation discipline. Monitor for opportunities to accelerate deleveraging.'
      });
    }
    
    // 4. INTEREST COVERAGE ANALYSIS
    if (stats.minICR < 2.0) {
      analysis.push({
        type: 'warning',
        category: 'Interest Coverage',
        insight: `Minimum interest coverage of ${numFmt(stats.minICR)}x falls below prudent 2.0x threshold, limiting financial flexibility.`,
        recommendation: 'Prioritize EBITDA growth or refinance to lower cost of capital. Limited capacity for additional debt.'
      });
    } else if (stats.minICR >= 3.0) {
      analysis.push({
        type: 'positive',
        category: 'Interest Coverage',
        insight: `Robust interest coverage averaging ${numFmt(stats.avgICR)}x demonstrates strong earnings protection against interest obligations.`,
        recommendation: 'Strong coverage provides capacity for additional debt if strategic opportunities arise.'
      });
    }
    
    // 5. CASH FLOW GENERATION QUALITY
    const avgCashConversion = stats.avgCashConversion;
    if (avgCashConversion >= 0.15) {
      analysis.push({
        type: 'positive',
        category: 'Cash Generation',
        insight: `Excellent cash conversion averaging ${pctFmt(avgCashConversion)} of revenue demonstrates high-quality earnings and strong working capital management.`,
        recommendation: 'Superior cash generation supports aggressive debt paydown or growth investment.'
      });
    } else if (avgCashConversion < 0.05) {
      analysis.push({
        type: 'warning',
        category: 'Cash Generation',
        insight: `Weak cash conversion at ${pctFmt(avgCashConversion)} of revenue suggests potential working capital or CapEx drag on cash flow.`,
        recommendation: 'Review working capital efficiency and capital expenditure requirements. Consider asset-light business model.'
      });
    }
    
    // 6. MULTI-TRANCHE SPECIFIC INSIGHTS
    if (projection.hasMultipleTranches && projection.multiTrancheInfo) {
      const seniorTranches = projection.multiTrancheInfo.tranches.filter(t => 
        t.seniority.toLowerCase().includes('senior')
      );
      const subTranches = projection.multiTrancheInfo.tranches.filter(t => 
        t.seniority.toLowerCase().includes('subordinated') || t.seniority.toLowerCase().includes('mezzanine')
      );
      
      if (subTranches.length > 0) {
        const subDebtTotal = subTranches.reduce((sum, t) => sum + t.amount, 0);
        const totalDebt = projection.multiTrancheInfo.totalDebt;
        const subDebtPct = (subDebtTotal / totalDebt) * 100;
        
        analysis.push({
          type: 'info',
          category: 'Capital Structure',
          insight: `Multi-layered capital structure with ${subDebtPct.toFixed(0)}% subordinated debt (${currencyFmtMM(subDebtTotal, ccy)}) provides enhanced downside protection for senior lenders.`,
          recommendation: 'Subordinated layers absorb first-loss risk. Monitor ratio of senior vs total debt service to assess senior lender priority.'
        });
      }
      
      // Maturity concentration risk
      const maturities = projection.multiTrancheInfo.tranches.map(t => 
        new Date(t.maturityDate).getFullYear()
      );
      const uniqueMaturities = [...new Set(maturities)];
      
      if (uniqueMaturities.length < projection.multiTrancheInfo.totalTranches) {
        analysis.push({
          type: 'warning',
          category: 'Refinancing Risk',
          insight: `Maturity concentration: Multiple tranches mature in ${uniqueMaturities.length} year(s), creating refinancing cliff risk.`,
          recommendation: 'Ladder maturities to reduce refinancing risk. Begin refinancing discussions 12-18 months before maturity clusters.'
        });
      }
    }
    
    // 7. FCF ADEQUACY FOR DEBT SERVICE
    const totalFCF = stats.totalFCFGenerated;
    const totalDebtService = projection.rows.reduce((sum, r) => sum + r.debtService, 0);
    const fcfCoverage = totalFCF / totalDebtService;
    
    if (fcfCoverage >= 1.0) {
      analysis.push({
        type: 'positive',
        category: 'Free Cash Flow',
        insight: `Cumulative FCF of ${currencyFmtMM(totalFCF, ccy)} fully covers total debt service of ${currencyFmtMM(totalDebtService, ccy)} (${numFmt(fcfCoverage)}x coverage).`,
        recommendation: 'Self-funding debt service from operations demonstrates financial sustainability. Excess FCF available for growth or returns to shareholders.'
      });
    } else {
      analysis.push({
        type: 'critical',
        category: 'Free Cash Flow',
        insight: `Cumulative FCF of ${currencyFmtMM(totalFCF, ccy)} INSUFFICIENT to cover debt service of ${currencyFmtMM(totalDebtService, ccy)} (${numFmt(fcfCoverage)}x coverage).`,
        recommendation: 'CRITICAL: FCF shortfall requires external financing or asset sales to meet debt obligations. Immediate action required.'
      });
    }
    
    return analysis;
  }, [projection, params, ccy]);
  
  const insightTypeConfig = {
    positive: { icon: CheckCircle2, color: 'emerald', label: 'Strength' },
    neutral: { icon: Info, color: 'blue', label: 'Notice' },
    warning: { icon: AlertTriangle, color: 'amber', label: 'Concern' },
    critical: { icon: AlertTriangle, color: 'red', label: 'Critical' },
    info: { icon: Sparkles, color: 'indigo', label: 'Insight' }
  };
  
  return (
    <Card className="border-l-4 border-l-indigo-600 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b transition-colors">
        <div
          className="flex items-center justify-between cursor-pointer hover:from-indigo-100 hover:to-purple-100 w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-indigo-900">
                AI-Powered Financial Analysis
              </CardTitle>
              <p className="text-xs text-indigo-700 mt-1">
                {insights.length} insights • Click to {isExpanded ? 'collapse' : 'expand'}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-indigo-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-indigo-600" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-6">
          <div className="space-y-4">
            {insights.map((insight, idx) => {
              const config = insightTypeConfig[insight.type];
              const Icon = config.icon;
              
              return (
                <div 
                  key={idx} 
                  className={`p-4 bg-${config.color}-50 border-l-4 border-${config.color}-500 rounded-r-lg`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 text-${config.color}-600 flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 bg-${config.color}-100 text-${config.color}-800 rounded-full`}>
                          {config.label}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {insight.category}
                        </span>
                      </div>
                      <p className={`text-sm text-${config.color}-900 mb-2 leading-relaxed`}>
                        {insight.insight}
                      </p>
                      <div className={`text-xs text-${config.color}-800 bg-${config.color}-100 p-2 rounded border border-${config.color}-200`}>
                        <strong className="font-semibold">Recommendation:</strong> {insight.recommendation}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Covenant Compliance Indicator - FIXED VERSION
 */
function CovenantIndicator({ value, threshold, isInverse = false, debtBalance }) {
  // Check if there's actual debt in this specific year
  const hasDebt = debtBalance > 0;
  
  // Invalid value check
  const isInvalid =
    value === null ||
    value === undefined ||
    !isFinite(value);
    

  // If no debt balance in this year, show "No debt"
  if (!hasDebt) {
    return (
      <div className="flex items-center gap-2 text-slate-500 italic">
        <span className="font-mono text-sm font-semibold">—</span>
        <span className="text-xs">No debt</span>
      </div>
    );
  }

  // If invalid value but there IS debt, show 0
  const safeValue = isInvalid ? 0 : value;

  // Normal compliance check
  const isBreached = isInverse ? safeValue > threshold : safeValue < threshold;
  const isMarginal = isInverse
    ? safeValue > threshold * 0.9 && safeValue <= threshold
    : safeValue < threshold * 1.1 && safeValue >= threshold;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm font-bold">{numFmt(safeValue)}x</span>
      {isBreached ? (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
          <AlertTriangle className="w-3 h-3" />
          <span>BREACH</span>
        </div>
      ) : isMarginal ? (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
          <AlertTriangle className="w-3 h-3" />
          <span>MARGINAL</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          <span>COMPLIANT</span>
        </div>
      )}
    </div>
  );
}

/**
 * Main Loan Metrics Table Component
 */
export default function LoanMetricsTable({ projection, params, ccy }) {
  const [activeView, setActiveView] = useState('summary');
  const [aiSummary, setAiSummary] = useState('');

  useEffect(() => {
    const handleAISummary = (event) => {
      setAiSummary(event.detail);
    };

    window.addEventListener('ai-summary-ready', handleAISummary);
    return () => window.removeEventListener('ai-summary-ready', handleAISummary);
  }, []);

  if (!projection || !projection.rows || projection.rows.length === 0) {
    return (
      <Card className="border-l-4 border-l-red-600">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <p className="font-semibold">No projection data available</p>
              <p className="text-sm">Please configure financial parameters to generate loan metrics.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const summaryStats = useMemo(() => {
    const totalInterest = projection.rows.reduce((sum, r) => sum + r.interestExpense, 0);
    const totalPrincipal = projection.rows.reduce((sum, r) => sum + r.principalPayment, 0);
    const totalDebtService = totalInterest + totalPrincipal;
    const avgDebtBalance = projection.rows.reduce((sum, r) => sum + r.debtBalance, 0) / projection.rows.length;
    
    return {
      totalInterest,
      totalPrincipal,
      totalDebtService,
      avgDebtBalance,
      openingBalance: projection.rows[0].debtBalance,
      closingBalance: projection.rows[projection.rows.length - 1].debtBalance,
      totalRepaid: totalPrincipal
    };
  }, [projection]);
  
  return (
    <div className="space-y-6">
      <AIInsightPanel projection={projection} params={params} ccy={ccy} />
      
      <div className="flex justify-end">
        

<button
  onClick={() => {
    console.log("✅ Triggering AI analysis event...");
    
    // Create a focused summary from the table data
    const tableSummary = generateTableSummary(projection, params, ccy);
    
    // Trigger the AI analysis with the table data
    window.dispatchEvent(new CustomEvent("trigger-ai-analysis", {
      detail: { summary: tableSummary, projection, params, ccy }
    }));
  }}
  className="flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-md shadow hover:from-blue-600 hover:to-indigo-700 transition-all"
>
  <MessageCircleIcon className="w-4 h-4 text-white" />
  <span>FinAssist AI: Interpret Loan Metrics</span>
</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-600 font-semibold">Total Debt Service</p>
                <p className="text-xl font-bold text-slate-900">{currencyFmtMM(summaryStats.totalDebtService, ccy)}</p>
                <p className="text-xs text-slate-500 mt-1">Over {projection.rows.length} years</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-600 font-semibold">Principal Repaid</p>
                <p className="text-xl font-bold text-slate-900">{currencyFmtMM(summaryStats.totalRepaid, ccy)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {summaryStats.openingBalance > 0 
                    ? `${((summaryStats.totalRepaid / summaryStats.openingBalance) * 100).toFixed(0)}% of opening balance`
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Percent className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-600 font-semibold">Avg DSCR</p>
                <p className="text-xl font-bold text-slate-900">{numFmt(projection.creditStats.avgDSCR)}x</p>
                <p className="text-xs text-slate-500 mt-1">
                  Min: {numFmt(projection.creditStats.minDSCR)}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-600 font-semibold">Avg Leverage</p>
                <p className="text-xl font-bold text-slate-900">{numFmt(projection.creditStats.avgLeverage)}x</p>
                <p className="text-xs text-slate-500 mt-1">
                  Max: {numFmt(projection.creditStats.maxLeverage)}x
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* View Toggle */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900">Debt Service Schedule</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveView('summary')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  activeView === 'summary'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Summary View
              </button>
              <button
                onClick={() => setActiveView('detailed')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                  activeView === 'detailed'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Detailed View
              </button>
              {projection.hasMultipleTranches && (
                <button
                  onClick={() => setActiveView('tranches')}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                    activeView === 'tranches'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tranche Detail
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {activeView === 'summary' && (
              <SummaryView projection={projection} params={params} ccy={ccy} />
            )}
            {activeView === 'detailed' && (
              <DetailedView projection={projection} params={params} ccy={ccy} />
            )}
            {activeView === 'tranches' && projection.hasMultipleTranches && (
              <TrancheView projection={projection} params={params} ccy={ccy} />
            )}
          </div>
        </CardContent>
      </Card>

      {aiSummary && (
        <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
          <CardHeader className="border-b border-blue-200">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <MessageCircleIcon className="w-5 h-5 text-blue-700" />
              FinAssist AI Summary & Interpretation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <AITextRenderer 
              content={aiSummary}
              className="text-sm leading-relaxed text-slate-800"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Summary View - High-level metrics
 */
function SummaryView({ projection, params, ccy }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-100 border-b-2 border-slate-300">
          <th className="text-left py-3 px-4 font-bold text-slate-700">Metric</th>
          {projection.rows.map((row) => (
            <th key={row.year} className="text-right py-3 px-4 font-bold text-slate-700">
              {row.year}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        <tr className="hover:bg-slate-50">
          <td className="py-2 px-4 font-semibold text-slate-700">Revenue</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
              {currencyFmtMM(row.revenue, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="hover:bg-blue-50">
          <td className="py-2 px-4 font-semibold text-blue-900">EBITDA</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-blue-900 font-bold py-2 px-4">
              {currencyFmtMM(row.ebitda, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="hover:bg-slate-50">
          <td className="py-2 px-4 font-semibold text-slate-700 pl-8">└─ EBITDA Margin</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-slate-700 py-2 px-4">
              {pctFmt(row.ebitdaMargin)}
            </td>
          ))}
        </tr>
        
        <tr className="bg-purple-50 hover:bg-purple-100">
          <td className="py-2 px-4 font-semibold text-purple-900">Total Debt Service</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-purple-900 font-bold py-2 px-4">
              {currencyFmtMM(row.debtService, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="hover:bg-slate-50">
          <td className="py-2 px-4 font-semibold text-slate-700 pl-8">└─ Interest</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-slate-700 py-2 px-4">
              {currencyFmtMM(row.interestExpense, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="hover:bg-slate-50">
          <td className="py-2 px-4 font-semibold text-slate-700 pl-8">└─ Principal</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-slate-700 py-2 px-4">
              {currencyFmtMM(row.principalPayment, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="bg-slate-100 hover:bg-slate-200">
          <td className="py-2 px-4 font-semibold text-slate-800">Ending Debt Balance</td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
              {currencyFmtMM(row.debtBalance, ccy)}
            </td>
          ))}
        </tr>
        
        <tr className="bg-emerald-50 hover:bg-emerald-100">
          <td className="py-2 px-4 font-semibold text-emerald-900">
            DSCR
            <span className="ml-2 text-xs text-slate-600">(Min: {numFmt(params.minDSCR)}x)</span>
          </td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right py-2 px-4">
              <CovenantIndicator 
                value={row.dscr} 
                threshold={params.minDSCR} 
                isInverse={false}
                debtBalance={row.debtBalance}
              />
            </td>
          ))}
        </tr>
        
        <tr className="bg-blue-50 hover:bg-blue-100">
          <td className="py-2 px-4 font-semibold text-blue-900">
            ICR
            <span className="ml-2 text-xs text-slate-600">(Min: {numFmt(params.targetICR)}x)</span>
          </td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right py-2 px-4">
              <CovenantIndicator 
                value={row.icr} 
                threshold={params.targetICR} 
                isInverse={false}
                debtBalance={row.debtBalance}
              />
            </td>
          ))}
        </tr>
        
        <tr className="bg-amber-50 hover:bg-amber-100">
          <td className="py-2 px-4 font-semibold text-amber-900">
            Net Debt / EBITDA
            <span className="ml-2 text-xs text-slate-600">(Max: {numFmt(params.maxNDToEBITDA)}x)</span>
          </td>
          {projection.rows.map((row, i) => (
            <td key={i} className="text-right py-2 px-4">
              <CovenantIndicator 
                value={row.ndToEbitda} 
                threshold={params.maxNDToEBITDA} 
                isInverse={true}
                debtBalance={row.debtBalance}
              />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Detailed View - Comprehensive metrics
 */
function DetailedView({ projection, params, ccy }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-slate-100 border-b-2 border-slate-300">
          <th className="text-left py-3 px-4 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10">
            Metric
          </th>
          {projection.rows.map((row) => (
            <th key={row.year} className="text-right py-3 px-4 font-bold text-slate-700 min-w-[120px]">
              {row.year}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        <tr className="bg-blue-100">
          <td colSpan="100%" className="py-2 px-4 font-bold text-blue-900 text-sm">
      {/* ===============================
     📊 INCOME STATEMENT + DEBT & CASH FLOW
================================== */}
<div className="overflow-x-auto mt-6">
  <table className="min-w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
    <tbody>
      {/* ===============================
   📊 INCOME STATEMENT
================================== */}
<tr className="bg-blue-100">
  <td colSpan="100%" className="py-2 px-4 font-bold text-blue-900 text-sm">
    📊 INCOME STATEMENT
  </td>
</tr>

{/* Revenue & Growth */}
<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Revenue</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.revenue, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 text-slate-600 pl-6 sticky left-0 bg-white">└─ Growth Rate</td>
  {projection.rows.map((row, i) => {
    const prevRevenue = i > 0 ? projection.rows[i - 1].revenue : row.revenue;
    const growth = i > 0 ? (row.revenue - prevRevenue) / prevRevenue : 0;
    return (
      <td key={i} className="text-right font-mono text-slate-600 py-2 px-4">
        {i > 0 ? pctFmt(growth) : "—"}
      </td>
    );
  })}
</tr>

{/* Gross Profit Band */}
<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">COGS</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.cogs, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-slate-100 hover:bg-slate-200">
  <td className="py-2 px-4 font-semibold text-slate-800 sticky left-0 bg-slate-100">
    Gross Profit
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
      {currencyFmtMM(row.grossProfit, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 text-slate-600 pl-6 sticky left-0 bg-white">└─ Gross Margin</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-600 py-2 px-4">
      {pctFmt(row.grossMargin)}
    </td>
  ))}
</tr>

{/* Operating Profit Band */}
<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">
    Operating Expenses
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.opex, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-blue-50 hover:bg-blue-100">
  <td className="py-2 px-4 font-semibold text-blue-900 sticky left-0 bg-blue-50">EBITDA</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-blue-900 font-bold py-2 px-4">
      {currencyFmtMM(row.ebitda, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 text-slate-600 pl-6 sticky left-0 bg-white">└─ EBITDA Margin</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-600 py-2 px-4">
      {pctFmt(row.ebitdaMargin)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">
    Depreciation & Amortization
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.depreciation, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-slate-100 hover:bg-slate-200">
  <td className="py-2 px-4 font-semibold text-slate-800 sticky left-0 bg-slate-100">EBIT</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
      {currencyFmtMM(row.ebit, ccy)}
    </td>
  ))}
</tr>

{/* Interest & Net Income Band */}
<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Interest Expense</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.interestExpense, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-slate-100 hover:bg-slate-200">
  <td className="py-2 px-4 font-semibold text-slate-800 sticky left-0 bg-slate-100">
    EBT (Pre-Tax Income)
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
      {currencyFmtMM(row.ebt, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Income Tax</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.tax, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-emerald-50 hover:bg-emerald-100">
  <td className="py-2 px-4 font-semibold text-emerald-900 sticky left-0 bg-emerald-50">Net Income</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-emerald-900 font-bold py-2 px-4">
      {currencyFmtMM(row.netIncome, ccy)}
    </td>
  ))}
</tr>

{/* ===============================
   💵 CASH FLOW STATEMENT
================================== */}
<tr className="bg-indigo-100">
  <td colSpan="100%" className="py-2 px-4 font-bold text-indigo-900 text-sm">
    💵 CASH FLOW STATEMENT
  </td>
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Operating Cash Flow</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.operatingCashFlow, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Working Capital Change</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      ({currencyFmtMM(row.wcDelta, ccy)})
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Capital Expenditure (CapEx)</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      ({currencyFmtMM(row.capex, ccy)})
    </td>
  ))}
</tr>

<tr className="bg-indigo-50 hover:bg-indigo-100">
  <td className="py-2 px-4 font-semibold text-indigo-900 sticky left-0 bg-indigo-50">
    Free Cash Flow (FCF)
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-indigo-900 font-bold py-2 px-4">
      {currencyFmtMM(row.fcf, ccy)}
    </td>
  ))}
</tr>

{/* ===============================
   💰 DEBT SERVICE
================================== */}
<tr className="bg-purple-100">
  <td colSpan="100%" className="py-2 px-4 font-bold text-purple-900 text-sm">
    💰 DEBT SERVICE
  </td>
</tr>

<tr className="bg-purple-50 hover:bg-purple-100">
  <td className="py-2 px-4 font-semibold text-purple-900 sticky left-0 bg-purple-50">
    Total Debt Service
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-purple-900 font-bold py-2 px-4">
      {currencyFmtMM(row.debtService, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 text-slate-700 pl-6 sticky left-0 bg-white">└─ Interest Payment</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-700 py-2 px-4">
      {currencyFmtMM(row.interestExpense, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 text-slate-700 pl-6 sticky left-0 bg-white">└─ Principal Payment</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-700 py-2 px-4">
      {currencyFmtMM(row.principalPayment, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-slate-100 hover:bg-slate-200">
  <td className="py-2 px-4 font-semibold text-slate-800 sticky left-0 bg-slate-100">
    Ending Debt Balance
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
      {currencyFmtMM(row.debtBalance, ccy)}
    </td>
  ))}
</tr>

{/* ===============================
   ⚖️ COVENANT RATIOS
================================== */}
<tr className="bg-amber-100">
  <td colSpan="100%" className="py-2 px-4 font-bold text-amber-900 text-sm">
    ⚖️ COVENANT RATIOS
  </td>
</tr>

<tr className="bg-emerald-50 hover:bg-emerald-100">
  <td className="py-2 px-4 font-semibold text-emerald-900 sticky left-0 bg-emerald-50">
    DSCR (Debt Service Coverage)
    <div className="text-xs text-slate-600 font-normal">Covenant: ≥{numFmt(params.minDSCR)}x</div>
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right py-2 px-4">
     <CovenantIndicator value={row.dscr} threshold={params.minDSCR} debtBalance={row.debtBalance} />
    </td>
  ))}
</tr>

<tr className="bg-blue-50 hover:bg-blue-100">
  <td className="py-2 px-4 font-semibold text-blue-900 sticky left-0 bg-blue-50">
    ICR (Interest Coverage)
    <div className="text-xs text-slate-600 font-normal">Covenant: ≥{numFmt(params.targetICR)}x</div>
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right py-2 px-4">
      <CovenantIndicator value={row.icr} threshold={params.targetICR} debtBalance={row.debtBalance} />

    </td>
  ))}
</tr>

<tr className="bg-amber-50 hover:bg-amber-100">
  <td className="py-2 px-4 font-semibold text-amber-900 sticky left-0 bg-amber-50">
    Net Debt / EBITDA (Leverage)
    <div className="text-xs text-slate-600 font-normal">Covenant: ≤{numFmt(params.maxNDToEBITDA)}x</div>
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right py-2 px-4">
      <CovenantIndicator
  value={row.ndToEbitda}
  threshold={params.maxNDToEBITDA}
  isInverse
  debtBalance={row.debtBalance}
/>
    </td>
  ))}
</tr>

{/* ===============================
   🏦 BALANCE SHEET SUMMARY
================================== */}
<tr className="bg-slate-100">
  <td colSpan="100%" className="py-2 px-4 font-bold text-slate-900 text-sm">
    🏦 BALANCE SHEET SUMMARY
  </td>
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">
    Cash & Cash Equivalents
  </td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.cash, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Working Capital</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.workingCapital, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Net PP&E</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.netPPE, ccy)}
    </td>
  ))}
</tr>

<tr className="hover:bg-slate-50">
  <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white">Gross Debt</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
      {currencyFmtMM(row.grossDebt, ccy)}
    </td>
  ))}
</tr>

<tr className="bg-amber-50 hover:bg-amber-100">
  <td className="py-2 px-4 font-semibold text-amber-900 sticky left-0 bg-amber-50">Net Debt</td>
  {projection.rows.map((row, i) => (
    <td key={i} className="text-right font-mono text-amber-900 font-bold py-2 px-4">
      {currencyFmtMM(row.netDebt, ccy)}
    </td>
  ))}
</tr>
            </tbody>
          </table>
        </div> {/* close overflow-x-auto mt-6 */}
      </td>
    </tr>
  </tbody>
</table>
);
}

/**
 * Tranche View - Multi-tranche breakdown
 */
function TrancheView({ projection, params, ccy }) {
  if (!projection.hasMultipleTranches || !projection.multiTrancheInfo) {
    return (
      <div className="p-8 text-center text-slate-600">
        <Info className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p className="text-lg font-semibold">Multi-tranche mode not enabled</p>
        <p className="text-sm mt-2">
          Enable multiple debt tranches in the Opening Debt Schedule section to view tranche-level details.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Multi-Tranche Summary */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-300">
        <h3 className="text-lg font-bold text-purple-900 mb-3">Multi-Tranche Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-purple-700 font-semibold mb-1">Total Tranches</p>
            <p className="text-2xl font-bold text-purple-900">
              {projection.multiTrancheInfo.totalTranches}
            </p>
          </div>
          <div>
            <p className="text-xs text-purple-700 font-semibold mb-1">Total Debt</p>
            <p className="text-2xl font-bold text-purple-900">
              {currencyFmtMM(projection.multiTrancheInfo.totalDebt, ccy)}
            </p>
          </div>
          <div>
            <p className="text-xs text-purple-700 font-semibold mb-1">Blended Rate</p>
            <p className="text-2xl font-bold text-purple-900">
              {pctFmt(projection.multiTrancheInfo.blendedRate)}
            </p>
          </div>
        </div>
      </div>

      {/* Tranche-by-Tranche Tables */}
      {projection.multiTrancheInfo.tranches.map((tranche, trancheIdx) => (
        <div key={trancheIdx} className="mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold">{tranche.name}</h4>
                <p className="text-xs text-slate-300 mt-1">
                  {tranche.seniority} • {currencyFmtMM(tranche.amount, ccy)} @ {pctFmt(tranche.rate)} •{" "}
                  {tranche.amortizationType === "amortizing"
                    ? "Amortizing"
                    : tranche.amortizationType === "interest-only"
                    ? "Interest-Only"
                    : "Bullet"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-300">Maturity</p>
                <p className="text-sm font-bold">
                  {new Date(tranche.maturityDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-2 border-t-0 border-slate-300 rounded-b-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="text-left py-2 px-4 font-bold text-slate-700">Metric</th>
                  {projection.rows.map((row) => (
                    <th key={row.year} className="text-right py-2 px-4 font-bold text-slate-700">
                      {row.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-semibold text-slate-700">Interest Payment</td>
                  {projection.rows.map((row, i) => {
                    const trancheData = row.trancheDetails[trancheIdx];
                    return (
                      <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
                        {trancheData ? currencyFmtMM(trancheData.interest, ccy) : "—"}
                      </td>
                    );
                  })}
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="py-2 px-4 font-semibold text-slate-700">Principal Payment</td>
                  {projection.rows.map((row, i) => {
                    const trancheData = row.trancheDetails[trancheIdx];
                    return (
                      <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
                        {trancheData ? currencyFmtMM(trancheData.principal, ccy) : "—"}
                      </td>
                    );
                  })}
                </tr>

                <tr className="bg-purple-50 hover:bg-purple-100">
                  <td className="py-2 px-4 font-semibold text-purple-900">Total Payment</td>
                  {projection.rows.map((row, i) => {
                    const trancheData = row.trancheDetails[trancheIdx];
                    return (
                      <td key={i} className="text-right font-mono text-purple-900 font-bold py-2 px-4">
                        {trancheData ? currencyFmtMM(trancheData.totalPayment, ccy) : "—"}
                      </td>
                    );
                  })}
                </tr>

                <tr className="bg-slate-100 hover:bg-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Ending Balance</td>
                  {projection.rows.map((row, i) => {
                    const trancheData = row.trancheDetails[trancheIdx];
                    return (
                      <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
                        {trancheData ? currencyFmtMM(trancheData.endingBalance, ccy) : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Aggregated View */}
      <div className="mt-6">
        <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white p-3 rounded-t-lg">
          <h4 className="text-lg font-bold">Aggregated Total (All Tranches)</h4>
          <p className="text-xs text-slate-200 mt-1">
            Combined debt service across all tranches
          </p>
        </div>

        <div className="overflow-x-auto border-2 border-t-0 border-indigo-300 rounded-b-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-indigo-100 border-b border-indigo-300">
                <th className="text-left py-2 px-4 font-bold text-indigo-900">Metric</th>
                {projection.rows.map((row) => (
                  <th key={row.year} className="text-right py-2 px-4 font-bold text-indigo-900">
                    {row.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-4 font-semibold text-slate-700">Total Interest</td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
                    {currencyFmtMM(row.interestExpense, ccy)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-2 px-4 font-semibold text-slate-700">Total Principal</td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right font-mono text-slate-900 py-2 px-4">
                    {currencyFmtMM(row.principalPayment, ccy)}
                  </td>
                ))}
              </tr>

              <tr className="bg-indigo-50 hover:bg-indigo-100">
                <td className="py-2 px-4 font-semibold text-indigo-900">Total Debt Service</td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right font-mono text-indigo-900 font-bold py-2 px-4">
                    {currencyFmtMM(row.debtService, ccy)}
                  </td>
                ))}
              </tr>

              <tr className="bg-slate-100 hover:bg-slate-200">
                <td className="py-2 px-4 font-semibold text-slate-800">Total Ending Balance</td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right font-mono text-slate-900 font-bold py-2 px-4">
                    {currencyFmtMM(row.debtBalance, ccy)}
                  </td>
                ))}
              </tr>

              {/* Covenant Ratios using Aggregated Debt Service */}
              <tr className="bg-emerald-50 hover:bg-emerald-100">
                <td className="py-2 px-4 font-semibold text-emerald-900">
                  DSCR (Aggregated)
                  <div className="text-xs text-slate-600 font-normal">
                    EBITDA / Total Debt Service
                  </div>
                </td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right py-2 px-4">
                    <CovenantIndicator value={row.dscr} threshold={params.minDSCR} />
                  </td>
                ))}
              </tr>

              <tr className="bg-blue-50 hover:bg-blue-100">
                <td className="py-2 px-4 font-semibold text-blue-900">
                  ICR (Aggregated)
                  <div className="text-xs text-slate-600 font-normal">EBIT / Total Interest</div>
                </td>
                {projection.rows.map((row, i) => (
                  <td key={i} className="text-right py-2 px-4">
                    <CovenantIndicator value={row.icr} threshold={params.targetICR} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
