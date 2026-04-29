"use client";
import React, { useRef } from "react";
import { Task, Category } from "@/lib/types";
import { DAY } from "@/lib/constants";
import { holidayName } from "@/lib/holidays";
import { IconChevL, IconChevR, IconX, IconPlus, IconFlag, IconRepeat } from "./Icons";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";

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
  const selHoliday = selectedDate ? holidayName(selectedDate) : null;

  const fmtTime = (d: string) => {
    const o = new Date(d);
    return `${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`;
  };

  // 横スワイプで月を切り替える
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    // 横方向が縦方向の 2 倍以上で 50px 超えたら月送り
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) setMonth(new Date(y, m + 1));
      else setMonth(new Date(y, m - 1));
    }
  };

  return (
    <div className={selectedDate ? "pb-[56dvh]" : ""}>
      <SectionHeader
        title={`${y}年 ${m + 1}月`}
        className="mb-2 px-4"
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(new Date(y, m - 1))} className="min-h-11 min-w-11 p-2 hover:bg-slate-100 rounded-xl" aria-label="前の月"><IconChevL size={16} /></button>
            <button onClick={() => setMonth(new Date(y, m + 1))} className="min-h-11 min-w-11 p-2 hover:bg-slate-100 rounded-xl" aria-label="次の月"><IconChevR size={16} /></button>
          </div>
        }
      />
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="grid grid-cols-7 mb-1 px-1">
        {DAY.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-1.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 border-y border-slate-100 overflow-hidden">
        {cells.map((day, idx) => {
          const dt = day ? tasksOn(day) : [];
          const sel = isSel(day);
          const tod = isToday(day);
          const dow = day != null ? new Date(y, m, day).getDay() : -1;
          const hName = day != null ? holidayName(new Date(y, m, day)) : null;
          const isRed = dow === 0 || hName !== null;
          const isBlue = dow === 6;
          const dayColor = tod ? "" : isRed ? "text-rose-500" : isBlue ? "text-blue-500" : "text-gray-700";
          return (
            <div
              key={idx}
              onClick={() => day && setSelectedDate(new Date(y, m, day))}
              className={`min-h-[106px] p-1.5 transition-colors ${day ? "cursor-pointer" : ""}`}
              style={sel ? { boxShadow: "inset 0 0 0 2px #111827", backgroundColor: "#fff" } : tod ? { backgroundColor: "#EFF6FF" } : { backgroundColor: "#fff" }}
            >
              {day && (
                <>
                  <div className="text-[11px] leading-none mb-1 flex flex-col items-center gap-0.5">
                    <span className={`inline-flex items-center justify-center ${tod ? "w-5 h-5 rounded-full bg-blue-500 text-white font-bold" : `${dayColor} ${sel ? "font-bold" : ""}`}`}>{day}</span>
                    {hName && <span className="text-[9px] text-rose-500 leading-none truncate max-w-full" title={hName}>{hName.length > 4 ? `${hName.slice(0, 3)}…` : hName}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {dt.slice(0, 2).map((t) => {
                      const tc = cats.find((c) => c.id === t.category);
                      const isEvent = t.kind === "event";
                      return (
                        <div
                          key={t.id}
                          className="calendar-task-bar text-[10px] leading-tight truncate px-1 py-[1px] rounded"
                          style={isEvent
                            ? { backgroundColor: "#fff", color: tc?.color || "#889096", border: `1px solid ${tc?.color || "#889096"}` }
                            : { backgroundColor: t.priority ? "#CD2B31" : (tc?.color || "#889096"), color: "#fff" }}
                        >{t.title}</div>
                      );
                    })}
                    {dt.length > 2 && <div className="text-[9px] px-0.5 text-gray-400">+{dt.length - 2}件</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>
      {selectedDate && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 w-full max-w-lg mx-auto bg-white rounded-t-3xl shadow-2xl sheet-slide-up flex flex-col border-t border-slate-100"
          style={{ maxHeight: "55dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
          role="dialog"
        >
            <div className="flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-4 pb-3 flex items-center justify-between">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold text-gray-900">{fmtSel}</span>
                {selHoliday && <span className="text-[11px] text-rose-500 font-medium truncate">{selHoliday}</span>}
              </div>
              <button onClick={() => setSelectedDate(null)} aria-label="閉じる" className="text-gray-400 hover:text-gray-600 p-1.5 -mr-1.5">
                <IconX size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selTasks.length === 0 ? (
                <EmptyState title="予定はありません" description="この日は余白です。追加して整えましょう。" className="!border-none !shadow-none !bg-transparent py-7" />
              ) : (
                selTasks.map((t) => {
                  const tc = cats.find((c) => c.id === t.category) || { label: "未分類", color: "#889096" };
                  const hasMemo = t.memo && t.memo.trim();
                  const hasUrl = t.url && t.url.trim();
                  const isEvent = t.kind === "event";
                  const timeLabel = isEvent && t.endTime
                    ? `${fmtTime(t.deadline)}–${fmtTime(t.endTime)}`
                    : fmtTime(t.deadline);
                  return (
                    <div key={t.id} onClick={() => onEditTask(t)}
                      className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`flex-shrink-0 ${isEvent && t.endTime ? "w-20" : "w-12"} text-right mt-0.5`}>
                        <div className="text-xs font-medium text-gray-500 tabular-nums">{timeLabel}</div>
                      </div>
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: t.priority ? "#CD2B31" : tc.color, minHeight: "24px" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {t.priority && <IconFlag filled size={11} />}
                          <span className="text-sm text-gray-900 font-medium truncate">{t.title}</span>
                          {t.recurrence && t.recurrence !== "none" && <IconRepeat size={11} stroke="#889096" />}
                          {isEvent && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">予定</span>}
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
            </div>
            <button onClick={() => onAddClick(selectedDate)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors border-t border-slate-100">
              <IconPlus size={15} />新しい予定の作成
            </button>
        </div>
      )}
    </div>
  );
}
