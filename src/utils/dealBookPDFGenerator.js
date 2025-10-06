// utils/dealBookPDFGenerator.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currencyFmtMM, numFmt, pctFmt } from './formatters';

export async function generateDealBookPDF(data) {
  console.log('Generating Deal Book PDF...');
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);

  try {
    // Cover Page
    addCoverPage(pdf, data, pageWidth, pageHeight);

    // Table of Contents
    pdf.addPage();
    addTableOfContents(pdf, margin);

    // Executive Summary
    pdf.addPage();
    addExecutiveSummary(pdf, data, margin, contentWidth);

    // Company Profile
    pdf.addPage();
    addCompanyProfile(pdf, data, margin, contentWidth);

    // Transaction Structure
    pdf.addPage();
    addTransactionStructure(pdf, data, margin, contentWidth);

    // Financial Projections
    pdf.addPage();
    addFinancialProjections(pdf, data, margin, contentWidth);

    // Scenario Analysis
    if (Object.keys(data.projections.scenarios).length > 0) {
      pdf.addPage();
      addScenarioAnalysis(pdf, data, margin, contentWidth);
    }

    // Credit Analysis
    pdf.addPage();
    addCreditAnalysis(pdf, data, margin, contentWidth);

    // Covenant Analysis
    pdf.addPage();
    addCovenantAnalysis(pdf, data, margin, contentWidth);

    // Collateral Analysis
    if (data.collateral.value > 0) {
      pdf.addPage();
      addCollateralAnalysis(pdf, data, margin, contentWidth);
    }

    // Risk Assessment
    pdf.addPage();
    addRiskAssessment(pdf, data, margin, contentWidth);

    // Recommendation
    pdf.addPage();
    addRecommendation(pdf, data, margin, contentWidth);

    // Add page numbers and footers
    addPageNumbersAndFooters(pdf, data);

    // Save PDF
    const fileName = `DealBook_${sanitizeFileName(data.company.legalName)}_${formatDateForFilename(new Date())}.pdf`;
    pdf.save(fileName);

    return {
      success: true,
      fileName,
      pages: pdf.internal.getNumberOfPages()
    };

  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

// ===== COVER PAGE =====
function addCoverPage(pdf, data, pageWidth, pageHeight) {
  // Background gradient effect using rectangles
  pdf.setFillColor(59, 130, 246); // Blue
  pdf.rect(0, 0, pageWidth, pageHeight / 3, 'F');
  
  pdf.setFillColor(37, 99, 235); // Darker blue
  pdf.rect(0, pageHeight / 3, pageWidth, pageHeight / 3, 'F');
  
  pdf.setFillColor(29, 78, 216); // Even darker
  pdf.rect(0, (pageHeight / 3) * 2, pageWidth, pageHeight / 3, 'F');

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont(undefined, 'bold');
  pdf.text('CREDIT ANALYSIS', pageWidth / 2, 60, { align: 'center' });
  pdf.text('DEAL BOOK', pageWidth / 2, 75, { align: 'center' });

  // Company Name
  pdf.setFontSize(20);
  pdf.setFont(undefined, 'normal');
  pdf.text(data.company.legalName, pageWidth / 2, 100, { align: 'center' });

  // Transaction Amount
  pdf.setFontSize(16);
  pdf.text(
    `${currencyFmtMM(data.transaction.requestedAmount, data.metadata.currency)} ${data.transaction.facilityType || 'Facility'}`,
    pageWidth / 2,
    115,
    { align: 'center' }
  );

  // Date and Confidentiality
  pdf.setFontSize(10);
  pdf.text(
    `Generated: ${new Date(data.metadata.exportDate).toLocaleDateString()}`,
    pageWidth / 2,
    pageHeight - 40,
    { align: 'center' }
  );
  
  pdf.setFontSize(8);
  pdf.text(
    'CONFIDENTIAL - FOR INTERNAL USE ONLY',
    pageWidth / 2,
    pageHeight - 30,
    { align: 'center' }
  );
}

// ===== TABLE OF CONTENTS =====
function addTableOfContents(pdf, margin) {
  pdf.setTextColor(40, 40, 40);
  pdf.setFontSize(20);
  pdf.setFont(undefined, 'bold');
  pdf.text('TABLE OF CONTENTS', margin, 30);

  const sections = [
    'Executive Summary',
    'Company Profile',
    'Transaction Structure',
    'Financial Projections',
    'Scenario Analysis',
    'Credit Analysis',
    'Covenant Analysis',
    'Collateral Analysis',
    'Risk Assessment',
    'Recommendation'
  ];

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');
  
  let y = 50;
  sections.forEach((section, index) => {
    pdf.text(`${index + 1}.`, margin, y);
    pdf.text(section, margin + 10, y);
    pdf.text('...', margin + 100, y);
    y += 8;
  });
}

// ===== EXECUTIVE SUMMARY =====
function addExecutiveSummary(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'EXECUTIVE SUMMARY', margin, y);
  y += 15;

  const baseProj = data.projections.base;
  const recommendation = determineRecommendation(baseProj, data);

  // Recommendation Box
  const recColor = recommendation.decision === 'APPROVE' ? [34, 197, 94] :
                   recommendation.decision === 'DECLINE' ? [239, 68, 68] :
                   [59, 130, 246];
  
  pdf.setFillColor(...recColor);
  pdf.rect(margin, y, contentWidth, 15, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text(`RECOMMENDATION: ${recommendation.decision}`, margin + 5, y + 10);
  
  y += 20;
  pdf.setTextColor(60, 60, 60);
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');

  const summaryText = pdf.splitTextToSize(recommendation.summary, contentWidth);
  pdf.text(summaryText, margin, y);
  y += summaryText.length * 5 + 10;

  // Key Metrics Table
  y = addKeyMetricsTable(pdf, data, margin, y, contentWidth);

  // Transaction Overview
  y += 10;
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.text('Transaction Overview', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  
  const transactionDetails = [
    ['Facility Type', data.transaction.facilityType || 'N/A'],
    ['Requested Amount', currencyFmtMM(data.transaction.requestedAmount, data.metadata.currency)],
    ['Tenor', `${data.transaction.tenor} years`],
    ['Interest Rate', pctFmt(data.transaction.interestRate)],
    ['Payment Frequency', data.transaction.paymentFrequency],
    ['Use of Proceeds', data.transaction.useOfProceeds || 'N/A']
  ];

  transactionDetails.forEach(([label, value]) => {
    pdf.setFont(undefined, 'bold');
    pdf.text(`${label}:`, margin, y);
    pdf.setFont(undefined, 'normal');
    const valueLines = pdf.splitTextToSize(value, contentWidth - 60);
    pdf.text(valueLines, margin + 60, y);
    y += Math.max(5, valueLines.length * 5) + 2;
  });
}

// ===== FINANCIAL PROJECTIONS =====
function addFinancialProjections(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'FINANCIAL PROJECTIONS', margin, y);
  y += 15;

  const baseProj = data.projections.base;
  
  if (!baseProj || !baseProj.rows || baseProj.rows.length === 0) {
    pdf.setFont(undefined, 'italic');
    pdf.text('No projection data available', margin, y);
    return;
  }

  // Summary Metrics
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Valuation Summary', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  
  const valuationMetrics = [
    ['Enterprise Value', currencyFmtMM(baseProj.enterpriseValue, data.metadata.currency)],
    ['Equity Value', currencyFmtMM(baseProj.equityValue, data.metadata.currency)],
    ['Equity MOIC', `${numFmt(baseProj.moic)}x`],
    ['Equity IRR', pctFmt(baseProj.irr)],
  ];

  valuationMetrics.forEach(([label, value]) => {
    pdf.text(`${label}:`, margin + 5, y);
    pdf.text(value, margin + 80, y);
    y += 6;
  });

  y += 10;

  // Year-by-year projection table
  const tableData = baseProj.rows.map(row => [
    row.year,
    currencyFmtMM(row.revenue, data.metadata.currency),
    currencyFmtMM(row.ebitda, data.metadata.currency),
    currencyFmtMM(row.fcf, data.metadata.currency),
    numFmt(row.dscr),
    numFmt(row.ndToEbitda)
  ]);

  autoTable(pdf, {
    startY: y,
    head: [['Year', 'Revenue', 'EBITDA', 'FCF', 'DSCR', 'ND/EBITDA']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });
}

// ===== SCENARIO ANALYSIS =====
function addScenarioAnalysis(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'SCENARIO ANALYSIS', margin, y);
  y += 15;

  const scenarios = data.projections.scenarios;
  
  if (!scenarios || Object.keys(scenarios).length === 0) {
    pdf.setFont(undefined, 'italic');
    pdf.text('No scenario analysis available', margin, y);
    return;
  }

  // Scenario comparison table
  const scenarioData = Object.entries(scenarios).map(([name, proj]) => [
    name,
    pctFmt(proj.irr || 0),
    `${numFmt(proj.moic || 0)}x`,
    numFmt(proj.creditStats?.minDSCR || 0),
    numFmt(proj.creditStats?.maxLeverage || 0),
    (proj.breaches?.dscrBreaches || 0) + (proj.breaches?.icrBreaches || 0) + (proj.breaches?.ndBreaches || 0)
  ]);

  autoTable(pdf, {
    startY: y,
    head: [['Scenario', 'IRR', 'MOIC', 'Min DSCR', 'Max Lev', 'Breaches']],
    body: scenarioData,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  y = pdf.lastAutoTable.finalY + 10;

  // Sensitivity Commentary
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Sensitivity Analysis', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  
  const baseCase = scenarios.base || data.projections.base;
  Object.entries(scenarios).forEach(([name, scenario]) => {
    if (name !== 'base') {
      const irrDelta = ((scenario.irr - baseCase.irr) / baseCase.irr) * 100;
      const dscrDelta = (scenario.creditStats?.minDSCR || 0) - (baseCase.creditStats?.minDSCR || 0);
      
      const text = `${name}: IRR ${irrDelta >= 0 ? '+' : ''}${numFmt(irrDelta)}%, DSCR ${dscrDelta >= 0 ? '+' : ''}${numFmt(dscrDelta)}`;
      pdf.text(text, margin + 5, y);
      y += 6;
    }
  });
}

// ===== COVENANT ANALYSIS =====
function addCovenantAnalysis(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'COVENANT COMPLIANCE ANALYSIS', margin, y);
  y += 15;

  const baseProj = data.projections.base;
  const stats = baseProj.creditStats || {};
  const breaches = baseProj.breaches || {};

  // Covenant Status Table
  const covenantData = [
    [
      'Debt Service Coverage Ratio (DSCR)',
      `${numFmt(stats.minDSCR || 0)}x`,
      `≥ ${numFmt(data.covenants.minDSCR)}x`,
      numFmt((stats.minDSCR || 0) - data.covenants.minDSCR),
      (stats.minDSCR || 0) >= data.covenants.minDSCR ? 'PASS' : 'BREACH'
    ],
    [
      'Interest Coverage Ratio (ICR)',
      `${numFmt(stats.minICR || 0)}x`,
      `≥ ${numFmt(data.covenants.targetICR)}x`,
      numFmt((stats.minICR || 0) - data.covenants.targetICR),
      (stats.minICR || 0) >= data.covenants.targetICR ? 'PASS' : 'BREACH'
    ],
    [
      'Net Debt / EBITDA',
      `${numFmt(stats.maxLeverage || 0)}x`,
      `≤ ${numFmt(data.covenants.maxLeverage)}x`,
      numFmt(data.covenants.maxLeverage - (stats.maxLeverage || 0)),
      (stats.maxLeverage || 0) <= data.covenants.maxLeverage ? 'PASS' : 'BREACH'
    ]
  ];

  autoTable(pdf, {
    startY: y,
    head: [['Covenant', 'Actual', 'Threshold', 'Cushion', 'Status']],
    body: covenantData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      4: { 
        halign: 'center',
        cellWidth: 25
      }
    },
    didParseCell: function(data) {
      if (data.column.index === 4 && data.cell.section === 'body') {
        if (data.cell.raw === 'PASS') {
          data.cell.styles.textColor = [34, 197, 94];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'BREACH') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin }
  });

  y = pdf.lastAutoTable.finalY + 10;

  // Breach Summary
  const totalBreaches = (breaches.dscrBreaches || 0) + (breaches.icrBreaches || 0) + (breaches.ndBreaches || 0);
  
  if (totalBreaches > 0) {
    pdf.setFillColor(254, 226, 226); // Light red
    pdf.rect(margin, y, contentWidth, 20, 'F');
    
    pdf.setTextColor(153, 27, 27); // Dark red
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text(`WARNING: ${totalBreaches} Covenant Breach(es) Identified`, margin + 5, y + 8);
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.text(`DSCR: ${breaches.dscrBreaches || 0} | ICR: ${breaches.icrBreaches || 0} | Leverage: ${breaches.ndBreaches || 0}`, margin + 5, y + 14);
    
    y += 25;
  } else {
    pdf.setFillColor(220, 252, 231); // Light green
    pdf.rect(margin, y, contentWidth, 12, 'F');
    
    pdf.setTextColor(21, 128, 61); // Dark green
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('All covenants projected to remain in compliance throughout tenor', margin + 5, y + 8);
    
    y += 17;
  }
  
  pdf.setTextColor(60, 60, 60);
}

// ===== CREDIT ANALYSIS =====
function addCreditAnalysis(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'CREDIT ANALYSIS', margin, y);
  y += 15;

  // Credit Strengths
  if (data.credit.strengths) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Credit Strengths', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const strengthLines = pdf.splitTextToSize(data.credit.strengths, contentWidth);
    pdf.text(strengthLines, margin + 5, y);
    y += strengthLines.length * 5 + 8;
  }

  // Key Risks
  if (data.credit.risks) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Key Risks', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const riskLines = pdf.splitTextToSize(data.credit.risks, contentWidth);
    pdf.text(riskLines, margin + 5, y);
    y += riskLines.length * 5 + 8;
  }

  // Mitigating Factors
  if (data.credit.mitigants) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Mitigating Factors', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const mitigantLines = pdf.splitTextToSize(data.credit.mitigants, contentWidth);
    pdf.text(mitigantLines, margin + 5, y);
    y += mitigantLines.length * 5 + 8;
  }

  // Credit History
  if (data.credit.history) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Credit History', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(data.credit.history, margin + 5, y);
  }
}

// ===== COLLATERAL ANALYSIS =====
function addCollateralAnalysis(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'COLLATERAL & SECURITY ANALYSIS', margin, y);
  y += 15;

  const proFormaDebt = data.transaction.requestedAmount + (data.params?.openingDebt || 0);
  const ltv = data.collateral.value > 0 ? (proFormaDebt / data.collateral.value) * 100 : 0;
  const coverage = proFormaDebt > 0 ? data.collateral.value / proFormaDebt : 0;

  // Coverage Metrics
  const coverageData = [
    ['Collateral Value', currencyFmtMM(data.collateral.value, data.metadata.currency)],
    ['Pro-Forma Debt', currencyFmtMM(proFormaDebt, data.metadata.currency)],
    ['Loan-to-Value Ratio', `${numFmt(ltv)}%`],
    ['Collateral Coverage', `${numFmt(coverage)}x`],
    ['Lien Position', data.collateral.lienPosition || 'N/A']
  ];

  autoTable(pdf, {
    startY: y,
    body: coverageData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  y = pdf.lastAutoTable.finalY + 10;

  // LTV Assessment
  const ltvStatus = ltv <= 60 ? { text: 'STRONG', color: [34, 197, 94] } :
                    ltv <= 75 ? { text: 'ADEQUATE', color: [234, 179, 8] } :
                    { text: 'WEAK', color: [239, 68, 68] };

  pdf.setFillColor(...ltvStatus.color);
  pdf.rect(margin, y, contentWidth, 12, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'bold');
  pdf.text(`Collateral Coverage Assessment: ${ltvStatus.text}`, margin + 5, y + 8);
  
  y += 17;
  pdf.setTextColor(60, 60, 60);

  // Description
  if (data.collateral.description) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Collateral Description', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const descLines = pdf.splitTextToSize(data.collateral.description, contentWidth);
    pdf.text(descLines, margin + 5, y);
    y += descLines.length * 5 + 8;
  }

  // Appraisal Information
  if (data.collateral.appraisalValue) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Appraisal Information', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Appraisal Value: ${currencyFmtMM(data.collateral.appraisalValue, data.metadata.currency)}`, margin + 5, y);
    y += 6;
    pdf.text(`Appraisal Date: ${data.collateral.appraisalDate || 'N/A'}`, margin + 5, y);
  }
}

// ===== RISK ASSESSMENT =====
function addRiskAssessment(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'RISK ASSESSMENT', margin, y);
  y += 15;

  const baseProj = data.projections.base;
  const stats = baseProj.creditStats || {};

  // Risk Rating
  const riskScore = calculateRiskScore(stats, data);
  const riskRating = riskScore >= 80 ? { text: 'LOW RISK', color: [34, 197, 94] } :
                     riskScore >= 60 ? { text: 'MODERATE RISK', color: [234, 179, 8] } :
                     { text: 'HIGH RISK', color: [239, 68, 68] };

  pdf.setFillColor(...riskRating.color);
  pdf.rect(margin, y, contentWidth, 15, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont(undefined, 'bold');
  pdf.text(`Overall Risk Assessment: ${riskRating.text}`, margin + 5, y + 10);
  
  y += 20;
  pdf.setTextColor(60, 60, 60);

  // Risk Factors
  const riskFactors = [
    {
      category: 'Credit Risk',
      level: stats.minDSCR >= 1.5 ? 'Low' : stats.minDSCR >= 1.2 ? 'Moderate' : 'High',
      description: `DSCR coverage of ${numFmt(stats.minDSCR)}x`
    },
    {
      category: 'Leverage Risk',
      level: stats.maxLeverage <= 2.5 ? 'Low' : stats.maxLeverage <= 3.5 ? 'Moderate' : 'High',
      description: `Maximum leverage of ${numFmt(stats.maxLeverage)}x`
    },
    {
      category: 'Collateral Risk',
      level: ltv <= 60 ? 'Low' : ltv <= 75 ? 'Moderate' : 'High',
      description: `LTV ratio of ${numFmt(ltv)}%`
    },
    {
      category: 'Business Risk',
      level: data.company.businessAge >= 5 ? 'Low' : data.company.businessAge >= 2 ? 'Moderate' : 'High',
      description: `${data.company.businessAge} years in operation`
    }
  ];

  const ltv = data.collateral.value > 0 ? 
    ((data.transaction.requestedAmount + (data.params?.openingDebt || 0)) / data.collateral.value) * 100 : 
    0;

  const riskTableData = riskFactors.map(risk => [
    risk.category,
    risk.level,
    risk.description
  ]);

  autoTable(pdf, {
    startY: y,
    head: [['Risk Category', 'Level', 'Description']],
    body: riskTableData,
    theme: 'striped',
    headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      1: { halign: 'center', cellWidth: 30 }
    },
    didParseCell: function(data) {
      if (data.column.index === 1 && data.cell.section === 'body') {
        if (data.cell.raw === 'Low') {
          data.cell.styles.textColor = [34, 197, 94];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.cell.raw === 'High') {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [234, 179, 8];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin }
  });
}

// ===== RECOMMENDATION =====
function addRecommendation(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'CREDIT COMMITTEE RECOMMENDATION', margin, y);
  y += 15;

  const baseProj = data.projections.base;
  const recommendation = determineRecommendation(baseProj, data);

  // Decision Box
  const decisionColor = recommendation.decision === 'APPROVE' ? [34, 197, 94] :
                       recommendation.decision === 'DECLINE' ? [239, 68, 68] :
                       recommendation.decision.includes('CONDITIONAL') ? [59, 130, 246] :
                       [234, 179, 8];

  pdf.setFillColor(...decisionColor);
  pdf.rect(margin, y, contentWidth, 20, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text(recommendation.decision, margin + 5, y + 13);
  
  y += 25;
  pdf.setTextColor(60, 60, 60);

  // Summary
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Summary', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  const summaryLines = pdf.splitTextToSize(recommendation.summary, contentWidth);
  pdf.text(summaryLines, margin + 5, y);
  y += summaryLines.length * 5 + 10;

  // Rationale
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Rationale', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  const rationaleLines = pdf.splitTextToSize(recommendation.rationale, contentWidth);
  pdf.text(rationaleLines, margin + 5, y);
  y += rationaleLines.length * 5 + 10;

  // Conditions (if applicable)
  if (recommendation.decision.includes('CONDITIONAL') || recommendation.decision.includes('CONDITIONS')) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Conditions for Approval', margin, y);
    y += 8;

    const conditions = [
      'Enhanced quarterly monitoring and reporting',
      'Debt Service Reserve Account of 6 months',
      'Annual collateral revaluation',
      'Management certifications on covenant compliance',
      'Consent required for major capital expenditures'
    ];

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    conditions.forEach(condition => {
      pdf.text(`• ${condition}`, margin + 5, y);
      y += 6;
    });
  }
}

// ===== HELPER FUNCTIONS =====

function addSectionHeader(pdf, title, x, y) {
  pdf.setFillColor(59, 130, 246);
  pdf.rect(x, y - 5, pdf.internal.pageSize.getWidth() - (2 * x), 12, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text(title, x + 5, y + 4);
  
  pdf.setTextColor(60, 60, 60);
}

function addKeyMetricsTable(pdf, data, margin, y, contentWidth) {
  const baseProj = data.projections.base;
  const stats = baseProj.creditStats || {};

  const metricsData = [
    ['Enterprise Value', currencyFmtMM(baseProj.enterpriseValue, data.metadata.currency)],
    ['Equity IRR', pctFmt(baseProj.irr)],
    ['Minimum DSCR', `${numFmt(stats.minDSCR)}x`],
    ['Maximum Leverage', `${numFmt(stats.maxLeverage)}x`],
  ];

  autoTable(pdf, {
    startY: y,
    body: metricsData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  return pdf.lastAutoTable.finalY + 5;
}

function addCompanyProfile(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'COMPANY PROFILE', margin, y);
  y += 15;

  const companyData = [
    ['Legal Name', data.company.legalName],
    ['Operating Name', data.company.operatingName || 'N/A'],
    ['Industry', data.company.industry || 'N/A'],
    ['Business Age', `${data.company.businessAge || 'N/A'} years`],
    ['Total Assets', currencyFmtMM(data.company.totalAssets, data.metadata.currency)],
  ];

  autoTable(pdf, {
    startY: y,
    body: companyData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: margin, right: margin }
  });

  y = pdf.lastAutoTable.finalY + 10;

  // Business Description
  if (data.business.model) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Business Model', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const modelLines = pdf.splitTextToSize(data.business.model, contentWidth);
    pdf.text(modelLines, margin + 5, y);
    y += modelLines.length * 5 + 8;
  }

  // Management
  if (data.management.names) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Management Team', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(data.management.names, margin + 5, y);
    y += 6;
    
    if (data.management.experience) {
      pdf.text(`Experience Level: ${data.management.experience}`, margin + 5, y);
    }
  }
}

function addTransactionStructure(pdf, data, margin, contentWidth) {
  let y = 30;
  
  addSectionHeader(pdf, 'TRANSACTION STRUCTURE', margin, y);
  y += 15;

  const transactionData = [
    ['Facility Type', data.transaction.facilityType || 'N/A'],
    ['Requested Amount', currencyFmtMM(data.transaction.requestedAmount, data.metadata.currency)],
    ['Tenor', `${data.transaction.tenor} years`],
    ['Interest Rate', pctFmt(data.transaction.interestRate)],
    ['Payment Frequency', data.transaction.paymentFrequency],
    ['Day Count Convention', data.transaction.dayCountConvention || 'Actual/365'],
    ['Balloon Payment', `${data.transaction.balloonPercentage || 0}%`],
  ];

  autoTable(pdf, {
    startY: y,
    body: transactionData,
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: margin, right: margin }
  });

  y = pdf.lastAutoTable.finalY + 10;

  // Use of Proceeds
  if (data.transaction.useOfProceeds) {
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Use of Proceeds', margin, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    const proceedsLines = pdf.splitTextToSize(data.transaction.useOfProceeds, contentWidth);
    pdf.text(proceedsLines, margin + 5, y);
  }
}

function addPageNumbersAndFooters(pdf, data) {
  const totalPages = pdf.internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 2; i <= totalPages; i++) { // Skip cover page
    pdf.setPage(i);
    
    // Page number
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    
    // Confidentiality footer
    pdf.setFontSize(7);
    pdf.text(
      `CONFIDENTIAL - ${data.company.legalName}`,
      20,
      pageHeight - 10
    );
    
    // Date
    pdf.text(
      new Date(data.metadata.exportDate).toLocaleDateString(),
      pageWidth - 20,
      pageHeight - 10,
      { align: 'right' }
    );
  }
}

function determineRecommendation(projection, data) {
  if (!projection || !projection.creditStats) {
    return {
      decision: 'INSUFFICIENT DATA',
      summary: 'Unable to make recommendation',
      rationale: 'Insufficient projection data available for analysis'
    };
  }

  const stats = projection.creditStats;
  const breaches = projection.breaches || {};
  const totalBreaches = (breaches.dscrBreaches || 0) + (breaches.icrBreaches || 0) + (breaches.ndBreaches || 0);

  const minDSCR = stats.minDSCR || 0;
  const maxLeverage = stats.maxLeverage || 0;
  const dscrCushion = minDSCR - (data.covenants.minDSCR || 1.2);
  const leverageCushion = (data.covenants.maxLeverage || 3.5) - maxLeverage;

  if (totalBreaches > 0) {
    return {
      decision: 'DECLINE',
      summary: 'Covenant breaches identified - unacceptable credit risk',
      rationale: `Financial projections show ${totalBreaches} covenant breach(es). The transaction does not meet minimum credit standards and should be declined.`
    };
  }

  if (dscrCushion >= 0.3 && leverageCushion >= 0.5) {
    return {
      decision: 'APPROVE',
      summary: 'Strong credit profile with significant covenant cushion',
      rationale: `Minimum DSCR of ${numFmt(minDSCR)}x provides ${numFmt(dscrCushion)}x cushion above covenant. Maximum leverage of ${numFmt(maxLeverage)}x is well within limits. Recommend approval.`
    };
  }

  if (dscrCushion >= 0 && leverageCushion >= 0) {
    return {
      decision: 'APPROVE WITH CONDITIONS',
      summary: 'Adequate metrics but limited cushion - enhanced monitoring recommended',
      rationale: `DSCR cushion of ${numFmt(dscrCushion)}x is adequate but limited. Recommend approval with enhanced quarterly monitoring and covenant testing.`
    };
  }

  return {
    decision: 'DECLINE',
    summary: 'Insufficient credit metrics',
    rationale: 'Credit metrics do not meet minimum standards for approval.'
  };
}

function calculateRiskScore(stats, data) {
  let score = 50; // Base score

  // DSCR contribution (0-25 points)
  const dscrPoints = Math.min(25, (stats.minDSCR - 1.2) * 15);
  score += dscrPoints;

  // Leverage contribution (0-20 points)
  const leveragePoints = Math.min(20, (3.5 - stats.maxLeverage) * 10);
  score += leveragePoints;

  // ICR contribution (0-15 points)
  const icrPoints = Math.min(15, (stats.minICR - 2.0) * 8);
  score += icrPoints;

  // Collateral contribution (0-10 points)
  const ltv = data.collateral.value > 0 ? 
    ((data.transaction.requestedAmount + (data.params?.openingDebt || 0)) / data.collateral.value) * 100 : 
    100;
  const collateralPoints = Math.min(10, (75 - ltv) * 0.2);
  score += collateralPoints;

  return Math.max(0, Math.min(100, score));
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
}

function formatDateForFilename(date) {
  return date.toISOString().split('T')[0];
}