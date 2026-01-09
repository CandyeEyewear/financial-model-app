import React, { useState } from "react";
import { Card } from "./Card.jsx";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CollapsibleCard({ 
  title, 
  icon: Icon, 
  color = "slate", 
  defaultOpen = false, 
  children 
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Simplified color mapping - using just 3 main colors
  const colorClasses = {
    blue: "border-l-blue-500 bg-blue-50/50",
    emerald: "border-l-emerald-500 bg-emerald-50/50",
    amber: "border-l-amber-500 bg-amber-50/50",
    slate: "border-l-slate-400 bg-slate-50/50",
  };

  const iconColors = {
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    slate: "text-slate-600",
  };

  const borderClass = colorClasses[color] || colorClasses.slate;
  const iconClass = iconColors[color] || iconColors.slate;

  return (
    <div className={`rounded-lg border border-slate-200 shadow-sm bg-white overflow-hidden`}>
      {/* Header */}
      <div 
        className={`flex items-center justify-between px-4 py-3 cursor-pointer border-l-4 ${borderClass} hover:bg-slate-50 transition-colors`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${iconClass}`} />}
          <h2 className="font-medium text-slate-800 text-sm">{title}</h2>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="p-4 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}
