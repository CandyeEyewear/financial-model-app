# AUDIT REPORT: FinSight Facility Handling

**Date:** January 10, 2026
**Auditor:** Claude (Automated Code Audit)
**Scope:** New Facility vs Existing Facility handling across the FinSight codebase

---

## Executive Summary

| Category | Count |
|----------|-------|
| **Total Issues Found** | 19 |
| 🔴 **Critical** | 4 |
| ❌ **Major** | 6 |
| ⚠️ **Minor** | 9 |
| ✅ **Working Correctly** | 12 |

---

## Critical Issues (Fix Immediately)

| # | Location | Issue | Impact | Recommended Fix |
|---|----------|-------|--------|-----------------|
| 1 | `buildProjection.js:42` | **OR operator bug in principal calculation** - Comment says "FIX: Combine opening debt + new facility" but code uses `params.openingDebt \|\| params.requestedLoanAmount` which only uses ONE, not both | When user has BOTH existing debt AND new facility, only existing debt is used if it's non-zero. **Calculations are WRONG.** | Change to additive logic: `(params.openingDebt \|\| 0) + (params.requestedLoanAmount \|\| 0)` |
| 2 | `buildProjection.js:336` | **Unreachable code path** - After auto-creating tranches (lines 288-334), line 336 has orphaned single-debt logic that can never execute | The `return buildAmortizationSchedule(params)` on line 336 is never reached because the conditional on line 288 already returns. This is dead code that confuses maintenance. | Remove line 336 or restructure the IIFE logic properly |
| 3 | `validation.js:120-151` | **No validation for existing facilities** - `validateFacilityTerms()` only validates NEW facility fields (`requestedLoanAmount`, `proposedPricing`, `proposedTenor`) | Existing debt with invalid values (0% rate, 0 tenor, negative amount) passes validation silently, leading to NaN/Infinity in calculations | Add `validateExistingDebtTerms()` function that validates `existingDebtAmount`, `existingDebtRate`, `existingDebtTenor` |
| 4 | `CreditDashboard.jsx:329` | **Multi-tranche debt not detected** - `hasExistingDebt` only checks `params.openingDebt > 0`, but when `hasMultipleTranches` is true, `openingDebt` is set to 0 by the sync logic | **Entire CreditDashboard shows "No Existing Debt" and N/A for all metrics when using multi-tranche mode**, even though user has properly configured debt. Dashboard is completely useless for multi-tranche users. | Check all debt sources: `params.openingDebt > 0 \|\| (params.hasMultipleTranches && params.debtTranches?.some(t => t.amount > 0))` |

---

## Major Issues (Fix Soon)

| # | Location | Issue | Impact | Recommended Fix |
|---|----------|-------|--------|-----------------|
| 4 | `buildProjection.js:55` | **Rate ambiguity** - Uses `params.interestRate` which is synced from `proposedPricing`, not existing debt rate | If only existing debt exists (no new facility), the interest rate used may be stale or from the new facility defaults | Use explicit logic: `params.existingDebtRate \|\| params.proposedPricing \|\| params.interestRate` |
| 5 | `DebtTrancheManager.jsx:145-147` | **Incorrect Year 1 debt service preview** - Uses simple `amount/tenor` for principal, ignoring interest-only periods | Misleading Year 1 preview when tranche has interest-only period configured | Add check for `interestOnlyYears` before calculating principal |
| 6 | `FinancialModelAndStressTester.js:754` | **Hardcoded maturity date** - `openingDebtMaturityDate: '2028-12-31'` is hardcoded default | Users may not realize they need to update this, leading to incorrect maturity calculations | Calculate dynamically based on current year |
| 7 | `debtCapacityAnalyzer.js:23` | **Rate fallback uses wrong source** - Uses `params.interestRate` (which is synced from new facility) for existing debt capacity analysis | When analyzing capacity of existing debt only, uses new facility rate instead of existing debt rate | Should check `params.existingDebtRate` first |
| 8 | `BlendedDebtMetrics.jsx:15-20` | **Ignores interest-only periods in debt service estimate** - Calculates `totalPrincipal` without accounting for `interestOnlyYears` field | Overstates Year 1 principal payment for tranches with interest-only periods | Add check for `t.interestOnlyYears > 0` before adding principal component |
| 9 | `FinancialModelAndStressTester.js:2324-2334` | **Multi-tranche initialization uses current rate defaults** - When enabling multi-tranche, creates tranche with `existingDebtRate \|\| 0.10` | If user hasn't set existing debt rate, defaults to 10% which may be incorrect | Prompt user to confirm rate, or use a more prominent warning |

---

## Minor Issues / Improvements

| # | Location | Issue | Impact | Recommended Fix |
|---|----------|-------|--------|-----------------|
| 10 | `buildProjection.js:16-27` | **Day count convention ignored** - User selects `dayCountConvention` but it's never used in interest calculations | Interest calculated as simple `balance * annualRate`, not respecting Actual/360, Actual/365, 30/360 | Implement day count logic in `buildAmortizationSchedule()` |
| 11 | `validation.js` | **No duplicate facility name check** - Multi-tranche system allows duplicate names | Users may confuse tranches with same names | Add validation for unique tranche names |
| 12 | `DebtTrancheManager.jsx:9-21` | **No validation on tranche add** - Allows adding tranches with 0 amount and 0 rate | Users can create meaningless tranches that affect blended calculations | Add minimum validation: amount > 0, rate > 0, tenor > 0 |
| 13 | `buildProjection.js:319` | **Maturity date calculation edge case** - Uses month 11 (December) with day 31 | Edge case: Works because December has 31 days, but logic is fragile | Use proper date arithmetic |
| 14 | `FinancialModelAndStressTester.js:681` | **`dayCountConvention` field exists but not used** - UI allows selection but calculation ignores it | User expects their day count selection to affect calculations | Either implement day count logic or remove the field |
| 15 | `SmartSuggestions.jsx:31` | **Refinancing gap uses approximate year calculation** - `yearsRemaining = (facilityEnd - maturity) / (365 * 24 * 60 * 60 * 1000)` | Doesn't account for leap years, but close enough for display purposes | Acceptable, could use date library for precision |
| 16 | `LoanMetricsTable.jsx:270` | **FCF coverage aggregates all years** - Compares cumulative FCF vs cumulative debt service | May hide year-specific shortfalls if total is positive | Add year-by-year FCF coverage analysis |
| 17 | `buildProjection.js:443` | **DSCR capped at 999** - Returns 999 when no debt service | Doesn't distinguish "no debt" from "infinite coverage" | Return `Infinity` or use `null` with proper handling |
| 18 | `debtCapacityAnalyzer.js:40-41` | **Doesn't distinguish new vs existing in capacity** - `currentDebtRequest = openingDebt + requestedLoanAmount` | Capacity analysis doesn't show how much comes from existing vs new | Add breakdown in return object |

---

## What's Working Well ✅

1. **Clear UI separation** - Existing debt and new facility have distinct form sections (`FinancialModelAndStressTester.js:2207-2368`)
2. **Multi-tranche support** - Array-based `debtTranches` with per-tranche parameters (`DebtTrancheManager.jsx`)
3. **Auto-sync mechanism** - New facility terms sync to legacy fields (`FinancialModelAndStressTester.js:917-935`)
4. **Blended metrics calculation** - Correct weighted average rate calculation (`BlendedDebtMetrics.jsx:9-11`)
5. **Refinancing warnings** - Smart detection of maturity mismatches (`SmartSuggestions.jsx:26-57`, `BlendedDebtMetrics.jsx:27-32`)
6. **Stress testing separation** - Clear labeling of "Existing Only", "New Only", "Combined" (`DebtStressTesting.jsx:868-916`)
7. **Covenant breach detection** - Comprehensive DSCR, ICR, ND/EBITDA tracking (`buildProjection.js:581-593`)
8. **Amortization types** - Proper support for amortizing, interest-only, and bullet structures (`buildProjection.js:92-133`)
9. **Multi-tranche aggregation** - Correct aggregation of per-tranche schedules (`buildProjection.js:191-234`)
10. **Credit statistics summary** - Comprehensive min/max/avg calculations (`buildProjection.js:554-575`)
11. **AI-powered insights** - Context-aware recommendations in `LoanMetricsTable.jsx` and `DebtStressTesting.jsx`
12. **Auto-create tranches** - When both existing and new facility exist, auto-creates separate tranches (`buildProjection.js:288-334`)

---

## Recommended Architecture Improvements

### 1. Create Facility Type Enum
```javascript
// src/types/facility.js
export const FacilityType = {
  EXISTING: 'existing',
  NEW: 'new',
  REFINANCING: 'refinancing'
};

export const FacilityStatus = {
  ACTIVE: 'active',
  PROPOSED: 'proposed',
  COMMITTED: 'committed',
  DRAWN: 'drawn'
};
```

### 2. Unified Facility Interface
```javascript
// src/types/facility.js
export interface Facility {
  id: string;
  name: string;
  type: FacilityType; // NEW FIELD
  status: FacilityStatus; // NEW FIELD
  amount: number;
  rate: number;
  tenorYears: number;
  maturityDate: string;
  amortizationType: 'amortizing' | 'interest-only' | 'bullet';
  paymentFrequency: string;
  seniority: string;
  interestOnlyYears?: number;
  drawdownDate?: string; // For new facilities
  originationDate?: string; // For existing facilities
  outstandingBalance?: number; // For existing (may differ from amount)
}
```

### 3. Centralized Debt Calculation Service
Create `src/utils/debtService.js` to centralize all facility handling logic and eliminate the scattered handling throughout the codebase.

---

## Code Examples for Critical Fixes

### Fix #1: buildProjection.js:42 - Combine Facilities Correctly

**Current (BROKEN):**
```javascript
// Line 42
const principal = params.openingDebt || params.requestedLoanAmount || 0;
```

**Fixed:**
```javascript
// Combine both debt sources properly
const openingDebtAmount = params.openingDebt || 0;
const newFacilityAmount = params.requestedLoanAmount || 0;
const principal = openingDebtAmount + newFacilityAmount;
```

**Note:** The better fix is already partially implemented in the auto-tranche creation (lines 288-334). The real fix should ensure this path is ALWAYS taken when both debts exist.

### Fix #4: CreditDashboard.jsx:329 - Detect Multi-Tranche Debt

**Current (BROKEN):**
```javascript
// Line 329
const hasExistingDebt = safe(params.openingDebt, 0) > 0;
```

**Problem:** When `hasMultipleTranches` is true, the sync logic sets `openingDebt = 0`:
```javascript
// FinancialModelAndStressTester.js:927
openingDebt: prev.hasMultipleTranches ? 0 : (prev.hasExistingDebt ? prev.existingDebtAmount : 0),
```

**Fixed:**
```javascript
// Check all possible debt sources
const hasExistingDebt =
  safe(params.openingDebt, 0) > 0 ||
  (params.hasMultipleTranches && params.debtTranches?.some(t => t.amount > 0)) ||
  (baseProj?.hasMultipleTranches && safe(baseProj?.multiTrancheInfo?.totalDebt, 0) > 0);
```

This ensures the dashboard works correctly whether debt is configured via:
- Single opening debt (`openingDebt > 0`)
- Multi-tranche mode with tranches (`hasMultipleTranches && debtTranches`)
- Projection data that includes multi-tranche info

### Fix #3: Add Existing Debt Validation

**Add to validation.js:**
```javascript
/**
 * Validate existing debt terms
 */
export function validateExistingDebtTerms(params) {
  const errors = [];
  const warnings = [];

  if (!params.hasExistingDebt) {
    return { isValid: true, errors, warnings };
  }

  if (!params.existingDebtAmount || params.existingDebtAmount <= 0) {
    errors.push("Existing debt amount must be positive when existing debt is enabled");
  }

  if (!params.existingDebtRate || params.existingDebtRate <= 0) {
    errors.push("Existing debt interest rate must be positive");
  }

  if (params.existingDebtRate > 0.5) {
    warnings.push("Existing debt rate appears unusually high (>50%)");
  }

  if (!params.existingDebtTenor || params.existingDebtTenor <= 0) {
    errors.push("Existing debt remaining tenor must be positive");
  }

  if (params.existingDebtTenor > 30) {
    warnings.push("Existing debt tenor exceeds typical maximum of 30 years");
  }

  if (params.openingDebtMaturityDate) {
    const maturityDate = new Date(params.openingDebtMaturityDate);
    const today = new Date();

    if (maturityDate <= today) {
      errors.push("Existing debt maturity date must be in the future");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Prioritized Fix List

| Priority | File | Change | Why It Matters |
|----------|------|--------|----------------|
| 1 | `buildProjection.js:42` | Fix OR to addition for combining facilities | **CRITICAL**: Wrong debt calculations when both exist |
| 2 | `CreditDashboard.jsx:329` | Fix `hasExistingDebt` to detect multi-tranche debt | **CRITICAL**: Dashboard completely broken for multi-tranche users |
| 3 | `validation.js` | Add `validateExistingDebtTerms()` function | Prevents NaN/Infinity from invalid existing debt |
| 4 | `buildProjection.js:336` | Remove unreachable code | Code clarity and maintainability |
| 5 | `buildProjection.js:55` | Use `params.existingDebtRate` when appropriate | Correct rate for existing debt calculations |
| 6 | `debtCapacityAnalyzer.js:23` | Use existing debt rate for capacity analysis | Correct capacity assessment |
| 7 | `DebtTrancheManager.jsx:145-147` | Account for interest-only in preview | Accurate Year 1 debt service display |
| 8 | `BlendedDebtMetrics.jsx:15-20` | Account for interest-only in estimate | Accurate blended metrics |
| 9 | `FinancialModelAndStressTester.js:754` | Dynamic default maturity date | Appropriate defaults for users |
| 10 | `DebtTrancheManager.jsx:9-21` | Add tranche validation | Prevent invalid tranches |
| 11 | `buildProjection.js:16-27` | Implement day count convention | Accurate interest calculations for bankers |

---

## Files Audited

### Core Calculation Files
- `src/utils/buildProjection.js` - Main projection engine
- `src/utils/validation.js` - Input validation
- `src/utils/debtCapacityAnalyzer.js` - Debt capacity analysis
- `src/utils/financialCalculations.js` - IRR/MOIC helpers

### UI Components
- `src/FinancialModelAndStressTester.js` - Main form & orchestration
- `src/components/DebtTrancheManager.jsx` - Multi-tranche UI
- `src/components/BlendedDebtMetrics.jsx` - Blended metrics display
- `src/components/LoanMetricsTable.jsx` - Covenant metrics table
- `src/components/DebtStressTesting.jsx` - Stress scenarios
- `src/components/SmartSuggestions.jsx` - Smart warnings

---

## Conclusion

The FinSight application has a **solid foundation** for handling new vs existing facilities, with clear UI separation and comprehensive multi-tranche support. However, **four critical bugs** exist that can produce incorrect financial projections or render entire features useless:

1. **The OR operator bug** is the most severe - it silently uses only one debt source when both exist
2. **CreditDashboard multi-tranche blindness** - the entire dashboard shows "No Existing Debt" for multi-tranche users because it only checks `openingDebt` which is set to 0 when multi-tranche is enabled
3. **Missing validation** for existing debt allows invalid inputs to corrupt calculations
4. **Dead code** after auto-tranche creation creates maintenance confusion

The recommended fixes prioritize calculation accuracy and feature correctness first, then validation, then code quality improvements. With these fixes, the application will provide accurate financial modeling for bankers and analysts working with complex debt structures.
