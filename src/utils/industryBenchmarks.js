// src/utils/industryBenchmarks.js

export const INDUSTRY_BENCHMARKS = {
  "Manufacturing": {
    minDSCR: 1.25,
    targetICR: 2.5,
    maxNDToEBITDA: 3.0,
    description: "Conservative metrics for capital-intensive manufacturing"
  },
  "Services": {
    minDSCR: 1.35,
    targetICR: 3.0,
    maxNDToEBITDA: 2.5,
    description: "Higher coverage for service-based businesses"
  },
  "Retail": {
    minDSCR: 1.30,
    targetICR: 2.75,
    maxNDToEBITDA: 2.75,
    description: "Balanced metrics for retail operations"
  },
  "Technology": {
    minDSCR: 1.40,
    targetICR: 3.5,
    maxNDToEBITDA: 2.0,
    description: "Strong coverage for high-growth tech companies"
  },
  "Healthcare": {
    minDSCR: 1.30,
    targetICR: 2.5,
    maxNDToEBITDA: 3.0,
    description: "Standard healthcare industry metrics"
  },
  "Real Estate": {
    minDSCR: 1.20,
    targetICR: 2.0,
    maxNDToEBITDA: 4.0,
    description: "Asset-backed real estate lending standards"
  },
  "Financial Services": {
    minDSCR: 1.50,
    targetICR: 4.0,
    maxNDToEBITDA: 2.0,
    description: "Stringent metrics for financial institutions"
  },
  "Agriculture": {
    minDSCR: 1.15,
    targetICR: 2.0,
    maxNDToEBITDA: 3.5,
    description: "Seasonal business considerations"
  },
  "Energy": {
    minDSCR: 1.25,
    targetICR: 2.5,
    maxNDToEBITDA: 3.5,
    description: "Commodity-linked business metrics"
  },
  "Transportation": {
    minDSCR: 1.20,
    targetICR: 2.25,
    maxNDToEBITDA: 3.25,
    description: "Asset-heavy transportation metrics"
  }
};

export function getBenchmarksForIndustry(industry) {
  return INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS["Manufacturing"];
}