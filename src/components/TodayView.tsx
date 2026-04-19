"use client";
import React, { useMemo, useState } from "react";
import { Task, Category } from "@/lib/types";
import { DayOverrides, ScoredTask, buildTodayPlan, ensureDayOverrides } from "@/lib/scoring";
import { fmt, remaining, urgColor } from "@/lib/utils";
import { IconRepeat } from "./Icons";
import EmptyState from "./ui/EmptyState";

interface TodayViewProps {
  tasks: Task[];
  cats: Category[];
  overrides: DayOverrides | null;
  setOverrides: (next: DayOverrides) => void;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onLogProgress: (task: Task, deltaMinutes: number) => void;
}

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill={filled ? "#F5A524" : "none"} stroke={filled ? "#F5A524" : "#CBD5E1"} strokeWidth="2" strokeLinejoin="round">
    <polygon points="12,2 15,9 22,10 17,15 18,22 12,18.5 6,22 7,15 2,10 9,9" />
  </svg>
);

const TaskCard = ({
  scored,
  cats,
  variant,
  onComplete,
  onEdit,
  onLog,
  onSkip,
  onPromote,
}: {
  scored: ScoredTask;
  cats: Category[];
  variant: "due" | "goal" | "alt";
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onLog?: (task: Task, delta: number) => void;
  onSkip?: (task: Task) => void;
  onPromote?: (task: Task) => void;
}) => {
  const { task, reasons, todayRequiredMinutes } = scored;
  const rem = remaining(task.deadline);
  const uc = urgColor(rem.u);
  const cat = cats.find((c) => c.id === task.category) || { label: "未分類", color: "#889096" };
  const importance = task.importance ?? 2;
  const isOverdue = rem.u >= 4;

  const accent =
    variant === "due" ? "border-l-[3px] border-rose-500"
    : variant === "goal" ? "border-l-[3px] border-transparent"
    : "border-l-[3px] border-transparent";

  return (
    <div className={`surface-card ${accent} px-4 py-3 flex flex-col gap-2`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task)}
          aria-label="完了"
          className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex-shrink-0"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(task)}>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold truncate ${isOverdue ? "text-rose-700" : "text-slate-900"}`}>{task.title}</span>
            {task.recurrence && task.recurrence !== "none" && <IconRepeat size={11} stroke="#94A3B8" />}
            <span className="flex items-center gap-0.5 flex-shrink-0"><Star filled={importance >= 1} /><Star filled={importance >= 2} /><Star filled={importance >= 3} /></span>
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
          {variant !== "alt" && reasons.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reasons.slice(0, 4).map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{r}</span>
              ))}
            </div>
          )}
          {variant === "alt" && (
            <div className="mt-1 text-[11px] text-slate-500">
              {todayRequiredMinutes > 0 ? `今日${todayRequiredMinutes}分想定` : "すぐ終わる・締切近め"}
            </div>
          )}
        </div>
      </div>
      {variant !== "alt" && onLog && (
        <div className="flex items-center justify-between pl-8 gap-2">
          <div className="flex gap-1.5">
            <button onClick={() => onLog(task, 15)} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium hover:bg-slate-200">+15分</button>
            <button onClick={() => onLog(task, 30)} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium hover:bg-slate-200">+30分</button>
            <button onClick={() => onComplete(task)} className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100">✓ 完了</button>
          </div>
          {variant === "goal" && onSkip && (
            <button onClick={() => onSkip(task)} className="text-[11px] text-slate-400 hover:text-slate-600">今日は見送り</button>
          )}
        </div>
      )}
      {variant === "alt" && onPromote && (
        <div className="flex justify-end">
          <button onClick={() => onPromote(task)} className="px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 text-[11px] font-medium hover:bg-slate-50">今日やる</button>
        </div>
      )}
    </div>
  );
};

export default function TodayView({ tasks, cats, overrides, setOverrides, onComplete, onEdit, onLogProgress }: TodayViewProps) {
  const today = useMemo(() => new Date(), []);
  const plan = useMemo(() => buildTodayPlan(tasks, today, overrides || undefined), [tasks, today, overrides]);
  const [showAlts, setShowAlts] = useState(false);

  const ensure = (): DayOverrides => {
    const base = ensureDayOverrides(overrides, today);
    return { date: base.date, skipped: [...base.skipped], pinned: [...base.pinned] };
  };

  const handleSkip = (task: Task) => {
    const next = ensure();
    if (!next.skipped.includes(task.id)) next.skipped.push(task.id);
    next.pinned = next.pinned.filter((id) => id !== task.id);
    setOverrides(next);
  };

  const handlePromote = (task: Task) => {
    const next = ensure();
    if (!next.pinned.includes(task.id)) next.pinned.push(task.id);
    next.skipped = next.skipped.filter((id) => id !== task.id);
    setOverrides(next);
    setShowAlts(false);
  };

  const totalGoalMinutes = plan.goals.reduce((s, g) => s + (g.todayRequiredMinutes || g.remainingMinutes), 0);

  return (
    <div className="px-4 py-3 space-y-6">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-rose-600 tracking-widest">本日締切</h2>
          <span className="text-[11px] text-slate-400">{plan.dueToday.length}件</span>
        </div>
        {plan.dueToday.length === 0 ? (
          <div className="text-[12px] text-slate-400 px-1">今日の締切はありません。</div>
        ) : (
          <div className="space-y-2">
            {plan.dueToday.map((s) => (
              <TaskCard
                key={s.task.id}
                scored={s}
                cats={cats}
                variant="due"
                onComplete={onComplete}
                onEdit={onEdit}
                onLog={onLogProgress}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold text-slate-700 tracking-widest">今日の達成目標</h2>
          <span className="text-[11px] text-slate-400">
            {plan.goals.length}件{totalGoalMinutes > 0 ? ` ・ ${totalGoalMinutes}分` : ""}
          </span>
        </div>
        {plan.goals.length === 0 ? (
          <EmptyState title="今日の追加タスクなし" description="本日締切に集中できます。" />
        ) : (
          <div className="space-y-2">
            {plan.goals.map((s) => (
              <TaskCard
                key={s.task.id}
                scored={s}
                cats={cats}
                variant="goal"
                onComplete={onComplete}
                onEdit={onEdit}
                onLog={onLogProgress}
                onSkip={handleSkip}
              />
            ))}
          </div>
        )}
      </section>

      {plan.alternatives.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setShowAlts((v) => !v)}
            className="w-full flex items-baseline justify-between py-1"
          >
            <h2 className="text-xs font-semibold text-slate-500 tracking-widest">代替タスク</h2>
            <span className="text-[11px] text-slate-400">{plan.alternatives.length}件 {showAlts ? "閉じる" : "見る"}</span>
          </button>
          {showAlts && (
            <div className="space-y-2">
              {plan.alternatives.map((s) => (
                <TaskCard
                  key={s.task.id}
                  scored={s}
                  cats={cats}
                  variant="alt"
                  onComplete={onComplete}
                  onEdit={onEdit}
                  onPromote={handlePromote}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
