/**
 * Financial Statement Upload Component
 * AI-powered extraction with drag-and-drop, validation, and review step
 * WCAG 2.1 AA Compliant
 */
import React, { useState, useRef, useCallback } from 'react';
import { Button } from './Button';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  AlertTriangle,
  FileSpreadsheet,
  File,
  Check,
  RotateCcw
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { currencyFmt } from '../utils/formatters';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 20000; // Characters to send to AI

const ALLOWED_TYPES = {
  'application/pdf': { ext: 'pdf', icon: FileText, label: 'PDF Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', icon: FileText, label: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', icon: FileSpreadsheet, label: 'Excel Spreadsheet' },
  'application/vnd.ms-excel': { ext: 'xls', icon: FileSpreadsheet, label: 'Excel Spreadsheet' },
  'text/plain': { ext: 'txt', icon: File, label: 'Text File' },
};

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls', 'txt'];

// User-friendly error messages
const ERROR_MESSAGES = {
  'pdf.js': 'PDF processing is temporarily unavailable. Please try uploading an Excel or Word document instead.',
  'api error': 'AI service unavailable, and smart parser couldn\'t extract data. Try an Excel file with clear headers.',
  'parse': 'Could not find financial data. Please ensure the document has labeled rows (Revenue, COGS, etc.) and year columns.',
  'timeout': 'Processing took too long. Try uploading a smaller document or specific pages only.',
  'token': 'Please sign in to use AI extraction, or try an Excel file which can be parsed without AI.',
  'limit': 'You\'ve reached your monthly AI usage limit. Try uploading an Excel file (no AI needed).',
  'network': 'Network error. Please check your internet connection and try again.',
  'empty': 'The document appears to be empty or unreadable. Please try a different file.',
};

const getHumanReadableError = (error) => {
  const errorMsg = error.message?.toLowerCase() || '';
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMsg.includes(key.toLowerCase())) {
      return message;
    }
  }
  return 'Something went wrong processing your file. Please try a different format or contact support.';
};

// Processing steps for progress indication
const PROCESSING_STEPS = [
  { id: 'validate', label: 'Validating file', progress: 10 },
  { id: 'read', label: 'Reading document', progress: 30 },
  { id: 'extract', label: 'Extracting text', progress: 50 },
  { id: 'analyze', label: 'AI analyzing data', progress: 70 },
  { id: 'parse', label: 'Parsing results', progress: 90 },
  { id: 'complete', label: 'Complete', progress: 100 },
];

export function FinancialStatementUpload({ onDataExtracted, accessToken, onChange }) {
  // Support both callback props
  const handleDataExtracted = useCallback((data) => {
    if (onDataExtracted) onDataExtracted(data);
    if (onChange) onChange(data);
  }, [onDataExtracted, onChange]);

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [extractionResult, setExtractionResult] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Refs
  const fileInputRef = useRef(null);
  const statusAnnouncerRef = useRef(null);

  // Announce status changes for screen readers
  const announceStatus = (message) => {
    if (statusAnnouncerRef.current) {
      statusAnnouncerRef.current.textContent = message;
    }
  };

  // File validation
  const validateFile = (file) => {
    const errors = [];
    
    if (!file) {
      errors.push('No file selected.');
      return errors;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push(`Unsupported file type (.${extension}). Please upload PDF, Excel, Word, or text files.`);
    }

    // Check if file is empty
    if (file.size === 0) {
      errors.push('The file appears to be empty.');
    }

    return errors;
  };

  // Handle file selection (from input or drop)
  const handleFileSelect = (file) => {
    const errors = validateFile(file);
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      setSelectedFile(file);
      setUploadStatus(null);
      setExtractionResult(null);
      setExtractedText('');
      announceStatus(`File selected: ${file.name}`);
    } else {
      setSelectedFile(null);
      announceStatus(`File validation failed: ${errors.join('. ')}`);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setValidationErrors([]);
    setUploadStatus(null);
    setExtractionResult(null);
    setExtractedText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    announceStatus('File removed');
  };

  // Update processing step
  const updateStep = (stepId) => {
    const step = PROCESSING_STEPS.find(s => s.id === stepId);
    if (step) {
      setCurrentStep(step);
      setUploadStatus({ type: 'info', message: step.label + '...' });
      announceStatus(step.label);
    }
  };

  // Text extraction functions
  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      
      if (!pdfjsLib) {
        throw new Error('PDF.js library not loaded');
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 20); // Limit pages for performance
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      if (fullText.trim().length === 0) {
        throw new Error('empty');
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('PDF.js: ' + error.message);
    }
  };

  const extractTextFromExcel = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let allText = '';
    
    // Only process first 3 sheets for performance
    const sheetsToProcess = workbook.SheetNames.slice(0, 3);
    
    sheetsToProcess.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      allText += `\n=== ${sheetName} ===\n`;
      jsonData.forEach(row => {
        if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          allText += row.join('\t') + '\n';
        }
      });
    });
    
    if (allText.trim().length === 0) {
      throw new Error('empty');
    }
    
    return allText;
  };

  const extractTextFromDocx = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.value.trim().length === 0) {
      throw new Error('empty');
    }
    
    return result.value;
  };

  // Smart text parser - extracts financial data without AI
  const parseFinancialText = (text) => {
    // Normalize text - replace multiple spaces/tabs with single space
    const normalizedText = text.replace(/[\t\r]+/g, ' ').replace(/  +/g, ' ');
    
    // Find all 4-digit years in the text (between 2000-2030)
    const yearMatches = normalizedText.match(/\b(20[0-3]\d)\b/g);
    const uniqueYears = [...new Set(yearMatches || [])].map(Number).sort((a, b) => b - a).slice(0, 5);
    
    if (uniqueYears.length === 0) {
      throw new Error('parse: No years found in document');
    }

    // Extract ALL large numbers from the text (likely financial figures)
    const allNumbers = [];
    const numberRegex = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g;
    let match;
    while ((match = numberRegex.exec(normalizedText)) !== null) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      // Only include numbers > 1000 (filter out years and small numbers)
      if (num > 10000) {
        allNumbers.push({ value: num, index: match.index });
      }
    }

    // Financial keywords and their patterns
    const keywords = {
      revenue: /\b(revenue|sales|turnover|total\s*income)\b/i,
      cogs: /\b(cost\s*of\s*(goods\s*)?sold|cogs|direct\s*cost|cost\s*of\s*sales)\b/i,
      grossProfit: /\b(gross\s*profit|gross\s*margin)\b/i,
      opex: /\b(operating\s*expense|opex|administrative|admin|sg&?a)\b/i,
      interestExpense: /\b(interest\s*expense|finance\s*cost)\b/i,
      taxExpense: /\b(tax(ation)?)\b/i,
      netIncome: /\b(net\s*(profit|income|loss)|profit\s*after\s*tax)\b/i,
      profitBeforeTax: /\b(profit\s*before\s*tax(ation)?|pbt)\b/i,
    };

    // Find positions of keywords in text
    const findKeywordPosition = (pattern) => {
      const match = pattern.exec(normalizedText);
      return match ? match.index : -1;
    };

    // For each keyword, find the numbers that appear after it
    const extractValuesForKeyword = (pattern) => {
      const keywordPos = findKeywordPosition(pattern);
      if (keywordPos === -1) return [];
      
      // Find numbers that appear within 200 characters after the keyword
      const nearbyNumbers = allNumbers
        .filter(n => n.index > keywordPos && n.index < keywordPos + 200)
        .map(n => n.value)
        .slice(0, uniqueYears.length); // Only take as many as we have years
      
      return nearbyNumbers;
    };

    // Try to detect if numbers are in thousands/millions
    const detectScale = (text) => {
      if (/in\s*millions|in\s*\$?m\b|\(.*millions.*\)/i.test(text)) return 1000000;
      if (/in\s*thousands|in\s*\$?k\b|\(.*thousands.*\)/i.test(text)) return 1000;
      return 1;
    };
    const scale = detectScale(normalizedText);

    // Build year data - try to match numbers with years
    const yearsData = uniqueYears.map((year, yearIndex) => {
      const yearData = {
        year,
        revenue: 0,
        cogs: 0,
        opex: 0,
        depreciation: 0,
        interestExpense: 0,
        taxExpense: 0,
        cash: 0,
        receivables: 0,
        inventory: 0,
        otherCurrentAssets: 0,
        ppe: 0,
        accountsPayable: 0,
        accruedExp: 0,
        shortTermDebt: 0,
        longTermDebt: 0,
        opCashFlow: 0,
        capex: 0,
      };
      
      // Temporary storage for derived calculations
      let grossProfit = 0;

      // Extract values for each financial line item
      for (const [field, pattern] of Object.entries(keywords)) {
        const values = extractValuesForKeyword(pattern);
        if (values.length > yearIndex) {
          if (field === 'grossProfit') {
            grossProfit = values[yearIndex] * scale;
          } else if (field in yearData) {
            yearData[field] = values[yearIndex] * scale;
          }
        }
      }

      // If we found grossProfit but not revenue, try to find revenue separately
      if (yearData.revenue === 0) {
        // Look for the largest numbers near "Revenue" or at the start
        const revenueValues = extractValuesForKeyword(/\brevenue\b/i);
        if (revenueValues.length > yearIndex) {
          yearData.revenue = revenueValues[yearIndex] * scale;
        }
      }

      // Calculate COGS from gross profit if we have revenue but not COGS
      if (yearData.revenue > 0 && yearData.cogs === 0 && grossProfit > 0) {
        yearData.cogs = yearData.revenue - grossProfit;
      }

      return yearData;
    });

    // Filter out years with no meaningful data
    const validYears = yearsData.filter(y => y.revenue > 0 || y.cogs > 0 || y.opex > 0);
    
    if (validYears.length === 0) {
      throw new Error('parse: Could not extract financial data from document');
    }

    return validYears;
  };

  // Data quality checks
  const detectDataQualityIssues = (years) => {
    const warnings = [];
    
    years.forEach(year => {
      if (year.revenue === 0) {
        warnings.push(`Year ${year.year}: Revenue is zero - please verify`);
      }
      if (year.cogs > year.revenue && year.revenue > 0) {
        warnings.push(`Year ${year.year}: COGS exceeds revenue - check for data errors`);
      }
      if (year.year < 1900 || year.year > 2100) {
        warnings.push(`Year ${year.year}: Invalid year - please correct`);
      }
    });
    
    return warnings;
  };

  // AI Processing
  const processWithAI = async (text) => {
    if (!accessToken) {
      throw new Error('token');
    }

    const prompt = `You are a financial data extraction expert. Extract financial statement data from the following text and return ONLY valid JSON.

FIELD DEFINITIONS:
- revenue: Total Revenue, Sales, or Turnover
- cogs: Cost of Goods Sold, Direct Cost, or Cost of Sales (NOT the same as revenue!)
- opex: Operating Expenses, Administrative Expenses, or SG&A
- depreciation: Depreciation and Amortization
- interestExpense: Interest Expense or Finance Cost
- taxExpense: Tax Expense or Taxation
- cash: Cash and Cash Equivalents
- receivables: Accounts Receivable or Trade Receivables
- inventory: Inventory or Stock
- ppe: Property Plant & Equipment or Fixed Assets
- accountsPayable: Accounts Payable or Trade Payables
- shortTermDebt: Short-term Debt or Current Portion of Debt
- longTermDebt: Long-term Debt or Non-current Borrowings

Extract these fields for each year found:
{
  "years": [
    {
      "year": 2023,
      "revenue": 1000000,
      "cogs": 400000,
      "opex": 300000,
      "depreciation": 50000,
      "interestExpense": 20000,
      "taxExpense": 40000,
      "cash": 100000,
      "receivables": 150000,
      "inventory": 80000,
      "otherCurrentAssets": 20000,
      "ppe": 500000,
      "accountsPayable": 90000,
      "accruedExp": 30000,
      "shortTermDebt": 50000,
      "longTermDebt": 200000,
      "opCashFlow": 180000,
      "capex": 60000
    }
  ]
}

RULES:
1. Extract ALL years found (up to 5 most recent)
2. Use 0 for missing values - do NOT guess
3. Convert amounts to numeric values (remove commas, currency symbols)
4. Revenue and COGS should be DIFFERENT values - COGS is typically 40-80% of revenue
5. Return ONLY JSON, no explanation or markdown

Financial Statement Text:
${text.substring(0, MAX_TEXT_LENGTH)}`;

    const systemMessage = "You are a financial data extraction expert. You ONLY respond with valid JSON, nothing else. Be conservative - use 0 for any values you cannot clearly identify.";

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt,
          systemMessage,
          extractionMode: true // Signal to use lower temperature
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('limit');
        }
        throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown'}`);
      }

      const data = await response.json();
      let extractedData = data.choices?.[0]?.message?.content || "";

      // Clean up response - remove markdown code blocks if present
      extractedData = extractedData.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const parsedData = JSON.parse(extractedData);
      
      if (!parsedData.years || !Array.isArray(parsedData.years) || parsedData.years.length === 0) {
        throw new Error('parse: No financial data found');
      }

      // Log what AI returned for debugging
      console.log('AI extracted data:', JSON.stringify(parsedData.years, null, 2));

      // Ensure all required fields have default values
      const normalizedYears = parsedData.years.map(year => ({
        year: year.year || 0,
        revenue: Number(year.revenue) || 0,
        cogs: Number(year.cogs) || 0,
        opex: Number(year.opex) || 0,
        depreciation: Number(year.depreciation) || 0,
        interestExpense: Number(year.interestExpense) || 0,
        taxExpense: Number(year.taxExpense) || 0,
        cash: Number(year.cash) || 0,
        receivables: Number(year.receivables) || 0,
        inventory: Number(year.inventory) || 0,
        otherCurrentAssets: Number(year.otherCurrentAssets) || 0,
        ppe: Number(year.ppe) || 0,
        accountsPayable: Number(year.accountsPayable) || 0,
        accruedExp: Number(year.accruedExp) || 0,
        shortTermDebt: Number(year.shortTermDebt) || 0,
        longTermDebt: Number(year.longTermDebt) || 0,
        opCashFlow: Number(year.opCashFlow) || 0,
        capex: Number(year.capex) || 0,
      }));

      console.log('Normalized data:', JSON.stringify(normalizedYears, null, 2));

      return normalizedYears;

    } catch (error) {
      console.error('AI processing error:', error);
      throw error;
    }
  };

  // Main processing function
  const handleProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setExtractionResult(null);
    setExtractedText('');

    try {
      // Step 1: Validate
      updateStep('validate');
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for UX

      // Step 2: Read file
      updateStep('read');
      let text = '';
      const fileType = selectedFile.name.split('.').pop().toLowerCase();

      // Step 3: Extract text
      updateStep('extract');
      
      if (fileType === 'pdf') {
        text = await extractTextFromPDF(selectedFile);
      } else if (fileType === 'docx') {
        text = await extractTextFromDocx(selectedFile);
      } else if (['xlsx', 'xls'].includes(fileType)) {
        text = await extractTextFromExcel(selectedFile);
      } else if (fileType === 'txt') {
        text = await selectedFile.text();
        if (text.trim().length === 0) {
          throw new Error('empty');
        }
      } else {
        throw new Error('Unsupported file type');
      }

      setExtractedText(text);

      // Step 4: Extract financial data
      updateStep('analyze');
      let extractedYears = null;
      let usedAI = false;
      let parseWarnings = [];

      // Helper to check if extraction result is useful
      const isValidExtraction = (years) => {
        if (!years || years.length === 0) return false;
        // Check that at least one year has revenue > 0 AND revenue != cogs (common parsing error)
        return years.some(y => {
          const revenue = Number(y.revenue) || 0;
          const cogs = Number(y.cogs) || 0;
          return revenue > 0 && revenue !== cogs;
        });
      };

      // Determine file type
      const fileExt = selectedFile.name.split('.').pop().toLowerCase();
      const isExcel = ['xlsx', 'xls'].includes(fileExt);
      
      // ONLY use smart parser for Excel files (structured data)
      // PDFs and other formats should ALWAYS use AI
      if (isExcel) {
        try {
          console.log('Trying smart parser for Excel file...');
          extractedYears = parseFinancialText(text);
          
          if (isValidExtraction(extractedYears)) {
            parseWarnings.push('Extracted using smart parser (no AI required)');
            console.log('Smart parser succeeded with valid data');
          } else {
            console.log('Smart parser result invalid (revenue=0 or revenue=cogs), falling back to AI');
            extractedYears = null;
          }
        } catch (parseError) {
          console.log('Smart parser failed:', parseError.message);
          extractedYears = null;
        }
      } else {
        console.log(`File type "${fileExt}" - skipping smart parser, using AI directly`);
      }

      // Use AI if smart parser didn't work or wasn't applicable
      if (!extractedYears) {
        if (accessToken) {
          try {
            console.log('Using AI for extraction...');
            extractedYears = await processWithAI(text);
            usedAI = true;
            
            // Validate AI results too
            if (!isValidExtraction(extractedYears)) {
              parseWarnings.push('Warning: Please verify the extracted data is correct');
            }
            console.log('AI extraction completed');
          } catch (aiError) {
            console.error('AI extraction failed:', aiError);
            throw new Error('parse: Could not extract data. Please try again or use an Excel file.');
          }
        } else {
          throw new Error('token: Please sign in to extract data from PDF files.');
        }
      }

      // Step 5: Parse and validate results
      updateStep('parse');
      const warnings = [...parseWarnings, ...detectDataQualityIssues(extractedYears)];

      // Step 6: Complete - show for review
      updateStep('complete');
      setExtractionResult({
        data: extractedYears,
        warnings,
        needsReview: true
      });

      const methodUsed = usedAI ? 'using AI' : 'using smart parser';
      setUploadStatus({ 
        type: 'success', 
        message: `Found ${extractedYears.length} year(s) of financial data ${methodUsed}. Please review before applying.` 
      });
      announceStatus(`Successfully extracted ${extractedYears.length} years of data. Please review the results.`);

    } catch (error) {
      console.error('Processing error:', error);
      const friendlyMessage = getHumanReadableError(error);
      setUploadStatus({ type: 'error', message: friendlyMessage });
      announceStatus(`Error: ${friendlyMessage}`);
      setCurrentStep(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply extracted data
  const applyExtractedData = () => {
    if (extractionResult?.data) {
      handleDataExtracted(extractionResult.data);
      setUploadStatus({ 
        type: 'success', 
        message: `Applied ${extractionResult.data.length} year(s) of data to your model!` 
      });
      announceStatus('Data applied successfully');
      setExtractionResult(null);
      clearFile();
    }
  };

  // Discard results
  const discardResults = () => {
    setExtractionResult(null);
    setUploadStatus(null);
    setCurrentStep(null);
    announceStatus('Extracted data discarded');
  };

  // Get file icon
  const getFileIcon = () => {
    if (!selectedFile) return FileText;
    const type = Object.entries(ALLOWED_TYPES).find(([mime]) => 
      selectedFile.type === mime
    );
    return type ? type[1].icon : FileText;
  };

  const FileIcon = getFileIcon();

  return (
    <div className="space-y-4">
      {/* Screen reader announcements */}
      <div 
        ref={statusAnnouncerRef}
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && !selectedFile && fileInputRef.current?.click()}
        className={`
          relative p-6 sm:p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.01]' 
            : selectedFile
              ? 'border-primary-300 bg-primary-50/50 dark:bg-primary-900/10'
              : 'border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
          }
          ${isProcessing ? 'pointer-events-none' : ''}
        `}
        role="button"
        tabIndex={isProcessing ? -1 : 0}
        aria-label={selectedFile ? `Selected file: ${selectedFile.name}. Press Enter to change file.` : 'Click or drag and drop to upload financial statements'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isProcessing && !selectedFile) {
              fileInputRef.current?.click();
            }
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.xls,.txt"
          onChange={handleInputChange}
          disabled={isProcessing}
          className="sr-only"
          id="financial-upload"
          aria-describedby="upload-instructions"
        />

        {/* File selected state */}
        {selectedFile ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleProcess();
                }}
                disabled={isProcessing || validationErrors.length > 0}
                loading={isProcessing}
                className="flex-1 sm:flex-none"
              >
                {isProcessing ? 'Processing...' : 'Extract Data'}
              </Button>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                disabled={isProcessing}
                aria-label="Remove file"
                className="px-3"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="text-center">
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors
              ${isDragging 
                ? 'bg-primary-200 dark:bg-primary-800' 
                : 'bg-primary-100 dark:bg-primary-900/30'
              }
            `}>
              <Upload 
                className={`w-8 h-8 transition-colors ${
                  isDragging 
                    ? 'text-primary-700 dark:text-primary-300' 
                    : 'text-primary-600 dark:text-primary-400'
                }`} 
                aria-hidden="true" 
              />
            </div>
            
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              {isDragging ? 'Drop your file here' : 'Upload Financial Statements'}
            </h3>
            
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4" id="upload-instructions">
              Drag and drop or click to select. AI will extract financial data automatically.
            </p>
            
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors">
              <FileText className="w-4 h-4" aria-hidden="true" />
              Select File
            </div>
            
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
              Supports: PDF, Excel (.xlsx, .xls), Word (.docx), Text (.txt) — Max 10MB
            </p>
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-400/10 rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-primary-700 dark:text-primary-300 font-semibold text-lg">
              Drop to upload
            </div>
          </div>
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div 
          className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-danger-800 dark:text-danger-200 text-sm">
                File validation failed
              </h4>
              <ul className="mt-1 text-sm text-danger-700 dark:text-danger-300 list-disc list-inside">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {isProcessing && currentStep && (
        <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin" aria-hidden="true" />
            <span className="font-medium text-primary-800 dark:text-primary-200 text-sm">
              {currentStep.label}...
            </span>
          </div>
          <div className="h-2 bg-primary-100 dark:bg-primary-900/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-500 ease-out"
              style={{ width: `${currentStep.progress}%` }}
              role="progressbar"
              aria-valuenow={currentStep.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Processing: ${currentStep.progress}% complete`}
            />
          </div>
          <div className="flex justify-between text-xs text-primary-600 dark:text-primary-400 mt-1">
            <span>Step {PROCESSING_STEPS.findIndex(s => s.id === currentStep.id) + 1} of {PROCESSING_STEPS.length}</span>
            <span>{currentStep.progress}%</span>
          </div>
        </div>
      )}

      {/* Status message (when not processing) */}
      {uploadStatus && !isProcessing && !extractionResult && (
        <div 
          className={`p-4 rounded-lg border flex items-start gap-3 ${
            uploadStatus.type === 'success' 
              ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800' 
              : uploadStatus.type === 'error' 
                ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800' 
                : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
          }`}
          role="alert"
        >
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : uploadStatus.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Loader2 className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <p className={`text-sm font-medium ${
            uploadStatus.type === 'success' 
              ? 'text-success-800 dark:text-success-200' 
              : uploadStatus.type === 'error' 
                ? 'text-danger-800 dark:text-danger-200' 
                : 'text-primary-800 dark:text-primary-200'
          }`}>
            {uploadStatus.message}
          </p>
        </div>
      )}

      {/* Extraction review panel */}
      {extractionResult && extractionResult.needsReview && (
        <div className="rounded-xl border-2 border-warning-300 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-warning-100 dark:bg-warning-900/30 border-b border-warning-200 dark:border-warning-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400" aria-hidden="true" />
              <h4 className="font-semibold text-warning-900 dark:text-warning-100">
                Review Extracted Data
              </h4>
            </div>
            <p className="text-sm text-warning-700 dark:text-warning-300 mt-1">
              Please verify the AI extraction is correct before applying to your model.
            </p>
          </div>

          {/* Warnings */}
          {extractionResult.warnings.length > 0 && (
            <div className="px-4 py-3 bg-warning-100/50 dark:bg-warning-900/20 border-b border-warning-200 dark:border-warning-800">
              <p className="text-xs font-semibold text-warning-800 dark:text-warning-200 mb-1">
                Potential issues detected:
              </p>
              <ul className="text-xs text-warning-700 dark:text-warning-300 list-disc list-inside space-y-0.5">
                {extractionResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Data table */}
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warning-200 dark:border-warning-700">
                  <th className="text-left py-2 px-2 font-semibold text-neutral-700 dark:text-neutral-300">Year</th>
                  <th className="text-right py-2 px-2 font-semibold text-neutral-700 dark:text-neutral-300">Revenue</th>
                  <th className="text-right py-2 px-2 font-semibold text-neutral-700 dark:text-neutral-300">COGS</th>
                  <th className="text-right py-2 px-2 font-semibold text-neutral-700 dark:text-neutral-300">OpEx</th>
                  <th className="text-right py-2 px-2 font-semibold text-neutral-700 dark:text-neutral-300">Total Debt</th>
                </tr>
              </thead>
              <tbody>
                {extractionResult.data.map((year, idx) => {
                  const revenue = Number(year.revenue) || 0;
                  const cogs = Number(year.cogs) || 0;
                  const opex = Number(year.opex) || 0;
                  const totalDebt = (Number(year.shortTermDebt) || 0) + (Number(year.longTermDebt) || 0);
                  
                  return (
                    <tr 
                      key={year.year || idx} 
                      className="border-b border-warning-100 dark:border-warning-800/50 last:border-0"
                    >
                      <td className="py-2 px-2 font-medium text-neutral-900 dark:text-neutral-100">
                        {year.year}
                      </td>
                      <td className="text-right py-2 px-2 text-neutral-700 dark:text-neutral-300">
                        {revenue > 0 ? currencyFmt(revenue) : '—'}
                      </td>
                      <td className="text-right py-2 px-2 text-neutral-700 dark:text-neutral-300">
                        {cogs > 0 ? currencyFmt(cogs) : '—'}
                      </td>
                      <td className="text-right py-2 px-2 text-neutral-700 dark:text-neutral-300">
                        {opex > 0 ? currencyFmt(opex) : '—'}
                      </td>
                      <td className="text-right py-2 px-2 text-neutral-700 dark:text-neutral-300">
                        {totalDebt > 0 ? currencyFmt(totalDebt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 bg-warning-100/50 dark:bg-warning-900/20 border-t border-warning-200 dark:border-warning-800 flex flex-col sm:flex-row gap-2">
            <Button onClick={applyExtractedData} className="flex-1 sm:flex-none">
              <Check className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Apply to Model
            </Button>
            <Button variant="secondary" onClick={discardResults} className="flex-1 sm:flex-none">
              <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Discard & Retry
            </Button>
          </div>
        </div>
      )}

      {/* Extracted text preview (collapsible) */}
      {extractedText && !isProcessing && (
        <details className="rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <summary className="px-4 py-3 cursor-pointer font-medium text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors rounded-lg">
            View extracted text ({extractedText.length.toLocaleString()} characters)
          </summary>
          <div className="px-4 pb-4">
            <pre className="mt-2 p-3 text-xs text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700 overflow-auto max-h-60 whitespace-pre-wrap font-mono">
              {extractedText.substring(0, 3000)}
              {extractedText.length > 3000 && '\n\n... [truncated]'}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

export default FinancialStatementUpload;
