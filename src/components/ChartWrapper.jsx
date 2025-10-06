import React from "react";
export function ChartWrapper({ data, height = 300, children, ariaLabel }) {
  if (!data || data.length === 0)
    return (
      <div
        className="flex items-center justify-center h-[200px] text-slate-500"
        role="status"
        aria-live="polite"
      >
        No data to display.
      </div>
    );
  return (
    <div style={{ height: height, width: "100%" }} aria-label={ariaLabel}>
      {children}
    </div>
  );
}