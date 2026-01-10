
import React, { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { AIExplanation } from "./AIExplanation";

export function EnhancedCreditCard({ 
  title, 
  value, 
  threshold, 
  status, 
  type, 
  subtitle, 
  context,
  isOpeningDebt = true
}) {
  const [isExplainExpanded, setIsExplainExpanded] = useState(false);
  
  const statusConfig = {
    compliant: { color: 'emerald', icon: Check, text: 'Compliant' },
    warning: { color: 'amber', icon: AlertTriangle, text: 'At Risk' },
    breach: { color: 'red', icon: AlertTriangle, text: 'Breach' }
  };
  
  const config = statusConfig[status] || statusConfig.compliant;
  const StatusIcon = config.icon;
  
  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
      <div className="p-4">
        {isOpeningDebt && (
          <div className="mb-2">
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
              Opening Debt
            </span>
          </div>
        )}
        
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
          <div className={`px-2 py-1 rounded-full bg-${config.color}-100 flex items-center gap-1`}>
            <StatusIcon className={`w-3 h-3 text-${config.color}-700`} />
            <span className={`text-xs font-semibold text-${config.color}-700`}>{config.text}</span>
          </div>
        </div>
        
        <div className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 mb-1">
          {value}
        </div>
        
        <div className="text-xs text-slate-500 mb-3">
          {subtitle}
        </div>
        
        {threshold && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">Threshold:</span>
            <span className="font-semibold text-slate-800">{threshold}</span>
          </div>
        )}
      </div>
      
      <AIExplanation 
        metric={type}
        value={parseFloat(value)}
        threshold={threshold ? parseFloat(threshold) : null}
        context={context}
        isExpanded={isExplainExpanded}
        onToggle={() => setIsExplainExpanded(!isExplainExpanded)}
      />
    </div>
  );
}