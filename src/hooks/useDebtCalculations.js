/**
 * React hook for centralized debt calculations
 * Provides memoized debt metrics to prevent recalculation on every render
 *
 * Usage:
 *   const debtMetrics = useDebtCalculations(params, ebitda);
 *   console.log(debtMetrics.formatted.dscr); // "1.80x"
 */

import { useMemo } from 'react';
import { calculateAllDebtMetrics } from '../utils/debtCalculationService';

/**
 * Hook to get all debt calculations
 *
 * @param {Object} params - Financial model parameters
 * @param {number} ebitda - Optional EBITDA override (if not provided, uses params.ebitda)
 * @returns {Object} Debt calculation results with all metrics
 */
export function useDebtCalculations(params, ebitda = null) {
  const debtMetrics = useMemo(() => {
    if (!params) {
      return {
        scenario: 'none',
        hasExistingDebtToggle: false,
        rawExistingDebt: 0,
        rawNewFacility: 0,
        effectiveExistingDebt: 0,
        effectiveNewFacility: 0,
        totalDebt: 0,
        existingDebtService: 0,
        newFacilityService: 0,
        totalDebtService: 0,
        existingInterest: 0,
        newFacilityInterest: 0,
        totalInterest: 0,
        dscr: 0,
        icr: 0,
        leverage: 0,
        existingParams: null,
        newFacilityParams: null,
        tranches: [],
        blendedRate: 0,
        ebitda: 0,
        maxSustainableDebt: 0,
        availableCapacity: 0,
        excessDebt: 0,
        capacityUtilization: 0,
        isWithinCapacity: true,
        formatted: {
          existingDebt: 'J$0.0M',
          newFacility: 'J$0.0M',
          totalDebt: 'J$0.0M',
          existingDebtService: 'J$0.0M',
          newFacilityService: 'J$0.0M',
          totalDebtService: 'J$0.0M',
          dscr: '0.00x',
          icr: '0.00x',
          leverage: '0.00x',
          blendedRate: '0.00%',
          maxSustainableDebt: 'J$0.0M',
          availableCapacity: 'J$0.0M',
          excessDebt: 'J$0.0M',
          capacityUtilization: '0%',
        }
      };
    }

    return calculateAllDebtMetrics(params, ebitda);
  }, [
    // Dependency array - recalculate when these change
    params?.hasExistingDebt,
    params?.existingDebtAmount,
    params?.openingDebt,
    params?.existingDebtRate,
    params?.existingDebtTenor,
    params?.existingDebtAmortizationType,
    params?.requestedLoanAmount,
    params?.proposedPricing,
    params?.proposedTenor,
    params?.interestRate,
    params?.debtTenorYears,
    params?.amortizationType,
    params?.facilityAmortizationType,
    params?.ebitda,
    params?.minDSCR,
    params?.targetDSCR,
    ebitda,
  ]);

  return debtMetrics;
}

/**
 * Hook to get just the debt scenario
 *
 * @param {Object} params - Financial model parameters
 * @returns {string} Debt scenario: 'new_only', 'existing_only', 'both', or 'none'
 */
export function useDebtScenario(params) {
  return useMemo(() => {
    if (!params) return 'none';

    const toggleOn = params.hasExistingDebt === true;
    const existingAmount = params.existingDebtAmount || params.openingDebt || 0;
    const newAmount = params.requestedLoanAmount || 0;
    const effectiveExisting = toggleOn ? existingAmount : 0;

    const hasEffectiveExisting = effectiveExisting > 0;
    const hasNew = newAmount > 0;

    if (hasNew && hasEffectiveExisting) return 'both';
    if (hasNew && !hasEffectiveExisting) return 'new_only';
    if (!hasNew && hasEffectiveExisting) return 'existing_only';
    return 'none';
  }, [
    params?.hasExistingDebt,
    params?.existingDebtAmount,
    params?.openingDebt,
    params?.requestedLoanAmount,
  ]);
}

/**
 * Hook to check if there is any debt configured
 *
 * @param {Object} params - Financial model parameters
 * @returns {boolean} True if any debt exists
 */
export function useHasDebt(params) {
  return useMemo(() => {
    if (!params) return false;

    const toggleOn = params.hasExistingDebt === true;
    const existingAmount = params.existingDebtAmount || params.openingDebt || 0;
    const newAmount = params.requestedLoanAmount || 0;
    const effectiveExisting = toggleOn ? existingAmount : 0;

    return effectiveExisting > 0 || newAmount > 0;
  }, [
    params?.hasExistingDebt,
    params?.existingDebtAmount,
    params?.openingDebt,
    params?.requestedLoanAmount,
  ]);
}

export default useDebtCalculations;
