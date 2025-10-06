import React, { useState, useRef } from "react";

export function Tabs({ defaultValue, children, className = "", onValueChange }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const tabListRef = useRef(null);
  
  const tabValues = React.Children.toArray(children)
    .filter((child) => child.type === TabsList)
    .flatMap((child) =>
      React.Children.toArray(child.props.children).map((c) => c.props.value)
    );

  const handleTabChange = (newValue) => {
    setActiveTab(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  function handleKeyDown(e) {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const idx = tabValues.indexOf(activeTab);
    let nextIdx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabValues.length;
    else nextIdx = (idx - 1 + tabValues.length) % tabValues.length;
    handleTabChange(tabValues[nextIdx]);
  }
  
  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          activeTab,
          setActiveTab: handleTabChange,
          tabListRef,
          onTabKeyDown: handleKeyDown
        })
      )}
    </div>
  );
}

export function TabsList({ children, activeTab, setActiveTab, tabListRef, onTabKeyDown, className = "" }) {
  return (
    <div
      className={`inline-flex h-16 items-center justify-center rounded-xl bg-white p-2 border-2 border-slate-300 shadow-lg ${className}`}
      role="tablist"
      aria-label="Main Sections"
      ref={tabListRef}
      tabIndex={0}
      onKeyDown={onTabKeyDown}
    >
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

export function TabsTrigger({ value, children, activeTab, setActiveTab, className = "" }) {
  const isActive = activeTab === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tab-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-8 py-4 text-lg font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105"
          : "text-slate-700 hover:text-blue-700 hover:bg-blue-50 hover:scale-102"
      } ${className}`}
      onClick={() => setActiveTab(value)}
      id={`tab-${value}`}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, activeTab }) {
  if (activeTab !== value) return null;
  return (
    <div
      className="mt-2"
      role="tabpanel"
      id={`tab-panel-${value}`}
      aria-labelledby={`tab-${value}`}
    >
      {children}
    </div>
  );
}