import React, {
  useMemo,
  useState,
  useEffect,
  useRef
} from "react";
import {
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign
} from "lucide-react";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart as RBarChart,
  Bar,
  ComposedChart
} from "recharts";

/* ------------------ Utility Functions ------------------ */
const clamp = (x, min, max) =>
  Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));
const num = (x) =>
  x === "" || x === null || x === undefined ? 0 : Number(x);

function currencyFmt(value, ccy = "JMD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
}

function currencyFmtMM(value, ccy = "JMD") {
  const millions = value / 1_000_000;
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: ccy,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(millions) + "M"
    );
  } catch {
    return (
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(millions) + "M"
    );
  }
}

function numFmt(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function pctFmt(value) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

function download(filename, text) {
  const element = document.createElement("a");
  const file = new Blob([text], { type: "text/csv;charset=utf-8;" });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/* -------------- Debounce Hook for Performance -------------- */
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

/* ---------- Historical Assumptions Calculator ---------- */
function calculateHistoricalAssumptions(historicalData) {
  if (!Array.isArray(historicalData) || historicalData.length < 2) return null;
  const validYears = historicalData.filter(
    (d) => typeof d.revenue === "number" && d.revenue > 0
  );
  if (validYears.length < 2) return null;
  const sorted = [...validYears].sort((a, b) => a.year - b.year);

  // Growth
  let growthRates = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].revenue;
    const curr = sorted[i].revenue;
    if (prev > 0) growthRates.push((curr - prev) / prev);
  }
  const avgGrowth =
    growthRates.reduce((s, g) => s + g, 0) / growthRates.length || 0;

  // Margins
  const avgEbitdaMargin =
    sorted.reduce((s, d) => s + (d.ebitda / (d.revenue || 1)), 0) /
    sorted.length;
  const avgNetMargin =
    sorted.reduce((s, d) => s + (d.netIncome / (d.revenue || 1)), 0) /
    sorted.length;
  const avgWcPct =
    sorted.reduce((s, d) => s + (d.workingCapital / (d.revenue || 1)), 0) /
    sorted.length;

  // Capex proxy
  let capexRates = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].totalAssets;
    const curr = sorted[i].totalAssets;
    const net = sorted[i].netIncome;
    const deltaAssets = curr - prev;
    if (sorted[i].revenue > 0) {
      const capexEst = Math.max(0, (deltaAssets + net) / sorted[i].revenue);
      capexRates.push(capexEst);
    }
  }
  const avgCapexPct =
    capexRates.length > 0
      ? capexRates.reduce((s, c) => s + c, 0) / capexRates.length
      : 0.04;

  return {
    baseRevenue: sorted[sorted.length - 1].revenue,
    growth: avgGrowth,
    cogsPct: 1 - avgEbitdaMargin - 0.2, // fallback assumption: opex ~20%
    opexPct: 0.2,
    wcPctOfRev: avgWcPct,
    capexPct: avgCapexPct,
    avgNetMargin
  };
}

/* ---------- UI COMPONENTS WITH ACCESSIBILITY IMPROVEMENTS ---------- */

function Card({ children, className = "", ...rest }) {
  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`} {...rest}>
      {children}
    </section>
  );
}

function CardHeader({ children, className = "" }) {
  return (
    <header className={`px-6 py-4 border-b border-slate-200 ${className}`}>{children}</header>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h3>
  );
}

function Button({
  children,
  onClick,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-slate-900 text-slate-50 hover:bg-slate-900/90",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900",
    ghost: "hover:bg-slate-100 hover:text-slate-900"
  };
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8"
  };
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
  step,
  min,
  max,
  id,
  ...rest
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      className={`flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

function Label({ children, className = "", htmlFor }) {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

/* --------- Tabs with Keyboard and ARIA Improvements --------- */

function Tabs({ defaultValue, children, className = "" }) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  // Keyboard navigation
  const tabListRef = useRef(null);
  const tabValues = React.Children.toArray(children)
    .filter((child) => child.type === TabsList)
    .flatMap((child) =>
      React.Children.toArray(child.props.children).map((c) => c.props.value)
    );

  function handleKeyDown(e) {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const idx = tabValues.indexOf(activeTab);
    let nextIdx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabValues.length;
    else nextIdx = (idx - 1 + tabValues.length) % tabValues.length;
    setActiveTab(tabValues[nextIdx]);
  }

  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          activeTab,
          setActiveTab,
          tabListRef,
          onTabKeyDown: handleKeyDown
        })
      )}
    </div>
  );
}

function TabsList({ children, activeTab, setActiveTab, tabListRef, onTabKeyDown }) {
  return (
    <div
      className="inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500 border border-slate-200"
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

function TabsTrigger({ value, children, activeTab, setActiveTab }) {
  const isActive = activeTab === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tab-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "text-slate-600 hover:text-blue-700 hover:bg-slate-50"
        }`}
      onClick={() => setActiveTab(value)}
      id={`tab-${value}`}
      type="button"
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, activeTab }) {
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

/* ----------- Confirm Dialog (for Destructive Actions) ----------- */
function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white p-6 rounded-lg shadow-lg w-80">
        <p className="mb-4 text-slate-800">{message}</p>
        <div className="flex gap-4 justify-end">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----------- Example Chart Loading/Empty State Wrapper ----------- */
function ChartWrapper({ data, height = 300, children, ariaLabel }) {
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
    <ResponsiveContainer width="100%" height={height} aria-label={ariaLabel}>
      {children}
    </ResponsiveContainer>
  );
}

/* ----------- Example of Button Focus Feedback ----------- */
function FocusableButton(props) {
  return (
    <Button {...props} className={`${props.className} focus-visible:ring-2 focus-visible:ring-blue-500`} />
  );
}

/* ---------- Main Component - see next message for continuation ---------- */