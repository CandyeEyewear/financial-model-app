// components/FinancialStatementUpload.jsx
import React, { useState } from 'react';
import { Button } from './Button';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export function FinancialStatementUpload({ onDataExtracted, apiKey, onChange }) {
  // Support both onDataExtracted and onChange props for flexibility
  const handleDataExtracted = (data) => {
    if (onDataExtracted) {
      onDataExtracted(data);
    }
    if (onChange) {
      onChange(data);
    }
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [extractedText, setExtractedText] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus({ type: 'info', message: 'Reading file...' });

    try {
      let text = '';
      const fileType = file.name.split('.').pop().toLowerCase();

      if (fileType === 'pdf') {
        text = await extractTextFromPDF(file);
      } else if (fileType === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (['xlsx', 'xls'].includes(fileType)) {
        text = await extractTextFromExcel(file);
      } else if (fileType === 'txt') {
        text = await file.text();
      } else {
        throw new Error('Unsupported file type. Please upload PDF, DOCX, XLSX, or TXT');
      }

      setExtractedText(text);
      setUploadStatus({ type: 'success', message: 'File extracted. Processing with AI...' });

      // Send to AI for extraction
      await processWithAI(text);

    } catch (error) {
      console.error('File processing error:', error);
      setUploadStatus({ type: 'error', message: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    // Using pdf-parse library
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      
      if (!pdfjsLib) {
        throw new Error('PDF.js library not loaded. Add <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script> to your HTML');
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('PDF extraction failed. Make sure PDF.js is loaded or try a different file format.');
    }
  };

  const extractTextFromExcel = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let allText = '';
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      allText += `\n\n=== Sheet: ${sheetName} ===\n`;
      jsonData.forEach(row => {
        allText += row.join('\t') + '\n';
      });
    });
    
    return allText;
  };

  const processWithAI = async (text) => {
    if (!apiKey) {
      throw new Error('AI API key not configured. Please add REACT_APP_DEEPSEEK_API_KEY to your .env file');
    }

    const prompt = `You are a financial data extraction expert. Extract financial statement data from the following text and return ONLY valid JSON with no additional text or markdown.

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

Rules:
1. Extract ALL years found in the document
2. Use 0 for missing values
3. Convert all amounts to numeric values (no commas, currency symbols)
4. If amounts are in thousands/millions, convert to actual amounts
5. Return ONLY the JSON object, no explanation

CRITICAL: Your response must be ONLY valid JSON. Do not include any text before or after the JSON. Do not use markdown code blocks.

Financial Statement Text:
${text.substring(0, 15000)}`;

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a financial data extraction expert. You ONLY respond with valid JSON, nothing else." },
            { role: "user", content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      let extractedData = data.choices?.[0]?.message?.content || "";

      // Clean up response - remove markdown code blocks if present
      extractedData = extractedData.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const parsedData = JSON.parse(extractedData);
      
      if (!parsedData.years || !Array.isArray(parsedData.years)) {
        throw new Error('AI did not return valid financial data structure');
      }

      setUploadStatus({ 
        type: 'success', 
        message: `Successfully extracted ${parsedData.years.length} year(s) of data!` 
      });

      // Pass extracted data back to parent
      onDataExtracted(parsedData.years);

    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-6 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
        <div className="text-center">
          <Upload className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-blue-900 mb-2">Upload Financial Statements</h3>
          <p className="text-sm text-blue-700 mb-4">
            AI will automatically extract financial data from PDF, Excel, or Word documents
          </p>
          
          <input
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.txt"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="hidden"
            id="financial-upload"
          />
          
          <label 
            htmlFor="financial-upload"
            className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
              isProcessing 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
            } text-white`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Select File
              </>
            )}
          </label>

          <p className="text-xs text-blue-600 mt-2">
            Supports: PDF, Excel (.xlsx, .xls), Word (.docx), Text (.txt)
          </p>
        </div>
      </div>

      {uploadStatus && (
        <div className={`p-4 rounded-lg border flex items-start gap-3 ${
          uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
          uploadStatus.type === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          {uploadStatus.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> :
           uploadStatus.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" /> :
           <Loader2 className="w-5 h-5 text-blue-600 mt-0.5 animate-spin" />}
          <div className="flex-1">
            <div className={`font-semibold text-sm ${
              uploadStatus.type === 'success' ? 'text-emerald-800' :
              uploadStatus.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {uploadStatus.message}
            </div>
          </div>
        </div>
      )}

      {extractedText && (
        <details className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <summary className="cursor-pointer font-semibold text-sm text-slate-700">
            View Extracted Text ({extractedText.length} characters)
          </summary>
          <pre className="mt-3 text-xs text-slate-600 overflow-auto max-h-60 whitespace-pre-wrap">
            {extractedText.substring(0, 2000)}...
          </pre>
        </details>
      )}
    </div>
  );
}