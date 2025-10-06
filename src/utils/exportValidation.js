// utils/exportValidation.js

export function validateExportData({ projections, params, scenarios, historicalData }) {
  const errors = [];
  const warnings = [];

  // Required: Projections
  if (!projections) {
    errors.push('No projection data available');
  } else {
    const baseProj = projections.base || projections;
    if (!baseProj.rows || baseProj.rows.length === 0) {
      errors.push('Projection data is empty');
    }
    if (!baseProj.enterpriseValue) {
      warnings.push('Enterprise value not calculated');
    }
  }

  // Required: Company Information
  if (!params) {
    errors.push('No parameter data available');
  } else {
    if (!params.companyLegalName && !params.companyOperatingName) {
      errors.push('Company name is required');
    }
    if (!params.requestedLoanAmount || params.requestedLoanAmount <= 0) {
      errors.push('Loan amount is required');
    }
    if (!params.industry) {
      warnings.push('Industry not specified');
    }
  }

  // Optional but recommended
  if (!scenarios || Object.keys(scenarios).length === 0) {
    warnings.push('No scenario analysis available - report will be less comprehensive');
  }

  if (!historicalData || historicalData.length === 0) {
    warnings.push('No historical data - baseline assumptions cannot be validated');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    canExport: errors.length === 0,
    isComplete: errors.length === 0 && warnings.length === 0
  };
}