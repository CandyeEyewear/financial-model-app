import React, { useState, useEffect } from "react";
import { Input, Label } from "./FieldsPrimitives";
import { clamp, num } from "../utils/calculations";
import { numFmt } from "../utils/formatters";

export function NumberField({ label, value, onChange, min, max, step = 1 }) {
  const id = `numberfield-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <Input
        type="number"
        value={value}
        className="h-8 text-sm"
        id={id}
        onChange={(e) =>
          onChange(clamp(num(e.target.value), min ?? -1e12, max ?? 1e12))
        }
        step={step}
      />
    </div>
  );
}

export function MoneyField({ label, value, onChange, ccy }) {
  const id = `moneyfield-${label.replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(num(e.target.value))}
        className="h-8 text-sm"
        id={id}
      />
      <div className="text-xs text-slate-500">Units: {ccy}</div>
    </div>
  );
}

export function PctField({ label, value, onChange }) {
  const [local, setLocal] = useState(value * 100);
  const id = `pctfield-${label.replace(/\s+/g, "-")}`;
  useEffect(() => {
    setLocal(value * 100);
  }, [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs" htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={local}
          className="h-8 text-sm"
          id={id}
          onChange={(e) => {
            const v = clamp(num(e.target.value), -100, 100);
            setLocal(v);
            onChange(v / 100);
          }}
        />
        <span className="text-slate-500 text-sm">%</span>
      </div>
    </div>
  );
}