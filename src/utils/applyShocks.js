// Place this file in your /utils directory

import { clamp } from "./calculations.js";

export function applyShocks(base, shocks) {
  return {
    ...base,
    growth: base.growth + shocks.growthDelta,
    cogsPct: clamp(base.cogsPct + shocks.cogsDelta, 0, 1),
    opexPct: clamp(base.opexPct + shocks.opexDelta, 0, 1),
    capexPct: clamp(base.capexPct + shocks.capexDelta, 0, 1),
    interestRate: clamp(base.interestRate + shocks.rateDelta, 0, 1),
    wacc: clamp(base.wacc + shocks.waccDelta, 0.01, 1),
    terminalGrowth: clamp(base.terminalGrowth + shocks.termGDelta, -0.2, 0.2),
  };
}