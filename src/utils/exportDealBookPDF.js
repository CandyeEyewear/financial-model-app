// utils/exportDealBookPDF.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportDealBookToPDF = async (components, state) => {
  console.log('📄 Starting PDF generation...', {
    components: Object.keys(components),
    state: state.dealName
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let currentY = 20;

  // Add cover page
  pdf.setFontSize(24);
  pdf.setTextColor(40, 40, 40);
  pdf.text('DEAL BOOK', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 15;
  pdf.setFontSize(16);
  pdf.text(state.dealName || 'Financial Analysis', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 10;
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated on: ${state.exportDate}`, pageWidth / 2, currentY, { align: 'center' });

  // Add summary page
  pdf.addPage();
  currentY = 20;

  // Executive Summary
  pdf.setFontSize(18);
  pdf.setTextColor(40, 40, 40);
  pdf.text('EXECUTIVE SUMMARY', 20, currentY);
  currentY += 15;

  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);

  // Key Financial Metrics
  const summaryData = [
    ['Enterprise Value', formatCurrency(state.projections?.enterpriseValue, state.currency)],
    ['Equity Value', formatCurrency(state.projections?.equityValue, state.currency)],
    ['Equity IRR', formatPercentage(state.projections?.irr)],
    ['Equity MOIC', `${state.projections?.moic?.toFixed(2)}x`],
    ['Facility Amount', formatCurrency(state.facilityParams?.requestedLoanAmount, state.currency)],
    ['Interest Rate', formatPercentage(state.facilityParams?.proposedPricing)],
  ];

  summaryData.forEach(([label, value]) => {
    pdf.text(`${label}:`, 25, currentY);
    pdf.text(value, 80, currentY);
    currentY += 6;
  });

  // Add Financial Analysis section
  currentY += 10;
  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text('FINANCIAL ANALYSIS', 20, currentY);
  currentY += 12;

  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);

  // Credit Metrics
  const creditData = [
    ['Minimum DSCR', state.creditMetrics?.minDSCR?.toFixed(2)],
    ['Maximum Leverage', state.creditMetrics?.maxLeverage?.toFixed(2)],
    ['Average DSCR', state.creditMetrics?.avgDSCR?.toFixed(2)],
  ];

  creditData.forEach(([label, value]) => {
    pdf.text(`${label}:`, 25, currentY);
    pdf.text(value, 80, currentY);
    currentY += 6;
  });

  // Add Business Information section
  currentY += 10;
  if (currentY > pageHeight - 50) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text('BUSINESS INFORMATION', 20, currentY);
  currentY += 12;

  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);

  const businessInfo = [
    ['Industry', state.businessData?.industry],
    ['Business Model', state.businessData?.businessModel?.substring(0, 100) + '...'],
    ['Key Products', state.businessData?.productsServices?.substring(0, 100) + '...'],
  ];

  businessInfo.forEach(([label, value]) => {
    pdf.text(`${label}:`, 25, currentY);
    pdf.text(value || 'N/A', 80, currentY);
    currentY += 6;
  });

  // Add detailed financial tables
  pdf.addPage();
  currentY = 20;

  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text('DETAILED FINANCIAL PROJECTIONS', 20, currentY);
  currentY += 15;

  // Projection table header
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.setFillColor(59, 130, 246);
  pdf.rect(20, currentY, pageWidth - 40, 8, 'F');
  
  pdf.text('Year', 25, currentY + 6);
  pdf.text('Revenue', 50, currentY + 6);
  pdf.text('EBITDA', 80, currentY + 6);
  pdf.text('DSCR', 110, currentY + 6);
  pdf.text('Leverage', 140, currentY + 6);
  
  currentY += 12;

  // Projection table rows
  pdf.setTextColor(60, 60, 60);
  if (state.projections?.rows) {
    state.projections.rows.forEach((row, index) => {
      if (currentY > pageHeight - 20) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.text(row.year.toString(), 25, currentY);
      pdf.text(formatCurrency(row.revenue, state.currency), 50, currentY);
      pdf.text(formatCurrency(row.ebitda, state.currency), 80, currentY);
      pdf.text(row.dscr?.toFixed(2), 110, currentY);
      pdf.text(row.ndToEbitda?.toFixed(2), 140, currentY);
      
      currentY += 8;
    });
  }

  // Add footer
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Confidential - ${state.dealName}`, 20, pageHeight - 10);
  }

  // Save the PDF
  const fileName = `DealBook_${state.dealName.replace(/\s+/g, '_')}_${state.exportDate.replace(/\//g, '-')}.pdf`;
  pdf.save(fileName);

  console.log('✅ PDF generated successfully:', fileName);
  return fileName;
};

// Helper functions
const formatCurrency = (value, currency = 'JMD') => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatPercentage = (value) => {
  if (!value) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
};