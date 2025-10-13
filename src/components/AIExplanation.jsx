import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export function AIExplanation({ metric, value, threshold, context, isExpanded, onToggle }) {
  const [explanation, setExplanation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateExplanation = async () => {
    if (explanation) return;
    
    setIsLoading(true);
    
    try {
      // In production, call Claude API here
      // For now, generate contextual explanation
      const content = generateMetricExplanation(metric, value, threshold, context);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setExplanation(content);
    } catch (error) {
      console.error("Error generating explanation:", error);
      setExplanation("Unable to generate explanation at this time.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && !explanation && !isLoading) {
      generateExplanation();
    }
  }, [isExpanded]);

  return (
    <div className="border-t border-slate-200">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <Sparkles className="w-4 h-4" />
          AI Explain
        </span>
        <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              Analyzing...
            </div>
          ) : explanation ? (
            <div className="prose prose-sm max-w-none space-y-3">
              {explanation.split('\n\n').map((paragraph, i) => (
                <div key={i} className="text-sm text-slate-700">
                  {paragraph.split('\n').map((line, j) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={j} className="font-bold text-slate-900 mt-2">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.match(/^[0-9]\./)) {
                      return <li key={j} className="ml-4">{line.substring(3)}</li>;
                    }
                    return <p key={j}>{line}</p>;
                  })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function generateMetricExplanation(metric, value, threshold, context) {
  if (metric === "dscr") {
    const isBreach = value < threshold;
    return `**Analysis of DSCR: ${value.toFixed(2)}x**

${isBreach ? '⚠️' : '✅'} Your DSCR is ${isBreach ? 'below' : 'above'} the ${threshold.toFixed(2)}x covenant threshold.

**What this means:**
Cash flow covers debt service by ${((value - 1) * 100).toFixed(0)}%, ${isBreach ? 'which indicates heightened refinancing risk' : 'providing adequate safety margin'}.

**Key drivers:**
- Opening Debt service requirements
- EBITDA generation capacity
- Operating margin efficiency

**Recommendations:**
${isBreach ? `
1. Increase equity contribution to reduce debt service burden
2. Negotiate covenant relief to ${(threshold - 0.10).toFixed(2)}x
3. Review revenue growth and margin assumptions
4. Consider extending debt tenor to reduce annual payments
` : `
1. Maintain current capital structure
2. Monitor working capital efficiency  
3. Consider stress testing for downside scenarios
4. Opportunity to prepay if excess cash available
`}`;
  } else if (metric === "icr") {
    const isBreach = value < threshold;
    return `**Analysis of ICR: ${value.toFixed(2)}x**

${isBreach ? '⚠️' : '✅'} Your Interest Coverage Ratio is ${isBreach ? 'below' : 'above'} the ${threshold.toFixed(2)}x target.

**What this means:**
EBIT covers interest expense ${value.toFixed(2)} times. ${isBreach ? 'Limited buffer for interest rate shocks.' : 'Adequate protection against rate increases.'}

**Key factors:**
- Opening Debt interest expense
- Operating profitability (EBIT margin)
- Interest rate environment

**Recommendations:**
${isBreach ? `
1. Reduce debt principal or extend tenor
2. Improve operating margins through cost efficiency
3. Negotiate fixed-rate terms to limit rate risk
4. Focus on EBITDA growth initiatives
` : `
1. Current structure appears sustainable
2. Consider prepayment if excess cash available
3. Maintain focus on EBITDA growth
4. Build cash reserves for rate volatility
`}`;
  } else if (metric === "leverage") {
    const isBreach = value > threshold;
    return `**Analysis of Leverage: ${value.toFixed(2)}x**

${isBreach ? '⚠️' : '✅'} Your Net Debt/EBITDA is ${isBreach ? 'above' : 'within'} the ${threshold.toFixed(2)}x limit.

**What this means:**
It would take ${value.toFixed(1)} years of EBITDA to repay all debt. ${isBreach ? 'High leverage limits financial flexibility.' : 'Leverage is within acceptable range.'}

**Context:**
- Opening Debt balance relative to earnings
- EBITDA margin and growth trajectory
- Working capital efficiency

**Recommendations:**
${isBreach ? `
1. Increase equity to reduce net debt
2. Accelerate EBITDA growth through operational improvements
3. Consider asset sales to deleverage
4. Negotiate covenant waivers if temporary
` : `
1. Current leverage is manageable
2. Focus on maintaining EBITDA growth
3. Monitor for working capital drains
4. Opportunity for growth investments
`}`;
  }
  
  return "Analysis not available for this metric.";
}