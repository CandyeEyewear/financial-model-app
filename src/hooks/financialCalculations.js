// hooks/useFinancialCalculations.js
import { useCallback } from 'react';
import { useFinancial } from '../contexts/FinancialContext';
import { financialEngine } from '../utils/financialEngine';

export const useFinancialCalculations = () => {
  const { historicalData, assumptions } = useFinancial();

  const calculateSensitivity = useCallback((variable, range) => {
    const results = [];
    
    for (let i = range[0]; i <= range[1]; i += range[2] || 1) {
      const testAssumptions = { ...assumptions, [variable]: i };
      const result = financialEngine.calculateScenario(historicalData, testAssumptions);
      results.push({
        variableValue: i,
        dscr: result.summary.dscr,
        loanCapacity: result.summary.maxLoanAmount,
        revenueCAGR: result.summary.revenueCAGR
      });
    }
    
    return results;
  }, [historicalData, assumptions]);

  const calculateBreakEven = useCallback((targetDSCR = 1.25) => {
    // Find what revenue growth gives us target DSCR
    let low = 0;
    let high = 50;
    let result = null;
    
    for (let i = 0; i < 20; i++) { // Max 20 iterations
      const mid = (low + high) / 2;
      const testAssumptions = { ...assumptions, revenueGrowthRate: mid };
      const testResult = financialEngine.calculateScenario(historicalData, testAssumptions);
      
      if (Math.abs(testResult.summary.dscr - targetDSCR) < 0.01) {
        result = mid;
        break;
      } else if (testResult.summary.dscr < targetDSCR) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return result;
  }, [historicalData, assumptions]);

  return {
    calculateSensitivity,
    calculateBreakEven
  };
};