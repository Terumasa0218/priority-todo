"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Task, Category } from "@/lib/types";
import { DAY } from "@/lib/constants";
import { holidayName } from "@/lib/holidays";
import { taskDisplayTitle } from "@/lib/utils";
import { IconChevL, IconChevR, IconX, IconPlus, IconFlag, IconRepeat } from "./Icons";
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
  while (cells.length % 7 !== 0) cells.push(null);
  const monthTaskCount = useMemo(
    () => tasks.filter((t) => {
      const dd = new Date(t.deadline);
      return dd.getFullYear() === y && dd.getMonth() === m;
    }).length,
    [m, tasks, y]
  );

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

  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedDate) return;
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedDate]);

  const fmtTime = (d: string) => {
    const o = new Date(d);
    return `${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`;
  };

  // 横スワイプで月を切り替える
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingMonth, setIsDraggingMonth] = useState(false);
  const [monthMotion, setMonthMotion] = useState<"prev" | "next" | null>(null);

  const changeMonth = (direction: -1 | 1) => {
    setMonthMotion(direction > 0 ? "next" : "prev");
    setMonth(new Date(y, m + direction));
    window.setTimeout(() => setMonthMotion(null), 280);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    setIsDraggingMonth(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = e.touches[0].clientY - swipeStartY.current;
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    setDragOffset(Math.max(-72, Math.min(72, dx * 0.35)));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current == null || swipeStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    const dy = e.changedTouches[0].clientY - swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    setIsDraggingMonth(false);
    setDragOffset(0);
    // 横方向が縦方向の 2 倍以上で 50px 超えたら月送り
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
      changeMonth(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div className={selectedDate ? "pb-[56dvh]" : ""}>
      <div className="mx-4 mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold tracking-normal text-slate-950">{y}年 {m + 1}月</div>
          <div className="mt-0.5 text-xs font-medium text-slate-400">締切・予定 {monthTaskCount}件</div>
        </div>
        <div className="inline-flex items-center rounded-full border border-white/70 bg-white/72 p-1 shadow-[0_12px_28px_rgba(27,39,75,0.08)] backdrop-blur-xl">
          <button onClick={() => changeMonth(-1)} className="grid min-h-10 min-w-10 place-items-center rounded-full text-slate-500 transition active:scale-95 hover:bg-slate-100" aria-label="前の月"><IconChevL size={16} /></button>
          <button onClick={() => changeMonth(1)} className="grid min-h-10 min-w-10 place-items-center rounded-full text-slate-500 transition active:scale-95 hover:bg-slate-100" aria-label="次の月"><IconChevR size={16} /></button>
        </div>
      </div>
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { setIsDraggingMonth(false); setDragOffset(0); }}>
      <div
        className={`calendar-month-panel mx-4 overflow-hidden rounded-[22px] border border-white/80 bg-white/80 shadow-[0_18px_42px_rgba(27,39,75,0.08)] ${monthMotion ? `calendar-month-${monthMotion}` : ""}`}
        style={{
          "--calendar-drag-x": `${dragOffset}px`,
          "--calendar-drag-opacity": String(1 - Math.min(Math.abs(dragOffset) / 220, 0.22)),
          transition: isDraggingMonth ? "none" : undefined,
        } as React.CSSProperties}
      >
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/72">
        {DAY.map((d, i) => (
          <div key={d} className={`text-center text-xs font-bold py-2.5 ${i === 0 ? "text-rose-400" : i === 6 ? "text-sky-500" : "text-slate-400"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100/70">
        {cells.map((day, idx) => {
          const dt = day ? tasksOn(day) : [];
          const sel = isSel(day);
          const tod = isToday(day);
          const dow = day != null ? new Date(y, m, day).getDay() : -1;
          const hName = day != null ? holidayName(new Date(y, m, day)) : null;
          const isRed = dow === 0 || hName !== null;
          const isBlue = dow === 6;
          const dayColor = tod || sel ? "" : isRed ? "text-rose-500" : isBlue ? "text-sky-600" : "text-slate-700";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => day && setSelectedDate(new Date(y, m, day))}
              disabled={!day}
              className={`calendar-day-cell min-h-[84px] p-1.5 text-left transition-colors sm:min-h-[106px] ${day ? "cursor-pointer active:bg-slate-50" : "cursor-default bg-slate-50/45"}`}
              data-selected={sel || undefined}
              data-today={tod || undefined}
            >
              {day && (
                <>
                  <div className="mb-1 flex min-h-8 flex-col items-center gap-0.5">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold tabular-nums ${tod ? "bg-blue-500 text-white shadow-[0_8px_16px_rgba(22,136,242,0.24)]" : sel ? "bg-slate-900 text-white" : dayColor}`}>{day}</span>
                    {hName && <span className="max-w-full truncate text-[9px] font-medium leading-none text-rose-500" title={hName}>{hName.length > 4 ? `${hName.slice(0, 3)}…` : hName}</span>}
                  </div>
                  <div className="space-y-1">
                    {dt.slice(0, 2).map((t) => {
                      const tc = cats.find((c) => c.id === t.category);
                      const color = t.priority ? "#E11D48" : (tc?.color || "#889096");
                      const isEvent = t.kind === "event";
                      return (
                        <div
                          key={t.id}
                          className={`calendar-task-bar ${isEvent ? "calendar-task-bar-event" : ""}`}
                          style={{ "--task-color": color } as React.CSSProperties}
                        >
                          <span className="calendar-task-dot" />
                          <span className="truncate">{taskDisplayTitle(t)}</span>
                        </div>
                      );
                    })}
                    {dt.length > 2 && <div className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">+{dt.length - 2}件</div>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
      </div>
      </div>
      {selectedDate && (
        <div
          ref={detailsRef}
          className="mt-3 mx-4 bg-white rounded-3xl shadow-sm sheet-slide-up flex flex-col border border-slate-100 overflow-hidden"
          role="region"
          aria-live="polite"
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
            <div className="max-h-[38dvh] overflow-y-auto">
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
                          <span className="text-sm text-gray-900 font-medium truncate">{taskDisplayTitle(t)}</span>
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
              <IconPlus size={15} />この日に課題を追加
            </button>
        </div>
      )}
    </div>
  );
}
