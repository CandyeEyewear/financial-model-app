import React from "react";
import { Sparkles, AlertTriangle } from "lucide-react";

export function SmartSuggestion({ type, current, suggested, impact }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-900 mb-1">💡 Smart Suggestion</p>
        <p className="text-xs text-blue-800 mb-2">
          {type === 'equity' && (
            <>Your equity of <strong>{current}</strong> represents a small portion of total capital. 
            Industry standard: <strong>15-20%</strong>. Consider increasing to <strong>{suggested}</strong>.</>
          )}
        </p>
        {impact && (
          <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
            <strong>Impact:</strong> {impact}
          </div>
        )}
      </div>
    </div>
  );
}

export function OpeningDebtWarning({ maturityDate, newFacilityEndDate, onCalculate }) {
  const maturity = new Date(maturityDate);
  const facilityEnd = new Date(newFacilityEndDate);
  
  if (maturity < facilityEnd) {
    const yearsRemaining = (facilityEnd - maturity) / (365 * 24 * 60 * 60 * 1000);
    
    return (
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 mb-1">⚠️ Refinancing Required</p>
          <p className="text-xs text-amber-800 mb-2">
            Opening debt matures <strong>{new Date(maturityDate).toLocaleDateString()}</strong> but 
            new facility runs until <strong>{new Date(newFacilityEndDate).toLocaleDateString()}</strong>.
            Gap of <strong>{yearsRemaining.toFixed(1)} years</strong> needs coverage.
          </p>
          {onCalculate && (
            <button 
              onClick={onCalculate}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
            >
              Calculate refinancing impact →
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return null;
}