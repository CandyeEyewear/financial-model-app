import React from "react";
import { Button } from "./Button";
export function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white p-6 rounded-lg shadow-lg w-80">
        <p className="mb-4 text-slate-800">{message}</p>
        <div className="flex gap-4 justify-end">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}