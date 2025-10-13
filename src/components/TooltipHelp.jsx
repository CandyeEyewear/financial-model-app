import React, { useState } from "react";
import { HelpCircle } from "lucide-react";

export function TooltipHelp({ content, title }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-slate-400 hover:text-blue-600 transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {show && (
        <div className="absolute z-50 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl -top-2 left-6">
          {title && <div className="font-bold mb-1">{title}</div>}
          <div className="leading-relaxed">{content}</div>
          <div className="absolute w-2 h-2 bg-slate-900 transform rotate-45 -left-1 top-3"></div>
        </div>
      )}
    </div>
  );
}