import React, { useState } from "react";
import { Card } from "./Card.jsx";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CollapsibleCard({ 
  title, 
  icon: Icon, 
  color = "indigo", 
  defaultOpen = false, 
  children 
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border shadow-sm bg-white">
      {/* Header */}
      <div 
        className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-${color}-200 bg-gradient-to-r from-${color}-50 to-white`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-5 h-5 text-${color}-600`} />}
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="text-slate-600 hover:text-slate-800"
        >
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
