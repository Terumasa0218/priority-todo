"use client";
import React, { useMemo } from "react";
import { Task, Category } from "@/lib/types";
import { isActiveOn, isOverdue, isDueToday, taskFacts, subtaskProgress } from "@/lib/scoring";
import { fmt, remaining, urgColor } from "@/lib/utils";
import { IconFlag, IconRepeat } from "./Icons";
import EmptyState from "./ui/EmptyState";

interface TodayViewProps {
  tasks: Task[];
  cats: Category[];
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
}

const Badge = ({ tone, children }: { tone: "red" | "orange" | "blue" | "gray"; children: React.ReactNode }) => {
  const tones = {
    red: "bg-rose-100 text-rose-700",
    orange: "bg-amber-100 text-amber-700",
    blue: "bg-sky-100 text-sky-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tones[tone]}`}>{children}</span>;
};

const TaskCard = ({
  task,
  cats,
  onComplete,
  onEdit,
  onToggleSubtask,
  today,
}: {
  task: Task;
  cats: Category[];
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  today: Date;
}) => {
  const rem = remaining(task.deadline);
  const uc = urgColor(rem.u);
  const cat = cats.find((c) => c.id === task.category) || { label: "未分類", color: "#889096" };
  const facts = taskFacts(task, today);
  const sub = subtaskProgress(task);
  const importance = task.importance ?? 2;

  const accent = facts.overdue
    ? "border-l-[3px] border-rose-500"
    : task.priority
      ? "border-l-[3px] border-rose-400"
      : "border-l-[3px] border-transparent";

  return (
    <div className={`surface-card ${accent} px-4 py-3`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task)}
          aria-label="完了"
          className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex-shrink-0"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.priority && <IconFlag filled size={12} />}
            <span className={`text-sm font-semibold truncate ${facts.overdue ? "text-rose-700" : "text-slate-900"}`}>{task.title}</span>
            {task.recurrence && task.recurrence !== "none" && <IconRepeat size={11} stroke="#94A3B8" />}
            {importance === 3 && <span className="text-[10px] text-amber-600">★★★</span>}
            {importance === 2 && <span className="text-[10px] text-amber-600">★★</span>}
            {importance === 1 && <span className="text-[10px] text-amber-600">★</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="text-xs text-slate-500">{cat.label}</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500">{fmt(task.deadline)}</span>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: uc.bg, color: uc.fg }}>
              {rem.u >= 4 ? rem.t : `あと${rem.t}`}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {facts.overdue && <Badge tone="red">期限超過</Badge>}
            {facts.dueToday && <Badge tone="red">今日締切</Badge>}
            {!facts.overdue && !facts.dueToday && facts.daysToDue !== null && facts.daysToDue <= 3 && <Badge tone="orange">締切{facts.daysToDue}日</Badge>}
            {task.priority && <Badge tone="red">最優先</Badge>}
            {facts.startingToday && <Badge tone="blue">今日から着手</Badge>}
            {sub.total > 0 && <Badge tone="gray">{sub.done}/{sub.total}</Badge>}
          </div>
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-2 pl-1 space-y-1" onClick={(e) => e.stopPropagation()}>
              {task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button onClick={() => onToggleSubtask(task, s.id)} className={`w-3.5 h-3.5 rounded border-[1.5px] flex-shrink-0 ${s.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                    {s.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg>}
                  </button>
                  <span className={`text-[12px] ${s.done ? "line-through text-gray-400" : "text-gray-700"}`}>{s.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function TodayView({ tasks, cats, onComplete, onEdit, onToggleSubtask }: TodayViewProps) {
  const today = useMemo(() => new Date(), []);
  const list = useMemo(() => {
    const active = tasks.filter((t) => !t.completed && isActiveOn(t, today));
    const shown = active.filter((t) => isOverdue(t, today) || isDueToday(t, today) || t.priority || (t.startDate && isActiveOn(t, today)) || !t.startDate);
    return shown.sort((a, b) => {
      const ao = isOverdue(a, today);
      const bo = isOverdue(b, today);
      if (ao !== bo) return ao ? -1 : 1;
      const ap = a.priority ? 0 : 1;
      const bp = b.priority ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [tasks, today]);

  if (list.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState title="今日のタスクなし" description="締切が近づくと、ここに自動で現れます。" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {list.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          cats={cats}
          today={today}
          onComplete={onComplete}
          onEdit={onEdit}
          onToggleSubtask={onToggleSubtask}
        />
      ))}
    </div>
  );
}
