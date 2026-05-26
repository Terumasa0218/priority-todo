"use client";
import React from "react";
import { Task, Category } from "@/lib/types";
import { fmt } from "@/lib/utils";
import { IconArchive, IconCheck } from "./Icons";

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
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <IconArchive size={32} stroke="#ccc" />
        <p className="text-sm mt-3">達成済みタスクはまだありません</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-2">
        <span className="text-[10px] text-gray-400">過去1ヶ月分を表示</span>
      </div>
      {recent.map((t) => {
        const cat = cats.find((c) => c.id === t.category) || { label: "未分類", color: "#889096" };
        return (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <button onClick={() => onRestore(t.id)}
              className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0">
              <IconCheck size={12} stroke="white" sw={3} />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-400 line-through truncate block">{t.title}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[11px] text-gray-300">{t.completedAt ? fmt(t.completedAt) : ""}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
