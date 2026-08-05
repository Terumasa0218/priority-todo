"use client";

import React, { useMemo, useRef, useState } from "react";
import { Category, Task } from "@/lib/types";
import { DAY } from "@/lib/constants";
import { holidayName } from "@/lib/holidays";
import { taskDisplayTitle } from "@/lib/utils";
import { IconChevL, IconChevR, IconFlag, IconPlus, IconRepeat, IconX } from "./Icons";

interface CalendarViewProps {
  tasks: Task[];
  cats: Category[];
  month: Date;
  setMonth: (date: Date) => void;
  onAddClick: (date: Date) => void;
  onEditTask: (task: Task) => void;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
}

const fmtTime = (iso: string) => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export default function CalendarView({ tasks, cats, month, setMonth, onAddClick, onEditTask, selectedDate, setSelectedDate }: CalendarViewProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const cells: (number | null)[] = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const tasksByDay = useMemo(() => {
    const next = new Map<number, Task[]>();
    tasks.forEach((task) => {
      const date = new Date(task.deadline);
      if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return;
      const dayTasks = next.get(date.getDate()) || [];
      dayTasks.push(task);
      next.set(date.getDate(), dayTasks);
    });
    next.forEach((dayTasks) => dayTasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()));
    return next;
  }, [monthIndex, tasks, year]);

  const monthTaskCount = useMemo(() => Array.from(tasksByDay.values()).reduce((count, dayTasks) => count + dayTasks.length, 0), [tasksByDay]);
  const selectedTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter((task) => {
      const date = new Date(task.deadline);
      return date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth() && date.getDate() === selectedDate.getDate();
    }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }, [selectedDate, tasks]);

  const selectedRow = selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === monthIndex
    ? Math.floor((firstWeekday + selectedDate.getDate() - 1) / 7)
    : -1;
  const monthLift = selectedRow >= 5 ? 144 : selectedRow === 4 ? 104 : selectedRow === 3 ? 48 : 0;
  const selectedLabel = selectedDate ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日(${DAY[selectedDate.getDay()]})` : "";
  const selectedHoliday = selectedDate ? holidayName(selectedDate) : null;

  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [monthMotion, setMonthMotion] = useState<"prev" | "next" | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const changeMonth = (direction: -1 | 1) => {
    setMonthMotion(direction > 0 ? "next" : "prev");
    setSelectedDate(null);
    setMonth(new Date(year, monthIndex + direction, 1));
    window.setTimeout(() => setMonthMotion(null), 280);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    startX.current = event.touches[0].clientX;
    startY.current = event.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const xDistance = event.touches[0].clientX - startX.current;
    const yDistance = event.touches[0].clientY - startY.current;
    if (Math.abs(xDistance) < 10 || Math.abs(xDistance) < Math.abs(yDistance) * 1.4) return;
    setDragOffset(Math.max(-72, Math.min(72, xDistance * 0.35)));
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const xDistance = event.changedTouches[0].clientX - startX.current;
    const yDistance = event.changedTouches[0].clientY - startY.current;
    startX.current = null;
    startY.current = null;
    setDragging(false);
    setDragOffset(0);
    if (Math.abs(xDistance) > 50 && Math.abs(xDistance) > Math.abs(yDistance) * 2) changeMonth(xDistance < 0 ? 1 : -1);
  };

  const isSelected = (day: number | null) => Boolean(day && selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === monthIndex && selectedDate.getDate() === day);
  const isToday = (day: number | null) => Boolean(day && today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day);

  return (
    <div className="relative overflow-hidden pb-3">
      <div className="transition-transform duration-200 ease-out" style={{ transform: `translateY(-${monthLift}px)` }}>
        <div className="mx-5 mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{year}年 {monthIndex + 1}月</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">締切・予定 {monthTaskCount}件</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => changeMonth(-1)} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 active:bg-slate-100" aria-label="前の月"><IconChevL size={19} /></button>
            <button type="button" onClick={() => changeMonth(1)} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 active:bg-slate-100" aria-label="次の月"><IconChevR size={19} /></button>
          </div>
        </div>

        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { setDragging(false); setDragOffset(0); }}>
          <div
            className={`calendar-month-panel mx-4 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${monthMotion ? `calendar-month-${monthMotion}` : ""}`}
            style={{
              "--calendar-drag-x": `${dragOffset}px`,
              "--calendar-drag-opacity": String(1 - Math.min(Math.abs(dragOffset) / 220, 0.22)),
              transition: dragging ? "none" : undefined,
            } as React.CSSProperties}
          >
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
              {DAY.map((label, index) => <div key={label} className={`py-2 text-center text-xs font-bold ${index === 0 ? "text-rose-400" : index === 6 ? "text-sky-500" : "text-slate-400"}`}>{label}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-100/80">
              {cells.map((day, index) => {
                const dayTasks = day ? tasksByDay.get(day) || [] : [];
                const selected = isSelected(day);
                const currentDay = isToday(day);
                const dayDate = day ? new Date(year, monthIndex, day) : null;
                const holiday = dayDate ? holidayName(dayDate) : null;
                const weekday = dayDate?.getDay() ?? -1;
                const dayColor = currentDay || selected ? "" : weekday === 0 || holiday ? "text-rose-500" : weekday === 6 ? "text-sky-600" : "text-slate-700";
                return (
                  <button
                    key={`${year}-${monthIndex}-${index}`}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setSelectedDate(new Date(year, monthIndex, day))}
                    className={`calendar-day-cell min-h-[72px] p-1 text-left sm:min-h-[88px] ${day ? "active:bg-slate-50" : "cursor-default bg-slate-50/40"}`}
                    data-selected={selected || undefined}
                    data-today={currentDay || undefined}
                  >
                    {day && (
                      <>
                        <div className="mb-1 flex items-center justify-center">
                          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${currentDay && selected ? "bg-[#0B7DEE] text-white" : selected ? "bg-slate-900 text-white" : currentDay ? "bg-white text-[#0B7DEE] ring-2 ring-[#0B7DEE]" : dayColor}`}>{day}</span>
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 2).map((task) => {
                            const category = cats.find((item) => item.id === task.category);
                            const color = task.priority ? "#E11D48" : category?.color || "#889096";
                            return (
                              <div key={task.id} className="calendar-task-bar" style={{ "--task-color": color } as React.CSSProperties}>
                                <span className="calendar-task-dot" />
                                <span className="truncate">{task.title}</span>
                              </div>
                            );
                          })}
                          {dayTasks.length > 2 && <div className="px-1 text-center text-[9px] font-bold text-slate-400">+{dayTasks.length - 2}</div>}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedDate && (
        <section className="sheet-slide-up fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-40 mx-auto max-h-[34dvh] w-full max-w-lg overflow-hidden rounded-t-[24px] border border-slate-200/80 bg-white shadow-[0_-16px_42px_rgba(27,39,75,0.14)]" aria-live="polite">
          <div className="flex justify-center pb-1 pt-2"><span className="h-1 w-10 rounded-full bg-slate-200" /></div>
          <div className="flex items-start justify-between gap-3 px-5 pb-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-950">{selectedLabel}</h3>
              {selectedHoliday && <p className="mt-0.5 text-xs font-medium text-rose-500">{selectedHoliday}</p>}
            </div>
            <button type="button" onClick={() => setSelectedDate(null)} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 active:bg-slate-100" aria-label="閉じる"><IconX size={18} /></button>
          </div>
          <div className="max-h-[calc(34dvh-120px)] overflow-y-auto border-t border-slate-100">
            {selectedTasks.length === 0 ? (
              <div className="px-5 py-5 text-center">
                <p className="text-sm font-semibold text-slate-700">予定なし</p>
              </div>
            ) : selectedTasks.map((task) => {
              const category = cats.find((item) => item.id === task.category) || { label: "未分類", color: "#889096" };
              const eventTime = task.kind === "event" && task.endTime ? `${fmtTime(task.deadline)}-${fmtTime(task.endTime)}` : fmtTime(task.deadline);
              return (
                <button key={task.id} type="button" onClick={() => onEditTask(task)} className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3 text-left active:bg-slate-50">
                  <span className="w-11 flex-none text-right text-xs font-semibold tabular-nums text-slate-500">{eventTime}</span>
                  <span className="h-8 w-1 rounded-full" style={{ backgroundColor: task.priority ? "#E11D48" : category.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold text-slate-950">{taskDisplayTitle(task)}</span>{task.priority && <IconFlag size={12} filled />}{task.recurrence !== "none" && <IconRepeat size={12} stroke="#94A3B8" />}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{category.label}</span>
                  </span>
                  <IconChevR size={16} stroke="#94A3B8" />
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => onAddClick(selectedDate)} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-5 py-3 text-sm font-bold text-[#0B7DEE] active:bg-blue-50"><IconPlus size={17} />この日に課題を追加</button>
        </section>
      )}
    </div>
  );
}
