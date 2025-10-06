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
    "inline-flex items-center justify-center rounded-md font-semibold transition-all duration-200 focus:outline-none focus:ring-2 disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white shadow-md transform hover:scale-105 focus:ring-blue-200",
    secondary: "bg-white border-2 border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 focus:ring-blue-200",
    success: "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white shadow-md transform hover:scale-105 focus:ring-emerald-200",
    warning: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-700 hover:to-amber-700 text-white shadow-md transform hover:scale-105 focus:ring-amber-200",
    danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-700 hover:to-red-700 text-white shadow-md transform hover:scale-105 focus:ring-red-200",
    ghost: "hover:bg-slate-100 text-slate-700 hover:text-slate-900 focus:ring-slate-200"
  };
  
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-9 px-3 py-2 text-sm",
    lg: "h-12 px-8 py-3 text-base"
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