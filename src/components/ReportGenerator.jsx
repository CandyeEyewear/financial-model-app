import React, { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import { Label } from "./Label";
import { Input } from "./Input";
import { 
  FileText, Download, FileSpreadsheet, CheckSquare, Bot, Sparkles,
  AlertCircle, Check, Loader, Eye, RefreshCw, Copy, Upload, Palette, X, ChevronDown, ChevronUp
} from "lucide-react";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import ReactMarkdown from 'react-markdown';


// Helper to calculate CAGR
const calculateCAGR = (data, field) => {
  if (!data || data.length < 2) return 0;
  const start = data[0][field] || 0;
  const end = data[data.length - 1][field] || 0;
  if (start === 0) return 0;
  const years = data.length - 1;
  return ((Math.pow(end / start, 1 / years) - 1) * 100).toFixed(1);
};

/**
 * Strip markdown formatting from AI responses
 * AI is instructed not to use markdown, but sometimes it slips through
 */
const stripMarkdown = (text) => {
  if (!text) return '';

  return text
    // Remove headers (## Header)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold (**text** or __text__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic (*text* or _text_)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove bullet points at start of lines (keep content)
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Get total debt from all sources
 * Matches pattern used in other components for consistency
 */
const getTotalDebt = (params, projection = null) => {
  // Priority 1: Projection data (most accurate)
  if (projection?.multiTrancheInfo?.totalDebt > 0) {
    return {
      total: projection.multiTrancheInfo.totalDebt,
      source: 'Multi-tranche',
      breakdown: projection.multiTrancheInfo.tranches || []
    };
  }

  if (projection?.finalDebt > 0) {
    return {
      total: projection.finalDebt,
      source: 'Projection',
      breakdown: []
    };
  }

  // Priority 2: Multi-tranche params
  if (params?.hasMultipleTranches && params?.debtTranches?.length > 0) {
    const total = params.debtTranches.reduce((sum, t) => sum + (t.amount || 0), 0);
    return {
      total,
      source: 'Multi-tranche params',
      breakdown: params.debtTranches
    };
  }

  // Priority 3: Single debt fields
  const existingDebt = params?.openingDebt || params?.existingDebtAmount || 0;
  const newFacility = params?.requestedLoanAmount || 0;

  return {
    total: existingDebt + newFacility,
    source: existingDebt > 0 && newFacility > 0 ? 'Existing + New' :
            existingDebt > 0 ? 'Existing only' :
            newFacility > 0 ? 'New facility only' : 'No debt',
    breakdown: [
      existingDebt > 0 ? { name: 'Existing Debt', amount: existingDebt } : null,
      newFacility > 0 ? { name: 'New Facility', amount: newFacility } : null
    ].filter(Boolean)
  };
};

/**
 * Calculate LTV safely - returns null if cannot calculate
 */
const calculateLTV = (totalDebt, collateralValue) => {
  if (!collateralValue || collateralValue <= 0) return null;
  if (!totalDebt || totalDebt <= 0) return 0;
  return (totalDebt / collateralValue) * 100;
};

/**
 * Check if there's any debt configured
 */
const hasAnyDebt = (params, projection = null) => {
  const debtInfo = getTotalDebt(params, projection);
  return debtInfo.total > 0;
};

// Helper to convert hex to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [59, 130, 246]; // Default blue
};

export function ReportGenerator({ projections, params, ccy, historicalData, accessToken }) {
  
const [sectionStates, setSectionStates] = useState({
    branding: false,        // true = OPEN, false = CLOSED
    aiAnalysis: true,
    termSheet: false,
    reportGenerator: true
  });

  // 👇 ADD THIS FUNCTION TOO!
  const toggleSection = (sectionName) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

const [selectedSections, setSelectedSections] = useState({
    executiveSummary: true,
    companyProfile: true,
    historicalPerformance: true,
    industryBenchmarking: true,
    sponsorAnalysis: false,
    businessAnalysis: true,
    managementAnalysis: true,
    creditAnalysis: true,
    collateralAnalysis: true,
    covenantAnalysis: true,
    financialProjections: true,
    creditMetrics: true,
    sensitivityAnalysis: true,
    refinancingRisk: true,
    esgAndRegulatory: true,
    stressTestResults: true,
    recommendation: true,
    appendixTables: true,
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiGeneratedContent, setAiGeneratedContent] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);

  // Branding State
  const [branding, setBranding] = useState({
    logo: null,
    logoDataUrl: null,
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#F59E0B'
  });

  const logoInputRef = useRef(null);

  // Editable Term Sheet Fields
  const [termSheetFields, setTermSheetFields] = useState({
    issuer: params.companyLegalName || "Borrower Name",
    arranger: "ABC Wealth Limited",
    trustee: "JCSD Trustee Services Limited",
    facilityType: "Senior Secured Fixed Rate Bond",
    currency: ccy,
    raiseAmount: params.requestedLoanAmount || 0,
    distribution: "Private Placement to Accredited Investors",
    useOfProceeds: params.useOfProceeds || "Refinance existing liabilities and provide working capital support",
    
    tenure: params.proposedTenor || 5,
    openingDate: new Date().toLocaleDateString(),
    issueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    maturityDate: new Date(Date.now() + (params.proposedTenor || 5) * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    coupon: (params.proposedPricing * 100) || 10.00,
    couponFrequency: params.paymentFrequency || "Quarterly",
    accrualBasis: params.dayCountConvention || "Actual/365",
    principalRepayment: params.balloonPercentage > 0 
      ? `Amortization with ${params.balloonPercentage}% balloon at maturity`
      : "Bullet payment at maturity",
    principalPrepayment: "Issuer may prepay after 30 days notice without penalty",
    
    securityDescription: params.collateralDescription ||
      `First legal mortgage over assets. Market value: ${currencyFmtMM(params.collateralValue || 0, ccy)} (LTV: ${(() => {
        const totalDebt = (params.openingDebt || params.existingDebtAmount || 0) + (params.requestedLoanAmount || 0);
        const ltv = params.collateralValue > 0 ? ((totalDebt / params.collateralValue) * 100).toFixed(1) : 'N/A';
        return ltv;
      })()}%). Personal guarantees from principals.`,
    
    financialCovenants: 
      `• Minimum Current Ratio: 1.5x
- Minimum Interest Coverage: ${numFmt(params.targetICR || 2.25)}x  
- Minimum Debt Service Coverage: ${numFmt(params.minDSCR || 1.25)}x
- Maximum Leverage Ratio: ${numFmt(params.maxNDToEBITDA || 3.5)}x`,
    
    positiveCovenants:
      `• Use of Proceeds: Funds used strictly for approved purposes
- Maintenance of Contracts: Ensure all contracts remain in good standing
- Financial Reporting: Provide quarterly and annual financial statements
- Insurance: Maintain adequate insurance coverage
- Compliance with Laws: Maintain all licenses and permits`,
    
    negativeCovenants:
      `• Dividends: No distributions unless Current Ratio ≥ 1.0x post-distribution
- Shareholder Loans: No shareholder loans during bond tenure
- Asset Sales: No major asset sales without bondholder approval
- Additional Debt: No additional senior or pari passu debt without consent
- Change of Business: No material change in business operations`,
    
    conditionsPrecedent:
      `1. Board resolution authorizing the bond issuance
2. Issuer acceptance of all terms and conditions
3. Arranger internal credit and legal approvals
4. Satisfactory legal due diligence review
5. True and accurate representations and warranties
6. Execution of final bond documentation
7. Complete KYC documentation for all directors and beneficial owners
8. Payment of all arrangement fees and legal expenses
9. Certification of no Material Adverse Effect
10. Evidence of insurance coverage`,

    reportingRequirements:
      `1. Prompt notice of any Event of Default within 10 business days
2. Updated KYC information as requested by arranger
3. Quarterly compliance certificates within 45 days of quarter end
4. Annual audited financial statements within 120 days of year end
5. Immediate notice of litigation exceeding ${currencyFmtMM((params.requestedLoanAmount || 0) * 0.05, ccy)}
6. Notice of proposed material asset sales or acquisitions`,

    eventsOfDefault:
      `1. Non-payment of principal or interest within 7 days of due date
2. Breach of any financial covenant for two consecutive quarters
3. Change of majority ownership without prior written consent
4. Declaration of inability to honor debt obligations
5. Ceasing to operate as a going concern
6. Cross-default to other material debt obligations
7. Insolvency, bankruptcy, or receivership proceedings
8. Material misrepresentation in provided information`,

    defaultRate: `Coupon Rate plus 2.00% per annum`,
    arrangementFeePercent: 1.5,
    commitmentFeePercent: 0.5,
    legalCostEstimatePercent: 0.1,
  });

  // Sync termSheetFields with params changes
  useEffect(() => {
    const debtInfo = getTotalDebt(params, projections?.base);
    const ltv = calculateLTV(debtInfo.total, params.collateralValue);

    setTermSheetFields(prev => ({
      ...prev,
      // Only update if params have meaningful values (don't overwrite user edits with empty strings)
      issuer: params.companyLegalName || prev.issuer,
      raiseAmount: debtInfo.total || prev.raiseAmount,
      currency: ccy || prev.currency,
      tenure: params.proposedTenor || prev.tenure,
      coupon: params.proposedPricing ? (params.proposedPricing * 100) : prev.coupon,
      couponFrequency: params.paymentFrequency || prev.couponFrequency,
      accrualBasis: params.dayCountConvention || prev.accrualBasis,
      useOfProceeds: params.useOfProceeds || prev.useOfProceeds,

      // Update maturity date based on tenor
      maturityDate: params.proposedTenor
        ? new Date(Date.now() + params.proposedTenor * 365 * 24 * 60 * 60 * 1000).toLocaleDateString()
        : prev.maturityDate,

      // Update principal repayment based on balloon
      principalRepayment: params.balloonPercentage > 0
        ? `Amortization with ${params.balloonPercentage}% balloon at maturity`
        : params.useBalloonPayment === false
          ? "Amortizing principal payments"
          : prev.principalRepayment,

      // Update security description with correct LTV
      securityDescription: params.collateralDescription ||
        `First legal mortgage over assets. Market value: ${currencyFmtMM(params.collateralValue || 0, ccy)} (LTV: ${ltv !== null ? numFmt(ltv) : 'N/A'}%). Personal guarantees from principals.`,

      // Update financial covenants
      financialCovenants:
        `• Minimum Current Ratio: 1.5x
• Minimum Interest Coverage: ${numFmt(params.targetICR || 2.25)}x
• Minimum Debt Service Coverage: ${numFmt(params.minDSCR || 1.25)}x
• Maximum Leverage Ratio: ${numFmt(params.maxNDToEBITDA || 3.5)}x`,
    }));
  }, [
    params.companyLegalName,
    params.requestedLoanAmount,
    params.openingDebt,
    params.existingDebtAmount,
    params.proposedTenor,
    params.proposedPricing,
    params.collateralValue,
    params.collateralDescription,
    params.minDSCR,
    params.targetICR,
    params.maxNDToEBITDA,
    params.balloonPercentage,
    params.paymentFrequency,
    params.dayCountConvention,
    params.useOfProceeds,
    params.useBalloonPayment,
    projections?.base,
    ccy
  ]);

  // AI Integration using serverless function /api/ai/analyze
  // No longer needs frontend API key - uses accessToken for auth

  // Logo Upload Handler
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("Logo file size must be less than 2MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setBranding(prev => ({
          ...prev,
          logo: file,
          logoDataUrl: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setBranding(prev => ({
      ...prev,
      logo: null,
      logoDataUrl: null
    }));
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Generate comprehensive model summary for AI
  const generateModelSummary = () => {
    if (!projections?.base || !params) {
      return "Insufficient data for analysis.";
    }

    const base = projections.base;
    const minDSCR = base.creditStats?.minDSCR || 0;
    const maxLeverage = base.creditStats?.maxLeverage || 0;
    const minICR = base.creditStats?.minICR || 0;

    // Get total debt from all sources
    const debtInfo = getTotalDebt(params, base);
    const ltv = calculateLTV(debtInfo.total, params.collateralValue);
    const netDebt = debtInfo.total - (params.openingCash || 0);

    // Calculate debt service info
    const avgDebtService = base.rows?.length > 0
      ? base.rows.reduce((sum, r) => sum + (r.debtService || 0), 0) / base.rows.length
      : 0;

    return `
FINANCIAL MODEL SUMMARY FOR AI ANALYSIS:

COMPANY INFORMATION:
- Legal Name: ${params.companyLegalName || "N/A"}
- Operating Name: ${params.companyOperatingName || "N/A"}
- Industry: ${params.industry || "N/A"}
- Business Age: ${params.businessAge || 0} years
- Management Experience: ${params.managementExperience || "N/A"}
- Credit History: ${params.creditHistory || "N/A"}

DEBT STRUCTURE:
- Total Debt: ${currencyFmtMM(debtInfo.total, ccy)} (Source: ${debtInfo.source})
- Existing Debt: ${currencyFmtMM(params.openingDebt || params.existingDebtAmount || 0, ccy)}
- New Facility: ${currencyFmtMM(params.requestedLoanAmount || 0, ccy)}
- Opening Cash: ${params.openingCash !== undefined ? currencyFmtMM(params.openingCash, ccy) : "NOT SET (defaults to 0)"}
- Net Debt: ${currencyFmtMM(netDebt, ccy)}
${debtInfo.breakdown.length > 1 ? `- Breakdown: ${debtInfo.breakdown.map(t => `${t.name}: ${currencyFmtMM(t.amount, ccy)}`).join(', ')}` : ''}

TRANSACTION DETAILS:
- Proposed Tenor: ${params.proposedTenor || 0} years
- New Facility Rate: ${params.proposedPricing ? pctFmt(params.proposedPricing) : "N/A"}
- Existing Debt Rate: ${params.existingDebtRate ? pctFmt(params.existingDebtRate) : "N/A"}
- Blended Rate: ${params.interestRate ? pctFmt(params.interestRate) : "N/A"}
- Loan Purpose: ${params.loanPurpose || "N/A"}
- Use of Proceeds: ${params.useOfProceeds || "N/A"}
- Payment Frequency: ${params.paymentFrequency || "N/A"}
- Balloon Payment: ${params.balloonPercentage > 0 ? `${params.balloonPercentage}% at maturity (${currencyFmtMM(debtInfo.total * params.balloonPercentage / 100, ccy)})` : "None"}

FINANCIAL METRICS (BASE CASE):
- Enterprise Value: ${currencyFmtMM(base.enterpriseValue || 0, ccy)}
- Equity Value: ${currencyFmtMM(base.equityValue || 0, ccy)}
- Equity MOIC: ${numFmt(base.moic || 0)}x
- Equity IRR: ${pctFmt(base.irr || 0)}
- Min DSCR: ${numFmt(minDSCR)}x
- Max Leverage: ${numFmt(maxLeverage)}x
- Min ICR: ${numFmt(minICR)}x
${params.sharesOutstanding ? `- Shares Outstanding: ${numFmt(params.sharesOutstanding, 0)}
- Price per Share: ${currencyFmtMM((base.equityValue || 0) / params.sharesOutstanding, ccy)}` : '- Shares Outstanding: NOT SET'}

DEBT SERVICE ANALYSIS:
${base.rows && base.rows.length > 0 ? `
- Year 1 Debt Service: ${currencyFmtMM(base.rows[0].debtService || 0, ccy)}
- Year 1 EBITDA: ${currencyFmtMM(base.rows[0].ebitda || 0, ccy)}
- Avg Annual Debt Service: ${currencyFmtMM(avgDebtService, ccy)}
- Debt Service % of Revenue: ${base.rows[0].revenue > 0 ? pctFmt((base.rows[0].debtService || 0) / base.rows[0].revenue) : 'N/A'}`
: "No projection rows available"}

COVENANT COMPLIANCE:
- DSCR Requirement: ${numFmt(params.minDSCR || 1.2)}x
- DSCR Actual: ${numFmt(minDSCR)}x
- DSCR Cushion: ${numFmt(minDSCR - (params.minDSCR || 1.2))}x ${minDSCR < (params.minDSCR || 1.2) ? "⚠️ BREACH" : "✅"}
- Leverage Limit: ${numFmt(params.maxNDToEBITDA || 3.5)}x
- Leverage Actual: ${numFmt(maxLeverage)}x
- Leverage Cushion: ${numFmt((params.maxNDToEBITDA || 3.5) - maxLeverage)}x ${maxLeverage > (params.maxNDToEBITDA || 3.5) ? "⚠️ BREACH" : "✅"}
- ICR Requirement: ${numFmt(params.targetICR || 2.0)}x
- ICR Actual: ${numFmt(minICR)}x
- Total Covenant Breaches: ${(base.breaches?.dscrBreaches || 0) + (base.breaches?.icrBreaches || 0) + (base.breaches?.ndBreaches || 0)}
${base.breaches?.dscrBreachYears?.length > 0 ? `- DSCR Breach Years: ${base.breaches.dscrBreachYears.join(', ')}` : ''}
${base.breaches?.icrBreachYears?.length > 0 ? `- ICR Breach Years: ${base.breaches.icrBreachYears.join(', ')}` : ''}
${base.breaches?.leverageBreachYears?.length > 0 ? `- Leverage Breach Years: ${base.breaches.leverageBreachYears.join(', ')}` : ''}

COLLATERAL:
- Collateral Value: ${currencyFmtMM(params.collateralValue || 0, ccy)}
- LTV Ratio: ${ltv !== null ? `${numFmt(ltv)}%` : "Cannot calculate (no collateral value)"}
- LTV Assessment: ${ltv !== null ? (ltv <= 60 ? "STRONG (≤60%)" : ltv <= 75 ? "ADEQUATE (≤75%)" : "ELEVATED (>75%)") : "N/A"}
- Lien Position: ${params.lienPosition || "N/A"}
- Description: ${params.collateralDescription || "N/A"}

QUALITATIVE FACTORS:
${params.businessModel ? `Business Model: ${params.businessModel.substring(0, 300)}` : "⚠️ No business model provided"}
${params.creditStrengths ? `Credit Strengths: ${params.creditStrengths.substring(0, 300)}` : "⚠️ No strengths identified"}
${params.keyRisks ? `Key Risks: ${params.keyRisks.substring(0, 300)}` : "⚠️ No risks identified"}
${params.mitigatingFactors ? `Mitigating Factors: ${params.mitigatingFactors.substring(0, 300)}` : "⚠️ No mitigants specified"}

STRESS SCENARIOS:
${Object.keys(projections).filter(k => k !== 'base').length > 0 ?
  Object.keys(projections).filter(k => k !== 'base').map(scenario => {
    const proj = projections[scenario];
    const breaches = (proj.breaches?.dscrBreaches || 0) + (proj.breaches?.icrBreaches || 0) + (proj.breaches?.ndBreaches || 0);
    return `- ${scenario}: IRR ${pctFmt(proj.irr || 0)}, Min DSCR ${numFmt(proj.creditStats?.minDSCR || 0)}x, Leverage ${numFmt(proj.creditStats?.maxLeverage || 0)}x, Breaches: ${breaches}`;
  }).join('\n')
  : "No stress scenarios configured"}

HISTORICAL DATA:
${historicalData && historicalData.length > 0 ?
  `${historicalData.length} years of historical data available.
Latest year revenue: ${currencyFmtMM(historicalData[historicalData.length - 1]?.revenue || 0, ccy)}
Revenue CAGR: ${calculateCAGR(historicalData, 'revenue')}%
EBITDA trend: ${historicalData.map(y => `${y.year}: ${currencyFmtMM(y.ebitda || 0, ccy)}`).join(', ')}
Latest EBITDA Margin: ${historicalData[historicalData.length - 1]?.ebitda && historicalData[historicalData.length - 1]?.revenue ? pctFmt(historicalData[historicalData.length - 1].ebitda / historicalData[historicalData.length - 1].revenue) : 'N/A'}`
  : "⚠️ No historical data provided - recommend obtaining 3-5 years before credit decision"}

DATA QUALITY WARNINGS:
${[
  !params.openingCash && params.openingCash !== 0 ? "- Opening Cash: NOT SET (net debt calculation may be inaccurate)" : null,
  !params.sharesOutstanding ? "- Shares Outstanding: NOT SET (price per share cannot be calculated)" : null,
  !params.collateralValue ? "- Collateral Value: NOT SET (LTV cannot be calculated)" : null,
  !params.businessModel ? "- Business Model: NOT PROVIDED" : null,
  !params.keyRisks ? "- Key Risks: NOT IDENTIFIED" : null,
  (!historicalData || historicalData.length === 0) ? "- Historical Data: NONE PROVIDED" : null,
  params.openingDebt && params.existingDebtAmount && params.openingDebt !== params.existingDebtAmount ?
    `- Debt Mismatch: openingDebt (${params.openingDebt}) differs from existingDebtAmount (${params.existingDebtAmount})` : null
].filter(Boolean).join('\n') || "All key data fields populated ✅"}
`;
  };

  // Enhanced AI Analysis with Credit Committee Focus
  const generateAIAnalysis = async (section) => {
    if (!accessToken) {
      setAiError("Please log in to use AI analysis features.");
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);

    try {
      const modelSummary = generateModelSummary();
      const base = projections?.base || {};
      const minDSCR = base.creditStats?.minDSCR || 0;
      const maxLeverage = base.creditStats?.maxLeverage || 0;
      const minICR = base.creditStats?.minICR || 0;
      
      const prompts = {
        executiveSummary: `You are writing for a Credit Committee comprising senior executives who will approve or decline this transaction. Write a 3-paragraph executive summary in formal investment banking style:

PARAGRAPH 1: Transaction Overview
- Borrower name, industry, transaction size, and purpose
- Use precise financial terminology (e.g., "senior secured term facility" not "loan")

PARAGRAPH 2: Credit Assessment
- Lead with credit metrics: DSCR ${numFmt(minDSCR)}x, Leverage ${numFmt(maxLeverage)}x, ICR ${numFmt(minICR)}x
- Quantify covenant cushions (e.g., "DSCR covenant of ${numFmt(params.minDSCR || 1.2)}x provides ${numFmt(minDSCR - (params.minDSCR || 1.2))}x cushion")
- State collateral coverage explicitly

PARAGRAPH 3: Risk Summary & Recommendation
- Identify 2-3 material risks with quantified impact where possible
- State clear recommendation: APPROVE / APPROVE WITH CONDITIONS / DECLINE
- One-sentence rationale for recommendation

TONE: Formal, decisive, data-driven. Avoid hedging language. Use present tense for facts, future tense for projections.
DO NOT use markdown formatting (**, ##, etc.) - use plain text only.
Maximum 400 words.`,

        historicalPerformance: `Analyze the borrower's historical financial performance for Credit Committee review:

PERFORMANCE TRACK RECORD:
${historicalData && historicalData.length > 0 ? 
  `Historical data available for ${historicalData.length} years
Revenue CAGR: ${calculateCAGR(historicalData, 'revenue')}%
Recent revenue: ${historicalData.slice(-3).map(y => `${y.year}: ${currencyFmtMM(y.revenue || 0, ccy)}`).join(', ')}` 
  : "CRITICAL GAP: No historical data provided - recommend obtaining 3-5 years of historical financials before credit decision"}

QUALITY OF EARNINGS ASSESSMENT:
- Evaluate revenue sustainability and concentration
- Identify one-time items or non-recurring charges
- Assess working capital trends (if data available)
- Analyze historical volatility of cash flows

MANAGEMENT CREDIBILITY:
- Have they demonstrated ability to execute? (Track record)
- Conservative vs. aggressive assumptions in projections?
- Historical covenant compliance record

CONCLUSION: Rate historical performance as Strong/Acceptable/Weak/Insufficient Data with specific supporting evidence.

TONE: Analytical and objective. Flag data gaps prominently.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        industryBenchmarking: `Provide industry and peer benchmarking analysis for Credit Committee:

INDUSTRY CONTEXT:
Industry: ${params.industry}
Based on typical industry metrics (use general knowledge for ${params.industry} sector):
- Typical industry leverage range
- Typical EBITDA margins
- Industry growth outlook and cyclicality
- Key industry risks

BORROWER RELATIVE TO INDUSTRY:
- Leverage: ${numFmt(maxLeverage)}x vs. industry typical range
- EBITDA Margin: ${pctFmt((base.rows?.[0]?.ebitda || 0) / (base.rows?.[0]?.revenue || 1))} vs. industry average
- Growth expectations vs. industry trends

COMPETITIVE POSITION:
- Market position (leader/follower based on provided data)
- Competitive advantages or vulnerabilities
- Barriers to entry in this industry

ASSESSMENT: Rate borrower as Above Average/Average/Below Average relative to industry peers.

TONE: Comparative and benchmarked. Use industry knowledge appropriately.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        creditAnalysis: `You are the lead credit analyst presenting to the Credit Committee. Provide quantitative credit analysis:

1. DEBT SERVICE CAPACITY:
- Current DSCR: ${numFmt(minDSCR)}x vs covenant ${numFmt(params.minDSCR || 1.2)}x (cushion: ${numFmt(minDSCR - (params.minDSCR || 1.2))}x)
- Trend: improving/stable/deteriorating based on projections
- Stress tolerance: estimate revenue decline before DSCR breaches covenant

2. LEVERAGE PROFILE:
- Net Debt/EBITDA: ${numFmt(maxLeverage)}x vs limit ${numFmt(params.maxNDToEBITDA || 3.5)}x
- Deleveraging trajectory over ${base.rows?.length || 5} year projection
- Assessment of leverage sustainability

3. COLLATERAL ADEQUACY:
- Total Debt: ${currencyFmtMM(getTotalDebt(params, projections?.base).total, ccy)}
- LTV: ${(() => {
    const ltv = calculateLTV(getTotalDebt(params, projections?.base).total, params.collateralValue);
    return ltv !== null ? numFmt(ltv) : 'N/A';
  })()}%
- Lien position: ${params.lienPosition || 'Not specified'}
- Estimated recovery in default scenario

4. CREDIT RATING ASSESSMENT:
Assign internal rating (Strong / Acceptable / Weak / Poor) with quantitative justification.

TONE: Clinical, quantitative, professional. Lead with numbers. Avoid subjective adjectives without data.
DO NOT use markdown formatting - plain text only.
Maximum 500 words.`,

        collateralAnalysis: `Provide detailed collateral analysis for recovery assessment:

COLLATERAL PACKAGE:
${params.collateralDescription || "No collateral details provided"}

VALUATION ANALYSIS:
- As-Is Market Value: ${currencyFmtMM(params.collateralValue || 0, ccy)}
- Estimated Orderly Liquidation Value: ${currencyFmtMM((params.collateralValue || 0) * 0.70, ccy)} (assume 70% of market)
- Estimated Forced Sale Value: ${currencyFmtMM((params.collateralValue || 0) * 0.50, ccy)} (assume 50% of market)

LOAN-TO-VALUE ANALYSIS:
- Total Debt: ${currencyFmtMM(getTotalDebt(params, projections?.base).total, ccy)}
- LTV on Market Value: ${(() => {
    const ltv = calculateLTV(getTotalDebt(params, projections?.base).total, params.collateralValue);
    return ltv !== null ? numFmt(ltv) : 'N/A';
  })()}%
- LTV on Orderly Liquidation (70%): ${(() => {
    const ltv = calculateLTV(getTotalDebt(params, projections?.base).total, (params.collateralValue || 0) * 0.70);
    return ltv !== null ? numFmt(ltv) : 'N/A';
  })()}%
- LTV on Forced Sale (50%): ${(() => {
    const ltv = calculateLTV(getTotalDebt(params, projections?.base).total, (params.collateralValue || 0) * 0.50);
    return ltv !== null ? numFmt(ltv) : 'N/A';
  })()}%

RECOVERY ANALYSIS:
- Estimated recovery rate in default
- Time to liquidate (estimate in months)
- Liquidation costs (legal, brokerage - typically 10-15%)

COLLATERAL QUALITY:
- Liquidity: High/Medium/Low
- Price volatility assessment
- Marketability and ease of sale

MONITORING REQUIREMENTS:
- Recommended appraisal frequency
- Insurance coverage requirements
- Restrictions on additional liens

CONCLUSION: Rate collateral as Strong/Adequate/Weak with loss-given-default estimate.

TONE: Conservative and recovery-focused.
DO NOT use markdown formatting - plain text only.
Maximum 500 words.`,

        covenantAnalysis: `Analyze covenant structure and headroom for Credit Committee:

FINANCIAL COVENANTS:
1. Minimum DSCR: ${numFmt(params.minDSCR || 1.2)}x
   Current: ${numFmt(minDSCR)}x
   Headroom: ${numFmt(minDSCR - (params.minDSCR || 1.2))}x (${pctFmt((minDSCR - (params.minDSCR || 1.2)) / (params.minDSCR || 1.2))} cushion)
   Breach point: DSCR falls below covenant if EBITDA declines by approximately ${pctFmt((minDSCR - (params.minDSCR || 1.2)) / minDSCR)}

2. Maximum Net Debt/EBITDA: ${numFmt(params.maxNDToEBITDA || 3.5)}x
   Current: ${numFmt(maxLeverage)}x
   Headroom: ${numFmt((params.maxNDToEBITDA || 3.5) - maxLeverage)}x
   
3. Minimum Interest Coverage: ${numFmt(params.targetICR || 2.0)}x
   Current: ${numFmt(minICR)}x
   Headroom: ${numFmt(minICR - (params.targetICR || 2.0))}x

COVENANT TESTING: Quarterly

MOST AT-RISK COVENANT:
Identify which covenant has least headroom and explain why it's most vulnerable.

PROJECTED COMPLIANCE:
Show expected covenant metrics over next 4-8 quarters based on projections.

CURE RIGHTS:
- Equity cure provisions: Yes/No and limitations
- Event of Default triggers

RECOMMENDATION: Rate covenant package as Tight/Adequate/Loose with justification.

TONE: Precise and forward-looking.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        sensitivityAnalysis: `Provide detailed sensitivity analysis with decision triggers for Credit Committee:

BASE CASE ASSUMPTIONS:
- Revenue Growth: ${pctFmt(params.revenueGrowth || 0)}
- EBITDA Margin: ${pctFmt((base.rows?.[0]?.ebitda || 0) / (base.rows?.[0]?.revenue || 1))}
- Current Min DSCR: ${numFmt(minDSCR)}x

SENSITIVITY TO KEY VARIABLES:

REVENUE SENSITIVITY:
- -10% Revenue Impact: Estimate new DSCR and covenant status
- -20% Revenue Impact: Estimate breach likelihood
- Break-even Revenue: Calculate minimum revenue to maintain ${numFmt(params.minDSCR || 1.2)}x DSCR

MARGIN SENSITIVITY:
- -200bps EBITDA Margin: Impact on coverage ratios
- -500bps EBITDA Margin: Severe stress scenario

INTEREST RATE SENSITIVITY (if applicable):
- +100bps Rate Increase: Impact on debt service and DSCR
- +200bps Rate Increase: Stress scenario impact

DECISION TRIGGERS - Recommend monitoring thresholds:
RED FLAG: DSCR falls below ${numFmt((params.minDSCR || 1.2) + 0.10)}x for two consecutive quarters
ENHANCED MONITORING: Revenue decline exceeds 15% YoY or margin compression exceeds 300bps
STANDARD MONITORING: All metrics within expected ranges

BREAKEVEN ANALYSIS:
Minimum EBITDA required to maintain covenant: Calculate based on debt service.

TONE: Quantitative scenario planning. Help Committee understand vulnerability points.
DO NOT use markdown formatting - plain text only.
Maximum 500 words.`,

        refinancingRisk: `Assess refinancing and exit risk for Credit Committee:

MATURITY PROFILE:
- Facility Maturity Date: ${termSheetFields.maturityDate}
- Projected Debt at Maturity: ${currencyFmtMM(projections.base?.rows?.[projections.base.rows.length - 1]?.endingDebt || 0, ccy)}
- Projected Leverage at Maturity: ${numFmt(projections.base?.rows?.[projections.base.rows.length - 1]?.ndToEbitda || 0)}x

REFINANCING FEASIBILITY:
- Will borrower be "bankable" at maturity? (Compare projected metrics to typical market standards)
- Alternative refinancing sources available (bank market, private credit, capital markets)
- Market access assessment based on projected credit profile

REPAYMENT SOURCES AT MATURITY:
Primary: Refinancing (assess likelihood)
Secondary: Operating cash flow accumulation, asset sales
Tertiary: Sponsor support, collateral liquidation

MATURITY RISK FACTORS:
- Refinancing risk level: Low/Medium/High
- Dependence on market conditions
- Borrower credit profile trajectory

RECOMMENDATION:
Is refinancing risk acceptable given credit profile and structure?

TONE: Forward-looking and market-aware.
DO NOT use markdown formatting - plain text only.
Maximum 300 words.`,

        esgAndRegulatory: `Assess Environmental, Social, Governance, and Regulatory risks for Credit Committee:

ENVIRONMENTAL RISKS:
- Industry environmental profile: High/Medium/Low impact (based on ${params.industry})
- Climate transition risk assessment
- Environmental liabilities or contingencies

SOCIAL RISKS:
- Labor relations and key person dependencies
- Customer/supplier concentration: ${params.keyCustomers || 'Not specified'}
- Product liability or reputational risks

GOVERNANCE ASSESSMENT:
- Management structure and quality
- Related party transactions or conflicts
- Financial reporting quality (audited statements available?)
- Ownership structure

REGULATORY & COMPLIANCE:
- Key licenses and regulatory requirements for ${params.industry}
- Regulatory change risks on horizon
- Historical compliance track record
- Industry-specific regulations

REPUTATIONAL RISK:
- Public perception and brand strength
- Litigation history or ongoing issues
- Customer satisfaction indicators

OVERALL ESG RISK RATING: Low/Medium/High
KEY MITIGANTS: Specific actions to address highest risks

TONE: Comprehensive risk assessment covering non-financial factors.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        businessAnalysis: `Provide business quality assessment for Credit Committee:

INDUSTRY POSITION:
- Market dynamics and competitive intensity in ${params.industry}
- Industry growth outlook and cyclicality
- Borrower's competitive position and market share

BUSINESS MODEL SUSTAINABILITY:
${params.businessModel || "No business model description provided"}
- Revenue model assessment (recurring vs. transactional)
- Customer acquisition and retention
- Switching costs and competitive moat

MANAGEMENT QUALITY:
- Experience: ${params.managementExperience || 'Not specified'}
- Track record of execution
- Depth of management team
- Succession planning

STRATEGIC RISKS:
- Key person dependencies
- Technology or market disruption risks
- Execution risks in growth strategy

TONE: Objective business fundamentals assessment.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        recommendation: `Provide final credit recommendation to Credit Committee:

RECOMMENDATION: [State clearly: APPROVE / APPROVE WITH CONDITIONS / DECLINE]

CREDIT DECISION RATIONALE (3-4 supporting factors):
List the key quantitative and qualitative factors driving this recommendation.
Example format:
1. DSCR of ${numFmt(minDSCR)}x provides ${numFmt(minDSCR - (params.minDSCR || 1.2))}x cushion above ${numFmt(params.minDSCR || 1.2)}x covenant
2. [Second factor with specific metrics]
3. [Third factor with specific metrics]

KEY RISKS TO MONITOR (2-3 specific risks):
Identify material risks with measurable indicators.
Example: Customer concentration - Top 3 customers represent X% of revenue

${minDSCR >= (params.minDSCR || 1.2) ? 
  `CONDITIONS OF APPROVAL (if conditional):
- Quarterly compliance certificates within 30 days
- Annual site inspection rights
- Notification requirements for material events
- [Add 2-3 specific conditions based on risk profile]` : ''}

PROPOSED MONITORING FREQUENCY: Quarterly / Semi-Annual / Annual
Justify frequency based on risk profile and covenant cushions.

TONE: Authoritative and decisive. State recommendation with conviction backed by data.
DO NOT use markdown formatting - plain text only.
Maximum 400 words.`,

        riskAssessment: `Identify Top 5 Material Credit Risks in priority order for Credit Committee:

For each risk provide:

RISK 1: [Title]
Description: What could go wrong (2 sentences)
Quantified Impact: Financial impact estimate (e.g., "15% revenue decline breaches DSCR covenant")
Likelihood: High / Medium / Low
Mitigation: Specific covenants or actions that reduce this risk

RISK 2: [Title]
[Same format]

RISK 3: [Title]
[Same format]

RISK 4: [Title]
[Same format]

RISK 5: [Title]
[Same format]

Prioritize by (Likelihood × Impact). Focus on risks that impair debt repayment:
- Covenant breach scenarios
- Revenue/customer concentration
- Margin compression
- Working capital deterioration
- Refinancing risk at maturity
- Operational dependencies
- Market or competitive risks

TONE: Risk-focused but balanced. Committee needs to understand downside scenarios.
DO NOT use markdown formatting - plain text only.
Maximum 600 words.`,

        scenarioAnalysis: `Provide scenario analysis for Credit Committee stress testing:

BASE CASE: IRR ${pctFmt(projections.base?.irr || 0)}, Min DSCR ${numFmt(projections.base?.creditStats?.minDSCR || 0)}, Breaches: ${(projections.base?.breaches?.dscrBreaches || 0) + (projections.base?.breaches?.icrBreaches || 0)}

STRESS SCENARIOS SUMMARY:
${Object.keys(projections).filter(k => k !== 'base').map(scenario => {
  const proj = projections[scenario];
  return `${scenario}: IRR ${pctFmt(proj.irr || 0)}, Min DSCR ${numFmt(proj.creditStats?.minDSCR || 0)}, Breaches: ${(proj.breaches?.dscrBreaches || 0) + (proj.breaches?.icrBreaches || 0)}`;
}).join('\n')}

ANALYSIS REQUIRED:
1. Range of Outcomes: Best case to worst case metrics across all scenarios
2. Breaking Point Analysis: At what point do covenants breach? (e.g., "DSCR breaches under 15% revenue decline")
3. Key Sensitivity Drivers: Revenue vs. margin vs. interest rate - which matters most?
4. Probability Assessment: Assign likelihood to each scenario
5. Recommended Decision Case: State which scenario should drive credit decision (typically base or mild stress)

CONCLUSION: Can structure withstand reasonable stress? Yes/No with supporting rationale.

TONE: Analytical scenario comparison. Focus on downside protection.
DO NOT use markdown formatting - plain text only.
Maximum 500 words.`,

        sponsorAnalysis: `Analyze sponsor/ownership and alignment of interests (if PE/sponsored deal):

SPONSOR PROFILE:
- Name/Firm: [If applicable]
- Track record and reputation
- Financial capacity for support

SPONSOR COMMITMENT:
- Equity invested: ${currencyFmtMM(params.sponsorEquity || 0, ccy)} (${numFmt((params.sponsorEquity || 0) / ((params.sponsorEquity || 0) + params.requestedLoanAmount || 1) * 100)}% of capital structure)
- Meaningful commitment relative to fund size?
- Additional support mechanisms (guarantees, equity commitments)

ALIGNMENT OF INTERESTS:
- Management equity ownership
- Incentive structures
- Exit timeline expectations

SPONSOR TRACK RECORD:
- Past portfolio company performance
- Treatment of lenders in stressed situations
- Industry expertise in ${params.industry}

RISK ASSESSMENT:
- Sponsor stability: Strong/Adequate/Weak
- Likelihood of support if needed: High/Medium/Low

NOTE: If not a sponsored deal, state "Not applicable - direct corporate borrower"

TONE: Assessment of sponsor quality and alignment.
DO NOT use markdown formatting - plain text only.
Maximum 300 words.`
      };

      const systemPrompt = `You are a senior credit analyst at a leading financial institution preparing analysis for a Credit Committee meeting. Your audience consists of C-level executives who will make the final credit decision.

Your analysis must be:
- PROFESSIONAL: Formal tone suitable for executive decision-making
- QUANTITATIVE: Lead with specific numbers and metrics from the data
- DECISIVE: Clear conclusions with supporting evidence
- RISK-FOCUSED: Honest about concerns and weaknesses
- ACTIONABLE: Provide specific recommendations

Remember: Credit committees value precision, honesty, and decisiveness over promotional language.

FINANCIAL MODEL DATA:
${modelSummary}

CRITICAL INSTRUCTION: Do NOT use any markdown formatting in your response. No asterisks for bold (**text**), no hashtags for headers (## Header), no backticks for code (\`code\`). Write in plain text only with proper paragraph breaks and bullet points using dashes or numbers.`;

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt: prompts[section] || prompts.executiveSummary,
          systemMessage: systemPrompt
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content || "No response from AI service.";
      
      // Strip any markdown that may have slipped through
      const cleanedContent = stripMarkdown(aiContent);
      
      setAiGeneratedContent(prev => ({
        ...prev,
        [section]: cleanedContent
      }));
      
      setShowAIPreview(true);
    } catch (error) {
      if (error.name === 'AbortError') {
        setAiError("Request timed out after 30 seconds. Please try again.");
      } else {
        console.error("AI Generation Error:", error);
        setAiError(error.message || "Failed to generate AI analysis. Please try again.");
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Generate all AI sections at once
  const generateAllAIContent = async () => {
    const sections = [
      'executiveSummary', 
      'historicalPerformance',
      'industryBenchmarking',
      'creditAnalysis', 
      'collateralAnalysis',
      'covenantAnalysis',
      'businessAnalysis', 
      'sensitivityAnalysis',
      'refinancingRisk',
      'esgAndRegulatory',
      'recommendation', 
      'riskAssessment', 
      'scenarioAnalysis'
    ];
    
    for (const section of sections) {
      await generateAIAnalysis(section);
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };

  // Copy AI content to clipboard
  const copyAIContent = (content) => {
    navigator.clipboard.writeText(content).then(() => {
      alert("Content copied to clipboard!");
    });
  };

  // Update term sheet field handler
  const updateTermSheetField = (field, value) => {
    setTermSheetFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Calculate fees
  const calculatedFees = useMemo(() => {
    const amount = termSheetFields.raiseAmount || 0;
    return {
      arrangementFee: amount * (termSheetFields.arrangementFeePercent / 100),
      commitmentFee: amount * (termSheetFields.commitmentFeePercent / 100),
      legalCosts: amount * (termSheetFields.legalCostEstimatePercent / 100),
      totalFees: amount * ((termSheetFields.arrangementFeePercent + termSheetFields.commitmentFeePercent + termSheetFields.legalCostEstimatePercent) / 100)
    };
  }, [termSheetFields.raiseAmount, termSheetFields.arrangementFeePercent, termSheetFields.commitmentFeePercent, termSheetFields.legalCostEstimatePercent]);

  // Validation function
  const validateReportData = () => {
    const errors = [];

    if (!projections?.base) errors.push("No financial projections available");
    if (!params?.companyLegalName) errors.push("Company name is required");

    // FIXED: Check for any debt source, not just requestedLoanAmount
    const debtInfo = getTotalDebt(params, projections?.base);
    if (debtInfo.total <= 0) {
      errors.push("No debt configured (set existing debt or new facility amount)");
    }

    if (!params?.proposedTenor) errors.push("Loan tenor is required");

    if (errors.length > 0) {
      alert(`Cannot generate report:\n\n${errors.join('\n')}`);
      return false;
    }
    return true;
  };

  // Generate executive summary with AI or template
  const generateExecutiveSummary = () => {
    if (aiGeneratedContent.executiveSummary) {
      return aiGeneratedContent.executiveSummary;
    }

    const recommendation = determineRecommendation(projections.base, params);
    
    return `
EXECUTIVE SUMMARY

Company: ${params.companyLegalName || "N/A"} (${params.companyOperatingName || "N/A"})
Industry: ${params.industry}
Loan Purpose: ${params.loanPurpose || "Not specified"}
Recommended Decision: ${recommendation.decision}

TRANSACTION OVERVIEW
- Requested Facility: ${currencyFmtMM(params.requestedLoanAmount, ccy)}
- Proposed Tenor: ${params.proposedTenor} years
- Pricing: ${pctFmt(params.proposedPricing)}
- Structure: ${params.dealStructure}

FINANCIAL PERFORMANCE
- Enterprise Value: ${currencyFmtMM(projections.base.enterpriseValue || 0, ccy)}
- Equity IRR: ${pctFmt(projections.base.irr || 0)}
- Min DSCR: ${numFmt(projections.base.creditStats?.minDSCR || 0)}
- Max Leverage: ${numFmt(projections.base.creditStats?.maxLeverage || 0)}x

KEY INVESTMENT HIGHLIGHTS
${params.creditStrengths ? `Strengths: ${params.creditStrengths.substring(0, 300)}` : "No specific strengths identified."}

PRIMARY RISKS & MITIGANTS
${params.keyRisks ? `Risks: ${params.keyRisks.substring(0, 300)}` : "No specific risks identified."}
${params.mitigatingFactors ? `Mitigation: ${params.mitigatingFactors.substring(0, 300)}` : "No mitigation strategies specified."}

RECOMMENDATION
${recommendation.summary} ${recommendation.rationale}
`;
  };

  // Generate comprehensive PDF Report with professional styling
  const generatePDF = () => {
    if (!validateReportData()) return;
    
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Get brand colors
      const primaryRGB = hexToRgb(branding.primaryColor);
      const secondaryRGB = hexToRgb(branding.secondaryColor);
      const accentRGB = hexToRgb(branding.accentColor);

      // Color palette
      const COLORS = {
        primary: primaryRGB,
        secondary: secondaryRGB,
        accent: accentRGB,
        success: [34, 197, 94],
        warning: [245, 158, 11],
        danger: [239, 68, 68],
        darkGray: [51, 65, 85],
        lightGray: [148, 163, 184],
        background: [248, 250, 252]
      };

      const FONTS = {
        title: { size: 16, style: 'bold' },
        header: { size: 14, style: 'bold' },
        subheader: { size: 12, style: 'bold' },
        body: { size: 10, style: 'normal' },
        caption: { size: 8, style: 'normal' }
      };

      const checkNewPage = (requiredSpace = 20) => {
        if (yPos + requiredSpace > 280) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Helper for professional section headers
      const addProfessionalSection = (title, level = 1) => {
        checkNewPage(25);
        
        if (level === 1) {
          // Major section - full width colored band
          doc.setFillColor(...COLORS.primary);
          doc.rect(15, yPos - 5, 180, 10, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(FONTS.header.size);
          doc.setFont(undefined, FONTS.header.style);
          doc.text(title.toUpperCase(), 20, yPos + 2);
          doc.setTextColor(...COLORS.darkGray);
          yPos += 15;
        } else {
          // Subsection - left accent line
          doc.setDrawColor(...COLORS.primary);
          doc.setLineWidth(2);
          doc.line(15, yPos - 2, 15, yPos + 5);
          doc.setTextColor(...COLORS.primary);
          doc.setFontSize(FONTS.subheader.size);
          doc.setFont(undefined, FONTS.subheader.style);
          doc.text(title, 20, yPos + 2);
          doc.setTextColor(...COLORS.darkGray);
          yPos += 10;
        }
      };

      // Helper for metric boxes
      const addMetricBox = (label, value, color = COLORS.primary, x = 20, width = 43) => {
        // Light background
        doc.setFillColor(...color, 25); // 25 = ~10% opacity
        doc.roundedRect(x, yPos, width, 12, 2, 2, "F");
        
        doc.setFontSize(FONTS.caption.size);
        doc.setTextColor(...COLORS.lightGray);
        doc.text(label, x + 3, yPos + 5);
        
        doc.setFontSize(FONTS.subheader.size);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...color);
        doc.text(value, x + 3, yPos + 10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...COLORS.darkGray);
      };

      // Helper for covenant chart
      const addCovenantChart = (yStartPos) => {
        const base = projections?.base || {};
        const minDSCR = base.creditStats?.minDSCR || 0;
        const maxLeverage = base.creditStats?.maxLeverage || 0;
        const minICR = base.creditStats?.minICR || 0;

        const chartData = [
          { 
            covenant: 'DSCR', 
            current: minDSCR, 
            threshold: params.minDSCR || 1.2, 
            headroom: minDSCR - (params.minDSCR || 1.2),
            isMax: false
          },
          { 
            covenant: 'Leverage', 
            current: maxLeverage, 
            threshold: params.maxNDToEBITDA || 3.5, 
            headroom: (params.maxNDToEBITDA || 3.5) - maxLeverage,
            isMax: true
          },
          { 
            covenant: 'ICR', 
            current: minICR, 
            threshold: params.targetICR || 2.0, 
            headroom: minICR - (params.targetICR || 2.0),
            isMax: false
          }
        ];

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...COLORS.primary);
        doc.text("Covenant Compliance & Headroom", 20, yStartPos);
        doc.setTextColor(...COLORS.darkGray);
        
        let chartY = yStartPos + 8;
        chartData.forEach(item => {
          const headroomPercent = item.isMax 
            ? (item.headroom / item.threshold) * 100
            : (item.headroom / item.threshold) * 100;
          const barWidth = Math.max(Math.min(headroomPercent * 1.2, 120), 5);
          const color = item.headroom > (item.threshold * 0.2) 
            ? COLORS.success 
            : item.headroom > 0 
              ? COLORS.warning 
              : COLORS.danger;
          
          // Draw bar
          doc.setFillColor(...color);
          doc.roundedRect(85, chartY - 3, barWidth, 6, 1, 1, 'F');
          
          // Label and value
          doc.setFontSize(9);
          doc.setFont(undefined, 'bold');
          doc.text(`${item.covenant}:`, 20, chartY + 1);
          doc.setFont(undefined, 'normal');
          doc.text(`${numFmt(item.current)} vs ${numFmt(item.threshold)} (${item.headroom > 0 ? '+' : ''}${numFmt(item.headroom)} headroom)`, 45, chartY + 1);
          
          chartY += 10;
        });
        
        return chartY + 5;
      };

      // ============================================================================
      // COVER PAGE
      // ============================================================================
      doc.setFillColor(...COLORS.primary);
      doc.rect(0, 0, 210, 100, "F");
      
      // Add logo if available
      if (branding.logoDataUrl) {
        try {
          doc.addImage(branding.logoDataUrl, 'PNG', 15, 10, 40, 20, undefined, 'FAST');
        } catch (err) {
          console.warn("Could not add logo to PDF:", err);
        }
      }
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text("CONFIDENTIAL", 105, 20, { align: "center" });
      
      doc.setFontSize(26);
      doc.setFont(undefined, 'bold');
      doc.text("CREDIT COMMITTEE MEMORANDUM", 105, 45, { align: "center" });
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'normal');
      doc.text(params.companyLegalName || "Borrower Name", 105, 60, { align: "center" });
      
      // Recommendation badge
      doc.setFontSize(14);
      const rec = determineRecommendation(projections?.base || {}, params);
      const recColor = rec.decision.includes('APPROVE') && !rec.decision.includes('CONDITIONS') 
        ? COLORS.success 
        : rec.decision.includes('DECLINE') 
          ? COLORS.danger 
          : COLORS.warning;
      doc.setTextColor(...recColor);
      doc.text(rec.decision, 105, 75, { align: "center" });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`${currencyFmtMM(params.requestedLoanAmount, ccy)} ${params.dealStructure || 'Term Facility'}`, 105, 85, { align: "center" });

      // Transaction summary box
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 100, 210, 197, "F");
      
      doc.setFillColor(...COLORS.background);
      doc.roundedRect(20, 120, 170, 50, 3, 3, "F");
      
      doc.setTextColor(...COLORS.darkGray);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text("TRANSACTION SUMMARY", 25, 130);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      const coverDetails = [
        [`Facility Type:`, params.dealStructure || "Senior Secured Term Loan"],
        [`Requested Amount:`, currencyFmtMM(params.requestedLoanAmount, ccy)],
        [`Proposed Tenor:`, `${params.proposedTenor} years`],
        [`Pricing:`, `${pctFmt(params.proposedPricing)} per annum`],
        [`Purpose:`, (params.loanPurpose || "General corporate purposes").substring(0, 50)],
        [`Report Date:`, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
      ];
      
      let detailY = 140;
      coverDetails.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, 25, detailY);
        doc.setFont(undefined, 'normal');
        const valueLines = doc.splitTextToSize(value, 110);
        doc.text(valueLines, 75, detailY);
        detailY += Math.max(5, valueLines.length * 5);
      });

      // Disclaimer
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.lightGray);
      const disclaimer = "This memorandum is confidential and intended solely for use by the Credit Committee. The information contained herein is proprietary and may not be reproduced or distributed without prior written consent.";
      const disclaimerLines = doc.splitTextToSize(disclaimer, 170);
      doc.text(disclaimerLines, 105, 280, { align: "center" });

      // ============================================================================
      // PAGE 2 - EXECUTIVE SUMMARY
      // ============================================================================
      doc.addPage();
      yPos = 25;

      addProfessionalSection("EXECUTIVE SUMMARY", 1);
      
      // Key Metrics Dashboard
      const base = projections?.base || {};
      addMetricBox("Enterprise Value", currencyFmtMM(base.enterpriseValue || 0, ccy), COLORS.primary, 20, 43);
      addMetricBox("Equity IRR", pctFmt(base.irr || 0), COLORS.secondary, 68, 43);
      addMetricBox("Min DSCR", numFmt(base.creditStats?.minDSCR || 0), 
        base.creditStats?.minDSCR >= (params.minDSCR || 1.2) ? COLORS.success : COLORS.danger, 116, 43);
      addMetricBox("Max Leverage", `${numFmt(base.creditStats?.maxLeverage || 0)}x`, 
        base.creditStats?.maxLeverage <= (params.maxNDToEBITDA || 3.5) ? COLORS.success : COLORS.warning, 164, 43);
      
      yPos += 20;

      // Executive summary text
      doc.setFontSize(FONTS.body.size);
      doc.setFont(undefined, 'normal');
      const summaryText = generateExecutiveSummary();
      const summaryLines = doc.splitTextToSize(summaryText, 170);
      doc.text(summaryLines, 20, yPos);
      yPos += summaryLines.length * 5 + 15;

      // RECOMMENDATION BOX
      checkNewPage(35);
      doc.setFillColor(...recColor, 25);
      doc.roundedRect(20, yPos, 170, 30, 3, 3, "F");
      doc.setDrawColor(...recColor);
      doc.setLineWidth(1);
      doc.roundedRect(20, yPos, 170, 30, 3, 3, "S");
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...recColor);
      doc.text("RECOMMENDATION", 25, yPos + 8);
      
      doc.setFontSize(16);
      doc.text(rec.decision, 25, yPos + 17);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...COLORS.darkGray);
      const recLines = doc.splitTextToSize(rec.rationale, 160);
      doc.text(recLines, 25, yPos + 24);
      
      yPos += 40;

      // ============================================================================
      // COVENANT ANALYSIS WITH CHART
      // ============================================================================
      if (selectedSections.covenantAnalysis) {
        checkNewPage(50);
        yPos = addCovenantChart(yPos);
      }

      // ============================================================================
      // REMAINING SECTIONS
      // ============================================================================
      const addContentSection = (title, content) => {
        if (!content) return;
        checkNewPage(30);
        addProfessionalSection(title, 1);
        doc.setFontSize(FONTS.body.size);
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(content, 170);
        doc.text(lines, 20, yPos);
        yPos += lines.length * 5 + 15;
      };

      // Historical Performance
      if (selectedSections.historicalPerformance && aiGeneratedContent.historicalPerformance) {
        addContentSection("HISTORICAL PERFORMANCE ANALYSIS", aiGeneratedContent.historicalPerformance);
      }

      // Industry Benchmarking
      if (selectedSections.industryBenchmarking && aiGeneratedContent.industryBenchmarking) {
        addContentSection("INDUSTRY & PEER BENCHMARKING", aiGeneratedContent.industryBenchmarking);
      }

      // Business Analysis
      if (selectedSections.businessAnalysis) {
        const businessContent = aiGeneratedContent.businessAnalysis || `
BUSINESS MODEL & OPERATIONS
${params.businessModel || "No business model description provided."}

PRODUCTS & SERVICES
${params.productsServices || "No product/service details provided."}

MARKET POSITION
${params.competitivePosition || "No competitive analysis provided."}

CUSTOMER BASE
${params.keyCustomers || "No customer concentration analysis provided."}`;
        addContentSection("BUSINESS ANALYSIS", businessContent);
      }

      // Credit Analysis
      if (selectedSections.creditAnalysis) {
        addContentSection("CREDIT ANALYSIS", aiGeneratedContent.creditAnalysis || "No credit analysis generated.");
      }

      // Collateral Analysis
      if (selectedSections.collateralAnalysis && aiGeneratedContent.collateralAnalysis) {
        addContentSection("COLLATERAL & SECURITY ANALYSIS", aiGeneratedContent.collateralAnalysis);
      }

      // Sensitivity Analysis
      if (selectedSections.sensitivityAnalysis && aiGeneratedContent.sensitivityAnalysis) {
        addContentSection("SENSITIVITY & STRESS ANALYSIS", aiGeneratedContent.sensitivityAnalysis);
      }

      // Refinancing Risk
      if (selectedSections.refinancingRisk && aiGeneratedContent.refinancingRisk) {
        addContentSection("REFINANCING & EXIT RISK", aiGeneratedContent.refinancingRisk);
      }

      // ESG & Regulatory
      if (selectedSections.esgAndRegulatory && aiGeneratedContent.esgAndRegulatory) {
        addContentSection("ESG & REGULATORY RISK ASSESSMENT", aiGeneratedContent.esgAndRegulatory);
      }

      // Risk Assessment
      if (aiGeneratedContent.riskAssessment) {
        addContentSection("KEY CREDIT RISKS", aiGeneratedContent.riskAssessment);
      }

      // Scenario Analysis
      if (selectedSections.stressTestResults && aiGeneratedContent.scenarioAnalysis) {
        addContentSection("SCENARIO ANALYSIS", aiGeneratedContent.scenarioAnalysis);
      }

      // Financial Projections Table
      if (selectedSections.financialProjections && base.rows) {
        checkNewPage(60);
        addProfessionalSection("FINANCIAL PROJECTIONS", 1);
        
        const tableData = [["Year", "Revenue", "EBITDA", "DSCR", "Leverage", "ICR"]];
        base.rows.forEach(row => {
          tableData.push([
            `Y${row.year}`,
            currencyFmtMM(row.revenue || 0, ccy),
            currencyFmtMM(row.ebitda || 0, ccy),
            numFmt(row.dscr || 0),
            `${numFmt(row.ndToEbitda || 0)}x`,
            `${numFmt(row.icr || 0)}x`
          ]);
        });

        doc.autoTable({
          startY: yPos,
          head: [tableData[0]],
          body: tableData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { fontStyle: 'bold', halign: 'center' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' }
          }
        });
        
        yPos = doc.lastAutoTable.finalY + 15;
      }

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.lightGray);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 190, 290, { align: "right" });
      }

      doc.save(`Credit_Memo_${params.companyLegalName?.replace(/\s+/g, '_') || 'Company'}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Error generating PDF. Please check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  // Generate Term Sheet PDF
  const generateTermSheet = () => {
    if (!validateReportData()) return;
    
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      let yPos = 20;

      const primaryRGB = hexToRgb(branding.primaryColor);

      const checkNewPage = (requiredSpace = 20) => {
        if (yPos + requiredSpace > 280) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Header with branding
      doc.setFillColor(...primaryRGB);
      doc.rect(0, 0, 210, 50, "F");
      
      // Logo
      if (branding.logoDataUrl) {
        try {
          doc.addImage(branding.logoDataUrl, 'PNG', 15, 8, 35, 17, undefined, 'FAST');
        } catch (err) {
          console.warn("Could not add logo:", err);
        }
      }
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text("INDICATIVE TERM SHEET", 105, 18, { align: "center" });
      doc.setFontSize(16);
      doc.text(termSheetFields.issuer, 105, 28, { align: "center" });
      doc.setFontSize(12);
      doc.text(termSheetFields.facilityType, 105, 36, { align: "center" });
      
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(`${termSheetFields.currency} ${numFmt(termSheetFields.raiseAmount / 1000000)}M`, 105, 45, { align: "center" });
      
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(220, 220, 220);
      const disclaimer = "This Indicative Term Sheet is for discussion purposes only and does not constitute an offer. Terms subject to final approval and documentation.";
      const disclaimerLines = doc.splitTextToSize(disclaimer, 180);
      doc.text(disclaimerLines, 105, 54, { align: "center" });

      doc.setTextColor(0, 0, 0);
      yPos = 68;

      // Transaction Details
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("TRANSACTION DETAILS", 20, yPos);
      yPos += 8;

      const basicInfo = [
        ["Issuer:", termSheetFields.issuer],
        ["Arranger:", termSheetFields.arranger],
        ["Trustee:", termSheetFields.trustee],
        ["Facility Type:", termSheetFields.facilityType],
        ["Currency:", termSheetFields.currency],
        ["Amount:", `${termSheetFields.currency} ${currencyFmtMM(termSheetFields.raiseAmount, ccy)}`],
        ["Distribution:", termSheetFields.distribution],
        ["Use of Proceeds:", termSheetFields.useOfProceeds],
      ];

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      basicInfo.forEach(([label, value]) => {
        checkNewPage(10);
        doc.setFont(undefined, 'bold');
        doc.text(label, 20, yPos);
        doc.setFont(undefined, 'normal');
        const valueLines = doc.splitTextToSize(value, 115);
        doc.text(valueLines, 85, yPos);
        yPos += Math.max(5, valueLines.length * 5) + 3;
      });

      // Terms
      checkNewPage(20);
      yPos += 5;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("TERMS", 20, yPos);
      yPos += 8;

      const terms = [
        ["Tenure:", `${termSheetFields.tenure} years`],
        ["Opening Date:", termSheetFields.openingDate],
        ["Issue Date:", termSheetFields.issueDate],
        ["Maturity Date:", termSheetFields.maturityDate],
        ["Coupon:", `${numFmt(termSheetFields.coupon)}% per annum`],
        ["Coupon Frequency:", termSheetFields.couponFrequency],
        ["Accrual Basis:", termSheetFields.accrualBasis],
        ["Principal Repayment:", termSheetFields.principalRepayment],
        ["Prepayment:", termSheetFields.principalPrepayment],
        ["Default Rate:", termSheetFields.defaultRate],
      ];

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      terms.forEach(([label, value]) => {
        checkNewPage(10);
        doc.setFont(undefined, 'bold');
        doc.text(label, 20, yPos);
        doc.setFont(undefined, 'normal');
        const valueLines = doc.splitTextToSize(value, 115);
        doc.text(valueLines, 85, yPos);
        yPos += Math.max(5, valueLines.length * 5) + 3;
      });

      // Security Package
      checkNewPage(30);
      yPos += 5;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("SECURITY PACKAGE", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const securityLines = doc.splitTextToSize(termSheetFields.securityDescription, 170);
      doc.text(securityLines, 20, yPos);
      yPos += securityLines.length * 5 + 10;

      // Financial Covenants
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("FINANCIAL COVENANTS", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const covenantLines = doc.splitTextToSize(termSheetFields.financialCovenants, 170);
      doc.text(covenantLines, 20, yPos);
      yPos += covenantLines.length * 5 + 10;

      // Positive Covenants
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("POSITIVE COVENANTS", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const positiveLines = doc.splitTextToSize(termSheetFields.positiveCovenants, 170);
      doc.text(positiveLines, 20, yPos);
      yPos += positiveLines.length * 5 + 10;

      // Negative Covenants
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("NEGATIVE COVENANTS", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const negativeLines = doc.splitTextToSize(termSheetFields.negativeCovenants, 170);
      doc.text(negativeLines, 20, yPos);
      yPos += negativeLines.length * 5 + 10;

      // Conditions Precedent
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("CONDITIONS PRECEDENT", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const cpLines = doc.splitTextToSize(termSheetFields.conditionsPrecedent, 170);
      doc.text(cpLines, 20, yPos);
      yPos += cpLines.length * 5 + 10;

      // Reporting Requirements
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("REPORTING REQUIREMENTS", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const reportingLines = doc.splitTextToSize(termSheetFields.reportingRequirements, 170);
      doc.text(reportingLines, 20, yPos);
      yPos += reportingLines.length * 5 + 10;

      // Events of Default
      checkNewPage(30);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("EVENTS OF DEFAULT", 20, yPos);
      yPos += 8;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const eodLines = doc.splitTextToSize(termSheetFields.eventsOfDefault, 170);
      doc.text(eodLines, 20, yPos);
      yPos += eodLines.length * 5 + 10;

      // Fees and Expenses
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryRGB);
      doc.text("FEES AND EXPENSES", 20, yPos);
      yPos += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      const feeData = [
        ["Arrangement Fee:", `${numFmt(termSheetFields.arrangementFeePercent)}% (${currencyFmtMM(calculatedFees.arrangementFee, ccy)})`],
        ["Commitment Fee:", `${numFmt(termSheetFields.commitmentFeePercent)}% (${currencyFmtMM(calculatedFees.commitmentFee, ccy)})`],
        ["Legal Costs (Est.):", `${numFmt(termSheetFields.legalCostEstimatePercent)}% (${currencyFmtMM(calculatedFees.legalCosts, ccy)})`],
        ["Total Estimated Fees:", currencyFmtMM(calculatedFees.totalFees, ccy)],
      ];

      feeData.forEach(([label, value]) => {
        checkNewPage(7);
        doc.setFont(undefined, 'bold');
        doc.text(label, 20, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(value, 85, yPos);
        yPos += 7;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 290, { align: "center" });

      doc.save(`Term_Sheet_${termSheetFields.issuer.replace(/\s+/g, '_')}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Error generating PDF. Please check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  // Generate Excel with comprehensive data
  const generateExcel = () => {
    if (!validateReportData()) return;
    
    setIsExporting(true);
    
    try {
      const wb = XLSX.utils.book_new();

      // Executive Summary
      if (selectedSections.executiveSummary) {
        const summaryData = [
          ["CREDIT COMMITTEE REPORT - EXECUTIVE SUMMARY"],
          ["Generated", new Date().toLocaleDateString()],
          [],
          ["COMPANY INFORMATION"],
          ["Legal Name", params.companyLegalName || "N/A"],
          ["Operating Name", params.companyOperatingName || "N/A"],
          ["Industry", params.industry || "N/A"],
          ["Business Age", `${params.businessAge || 0} years`],
          ["Credit History", params.creditHistory || "N/A"],
          [],
          ["TRANSACTION DETAILS"],
          ["Requested Amount", params.requestedLoanAmount || 0],
          ["Tenor", `${params.proposedTenor || 0} years`],
          ["Interest Rate", params.proposedPricing || 0],
          ["Structure", params.dealStructure || "N/A"],
          ["Purpose", params.loanPurpose || "N/A"],
          [],
          ["FINANCIAL METRICS (BASE CASE)"],
          ["Enterprise Value", projections?.base?.enterpriseValue || 0],
          ["Equity Value", projections?.base?.equityValue || 0],
          ["Equity MOIC", projections?.base?.moic || 0],
          ["Equity IRR", projections?.base?.irr || 0],
          ["Min DSCR", projections?.base?.creditStats?.minDSCR || 0],
          ["Max Leverage", projections?.base?.creditStats?.maxLeverage || 0],
          ["Min ICR", projections?.base?.creditStats?.minICR || 0],
          [],
          ["COVENANT COMPLIANCE"],
          ["DSCR Requirement", params.minDSCR || 1.2],
          ["DSCR Cushion", (projections?.base?.creditStats?.minDSCR || 0) - (params.minDSCR || 1.2)],
          ["Leverage Limit", params.maxNDToEBITDA || 3.5],
          ["Leverage Cushion", (params.maxNDToEBITDA || 3.5) - (projections?.base?.creditStats?.maxLeverage || 0)],
          ["Total Breaches", (projections?.base?.breaches?.dscrBreaches || 0) + (projections?.base?.breaches?.icrBreaches || 0) + (projections?.base?.breaches?.ndBreaches || 0)],
        ];

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        ws['!cols'] = [{ wch: 25 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, ws, "Executive Summary");
      }

      // Detailed Projections
      if (selectedSections.financialProjections && projections?.base?.rows) {
        const projectionData = [
          ["YEAR", "REVENUE", "EBITDA", "DEBT SERVICE", "DSCR", "ND/EBITDA", "ICR", "ENDING DEBT", "CASH BALANCE"]
        ];
        
        projections.base.rows.forEach(row => {
          projectionData.push([
            row.year,
            row.revenue || 0,
            row.ebitda || 0,
            row.debtService || 0,
            row.dscr || 0,
            row.ndToEbitda || 0,
            row.icr || 0,
            row.endingDebt || 0,
            row.cashBalance || 0
          ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(projectionData);
        ws['!cols'] = Array(9).fill({ wch: 15 });
        XLSX.utils.book_append_sheet(wb, ws, "Financial Projections");
      }

      // Scenario Comparison
      if (projections && Object.keys(projections).length > 1) {
        const scenarioData = [
          ["SCENARIO", "IRR", "MOIC", "MIN DSCR", "MAX LEVERAGE", "BREACHES"]
        ];
        
        Object.entries(projections).forEach(([scenario, proj]) => {
          scenarioData.push([
            scenario,
            proj.irr || 0,
            proj.moic || 0,
            proj.creditStats?.minDSCR || 0,
            proj.creditStats?.maxLeverage || 0,
            (proj.breaches?.dscrBreaches || 0) + (proj.breaches?.icrBreaches || 0) + (proj.breaches?.ndBreaches || 0)
          ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(scenarioData);
        ws['!cols'] = Array(6).fill({ wch: 18 });
        XLSX.utils.book_append_sheet(wb, ws, "Scenario Comparison");
      }

      // AI Analysis (if available)
      if (Object.keys(aiGeneratedContent).length > 0) {
        const aiData = [["AI-GENERATED ANALYSIS"], []];
        
        Object.entries(aiGeneratedContent).forEach(([section, content]) => {
          aiData.push([section.toUpperCase()]);
          aiData.push([content]);
          aiData.push([]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(aiData);
        ws['!cols'] = [{ wch: 100 }];
        XLSX.utils.book_append_sheet(wb, ws, "AI Analysis");
      }

      XLSX.writeFile(
        wb,
        `Credit_Report_${params.companyLegalName?.replace(/\s+/g, '_') || 'Company'}_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error) {
      console.error("Excel Generation Error:", error);
      alert("Error generating Excel file. Please check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  // Enhanced recommendation with qualitative factors
  const determineRecommendation = (projection, params) => {
    if (!projection || !params) {
      return {
        decision: "INSUFFICIENT DATA",
        summary: "Unable to determine recommendation",
        rationale: "Insufficient projection or parameter data",
        color: [156, 163, 175]
      };
    }

    const minDSCR = projection.creditStats?.minDSCR || 0;
    const maxLeverage = projection.creditStats?.maxLeverage || 0;
    const totalBreaches = (projection.breaches?.dscrBreaches || 0) +
                         (projection.breaches?.icrBreaches || 0) +
                         (projection.breaches?.ndBreaches || 0);
    const irr = projection.irr || 0;
    const moic = projection.moic || 0;

    // Get total debt for collateral comparison - FIXED
    const debtInfo = getTotalDebt(params, projection);
    const totalDebt = debtInfo.total || 0;

    const strongManagement = params.managementExperience === "Exceptional" || params.managementExperience === "Strong";
    const cleanCreditHistory = params.creditHistory === "Excellent" || params.creditHistory === "Clean";

    // FIXED: Compare collateral against TOTAL debt, not just requestedLoanAmount
    // Also add safety check for zero/undefined values
    const collateralValue = params.collateralValue || 0;
    const adequateCollateral = collateralValue > 0 && totalDebt > 0
      ? collateralValue >= totalDebt * 1.5
      : false;

    const establishedBusiness = (params.businessAge || 0) >= 5;

    // Calculate LTV for reporting
    const ltv = calculateLTV(totalDebt, collateralValue);

    if (totalBreaches > 0) {
      return {
        decision: "DECLINE",
        summary: "Covenant breaches identified - unacceptable credit risk",
        rationale: `Analysis shows ${totalBreaches} covenant breach(es). Total debt ${currencyFmtMM(totalDebt, ccy)}. Recommend decline or significant restructuring.`,
        color: [239, 68, 68]
      };
    }

    if (minDSCR < (params.minDSCR || 1.2)) {
      if (strongManagement && adequateCollateral && establishedBusiness) {
        return {
          decision: "CONDITIONAL APPROVAL",
          summary: "Weak DSCR offset by strong qualitative factors - approve with enhanced monitoring",
          rationale: `DSCR of ${numFmt(minDSCR)}x is below covenant but strong collateral coverage (LTV ${ltv !== null ? numFmt(ltv) : 'N/A'}%) and ${params.businessAge}+ years of operations provide comfort. Total debt: ${currencyFmtMM(totalDebt, ccy)}.`,
          color: [245, 158, 11]
        };
      }
      return {
        decision: "DECLINE",
        summary: "Insufficient debt service coverage with weak fundamentals",
        rationale: `DSCR of ${numFmt(minDSCR)}x below minimum ${numFmt(params.minDSCR || 1.2)}x without offsetting strengths. Total debt: ${currencyFmtMM(totalDebt, ccy)}.`,
        color: [239, 68, 68]
      };
    }

    const strongCushion = minDSCR >= (params.minDSCR || 1.2) + 0.3;
    const conservativeLeverage = maxLeverage <= (params.maxNDToEBITDA || 3.5) - 0.5;
    const strongReturns = irr > 0.15 && moic > 2.0;

    if (strongCushion && conservativeLeverage && strongReturns) {
      return {
        decision: "APPROVE",
        summary: `Excellent credit profile - strong recommendation${strongManagement && cleanCreditHistory ? ' with superior management' : ''}`,
        rationale: `DSCR ${numFmt(minDSCR)}x (cushion: ${numFmt(minDSCR - (params.minDSCR || 1.2))}x), Leverage ${numFmt(maxLeverage)}x, IRR ${pctFmt(irr)}. Total debt: ${currencyFmtMM(totalDebt, ccy)}. ${strongManagement ? 'Exceptional management team.' : ''}`,
        color: [34, 197, 94]
      };
    }

    if (strongCushion || (conservativeLeverage && cleanCreditHistory)) {
      return {
        decision: "APPROVE",
        summary: "Sound credit metrics with adequate protection",
        rationale: `Acceptable risk profile with DSCR ${numFmt(minDSCR)}x, Leverage ${numFmt(maxLeverage)}x. Total debt: ${currencyFmtMM(totalDebt, ccy)}. ${adequateCollateral ? `Strong collateral coverage (LTV ${ltv !== null ? numFmt(ltv) : 'N/A'}%).` : ''}`,
        color: [34, 197, 94]
      };
    }

    return {
      decision: "APPROVE WITH CONDITIONS",
      summary: "Marginal metrics - approve with enhanced monitoring and conditions",
      rationale: `DSCR ${numFmt(minDSCR)}x provides limited cushion. Total debt: ${currencyFmtMM(totalDebt, ccy)}. Recommend quarterly monitoring and tighter covenants.`,
      color: [59, 130, 246]
    };
  };

  return (
    <div className="space-y-6">
      {/* Branding Section */}
      <Card className="border-l-4 border-l-purple-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader 
  className="bg-gradient-to-r from-purple-50 to-pink-50 border-b"
>
  <CardTitle 
    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
    onClick={() => toggleSection('branding')}  // 👈 MOVED HERE!
  >
    <Palette className="w-6 h-6 text-purple-600" />
    Report Branding & Customization
    {/* Arrow */}
    <span className="ml-auto">
      {sectionStates.branding ? (
        <ChevronUp className="w-5 h-5 text-purple-600" />
      ) : (
        <ChevronDown className="w-5 h-5 text-purple-600" />
      )}
    </span>
  </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Upload your company logo and select brand colors to customize all exported reports
          </p>
        </CardHeader>
  {sectionStates.branding && (
    <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-800">Company Logo</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                {branding.logoDataUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <img 
                        src={branding.logoDataUrl} 
                        alt="Company Logo" 
                        className="max-h-20 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => logoInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        leftIcon={Upload}
                        className="flex-1"
                      >
                        Change Logo
                      </Button>
                      <Button
                        onClick={removeLogo}
                        variant="outline"
                        size="sm"
                        leftIcon={X}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="text-center cursor-pointer py-6"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 font-medium">Click to upload logo</p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 2MB</p>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-slate-500">
                Your logo will appear on all PDF reports and term sheets
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-800">Brand Colors</Label>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="primaryColor" className="text-xs text-slate-600 mb-1 block">
                    Primary Color (Headers & Accents)
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="primaryColor"
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <Input
                      value={branding.primaryColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="flex-1 font-mono text-sm"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondaryColor" className="text-xs text-slate-600 mb-1 block">
                    Secondary Color (Highlights)
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="secondaryColor"
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <Input
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="flex-1 font-mono text-sm"
                      placeholder="#10B981"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accentColor" className="text-xs text-slate-600 mb-1 block">
                    Accent Color (Charts & Emphasis)
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="accentColor"
                      type="color"
                      value={branding.accentColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="w-16 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <Input
                      value={branding.accentColor}
                      onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                      className="flex-1 font-mono text-sm"
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Preview</p>
                <div className="flex gap-2">
                  <div 
                    className="w-12 h-12 rounded shadow-sm border border-slate-200"
                    style={{ backgroundColor: branding.primaryColor }}
                  />
                  <div 
                    className="w-12 h-12 rounded shadow-sm border border-slate-200"
                    style={{ backgroundColor: branding.secondaryColor }}
                  />
                  <div 
                    className="w-12 h-12 rounded shadow-sm border border-slate-200"
                    style={{ backgroundColor: branding.accentColor }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}   
      {/* 👆 See? Closing ) and then } */}
    </Card>
      {/* AI Analysis Assistant */}
      <Card className="border-l-4 border-l-indigo-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-600" />
            AI Credit Analysis Assistant
            <span className="ml-auto text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold border border-indigo-200">
              Powered by FinAssist
            </span>
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Generate intelligent credit analysis using AI - maintains professional Credit Committee tone
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* API Key Status */}
          {!accessToken && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>Login Required:</strong> Please log in to enable AI analysis features.
              </div>
            </div>
          )}

          {/* AI Generation Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            <Button 
              onClick={() => generateAIAnalysis('executiveSummary')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs"
            >
              {isGeneratingAI ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Executive
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('historicalPerformance')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Historical
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('creditAnalysis')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Credit
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('collateralAnalysis')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Collateral
            </Button>

            <Button 
              onClick={() => generateAIAnalysis('sensitivityAnalysis')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              Sensitivity
            </Button>

            <Button 
              onClick={() => generateAIAnalysis('recommendation')}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Recommendation
            </Button>

            <Button 
              onClick={generateAllAIContent}
              disabled={isGeneratingAI || !accessToken}
              className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white text-xs font-semibold"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Generate All
            </Button>
          </div>

          {/* Error Display */}
          {aiError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-red-800 font-semibold">AI Generation Error</div>
                <div className="text-xs text-red-700 mt-1">{aiError}</div>
              </div>
              <Button
                onClick={() => setAiError(null)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* AI Content Preview */}
          {Object.keys(aiGeneratedContent).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  AI-Generated Analysis ({Object.keys(aiGeneratedContent).length} sections)
                </h4>
                <Button
                  onClick={() => setShowAIPreview(!showAIPreview)}
                  variant="outline"
                  size="sm"
                  leftIcon={Eye}
                >
                  {showAIPreview ? 'Hide' : 'Show'} Preview
                </Button>
              </div>

              {showAIPreview && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(aiGeneratedContent).map(([section, content]) => (
                    <div key={section} className="p-4 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-sm text-slate-800 capitalize">
                          {section.replace(/([A-Z])/g, ' $1').trim()}
                        </h5>
                        <Button
                          onClick={() => copyAIContent(content)}
                          variant="ghost"
                          size="sm"
                          leftIcon={Copy}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Copy
                        </Button>
                      </div>
                      <ReactMarkdown className="text-xs text-slate-700 prose prose-sm max-w-none">
  {content}
</ReactMarkdown>

                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-xs text-emerald-700">
                  <Check className="w-4 h-4 inline mr-1" />
                  AI content will be automatically included in exported reports. All content uses professional Credit Committee tone.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Term Sheet Editor */}
      <Card className="border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Term Sheet Editor
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Customize term sheet provisions, covenants, and commercial terms
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Basic Info & Terms */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="issuer" className="text-sm font-semibold text-slate-700">Issuer</Label>
                <Input
                  id="issuer"
                  value={termSheetFields.issuer}
                  onChange={(e) => updateTermSheetField('issuer', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="facilityType" className="text-sm font-semibold text-slate-700">Facility Type</Label>
                <Input
                  id="facilityType"
                  value={termSheetFields.facilityType}
                  onChange={(e) => updateTermSheetField('facilityType', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coupon" className="text-sm font-semibold text-slate-700">Coupon (%)</Label>
                  <Input
                    id="coupon"
                    type="number"
                    step="0.01"
                    value={termSheetFields.coupon}
                    onChange={(e) => updateTermSheetField('coupon', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="tenure" className="text-sm font-semibold text-slate-700">Tenure (years)</Label>
                  <Input
                    id="tenure"
                    type="number"
                    value={termSheetFields.tenure}
                    onChange={(e) => updateTermSheetField('tenure', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="useOfProceeds" className="text-sm font-semibold text-slate-700">Use of Proceeds</Label>
                <textarea
                  id="useOfProceeds"
                  value={termSheetFields.useOfProceeds}
                  onChange={(e) => updateTermSheetField('useOfProceeds', e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="securityDescription" className="text-sm font-semibold text-slate-700">Security Package</Label>
                <textarea
                  id="securityDescription"
                  value={termSheetFields.securityDescription}
                  onChange={(e) => updateTermSheetField('securityDescription', e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="financialCovenants" className="text-sm font-semibold text-slate-700">Financial Covenants</Label>
                <textarea
                  id="financialCovenants"
                  value={termSheetFields.financialCovenants}
                  onChange={(e) => updateTermSheetField('financialCovenants', e.target.value)}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>
            </div>

            {/* Right Column - Covenants & Conditions */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="positiveCovenants" className="text-sm font-semibold text-slate-700">Positive Covenants</Label>
                <textarea
                  id="positiveCovenants"
                  value={termSheetFields.positiveCovenants}
                  onChange={(e) => updateTermSheetField('positiveCovenants', e.target.value)}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>

              <div>
                <Label htmlFor="negativeCovenants" className="text-sm font-semibold text-slate-700">Negative Covenants</Label>
                <textarea
                  id="negativeCovenants"
                  value={termSheetFields.negativeCovenants}
                  onChange={(e) => updateTermSheetField('negativeCovenants', e.target.value)}
                  rows={5}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>

              <div>
                <Label htmlFor="conditionsPrecedent" className="text-sm font-semibold text-slate-700">Conditions Precedent</Label>
                <textarea
                  id="conditionsPrecedent"
                  value={termSheetFields.conditionsPrecedent}
                  onChange={(e) => updateTermSheetField('conditionsPrecedent', e.target.value)}
                  rows={6}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>

              <div>
                <Label htmlFor="eventsOfDefault" className="text-sm font-semibold text-slate-700">Events of Default</Label>
                <textarea
                  id="eventsOfDefault"
                  value={termSheetFields.eventsOfDefault}
                  onChange={(e) => updateTermSheetField('eventsOfDefault', e.target.value)}
                  rows={6}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Fees Section */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-sm mb-4 text-slate-800">Fees & Expenses</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="arrangementFee" className="text-xs font-semibold text-slate-700">Arrangement Fee %</Label>
                <Input
                  id="arrangementFee"
                  type="number"
                  step="0.1"
                  value={termSheetFields.arrangementFeePercent}
                  onChange={(e) => updateTermSheetField('arrangementFeePercent', parseFloat(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="commitmentFee" className="text-xs font-semibold text-slate-700">Commitment Fee %</Label>
                <Input
                  id="commitmentFee"
                  type="number"
                  step="0.1"
                  value={termSheetFields.commitmentFeePercent}
                  onChange={(e) => updateTermSheetField('commitmentFeePercent', parseFloat(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="legalCost" className="text-xs font-semibold text-slate-700">Legal Costs %</Label>
                <Input
                  id="legalCost"
                  type="number"
                  step="0.1"
                  value={termSheetFields.legalCostEstimatePercent}
                  onChange={(e) => updateTermSheetField('legalCostEstimatePercent', parseFloat(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Fee Calculations */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-600">Arrangement Fee</div>
                <div className="font-bold text-slate-800">{currencyFmtMM(calculatedFees.arrangementFee, ccy)}</div>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-600">Commitment Fee</div>
                <div className="font-bold text-slate-800">{currencyFmtMM(calculatedFees.commitmentFee, ccy)}</div>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <div className="text-slate-600">Legal Costs</div>
                <div className="font-bold text-slate-800">{currencyFmtMM(calculatedFees.legalCosts, ccy)}</div>
              </div>
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <div className="text-emerald-700 font-semibold">Total Fees</div>
                <div className="font-bold text-emerald-800">{currencyFmtMM(calculatedFees.totalFees, ccy)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Generator */}
      <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Credit Committee Report Generator
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Generate comprehensive reports with financial analysis, covenant tracking, and AI insights
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Section Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-sm font-semibold text-slate-800">Report Sections</Label>
              <Button
                variant="outline"
                size="sm"
                leftIcon={CheckSquare}
                onClick={() => {
                  const allSelected = Object.values(selectedSections).every(v => v);
                  const newState = {};
                  Object.keys(selectedSections).forEach(key => {
                    newState[key] = !allSelected;
                  });
                  setSelectedSections(newState);
                }}
              >
                {Object.values(selectedSections).every(v => v) ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(selectedSections).map(([key, value]) => (
                <label 
                  key={key}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    value ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() => setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={generatePDF}
              disabled={isExporting}
              loading={isExporting}
              leftIcon={isExporting ? undefined : FileText}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              Generate PDF Report
            </Button>
            <Button
              onClick={generateExcel}
              disabled={isExporting}
              loading={isExporting}
              leftIcon={isExporting ? undefined : FileSpreadsheet}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              Generate Excel Report
            </Button>
            <Button
              onClick={generateTermSheet}
              disabled={isExporting}
              loading={isExporting}
              leftIcon={isExporting ? undefined : FileText}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              Generate Term Sheet
            </Button>
          </div>

          {/* Features Summary */}
          <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-sm mb-3 text-slate-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Report Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Executive Summary & Recommendation
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Historical Performance Analysis
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Industry Benchmarking
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Detailed Credit Metrics
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Covenant Compliance Charts
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Collateral & Security Analysis
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Sensitivity & Stress Testing
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Refinancing Risk Assessment
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-purple-600" />
                AI-Generated Insights
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-purple-600" />
                Custom Branding & Colors
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                ESG & Regulatory Assessment
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Professional PDF Layout
              </div>
            </div>
            
            {Object.keys(aiGeneratedContent).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-300">
                <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold">
                  <Sparkles className="w-3 h-3" />
                  {Object.keys(aiGeneratedContent).length} AI-generated section(s) will be included in exports
                </div>
              </div>
            )}

            {branding.logoDataUrl && (
              <div className="mt-2 pt-2 border-t border-slate-300">
                <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold">
                  <Palette className="w-3 h-3" />
                  Custom branding applied (logo + brand colors)
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
