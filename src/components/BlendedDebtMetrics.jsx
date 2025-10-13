// src/components/BlendedDebtMetrics.jsx
import React from 'react';
import { DollarSign, Percent, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { currencyFmtMM } from '../utils/formatters';

export function BlendedDebtMetrics({ tranches, ccy, startYear, projectionYears }) {
  if (!tranches || tranches.length === 0) return null;

  const totalDebt = tranches.reduce((sum, t) => sum + t.amount, 0);
  const weightedRate =
    totalDebt > 0 ? tranches.reduce((sum, t) => sum + (t.amount * t.rate), 0) / totalDebt : 0;

  // Calculate estimated annual debt service (interest + amortization if applicable)
  const totalInterest = tranches.reduce((s, t) => s + t.amount * t.rate, 0);
  const totalPrincipal = tranches.reduce((s, t) => {
    if (t.amortizationType === 'amortizing' && t.tenorYears > 0) {
      return s + t.amount / t.tenorYears;
    }
    return s;
  }, 0);
  const totalDebtService = totalInterest + totalPrincipal;

  const maturities = tranches.map((t) => new Date(t.maturityDate).getFullYear());
  const earliestYear = Math.min(...maturities);
  const latestYear = Math.max(...maturities);

  // --- NEW: Refinancing Warning Logic ---
  const projectionEnd = (startYear || new Date().getFullYear()) + (projectionYears || 0);
  const tranchesRequiringRefi = tranches.filter(
    (t) => new Date(t.maturityDate).getFullYear() <= projectionEnd
  );

  return (
    <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg">
      <h4 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Blended Debt Profile
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Total Debt" value={currencyFmtMM(totalDebt, ccy)} icon={<DollarSign />} />
        <Metric
          label="Blended Rate"
          value={`${(weightedRate * 100).toFixed(2)}%`}
          icon={<Percent />}
        />
        <Metric
          label="Est. Annual Debt Service"
          value={currencyFmtMM(totalDebtService, ccy)}
          icon={<DollarSign />}
        />
        <Metric
          label="Maturity Range"
          value={`${earliestYear} – ${latestYear}`}
          icon={<Calendar />}
        />
      </div>

      {/* Refinancing Warning */}
      {tranchesRequiringRefi.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">Refinancing Required During Projection</p>
            <p className="mt-1">
              The following tranches mature before projection end ({projectionEnd}):{' '}
              <strong>
                {tranchesRequiringRefi
                  .map((t) => `${t.name} (${new Date(t.maturityDate).getFullYear()})`)
                  .join(', ')}
              </strong>.
            </p>
          </div>
        </div>
      )}

      {/* Tranche Breakdown Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-purple-300">
              <th className="text-left py-2 text-purple-700">Tranche</th>
              <th className="text-right py-2 text-purple-700">Amount</th>
              <th className="text-right py-2 text-purple-700">% of Total</th>
              <th className="text-right py-2 text-purple-700">Rate</th>
              <th className="text-right py-2 text-purple-700">Maturity</th>
            </tr>
          </thead>
          <tbody>
            {tranches.map((t) => (
              <tr key={t.id} className="border-b border-purple-200">
                <td className="py-2 font-medium text-purple-900">{t.name}</td>
                <td className="text-right text-purple-800">{currencyFmtMM(t.amount, ccy)}</td>
                <td className="text-right text-purple-700">
                  {((t.amount / totalDebt) * 100).toFixed(1)}%
                </td>
                <td className="text-right text-purple-800">{(t.rate * 100).toFixed(2)}%</td>
                <td className="text-right text-purple-700">
                  {new Date(t.maturityDate).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-purple-700">
        {React.cloneElement(icon, { className: 'w-3 h-3' })}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-purple-900">{value}</div>
    </div>
  );
}
