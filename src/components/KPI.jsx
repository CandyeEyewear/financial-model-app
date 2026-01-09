import React from "react";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus 
} from "lucide-react";

export function KPI({ 
  label, 
  value, 
  trend, 
  alert, 
  tooltip,
  change,
  subtitle
}) {
  return (
    <div
      className={`flex flex-col justify-between p-4 rounded-lg border transition-colors ${
        alert 
          ? "bg-red-50 border-red-200" 
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
      title={tooltip}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-semibold ${alert ? "text-red-700" : "text-slate-900"}`}>
          {value}
        </span>
        {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500" />}
        {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
        {trend === "flat" && <Minus className="w-4 h-4 text-slate-400" />}
        {change && (
          <span className={`text-xs font-medium ${change.startsWith("-") ? "text-red-500" : "text-emerald-500"}`}>
            {change}
          </span>
        )}
      </div>

      {/* Optional subtitle */}
      {subtitle && (
        <span className="text-xs text-slate-400 mt-1">{subtitle}</span>
      )}
    </div>
  );
}
