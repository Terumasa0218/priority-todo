"use client";
import React from "react";
import { Task, Category } from "@/lib/types";
import { fmt, taskDisplayTitle } from "@/lib/utils";
import { IconArchive, IconCheck } from "./Icons";
import EmptyState from "./ui/EmptyState";
import StatusPill from "./ui/StatusPill";

interface CompletedListProps {
  tasks: Task[];
  cats: Category[];
  onRestore: (id: string) => void;
}

export default function CompletedList({ tasks, cats, onRestore }: CompletedListProps) {
  const [referenceTime] = React.useState(() => Date.now());
  const oneMonthAgo = referenceTime - 30 * 864e5;
  const recent = tasks.filter((t) => t.completedAt && new Date(t.completedAt).getTime() > oneMonthAgo);

  if (!recent.length) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          title="達成済みはまだありません"
          description="完了した課題はここに残り、必要なら元に戻せます。"
          icon={<IconArchive size={20} stroke="#94A3B8" />}
        />
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">過去1ヶ月分</span>
        <StatusPill tone="gray">{recent.length}件</StatusPill>
      </div>
      <div className="space-y-2.5">
      {recent.map((t) => {
        const cat = cats.find((c) => c.id === t.category) || { label: "未分類", color: "#889096" };
        const displayTitle = taskDisplayTitle(t);
        return (
          <div key={t.id} className="surface-card task-card flex items-start gap-3 px-4 py-3.5">
            <button onClick={() => onRestore(t.id)}
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600 shadow-inner active:scale-95 transition-transform"
              aria-label={`${displayTitle}を未完了に戻す`}
            >
              <IconCheck size={14} stroke="currentColor" sw={2.7} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="block truncate text-sm font-semibold text-slate-400 line-through">{displayTitle}</span>
                <StatusPill tone="green">完了</StatusPill>
              </div>
              <div className="mt-1.5 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="min-w-0 truncate text-xs font-medium text-slate-500">{cat.label}</span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs text-slate-400">{t.completedAt ? fmt(t.completedAt) : ""}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestore(t.id)}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 active:scale-95 transition-transform"
            >
              戻す
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
