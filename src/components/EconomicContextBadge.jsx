import React from 'react';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Percent,
  DollarSign,
  Activity,
  CheckCircle,
  Info
} from 'lucide-react';

/**
 * EconomicContextBadge Component
 * Displays current economic context at a glance
 * Used in credit analysis dashboards to show real-time economic indicators
 */
export default function EconomicContextBadge({
  economicData,
  country = 'Jamaica',
  onRefresh,
  isLoading = false,
  compact = false,
  className = ''
}) {
  // Empty state - no economic data loaded
  if (!economicData) {
    return (
      <div className={`economic-badge-empty ${className}`}>
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <Globe className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">No economic data loaded</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="ml-auto p-1.5 rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
              title="Fetch economic data"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const { interestRate, inflation, gdpGrowth, industryOutlook, fetchedAt, macroRisks } = economicData;

  // Determine overall economic health indicator
  const getHealthIndicator = () => {
    let score = 0;
    if (interestRate?.value <= 8) score++;
    if (inflation?.value <= 5) score++;
    if (gdpGrowth?.value >= 2) score++;

    if (score >= 3) return { status: 'healthy', color: 'emerald', icon: CheckCircle };
    if (score >= 2) return { status: 'moderate', color: 'amber', icon: Activity };
    return { status: 'challenging', color: 'red', icon: AlertTriangle };
  };

  const health = getHealthIndicator();
  const HealthIcon = health.icon;

  // Compact view for smaller spaces
  if (compact) {
    return (
      <div className={`economic-badge-compact ${className}`}>
        <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
          <Globe className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">{country}</span>
          {interestRate && (
            <div className="flex items-center gap-1 text-xs">
              <Percent className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-800">{interestRate.value}%</span>
            </div>
          )}
          {inflation && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">INF</span>
              <span className={`font-semibold ${inflation.value > 6 ? 'text-red-600' : 'text-slate-800'}`}>
                {inflation.value}%
              </span>
            </div>
          )}
          {gdpGrowth && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">GDP</span>
              <span className={`font-semibold ${gdpGrowth.value < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {gdpGrowth.value > 0 ? '+' : ''}{gdpGrowth.value}%
              </span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="ml-auto p-1 rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className={`economic-context-badge ${className}`}>
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-slate-800">{country}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-${health.color}-100 text-${health.color}-700`}>
              <HealthIcon className="w-3 h-3" />
              {health.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {fetchedAt ? new Date(fetchedAt).toLocaleDateString() : 'N/A'}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-white/50 transition-colors disabled:opacity-50"
                title="Refresh economic data"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Indicators Grid */}
        <div className="grid grid-cols-3 gap-px bg-slate-200 p-px">
          {/* Interest Rate */}
          <div className="bg-white p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Percent className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">CB Rate</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {interestRate ? `${interestRate.value}%` : 'N/A'}
            </div>
            <div className="text-xs text-slate-400">Policy rate</div>
          </div>

          {/* Inflation */}
          <div className="bg-white p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {inflation && inflation.value > 5 ? (
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inflation</span>
            </div>
            <div className={`text-xl font-bold ${
              inflation?.value > 7 ? 'text-red-600' :
              inflation?.value > 5 ? 'text-amber-600' : 'text-slate-800'
            }`}>
              {inflation ? `${inflation.value}%` : 'N/A'}
            </div>
            <div className="text-xs text-slate-400">YoY change</div>
          </div>

          {/* GDP Growth */}
          <div className="bg-white p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">GDP</span>
            </div>
            <div className={`text-xl font-bold ${
              gdpGrowth?.value < 0 ? 'text-red-600' :
              gdpGrowth?.value < 1 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {gdpGrowth ? `${gdpGrowth.value > 0 ? '+' : ''}${gdpGrowth.value}%` : 'N/A'}
            </div>
            <div className="text-xs text-slate-400">Growth rate</div>
          </div>
        </div>

        {/* Macro Risks Section (if any) */}
        {macroRisks && macroRisks.length > 0 && (
          <div className="p-3 bg-amber-50 border-t border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Macro Risk Factors
              </span>
            </div>
            <div className="space-y-1.5">
              {macroRisks.slice(0, 3).map((risk, index) => (
                <div key={index} className="flex items-start gap-2 text-xs">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold ${
                    risk.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    risk.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                    risk.severity === 'elevated' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {risk.type}
                  </span>
                  <span className="text-slate-600">{risk.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Industry Outlook (if available) */}
        {industryOutlook && (
          <div className="p-3 bg-blue-50 border-t border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                Industry Outlook
              </span>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              {industryOutlook.substring(0, 150)}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mini version for inline display
 */
export function EconomicContextMini({ economicData, country = 'Jamaica' }) {
  if (!economicData) return null;

  const { interestRate, inflation, gdpGrowth } = economicData;

  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 rounded text-xs">
      <Globe className="w-3 h-3 text-blue-500" />
      <span className="font-medium text-slate-700">{country}:</span>
      {interestRate && (
        <span className="text-slate-600">Rate {interestRate.value}%</span>
      )}
      {inflation && (
        <span className={inflation.value > 6 ? 'text-amber-600' : 'text-slate-600'}>
          Infl {inflation.value}%
        </span>
      )}
      {gdpGrowth && (
        <span className={gdpGrowth.value < 0 ? 'text-red-600' : 'text-emerald-600'}>
          GDP {gdpGrowth.value > 0 ? '+' : ''}{gdpGrowth.value}%
        </span>
      )}
    </div>
  );
}

/**
 * Rate Spread Analysis Component
 * Shows how proposed rate compares to central bank rate
 */
export function RateSpreadAnalysis({ rateAnalysis, className = '' }) {
  if (!rateAnalysis) return null;

  const { proposedRate, centralBankRate, spreadBps, assessment, riskLevel } = rateAnalysis;

  return (
    <div className={`rate-spread-analysis ${className}`}>
      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
          <DollarSign className="w-4 h-4" />
          Rate Spread Analysis
        </h4>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Proposed Rate</div>
            <div className="text-lg font-bold text-blue-700">{proposedRate.toFixed(2)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Central Bank</div>
            <div className="text-lg font-bold text-slate-700">{centralBankRate.toFixed(2)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">Spread</div>
            <div className={`text-lg font-bold ${
              riskLevel === 'good' ? 'text-emerald-600' :
              riskLevel === 'warning' ? 'text-amber-600' : 'text-red-600'
            }`}>
              +{spreadBps} bps
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-2 p-2 rounded ${
          riskLevel === 'good' ? 'bg-emerald-100 text-emerald-800' :
          riskLevel === 'warning' ? 'bg-amber-100 text-amber-800' :
          'bg-red-100 text-red-800'
        }`}>
          {riskLevel === 'good' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span className="text-xs font-medium">{assessment}</span>
        </div>
      </div>
    </div>
  );
}
