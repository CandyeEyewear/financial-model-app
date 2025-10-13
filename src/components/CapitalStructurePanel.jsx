// src/components/CapitalStructurePanel.jsx

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { currencyFmtMM, pctFmt, numFmt } from '../utils/formatters';

export function CapitalStructurePanel({ recommendations, ccy, isLoading }) {
  const [expandedSection, setExpandedSection] = useState(null);

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-indigo-600">
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
            <p className="text-slate-600">Analyzing capital structure and generating recommendations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || !recommendations.quantitativeAnalysis) {
    return (
      <Card className="border-l-4 border-l-slate-400">
        <CardContent className="p-8 text-center">
          <Info className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Capital structure analysis will appear here once projections are generated.</p>
        </CardContent>
      </Card>
    );
  }

  const { quantitativeAnalysis, aiInsights, confidenceLevel } = recommendations;
  const { currentState, structuralIssues, optimalStructure, transitionPlan, impactAnalysis } = quantitativeAnalysis;

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary Card */}
      <Card className="border-l-4 border-l-indigo-600 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Capital Structure Assessment
              </CardTitle>
              <p className="text-sm text-indigo-700 mt-1">
                AI-Enhanced Analysis • Confidence: <span className="font-bold">{confidenceLevel?.level || 'Medium'}</span>
              </p>
            </div>
            {aiInsights && (
              <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI-POWERED
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* AI Executive Summary */}
          {aiInsights?.executiveSummary && (
            <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-600 rounded-r-lg">
              <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" />
                AI Executive Summary
              </h4>
              <p className="text-sm text-indigo-800 leading-relaxed whitespace-pre-line">
                {aiInsights.executiveSummary}
              </p>
            </div>
          )}

          {/* Current vs Target Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border-2 border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600 font-semibold mb-1">Current Leverage</p>
              <p className="text-2xl font-bold text-slate-900">{numFmt(currentState.currentLeverage)}x</p>
              <p className="text-xs text-slate-500 mt-1">Net Debt / EBITDA</p>
            </div>

            <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
              <p className="text-xs text-emerald-700 font-semibold mb-1">Target Leverage</p>
              <p className="text-2xl font-bold text-emerald-900">{numFmt(optimalStructure.targetLeverage)}x</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>{numFmt(Math.abs(optimalStructure.leverageImprovement))}x improvement</span>
              </div>
            </div>

            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <p className="text-xs text-purple-700 font-semibold mb-1">Action Required</p>
              <p className="text-2xl font-bold text-purple-900">
                {optimalStructure.debtReductionNeeded > 0 
                  ? currencyFmtMM(optimalStructure.debtReductionNeeded, ccy)
                  : 'None'}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {optimalStructure.debtReductionNeeded > 0 ? 'Debt reduction needed' : 'On target'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structural Issues */}
      {structuralIssues.length > 0 && (
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="bg-red-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Structural Issues ({structuralIssues.length})
              </CardTitle>
              <button
                onClick={() => toggleSection('issues')}
                className="text-red-600 hover:text-red-800"
              >
                {expandedSection === 'issues' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </CardHeader>

          {expandedSection === 'issues' && (
            <CardContent className="p-6">
              <div className="space-y-4">
                {structuralIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border-l-4 rounded-r-lg ${
                      issue.severity === 'critical' ? 'bg-red-50 border-red-600' :
                      issue.severity === 'high' ? 'bg-amber-50 border-amber-600' :
                      'bg-blue-50 border-blue-600'
                    }`}
                  >
                    <div className="mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        issue.severity === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {issue.severity.toUpperCase()}
                      </span>
                      <span className="ml-2 text-sm font-bold text-slate-900">{issue.category}</span>
                    </div>

                    <p className="text-sm text-slate-800 mb-2">
                      <strong>Issue:</strong> {issue.issue}
                    </p>

                    <p className="text-sm text-slate-700">
                      <strong>Root Cause:</strong> {issue.rootCause}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Confidence Level Footer */}
      <Card className={`border-l-4 ${
        confidenceLevel?.level === 'High' ? 'border-l-emerald-600' :
        confidenceLevel?.level === 'Medium' ? 'border-l-amber-600' :
        'border-l-red-600'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${
              confidenceLevel?.level === 'High' ? 'bg-emerald-100' :
              confidenceLevel?.level === 'Medium' ? 'bg-amber-100' :
              'bg-red-100'
            }`}>
              {confidenceLevel?.level === 'High' ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              ) : confidenceLevel?.level === 'Medium' ? (
                <Info className="w-8 h-8 text-amber-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-900">
                Execution Confidence: {confidenceLevel?.level || 'Medium'}
              </h4>
              <p className="text-sm text-slate-700 mt-1">
                {confidenceLevel?.description || 'Analysis complete'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}