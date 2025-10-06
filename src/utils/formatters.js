// formatters.js - REPLACE entire file with this

export function currencyFmt(value, ccy = "JMD") {
  if (!value || !Number.isFinite(value)) return "—";
  
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

export function currencyFmtMM(value, ccy = "JMD") {
  if (!value || !Number.isFinite(value)) return "—";
  
  const millions = value / 1_000_000;
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: ccy,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(millions) + "M"
    );
  } catch {
    return (
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(millions) + "M"
    );
  }
}

export function numFmt(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0.00";
  
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function pctFmt(value) {
  if (!Number.isFinite(value)) return "0.0%";
  
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}