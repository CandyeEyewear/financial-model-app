import React from "react";
import { Button } from "./Button";
import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { currencyFmtMM, numFmt } from "../utils/formatters";
import { Download } from "lucide-react";

// For CSV export, you can also extract this to a utility.
function exportDetailedCSV(projection, scenarioName, ccy) {
  const headers = [
    "Year", "Revenue", "EBITDA", "EBIT", "FCF", "FCF to Equity", "Debt Service", "End Debt", "DSCR", "ICR", "ND/EBITDA"
  ];
  const rows = projection.rows.map(r => [
    r.year,
    currencyFmtMM(r.revenue, ccy),
    currencyFmtMM(r.ebitda, ccy),
    currencyFmtMM(r.ebit, ccy),
    currencyFmtMM(r.fcf, ccy),
    currencyFmtMM(r.fcfToEquity, ccy),
    currencyFmtMM(r.debtService, ccy),
    currencyFmtMM(r.endingDebt, ccy),
    numFmt(r.dscr),
    numFmt(r.icr),
    numFmt(r.ndToEbitda)
  ]);
  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
  const element = document.createElement("a");
  const file = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  element.href = URL.createObjectURL(file);
  element.download = `${scenarioName.toLowerCase().replace(/\s+/g, '_')}_projection.csv`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function DataTable({ projection, ccy, title = "" }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button
            size="sm"
            onClick={() => exportDetailedCSV(projection, title, ccy)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-2 w-full sm:w-auto"
          >
            <Download className="w-3 h-3 mr-1" />
            Export Table
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              {[
                "Year",
                "Revenue",
                "EBITDA",
                "EBIT",
                "FCF",
                "FCF to Equity",
                "Debt Service",
                "End Debt",
                "DSCR",
                "ICR",
                "ND/EBITDA",
              ].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((r) => (
              <tr key={r.year} className="odd:bg-white even:bg-slate-50">
                <td className="px-2 py-1">{r.year}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.revenue, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.ebitda, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.ebit, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.fcf, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.fcfToEquity, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.debtService, ccy)}</td>
                <td className="px-2 py-1">{currencyFmtMM(r.endingDebt, ccy)}</td>
                <td className={`px-2 py-1 ${r.dscrBreach ? "text-red-600 font-bold" : ""}`}>
                  {numFmt(r.dscr)}
                </td>
                <td className={`px-2 py-1 ${r.icrBreach ? "text-red-600 font-bold" : ""}`}>
                  {numFmt(r.icr)}
                </td>
                <td className={`px-2 py-1 ${r.ndBreach ? "text-red-600 font-bold" : ""}`}>
                  {numFmt(r.ndToEbitda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
