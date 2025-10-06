// components/DealBookExport.jsx
import React, { useState, useCallback } from 'react';
import { Button } from './Button';
import { Download, AlertCircle, Loader2, FileText, CheckCircle } from 'lucide-react';
import { generateDealBookPDF } from '../utils/dealBookPDFGenerator';
import { validateExportData } from '../utils/exportValidation';

export function DealBookExport({ 
  projections,
  params,
  scenarios,
  historicalData,
  ccy = "JMD"
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Validate data before export
  const validateData = useCallback(() => {
    const validation = validateExportData({
      projections,
      params,
      scenarios,
      historicalData
    });
    
    setValidationErrors(validation.errors);
    return validation.isValid;
  }, [projections, params, scenarios, historicalData]);

  const handleExport = async () => {
    console.log('Starting Deal Book export...');
    
    // Validate first
    if (!validateData()) {
      setExportStatus({
        type: 'error',
        message: 'Cannot export: Missing required data'
      });
      return;
    }

    setIsExporting(true);
    setExportStatus({ type: 'info', message: 'Generating PDF...' });
    
    try {
      // Prepare consolidated data model
      const exportData = {
        // Company Information
        company: {
          legalName: params.companyLegalName || 'Confidential Borrower',
          operatingName: params.companyOperatingName,
          industry: params.industry,
          businessAge: params.businessAge,
          totalAssets: params.totalAssets,
        },
        
        // Transaction Details
        transaction: {
          facilityType: params.dealStructure,
          requestedAmount: params.requestedLoanAmount,
          tenor: params.proposedTenor,
          interestRate: params.proposedPricing,
          paymentFrequency: params.paymentFrequency,
          balloonPercentage: params.balloonPercentage,
          dayCountConvention: params.dayCountConvention,
          loanPurpose: params.loanPurpose,
          useOfProceeds: params.useOfProceeds,
        },
        
        // Financial Projections
        projections: {
          base: projections.base || projections,
          scenarios: scenarios || {},
          historical: historicalData || [],
        },
        
        // Credit Analysis
        credit: {
          strengths: params.creditStrengths,
          risks: params.keyRisks,
          mitigants: params.mitigatingFactors,
          history: params.creditHistory,
        },
        
        // Collateral
        collateral: {
          description: params.collateralDescription,
          value: params.collateralValue,
          lienPosition: params.lienPosition,
          appraisalValue: params.appraisalValue,
          appraisalDate: params.appraisalDate,
        },
        
        // Management
        management: {
          names: params.keyManagementNames,
          experience: params.managementExperience,
          trackRecord: params.managementTrackRecord,
        },
        
        // Business Context
        business: {
          model: params.businessModel,
          products: params.productsServices,
          customers: params.keyCustomers,
          competitive: params.competitivePosition,
          marketShare: params.marketShare,
        },
        
        // Covenants
        covenants: {
          minDSCR: params.minDSCR,
          maxLeverage: params.maxNDToEBITDA,
          targetICR: params.targetICR,
        },
        
        // Metadata
        metadata: {
          exportDate: new Date().toISOString(),
          currency: ccy,
          generatedBy: 'Credit Analysis Platform',
        }
      };

      console.log('Exporting with data:', {
        company: exportData.company.legalName,
        facility: exportData.transaction.requestedAmount,
        scenarios: Object.keys(exportData.projections.scenarios).length
      });

      const result = await generateDealBookPDF(exportData);
      
      setExportStatus({
        type: 'success',
        message: `Deal Book exported successfully: ${result.fileName}`,
        fileName: result.fileName
      });
      
      console.log('Export completed:', result);
      
    } catch (error) {
      console.error('Export failed:', error);
      
      setExportStatus({
        type: 'error',
        message: `Export failed: ${error.message}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  const canExport = projections && params && projections.base?.rows?.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200">
        <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
        
        <div className="flex-1">
          <h3 className="font-bold text-lg text-blue-900 mb-1">Export Deal Book</h3>
          <p className="text-sm text-blue-700 mb-3">
            Generate a comprehensive, professionally formatted PDF report with complete credit analysis
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-600 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Executive Summary & Recommendation
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Financial Projections & Metrics
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Scenario Analysis & Stress Tests
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Covenant Compliance Analysis
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Credit Risk Assessment
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3" />
              Collateral & Security Details
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 mb-3">
              <div className="font-semibold mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Missing data for complete export:
              </div>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Export Status */}
          {exportStatus && (
            <div className={`p-3 rounded border text-xs flex items-start gap-2 ${
              exportStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              exportStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {exportStatus.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5" /> :
               exportStatus.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5" /> :
               <Loader2 className="w-4 h-4 mt-0.5 animate-spin" />}
              <div className="flex-1">
                <div className="font-semibold">{exportStatus.message}</div>
                {exportStatus.fileName && (
                  <div className="text-xs opacity-75 mt-1">Check your downloads folder</div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <Button
          onClick={handleExport}
          disabled={!canExport || isExporting}
          className={`px-6 py-3 font-semibold flex items-center gap-2 whitespace-nowrap ${
            !canExport || isExporting 
              ? 'bg-slate-400 cursor-not-allowed text-white' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {canExport ? 'Export PDF' : 'No Data'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}