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
    <div className={`surface-card p-8 text-center ${className}`}>
      {icon && <div className="mx-auto mb-3 w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
    </div>
  );
}
