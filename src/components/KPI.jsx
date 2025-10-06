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
  tooltip,       // new: explanatory text on hover
  change         // new: percentage change, e.g. "+5%" or "-2%"
}) {
  return (
    <div
      className={`flex flex-col justify-center items-start p-3 h-20 rounded-lg border transition duration-200 ${
        alert 
          ? "bg-red-50 border-red-200 hover:bg-red-100" 
          : "bg-white border-slate-200 hover:bg-slate-50"
      }`}
      title={tooltip}   // tooltip on hover
    >
      {/* Top row: label + icons */}
      <div className="flex items-center gap-1">
        <div className="text-xs text-slate-500">{label}</div>
        {alert && <AlertTriangle className="w-3 h-3 text-red-500" />}
        {trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
        {trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
        {trend === "flat" && <Minus className="w-3 h-3 text-slate-400" />}
      </div>

      {/* Bottom row: value + optional percentage change */}
      <div className="flex items-baseline gap-1">
        <div
          className={`text-sm font-bold ${
            alert ? "text-red-700" : "text-slate-900"
          }`}
        >
          {value}
        </div>
        {change && (
          <div
            className={`text-xs font-medium ${
              change.startsWith("-") 
                ? "text-red-500" 
                : "text-green-500"
            }`}
          >
            {change}
          </div>
        )}
      </div>
    </div>
  );
}
