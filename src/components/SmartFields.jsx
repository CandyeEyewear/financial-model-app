// src/components/SmartFields.jsx
import React, { useState, useEffect } from "react";
import { AlertTriangle, Info, BarChart3, Pencil, RefreshCw } from "lucide-react";
import { Label } from "./Label";
import { Input } from "./Input";
import { clamp, isValidNumber, decimalToPercent, percentToDecimal, safeDivide } from "../utils/mathUtils";

// ============================================================================
// AUTO-POPULATION BADGE
// ============================================================================
export function AutoPopBadge({ isEdited }) {
  if (isEdited) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
        <Pencil className="w-3 h-3" /> Edited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-cyan-100 text-cyan-800 rounded-full">
      <RefreshCw className="w-3 h-3" /> Auto
    </span>
  );
}

// ============================================================================
// SMART PERCENTAGE FIELD
// ============================================================================
export function SmartPctField({ 
  label, 
  value, 
  onChange, 
  isAutoPop = false, 
  historicalValue = null, 
  min = -100, 
  max = 100, 
  helper = null 
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(decimalToPercent(value).toFixed(2));
    }
  }, [value, isFocused]);

  useEffect(() => {
    setDisplayValue(decimalToPercent(value).toFixed(2));
  }, []);

  const handleChange = (e) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    setIsEdited(true);

    const numValue = parseFloat(inputValue);
    if (isValidNumber(numValue)) {
      const clamped = clamp(numValue, min, max);
      onChange(percentToDecimal(clamped));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(displayValue);
    if (isValidNumber(numValue)) {
      const clamped = clamp(numValue, min, max);
      setDisplayValue(clamped.toFixed(2));
      onChange(percentToDecimal(clamped));
    } else {
      setDisplayValue(decimalToPercent(value).toFixed(2));
    }
  };

  const variance = historicalValue ? safeDivide(value - historicalValue, historicalValue, 0) * 100 : null;
  const isSignificantVariance = variance && Math.abs(variance) > 10;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-semibold text-slate-700">{label}</label>
        {isAutoPop && <AutoPopBadge isEdited={isEdited} />}
      </div>
      
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={displayValue}
          onFocus={(e) => { setIsFocused(true); e.target.select(); }}
          onBlur={handleBlur}
          onChange={handleChange}
          step="0.01"
          className={`w-full h-10 px-3 text-sm border-2 rounded-md transition-all duration-200 ${
            isAutoPop && !isEdited 
              ? 'bg-cyan-50 border-cyan-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200' 
              : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
          }`}
          placeholder="e.g., 12"
        />
        <span className="text-slate-600 text-sm font-semibold">%</span>
      </div>
      
      {isAutoPop && !isEdited && (
        <p className="text-xs text-cyan-700 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Calculated from historical data - click to edit
        </p>
      )}
      
      {isSignificantVariance && (
        <div className="flex items-start gap-1 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
          <span className="text-amber-800">
            {variance > 0 ? '+' : ''}{variance.toFixed(1)}% vs historical ({decimalToPercent(historicalValue).toFixed(2)}%)
          </span>
        </div>
      )}
      
      {helper && (
        <p className="text-xs text-slate-500 italic">{helper}</p>
      )}
    </div>
  );
}

// ============================================================================
// SMART NUMBER FIELD (for covenant ratios, debt tenor, etc.)
// ============================================================================
export function SmartNumberField({ 
  label, 
  value, 
  onChange, 
  isAutoPop = false,
  benchmarkValue = null,
  helper = "",
  min = 0, 
  max = 100,
  step = 0.1
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isEdited, setIsEdited] = useState(false);

  // Calculate variance from benchmark using safe division
  const variance = benchmarkValue && value !== benchmarkValue
    ? safeDivide(value - benchmarkValue, benchmarkValue, 0) * 100
    : 0;
  
  const hasSignificantVariance = Math.abs(variance) > 10;

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value);
    }
  }, [value, isFocused]);

  const handleChange = (e) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    setIsEdited(true);

    const numValue = parseFloat(inputValue);
    if (isValidNumber(numValue)) {
      onChange(clamp(numValue, min, max));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseFloat(displayValue);
    if (isValidNumber(numValue)) {
      const clamped = clamp(numValue, min, max);
      setDisplayValue(clamped);
      onChange(clamped);
    } else {
      setDisplayValue(value);
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    e.target.select();
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        {isAutoPop && <AutoPopBadge isEdited={isEdited} />}
      </div>
      
      <Input 
        type="number" 
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        step={step}
        className={`h-10 text-sm border-2 rounded-md transition-all duration-200 ${
          isAutoPop && !isEdited 
            ? 'bg-cyan-50 border-cyan-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200' 
            : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
        }`}
      />
      
      {isAutoPop && !isEdited && (
        <p className="text-xs text-cyan-700 flex items-center gap-1">
          <Info className="w-3 h-3" />
          {helper || "Auto-populated from settings"}
        </p>
      )}
      
      {!isAutoPop && helper && (
        <p className="text-xs text-slate-500 italic">{helper}</p>
      )}

      {/* Variance Display */}
      {benchmarkValue !== null && hasSignificantVariance && (
        <div className={`text-xs p-2 rounded-md mt-2 ${
          Math.abs(variance) > 20 
            ? 'bg-amber-50 text-amber-800 border border-amber-200' 
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold">
              Benchmark: {benchmarkValue.toFixed(2)} | 
              Your Input: {value.toFixed(2)} | 
              Variance: {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
            </span>
          </div>
          {Math.abs(variance) > 20 && (
            <p className="mt-1 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span>Variance exceeds 20% from benchmark - verify this is appropriate</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}