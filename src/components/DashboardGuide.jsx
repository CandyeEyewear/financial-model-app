import React, { useState } from "react";
import { Info, ChevronDown, ChevronUp, HelpCircle, TrendingUp, Shield, BarChart3 } from "lucide-react";

export function DashboardGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg shadow-sm mb-6 overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-blue-100 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-base sm:text-lg font-bold text-blue-900">
              What is the Credit Dashboard?
            </h3>
            <p className="text-xs sm:text-sm text-blue-700">
              Click to learn what this tab shows and how to use it
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-blue-700 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-700 flex-shrink-0" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 animate-fade-in">
          {/* Overview */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              The Credit Dashboard provides a comprehensive credit risk assessment for your proposed transaction. 
              It analyzes your <strong>opening debt</strong> (existing debt on books) and shows whether the business 
              can safely service this debt while maintaining healthy financial ratios.
            </p>
          </div>

          {/* What You'll See */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Credit Assessment Score
                </h4>
                <p className="text-sm text-slate-700">
                  A 0-100 score that evaluates overall creditworthiness based on:
                </p>
                <ul className="text-xs text-slate-600 mt-2 space-y-1 ml-4">
                  <li>• <strong>DSCR</strong> - Can cash flow cover debt payments?</li>
                  <li>• <strong>ICR</strong> - Can earnings cover interest costs?</li>
                  <li>• <strong>Leverage</strong> - Is debt level manageable?</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Key Metrics Cards
                </h4>
                <p className="text-sm text-slate-700">
                  Four cards showing critical ratios:
                </p>
                <ul className="text-xs text-slate-600 mt-2 space-y-1 ml-4">
                  <li>• <strong>Min DSCR</strong> - Lowest coverage in projection period</li>
                  <li>• <strong>Min ICR</strong> - Lowest interest coverage</li>
                  <li>• <strong>Max Leverage</strong> - Highest debt/EBITDA ratio</li>
                  <li>• <strong>Annual Debt Service</strong> - Year 1 payment amount</li>
                </ul>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">📊 Charts & Analysis</h4>
                <ul className="text-sm text-slate-700 space-y-2">
                  <li><strong>Radar Chart:</strong> Visual credit strength profile</li>
                  <li><strong>Metrics Over Time:</strong> How ratios trend across projection years</li>
                  <li><strong>Company Profile:</strong> Industry context and collateral info</li>
                </ul>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">✅ Rationale & Covenants</h4>
                <p className="text-sm text-slate-700">
                  <strong>Underwriting Rationale:</strong> Shows which credit criteria are met<br/>
                  <strong>Recommended Covenants:</strong> Suggested loan terms and protections
                </p>
              </div>
            </div>
          </div>

          {/* Color Guide */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-bold text-blue-900 mb-3">🎨 Understanding the Colors</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500"></div>
                <span className="text-slate-700"><strong>Green:</strong> Compliant / Good</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-500"></div>
                <span className="text-slate-700"><strong>Yellow:</strong> Warning / At Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-slate-700"><strong>Red:</strong> Breach / Concern</span>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-300">
            <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Important Notes
            </h4>
            <ul className="text-sm text-amber-900 space-y-1">
              <li>• All metrics are based on your <strong>Opening Debt</strong> (existing debt on books)</li>
              <li>• The <strong>New Facility</strong> you're requesting is shown separately for comparison</li>
              <li>• Click <strong>"AI Explain"</strong> buttons on metric cards for detailed analysis</li>
              <li>• Use <strong>"Show metric details"</strong> to see year-by-year breakdown</li>
              <li>• Export to PDF to share with your credit committee</li>
            </ul>
          </div>

          {/* Quick Tips */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-300">
            <h4 className="font-bold text-indigo-900 mb-2">💡 Quick Tips</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-indigo-800">
              <div>
                <strong>✓ Good Sign:</strong> All cards show green "Compliant" status
              </div>
              <div>
                <strong⚠️ Warning Sign:</strong> Yellow badges or trending downward
              </div>
              <div>
                <strong>🔴 Red Flag:</strong> Multiple breaches or DSCR below 1.0x
              </div>
              <div>
                <strong>📈 Strong Deal:</strong> Improving trends + high collateral coverage
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}