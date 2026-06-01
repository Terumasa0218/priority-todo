"use client";
import React from "react";

interface BottomNavItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface BottomNavProps<T extends string> {
  value: T;
  items: BottomNavItem<T>[];
  onChange: (value: T) => void;
}

export default function BottomNav<T extends string>({ value, items, onChange }: BottomNavProps<T>) {
  return (
    <nav className="bottom-nav safe-x" aria-label="メインナビゲーション">
      <div className="bottom-nav-inner">
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`bottom-nav-button ${active ? "bottom-nav-button-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative flex h-6 items-center justify-center">
                {item.icon}
                {(item.count || 0) > 0 && <span className="bottom-nav-count">{item.count}</span>}
              </span>
              <span className="text-[10px] font-bold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
