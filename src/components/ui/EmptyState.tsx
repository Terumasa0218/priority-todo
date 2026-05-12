"use client";
import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, icon, className = "" }: EmptyStateProps) {
  return (
    <div className={`surface-card p-8 text-center overflow-hidden ${className}`}>
      {icon && <div className="mx-auto mb-3 w-12 h-12 rounded-3xl bg-gradient-to-br from-sky-50 to-indigo-50 shadow-inner flex items-center justify-center text-slate-400">{icon}</div>}
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>}
    </div>
  );
}
