"use client";
import React from "react";
import { Task, Category } from "@/lib/types";
import { DAY } from "@/lib/constants";
import { IconChevL, IconChevR, IconX, IconPlus, IconFlag, IconRepeat } from "./Icons";

interface CalendarViewProps {
  tasks: Task[];
  cats: Category[];
  month: Date;
  setMonth: (d: Date) => void;
  onAddClick: (d: Date) => void;
  onEditTask: (t: Task) => void;
  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;
}

export default function CalendarView({ tasks, cats, month, setMonth, onAddClick, onEditTask, selectedDate, setSelectedDate }: CalendarViewProps) {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  const tasksOn = (day: number) =>
    tasks.filter((t) => {
      const dd = new Date(t.deadline);
      return dd.getFullYear() === y && dd.getMonth() === m && dd.getDate() === day;
    });

  const isToday = (day: number | null) =>
    day !== null && today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;

  const isSel = (day: number | null) => {
    if (!day || !selectedDate) return false;
    return selectedDate.getFullYear() === y && selectedDate.getMonth() === m && selectedDate.getDate() === day;
  };

  const selTasks = selectedDate
    ? tasks
        .filter((t) => {
          const dd = new Date(t.deadline);
          return dd.getFullYear() === selectedDate.getFullYear() && dd.getMonth() === selectedDate.getMonth() && dd.getDate() === selectedDate.getDate();
        })
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    : [];

  const fmtSel = selectedDate
    ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日(${DAY[selectedDate.getDay()]})`
    : "";

  const fmtTime = (d: string) => {
    const o = new Date(d);
    return `${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(new Date(y, m - 1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevL size={16} /></button>
        <span className="text-sm font-semibold text-gray-900">{y}年 {m + 1}月</span>
        <button onClick={() => setMonth(new Date(y, m + 1))} className="p-2 hover:bg-gray-100 rounded-lg"><IconChevR size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden">
        {cells.map((day, idx) => {
          const dt = day ? tasksOn(day) : [];
          const sel = isSel(day);
          const tod = isToday(day);
          return (
            <div
              key={idx}
              onClick={() => day && setSelectedDate(new Date(y, m, day))}
              className={`min-h-[100px] p-1.5 transition-colors ${day ? "cursor-pointer" : ""}`}
              style={{ backgroundColor: sel ? "#111827" : tod ? "rgba(219,234,254,0.5)" : "#fff" }}
            >
              {day && (
                <>
                  <div className={`text-[11px] leading-none mb-1.5 text-center font-medium ${sel ? "font-bold text-white" : tod ? "font-bold text-blue-600" : "text-gray-700"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dt.slice(0, 2).map((t) => {
                      const tc = cats.find((c) => c.id === t.category);
                      return (
                        <div key={t.id}
                          className={`text-[8px] leading-tight truncate px-0.5 rounded ${sel ? "text-white/80" : "text-gray-500"}`}
                          style={!sel ? { borderLeft: `2px solid ${t.priority ? "#CD2B31" : (tc?.color || "#889096")}` } : { borderLeft: "2px solid rgba(255,255,255,0.5)" }}
                        >{t.title}</div>
                      );
                    })}
                    {dt.length > 2 && <div className={`text-[8px] px-0.5 ${sel ? "text-white/50" : "text-gray-400"}`}>+{dt.length - 2}</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {selectedDate && (
        <div className="mt-3">
          <div className="bg-gray-100 px-4 py-2.5 flex items-center justify-between rounded-t-lg">
            <span className="text-xs font-semibold text-gray-700">{fmtSel}</span>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600"><IconX size={14} /></button>
          </div>
          <div className="border border-t-0 border-gray-100 rounded-b-lg bg-white">
            {selTasks.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">予定はありません</div>
            ) : (
              selTasks.map((t) => {
                const tc = cats.find((c) => c.id === t.category) || { label: "未分類", color: "#889096" };
                const hasMemo = t.memo && t.memo.trim();
                const hasUrl = t.url && t.url.trim();
                return (
                  <div key={t.id} onClick={() => onEditTask(t)}
                    className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex-shrink-0 w-12 text-right mt-0.5">
                      <div className="text-xs font-medium text-gray-500">{fmtTime(t.deadline)}</div>
                    </div>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: t.priority ? "#CD2B31" : tc.color, minHeight: "24px" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {t.priority && <IconFlag filled size={11} />}
                        <span className="text-sm text-gray-900 font-medium truncate">{t.title}</span>
                        {t.recurrence && t.recurrence !== "none" && <IconRepeat size={11} stroke="#889096" />}
                      </div>
                      <span className="text-[11px] text-gray-400">{tc.label}</span>
                      {hasMemo && (
                        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed"
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                          {t.memo}
                        </div>
                      )}
                      {hasUrl && <div className="mt-0.5 text-[10px] text-blue-400 truncate">{t.url.replace(/^https?:\/\//, "").slice(0, 35)}</div>}
                    </div>
                    <IconChevR size={14} stroke="#ccc" className="mt-0.5" />
                  </div>
                );
              })
            )}
            <button onClick={() => onAddClick(selectedDate)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors border-t border-gray-100">
              <IconPlus size={15} />新しい予定の作成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
