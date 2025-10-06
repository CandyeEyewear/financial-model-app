import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { Button } from "./Button";
import { Label } from "./Label";
import { Input } from "./Input";
import { 
  FileText, Download, FileSpreadsheet, CheckSquare, Bot, Sparkles,
  AlertCircle, Check, Loader, Eye, RefreshCw, Copy
} from "lucide-react";
import { currencyFmtMM, numFmt, pctFmt } from "../utils/formatters";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// Color palette
const COLORS = {
  primary: { from: 'blue-500', to: 'blue-600', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  success: { from: 'emerald-500', to: 'emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  warning: { from: 'amber-500', to: 'amber-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  danger: { from: 'red-500', to: 'red-600', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  purple: { from: 'purple-500', to: 'purple-600', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

export function ReportGenerator({ projections, params, ccy, historicalData }) {
  const [selectedSections, setSelectedSections] = useState({
    executiveSummary: true,
    companyProfile: true,
    businessAnalysis: true,
    managementAnalysis: true,
    creditAnalysis: true,
    financialProjections: true,
    creditMetrics: true,
    covenantAnalysis: true,
    stressTestResults: true,
    recommendation: true,
    appendixTables: true,
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiGeneratedContent, setAiGeneratedContent] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [showAIPreview, setShowAIPreview] = useState(false);

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
      `First legal mortgage over assets. Market value: ${currencyFmtMM(params.collateralValue || 0, ccy)} (LTV: ${params.collateralValue > 0 ? ((params.requestedLoanAmount / params.collateralValue) * 100).toFixed(1) : 0}%). Personal guarantees from principals.`,
    
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
      `• Dividends: No distributions unless Current Ratio ≥ 1.0x post-   distribution
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

  // REAL AI Integration using DeepSeek API
  const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;

  // Generate comprehensive model summary for AI
  const generateModelSummary = () => {
    if (!projections?.base || !params) {
      return "Insufficient data for analysis.";
    }

    const base = projections.base;
    const minDSCR = base.creditStats?.minDSCR || 0;
    const maxLeverage = base.creditStats?.maxLeverage || 0;
    const minICR = base.creditStats?.minICR || 0;
    
    return `
FINANCIAL MODEL SUMMARY FOR AI ANALYSIS:

COMPANY INFORMATION:
- Legal Name: ${params.companyLegalName || "N/A"}
- Industry: ${params.industry || "N/A"}
- Business Age: ${params.businessAge || 0} years
- Management Experience: ${params.managementExperience || "N/A"}
- Credit History: ${params.creditHistory || "N/A"}

TRANSACTION DETAILS:
- Requested Amount: ${currencyFmtMM(params.requestedLoanAmount || 0, ccy)}
- Proposed Tenor: ${params.proposedTenor || 0} years
- Interest Rate: ${pctFmt(params.proposedPricing || 0)}
- Loan Purpose: ${params.loanPurpose || "N/A"}
- Use of Proceeds: ${params.useOfProceeds || "N/A"}

FINANCIAL METRICS (BASE CASE):
- Enterprise Value: ${currencyFmtMM(base.enterpriseValue || 0, ccy)}
- Equity Value: ${currencyFmtMM(base.equityValue || 0, ccy)}
- Equity MOIC: ${numFmt(base.moic || 0)}x
- Equity IRR: ${pctFmt(base.irr || 0)}
- Min DSCR: ${numFmt(minDSCR)}
- Max Leverage: ${numFmt(maxLeverage)}x
- Min ICR: ${numFmt(minICR)}

COVENANT COMPLIANCE:
- DSCR Requirement: ${numFmt(params.minDSCR || 1.2)}
- DSCR Cushion: ${numFmt(minDSCR - (params.minDSCR || 1.2))}
- Leverage Limit: ${numFmt(params.maxNDToEBITDA || 3.5)}x
- Leverage Cushion: ${numFmt((params.maxNDToEBITDA || 3.5) - maxLeverage)}x
- Covenant Breaches: ${(base.breaches?.dscrBreaches || 0) + (base.breaches?.icrBreaches || 0) + (base.breaches?.ndBreaches || 0)}

QUALITATIVE FACTORS:
${params.businessModel ? `Business Model: ${params.businessModel.substring(0, 300)}` : "No business model provided"}
${params.creditStrengths ? `Credit Strengths: ${params.creditStrengths.substring(0, 300)}` : "No strengths identified"}
${params.keyRisks ? `Key Risks: ${params.keyRisks.substring(0, 300)}` : "No risks identified"}
${params.mitigatingFactors ? `Mitigating Factors: ${params.mitigatingFactors.substring(0, 300)}` : "No mitigants specified"}

COLLATERAL:
- Collateral Value: ${currencyFmtMM(params.collateralValue || 0, ccy)}
- LTV Ratio: ${params.collateralValue > 0 ? numFmt((params.requestedLoanAmount / params.collateralValue) * 100) : "N/A"}%
- Lien Position: ${params.lienPosition || "N/A"}
- Description: ${params.collateralDescription || "N/A"}

STRESS SCENARIOS:
${Object.keys(projections).filter(k => k !== 'base').map(scenario => {
  const proj = projections[scenario];
  return `- ${scenario}: IRR ${pctFmt(proj.irr || 0)}, Min DSCR ${numFmt(proj.creditStats?.minDSCR || 0)}`;
}).join('\n')}

HISTORICAL DATA:
${historicalData && historicalData.length > 0 ? 
  `${historicalData.length} years of historical data available. Latest year revenue: ${currencyFmtMM(historicalData[historicalData.length - 1]?.revenue || 0, ccy)}` 
  : "No historical data provided"}
`;
  };

  // REAL AI Analysis Function
  const generateAIAnalysis = async (section) => {
    if (!apiKey) {
      setAiError("DeepSeek API key not configured. Add REACT_APP_DEEPSEEK_API_KEY to your .env file.");
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);

    try {
      const modelSummary = generateModelSummary();
      
      const prompts = {
        executiveSummary: `Based on the financial model data provided, write a comprehensive 3-paragraph executive summary for a credit committee report. Include: (1) Company overview and transaction details, (2) Key financial metrics and credit quality assessment, (3) Primary risks and recommendation rationale. Be specific with numbers from the data. Keep it professional and concise.`,
        
        creditAnalysis: `Analyze the credit quality of this transaction. Discuss: (1) Debt service coverage and cushion against covenants, (2) Leverage profile and trajectory, (3) Collateral adequacy and LTV, (4) Historical credit performance if available, (5) Overall credit rating (Strong/Acceptable/Weak) with justification. Reference specific metrics from the data.`,
        
        businessAnalysis: `Provide a business analysis covering: (1) Industry dynamics and competitive position, (2) Business model sustainability and revenue drivers, (3) Management quality and track record, (4) Key customers and concentration risks, (5) Growth prospects and strategic positioning. Use the qualitative data provided and be specific.`,
        
        recommendation: `Provide a clear credit recommendation: APPROVE, APPROVE WITH CONDITIONS, or DECLINE. Include: (1) Decision and confidence level, (2) Three key supporting factors, (3) Two primary risks to monitor, (4) Specific conditions if conditional approval, (5) Suggested monitoring frequency. Be direct and actionable.`,
        
        riskAssessment: `Identify and analyze the top 5 risks in priority order. For each risk: 
(1) Describe the risk clearly, 
(2) Quantify impact if possible using the data, 
(3) Assess likelihood (High/Medium/Low), 
(4) Suggest specific mitigation strategies. 
Focus on material credit risks that could impair repayment.`,

        
        scenarioAnalysis: `Compare the base case against all stress scenarios in the model. Discuss: (1) Range of outcomes (best to worst IRR and DSCR), (2) Sensitivity to key assumptions (revenue, margins, rates), (3) Breaking points where covenants breach, (4) Probability-weighted expected outcome, (5) Recommended scenario for decision-making.`,
      };

      const systemPrompt = `You are a senior credit analyst at a leading financial institution. Analyze the financial model data and provide professional, actionable insights for a credit committee. Be specific, reference actual numbers from the data, and maintain a professional tone suitable for executive decision-making.

FINANCIAL MODEL DATA:
${modelSummary}

Your analysis should be:
- Specific and data-driven (cite actual metrics)
- Professional and concise (avoid fluff)
- Actionable (provide clear recommendations)
- Risk-focused (highlight concerns honestly)
- Well-structured (use paragraphs and bullet points)`;

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompts[section] || prompts.executiveSummary }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content || "No response from AI service.";
      
      setAiGeneratedContent(prev => ({
        ...prev,
        [section]: aiContent
      }));
      
      setShowAIPreview(true);
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiError(error.message || "Failed to generate AI analysis. Please try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Generate all AI sections at once
  const generateAllAIContent = async () => {
    const sections = ['executiveSummary', 'creditAnalysis', 'businessAnalysis', 'recommendation', 'riskAssessment', 'scenarioAnalysis'];
    
    for (const section of sections) {
      await generateAIAnalysis(section);
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
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

  // Generate Business Analysis Section
  const generateBusinessAnalysis = () => {
    if (aiGeneratedContent.businessAnalysis) {
      return aiGeneratedContent.businessAnalysis;
    }

    return `
BUSINESS ANALYSIS

BUSINESS MODEL & OPERATIONS
${params.businessModel || "No business model description provided."}

PRODUCTS & SERVICES
${params.productsServices || "No product/service details provided."}

MARKET POSITION & COMPETITION
${params.competitivePosition || "No competitive analysis provided."}
${params.marketShare ? `Market Share: ${params.marketShare}` : ""}

CUSTOMER BASE
${params.keyCustomers || "No customer concentration analysis provided."}

INDUSTRY CONTEXT
Industry: ${params.industry}
Business Age: ${params.businessAge} years
Management Experience: ${params.managementExperience}
`;
  };

  // Generate Credit Analysis Section
  const generateCreditAnalysis = () => {
    if (aiGeneratedContent.creditAnalysis) {
      return aiGeneratedContent.creditAnalysis;
    }

    return `
CREDIT ANALYSIS

CREDIT STRENGTHS
${params.creditStrengths || "No specific credit strengths identified."}

KEY RISKS
${params.keyRisks || "No specific risks identified."}

RISK MITIGATION
${params.mitigatingFactors || "No mitigating factors specified."}

COLLATERAL ANALYSIS
${params.collateralDescription || "No collateral details provided."}
Collateral Value: ${currencyFmtMM(params.collateralValue || 0, ccy)}
LTV Ratio: ${params.collateralValue > 0 ? numFmt((params.requestedLoanAmount / params.collateralValue) * 100) : "N/A"}%
Lien Position: ${params.lienPosition}

REPAYMENT SOURCES
Primary: ${params.primaryRepaymentSource || "Not specified"}
Secondary: ${params.secondaryRepaymentSource || "Not specified"}
`;
  };

  // Generate Term Sheet PDF with proper calculations
  const generateTermSheet = () => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      let yPos = 20;

      const checkNewPage = (requiredSpace = 20) => {
        if (yPos + requiredSpace > 280) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Header
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 45, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("INDICATIVE TERM SHEET", 105, 15, { align: "center" });
      doc.setFontSize(16);
      doc.text(termSheetFields.issuer, 105, 25, { align: "center" });
      doc.setFontSize(12);
      doc.text(termSheetFields.facilityType, 105, 33, { align: "center" });
      
      // Amount
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(`${termSheetFields.currency} ${numFmt(termSheetFields.raiseAmount / 1000000)}M`, 105, 42, { align: "center" });
      
      // Disclaimer
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(200, 200, 200);
      const disclaimer = "This Indicative Term Sheet is for discussion purposes only and does not constitute an offer. Terms subject to final approval and documentation.";
      const disclaimerLines = doc.splitTextToSize(disclaimer, 180);
      doc.text(disclaimerLines, 105, 52, { align: "center" });

      doc.setTextColor(0, 0, 0);
      yPos = 65;

      // Basic Information
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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
      doc.setTextColor(59, 130, 246);
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

  // Generate comprehensive PDF Report
  const generatePDF = () => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      let yPos = 20;

      const checkNewPage = (requiredSpace = 20) => {
        if (yPos + requiredSpace > 280) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      const addSection = (title, content, isHeader = false) => {
        checkNewPage(30);
        if (isHeader) {
          doc.setFillColor(59, 130, 246);
          doc.rect(0, yPos - 10, 210, 12, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.text(title, 105, yPos - 2, { align: "center" });
          doc.setTextColor(0, 0, 0);
          yPos += 15;
        } else {
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(59, 130, 246);
          doc.text(title.toUpperCase(), 20, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 8;
        }
        
        if (content) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          const lines = doc.splitTextToSize(content, 170);
          doc.text(lines, 20, yPos);
          yPos += lines.length * 5 + 10;
        }
      };

      // Cover Page
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, 210, 297, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.text("CREDIT COMMITTEE", 105, 100, { align: "center" });
      doc.text("REPORT", 105, 115, { align: "center" });
      doc.setFontSize(20);
      doc.text(params.companyLegalName || "Confidential Borrower", 105, 140, { align: "center" });
      doc.setFontSize(14);
      doc.text(`${currencyFmtMM(params.requestedLoanAmount, ccy)} ${params.dealStructure || 'Term Loan'}`, 105, 155, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 175, { align: "center" });
      doc.setFontSize(10);
      doc.text("CONFIDENTIAL - FOR INTERNAL USE ONLY", 105, 280, { align: "center" });
      
      doc.addPage();
      yPos = 20;

      // Executive Summary
      if (selectedSections.executiveSummary) {
        addSection("EXECUTIVE SUMMARY", generateExecutiveSummary(), true);
      }

      // Company Profile
      if (selectedSections.companyProfile) {
        addSection("COMPANY PROFILE", `
Legal Name: ${params.companyLegalName || "N/A"}
Operating Name: ${params.companyOperatingName || "N/A"}
Industry: ${params.industry}
Business Age: ${params.businessAge} years
Credit History: ${params.creditHistory}
Management Experience: ${params.managementExperience}
Total Assets: ${currencyFmtMM(params.totalAssets, ccy)}
Collateral Value: ${currencyFmtMM(params.collateralValue, ccy)}
`);
      }

      // Business Analysis
      if (selectedSections.businessAnalysis) {
        addSection("BUSINESS ANALYSIS", generateBusinessAnalysis());
      }

      // Credit Analysis
      if (selectedSections.creditAnalysis) {
        addSection("CREDIT ANALYSIS", generateCreditAnalysis());
      }

      // Financial Projections Summary
      if (selectedSections.financialProjections && projections?.base) {
        const base = projections.base;
        addSection("FINANCIAL PROJECTIONS", `
Enterprise Value: ${currencyFmtMM(base.enterpriseValue || 0, ccy)}
Equity Value: ${currencyFmtMM(base.equityValue || 0, ccy)}
Equity MOIC: ${numFmt(base.moic || 0)}x
Equity IRR: ${pctFmt(base.irr || 0)}

Min DSCR: ${numFmt(base.creditStats?.minDSCR || 0)}
Max Leverage: ${numFmt(base.creditStats?.maxLeverage || 0)}x
Min ICR: ${numFmt(base.creditStats?.minICR || 0)}

Covenant Breaches: ${(base.breaches?.dscrBreaches || 0) + (base.breaches?.icrBreaches || 0) + (base.breaches?.ndBreaches || 0)}
`);
      }

      // Recommendation
      if (selectedSections.recommendation) {
        const rec = determineRecommendation(projections?.base || {}, params);
        addSection("RECOMMENDATION", `
DECISION: ${rec.decision}

SUMMARY: ${rec.summary}

RATIONALE: ${rec.rationale}

${aiGeneratedContent.recommendation ? `\nDETAILED ANALYSIS:\n${aiGeneratedContent.recommendation}` : ''}
`);
      }

      doc.save(`Credit_Report_${params.companyLegalName?.replace(/\s+/g, '_') || 'Company'}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Error generating PDF. Please check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  // Generate Excel with comprehensive data
  const generateExcel = () => {
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
        
        // Set column widths
        ws['!cols'] = [
          { wch: 25 },
          { wch: 25 }
        ];
        
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
        const aiData = [["AI-GENERATEDANALYSIS"], []];
        
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

    const strongManagement = params.managementExperience === "Exceptional" || params.managementExperience === "Strong";
    const cleanCreditHistory = params.creditHistory === "Excellent" || params.creditHistory === "Clean";
    const adequateCollateral = params.collateralValue >= params.requestedLoanAmount * 1.5;
    const establishedBusiness = params.businessAge >= 5;

    if (totalBreaches > 0) {
      return {
        decision: "DECLINE",
        summary: "Covenant breaches identified - unacceptable credit risk",
        rationale: `Analysis shows ${totalBreaches} covenant breach(es). Recommend decline or significant restructuring.`,
        color: [239, 68, 68]
      };
    }

    if (minDSCR < (params.minDSCR || 1.2)) {
      if (strongManagement && adequateCollateral && establishedBusiness) {
        return {
          decision: "CONDITIONAL APPROVAL",
          summary: "Weak DSCR offset by strong qualitative factors - approve with enhanced monitoring",
          rationale: `DSCR of ${numFmt(minDSCR)} is below covenant but strong collateral (${params.collateralValue >= params.requestedLoanAmount * 1.5 ? 'LTV <67%' : ''}) and ${params.businessAge}+ years of operations provide comfort.`,
          color: [245, 158, 11]
        };
      }
      return {
        decision: "DECLINE",
        summary: "Insufficient debt service coverage with weak fundamentals",
        rationale: `DSCR of ${numFmt(minDSCR)} below minimum ${numFmt(params.minDSCR || 1.2)} without offsetting strengths.`,
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
        rationale: `DSCR ${numFmt(minDSCR)} (cushion: ${numFmt(minDSCR - (params.minDSCR || 1.2))}), Leverage ${numFmt(maxLeverage)}x, IRR ${pctFmt(irr)}. ${strongManagement ? 'Exceptional management team.' : ''}`,
        color: [34, 197, 94]
      };
    }

    if (strongCushion || (conservativeLeverage && cleanCreditHistory)) {
      return {
        decision: "APPROVE",
        summary: "Sound credit metrics with adequate protection",
        rationale: `Acceptable risk profile with DSCR ${numFmt(minDSCR)}, Leverage ${numFmt(maxLeverage)}x. ${adequateCollateral ? 'Strong collateral coverage.' : ''}`,
        color: [34, 197, 94]
      };
    }

    return {
      decision: "APPROVE WITH CONDITIONS",
      summary: "Marginal metrics - approve with enhanced monitoring and conditions",
      rationale: `DSCR ${numFmt(minDSCR)} provides limited cushion. Recommend quarterly monitoring and tighter covenants.`,
      color: [59, 130, 246]
    };
  };

  return (
    <div className="space-y-6">
      {/* AI Analysis Assistant */}
      <Card className="border-l-4 border-l-purple-600 shadow-md hover:shadow-lg transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-600" />
            AI Credit Analysis Assistant
            <span className="ml-auto text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold border border-purple-200">
              Powered by DeepSeek
            </span>
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Generate intelligent credit analysis using AI - all content is editable and exportable
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* API Key Status */}
          {!apiKey && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>API Key Required:</strong> Add REACT_APP_DEEPSEEK_API_KEY to your .env file to enable AI analysis.
              </div>
            </div>
          )}

          {/* AI Generation Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Button 
              onClick={() => generateAIAnalysis('executiveSummary')}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs"
            >
              {isGeneratingAI ? <Loader className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              Executive
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('creditAnalysis')}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Credit
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('businessAnalysis')}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Business
            </Button>
            
            <Button 
              onClick={() => generateAIAnalysis('recommendation')}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs"
            >
              <Bot className="w-3 h-3 mr-1" />
              Recommendation
            </Button>

            <Button 
              onClick={() => generateAIAnalysis('riskAssessment')}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs"
            >
              <AlertCircle className="w-3 h-3 mr-1" />
              Risks
            </Button>

            <Button 
              onClick={generateAllAIContent}
              disabled={isGeneratingAI || !apiKey}
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              All Sections
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
                >
                  <Eye className="w-4 h-4 mr-2" />
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
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="text-xs text-emerald-700">
                  <Check className="w-4 h-4 inline mr-1" />
                  AI content will be automatically included in exported reports. You can copy and edit individual sections above.
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
            <div className="grid grid-cols-3 gap-4 mb-4">
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
                onClick={() => {
                  const allSelected = Object.values(selectedSections).every(v => v);
                  const newState = {};
                  Object.keys(selectedSections).forEach(key => {
                    newState[key] = !allSelected;
                  });
                  setSelectedSections(newState);
                }}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
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
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              {isExporting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Generate PDF Report
            </Button>
            <Button 
              onClick={generateExcel} 
              disabled={isExporting}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              {isExporting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Generate Excel Report
            </Button>
            <Button 
              onClick={generateTermSheet} 
              disabled={isExporting}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-md hover:shadow-lg"
            >
              {isExporting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Generate Term Sheet
            </Button>
          </div>

          {/* Features Summary */}
          <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <h4 className="font-semibold text-sm mb-3 text-slate-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Included Features
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Executive Summary & Recommendation
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Financial Projections & Metrics
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Covenant Compliance Analysis
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Stress Test Results
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600" />
                Collateral & Security Details
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-purple-600" />
                AI-Generated Insights
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}