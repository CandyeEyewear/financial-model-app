import React from "react";

export const Label = ({ children, className = "", ...props }) => {
  return (
    <label
      className={`block text-base font-medium text-gray-700 mb-1 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};