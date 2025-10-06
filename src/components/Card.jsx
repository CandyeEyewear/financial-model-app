import React from "react";
export function Card({ children, className = "", ...rest }) {
  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`} {...rest}>
      {children}
    </section>
  );
}
export function CardHeader({ children, className = "" }) {
  return (
    <header className={`px-6 py-4 border-b border-slate-200 ${className}`}>{children}</header>
  );
}
export function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h3>
  );
}