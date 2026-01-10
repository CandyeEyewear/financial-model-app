// src/components/DebtTrancheManager.jsx
import React, { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Label } from './Label';

// Account for interest-only periods in Year 1 preview
const calculateYear1DebtService = (tranche) => {
  const amount = tranche.amount || 0;
  const rate = tranche.rate || 0;
  const tenorYears = tranche.tenorYears || 1;
  const interestOnlyYears = tranche.interestOnlyYears || 0;
  const amortizationType = tranche.amortizationType || 'amortizing';

  // Year 1 interest (always applies)
  const year1Interest = amount * rate;

  // Year 1 principal depends on structure
  let year1Principal = 0;

  if (amortizationType === 'bullet' || amortizationType === 'interest-only') {
    // No principal in Year 1 for bullet/IO structures
    year1Principal = 0;
  } else if (interestOnlyYears >= 1) {
    // In interest-only period - no principal
    year1Principal = 0;
  } else if (amortizationType === 'amortizing') {
    // Amortizing with no IO period
    const amortizingYears = tenorYears - interestOnlyYears;
    year1Principal = amortizingYears > 0 ? amount / amortizingYears : 0;
  }

  return {
    principal: year1Principal,
    interest: year1Interest,
    total: year1Principal + year1Interest
  };
};

// Validate tranche before adding
const validateTranche = (tranche) => {
  const errors = [];

  if (!tranche.name || tranche.name.trim() === '') {
    errors.push('Tranche name is required');
  }

  if (!tranche.amount || tranche.amount <= 0) {
    errors.push('Tranche amount must be greater than zero');
  }

  if (!tranche.rate || tranche.rate <= 0) {
    errors.push('Tranche interest rate must be greater than zero');
  }

  if (!tranche.tenorYears || tranche.tenorYears <= 0) {
    errors.push('Tranche tenor must be greater than zero');
  }

  if (tranche.interestOnlyYears && tranche.interestOnlyYears >= tranche.tenorYears) {
    errors.push('Interest-only period cannot exceed or equal total tenor');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export function DebtTrancheManager({ tranches, onChange, ccy }) {
  const addTranche = () => {
    const newTranche = {
      id: Date.now(),
      name: `Tranche ${tranches.length + 1}`,
      amount: 0,
      rate: 0.10,
      maturityDate: new Date(Date.now() + 365 * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amortizationType: 'amortizing',
      tenorYears: 5,
      seniority: 'Senior Secured'
    };
    onChange([...tranches, newTranche]);
  };

  const updateTranche = (id, field, value) => {
    onChange(tranches.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTranche = (id) => {
    if (tranches.length > 1) {
      onChange(tranches.filter(t => t.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-600 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Each tranche will be calculated separately and aggregated for covenant testing
        </p>
        <Button 
          onClick={addTranche}
          className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center justify-center gap-1 w-full sm:w-auto"
        >
          <Plus className="w-3 h-3" /> Add Tranche
        </Button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {tranches.map((tranche, index) => (
          <div key={tranche.id} className="p-4 bg-white border-2 border-purple-200 rounded-lg space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Input
                value={tranche.name}
                onChange={(e) => updateTranche(tranche.id, 'name', e.target.value)}
                className="font-semibold text-sm flex-1 mr-2"
                placeholder="Tranche name"
              />
              {tranches.length > 1 && (
                <button
                  onClick={() => removeTranche(tranche.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Row 1: Amount, Rate, Tenor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount ({ccy})</Label>
                <Input
                  type="number"
                  value={tranche.amount}
                  onChange={(e) => updateTranche(tranche.id, 'amount', Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(tranche.rate * 100).toFixed(2)}
                  onChange={(e) => updateTranche(tranche.id, 'rate', Number(e.target.value) / 100)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tenor (Years)</Label>
                <Input
                  type="number"
                  value={tranche.tenorYears}
                  onChange={(e) => updateTranche(tranche.id, 'tenorYears', Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Row 2: Maturity, Amortization Type, Seniority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Maturity Date</Label>
                <Input
                  type="date"
                  value={tranche.maturityDate}
                  onChange={(e) => updateTranche(tranche.id, 'maturityDate', e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amortization</Label>
                <select
                  value={tranche.amortizationType}
                  onChange={(e) => updateTranche(tranche.id, 'amortizationType', e.target.value)}
                  className="w-full h-9 text-sm border border-slate-300 rounded-md"
                >
                  <option value="amortizing">Amortizing</option>
                  <option value="interest-only">Interest-Only</option>
                  <option value="bullet">Bullet</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Seniority</Label>
                <select
                  value={tranche.seniority}
                  onChange={(e) => updateTranche(tranche.id, 'seniority', e.target.value)}
                  className="w-full h-9 text-sm border border-slate-300 rounded-md"
                >
                  <option value="Senior Secured">Senior Secured</option>
                  <option value="Senior Unsecured">Senior Unsecured</option>
                  <option value="Subordinated">Subordinated</option>
                  <option value="Mezzanine">Mezzanine</option>
                  <option value="Revolver">Revolver</option>
                </select>
              </div>
            </div>

            {/* Annual Debt Service Preview */}
            <div className="pt-2 border-t border-slate-200">
              {(() => {
                const year1DS = calculateYear1DebtService(tranche);
                return (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Annual Debt Service (Year 1):</span>
                      <span className="font-bold text-purple-900">
                        {ccy} {year1DS.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>Interest: {ccy} {year1DS.interest.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      <span>Principal: {ccy} {year1DS.principal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                    {tranche.amortizationType === 'amortizing' && !tranche.interestOnlyYears && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Interest portion decreases over time as principal is repaid
                      </p>
                    )}
                    {tranche.interestOnlyYears > 0 && tranche.amortizationType === 'amortizing' && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        Interest-only for {tranche.interestOnlyYears} year(s), then amortizing
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
