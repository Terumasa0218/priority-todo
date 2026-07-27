"use client";

import React from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export default function Switch({ checked, onCheckedChange, label, disabled = false, className = "" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`ui-switch ${className}`}
      data-state={checked ? "checked" : "unchecked"}
    >
      <span className="ui-switch-thumb" aria-hidden="true" />
    </button>
  );
}
