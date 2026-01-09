import React from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "default",
  className = "",
  disabled = false,
  type = "button",
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-500",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
    warning: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-500",
    outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700 focus:ring-slate-500"
  };
  
  const sizes = {
    default: "h-9 px-4 py-2 text-sm",
    sm: "h-8 px-3 py-1.5 text-xs",
    lg: "h-10 px-6 py-2.5 text-sm"
  };
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}