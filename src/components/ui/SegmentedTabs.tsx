"use client";
import React from "react";

interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  value: T;
  items: SegmentedTabItem<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedTabs<T extends string>({ value, items, onChange, className = "" }: SegmentedTabsProps<T>) {
  return (
    <div className={`segmented-tabs ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`segmented-tab min-h-11 ${value === item.id ? "segmented-tab-active" : ""}`}
        >
          <span>{item.label}</span>
          {(item.count || 0) > 0 && <span className={`text-[10px] ${value === item.id ? "text-slate-600" : "text-slate-400"}`}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
