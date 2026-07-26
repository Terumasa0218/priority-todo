"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Task, Category } from "@/lib/types";
import { isActiveOn, isOverdue, isDueToday, taskFacts } from "@/lib/scoring";
import { fmt, remaining, taskDisplayTitle } from "@/lib/utils";
import { DAY } from "@/lib/constants";
import { IconCheck, IconFlag, IconRepeat } from "./Icons";
import EmptyState from "./ui/EmptyState";
import DatePickerField from "./DatePickerField";
import StatusPill from "./ui/StatusPill";

interface TodayViewProps {
  tasks: Task[];
  cats: Category[];
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onSnooze: (task: Task, snoozeUntilYMD: string) => void;
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const recurrenceText = (task: Task) => {
  if (!task.recurrence || task.recurrence === "none") return "";
  if (task.recurrence === "daily") return "毎日";
  if (task.recurrence === "weekly") return typeof task.classDayOfWeek === "number" ? `毎週${DAY[task.classDayOfWeek]}` : "毎週";
  if (task.recurrence === "biweekly") return typeof task.classDayOfWeek === "number" ? `隔週${DAY[task.classDayOfWeek]}` : "隔週";
  if (task.recurrence === "monthly") return "毎月";
  return "";
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 pt-4 pb-1.5">
    <span className="text-[10px] font-bold text-slate-400 tracking-[0.18em] uppercase">{children}</span>
  </div>
);

const EventCard = ({
  task,
  cats,
  onEdit,
}: {
  task: Task;
  cats: Category[];
  onEdit: (task: Task) => void;
}) => {
  const cat = cats.find((c) => c.id === task.category) || { label: "未分類", color: "#889096" };
  const start = fmtTime(task.deadline);
  const end = task.endTime ? fmtTime(task.endTime) : null;

  return (
    <div className="surface-card task-card px-4 py-3 cursor-pointer" onClick={() => onEdit(task)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-1 self-stretch rounded-full" style={{ backgroundColor: cat.color, minHeight: "32px" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 truncate">{task.title}</span>
            <StatusPill tone="blue">予定</StatusPill>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-500">{cat.label}</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-700 tabular-nums">{start}{end ? `–${end}` : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaskCard = ({
  task,
  cats,
  onComplete,
  onEdit,
  onLongPress,
  today,
}: {
  task: Task;
  cats: Category[];
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onLongPress: (task: Task) => void;
  today: Date;
}) => {
  const cat = cats.find((c) => c.id === task.category) || { label: "未分類", color: "#889096" };
  const facts = taskFacts(task, today);
  const rem = remaining(task.deadline);
  const displayTitle = taskDisplayTitle(task);
  const recurrence = recurrenceText(task);
  const visibleReason = facts.overdue
    ? "期限を過ぎています"
    : facts.dueToday
      ? "今日が締切"
      : "";

  const accent = facts.overdue
    ? "border-l-[4px] border-rose-400"
    : task.priority
      ? "border-l-[4px] border-amber-300"
      : "border-l-[4px] border-transparent";

  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startLong = useCallback(() => {
    longFired.current = false;
    if (longTimer.current) clearTimeout(longTimer.current);
    longTimer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress(task);
    }, 500);
  }, [onLongPress, task]);
  const cancelLong = useCallback(() => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  }, []);
  const handleClick = (e: React.MouseEvent) => {
    if (longFired.current) {
      e.preventDefault();
      e.stopPropagation();
      longFired.current = false;
      return;
    }
    onEdit(task);
  };

  return (
    <div className={`surface-card task-card ${accent} px-4 py-4`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task)}
          aria-label="完了"
          className="task-complete-button mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-0 hover:bg-green-50"
        >
          <IconCheck size={15} stroke="#94A3B8" sw={2.4} />
        </button>
        <div
          className="relative flex-1 min-w-0 cursor-pointer select-none"
          onClick={handleClick}
          onTouchStart={startLong}
          onTouchEnd={cancelLong}
          onTouchMove={cancelLong}
          onTouchCancel={cancelLong}
          onMouseDown={startLong}
          onMouseUp={cancelLong}
          onMouseLeave={cancelLong}
          onContextMenu={(e) => {
            e.preventDefault();
            longFired.current = true;
            onLongPress(task);
          }}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {task.priority && <IconFlag filled size={13} />}
                <span className={`block truncate text-[15px] font-bold leading-snug ${facts.overdue ? "text-rose-700" : "text-slate-950"}`}>{displayTitle}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="min-w-0 truncate text-xs font-medium text-slate-600">{cat.label}</span>
                <span className="text-xs text-slate-300">•</span>
                <span className="flex-shrink-0 text-xs text-slate-500">{fmt(task.deadline)}</span>
              </div>
            </div>
            {!facts.overdue && (
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700">
                あと{rem.t}
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {visibleReason && <StatusPill tone={facts.overdue ? "red" : "amber"}>{visibleReason}</StatusPill>}
            {task.priority && <StatusPill tone="amber">最優先</StatusPill>}
            {recurrence && (
              <StatusPill tone="gray">
                <IconRepeat size={10} stroke="currentColor" />
                {recurrence}
              </StatusPill>
            )}
            {task.moodleUid && <StatusPill tone="green">Moodle由来</StatusPill>}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SnoozeSheetProps {
  task: Task;
  today: Date;
  onClose: () => void;
  onSnooze: (snoozeUntilYMD: string) => void;
}

const SnoozeSheet = ({ task, today, onClose, onSnooze }: SnoozeSheetProps) => {
  const [pickCustom, setPickCustom] = useState(false);
  const [customDate, setCustomDate] = useState<string>("");

  const snoozeBy = (days: number) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    onSnooze(toYMD(d));
  };
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toYMD(tomorrow);
  // 締切以降は無意味なのでブロック
  const deadlineYMD = toYMD(new Date(task.deadline));

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-t-2xl shadow-xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-1 flex items-center justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-4 pb-2">
          <div className="text-sm font-semibold text-gray-900 truncate">{task.title}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">先延ばし（締切は変わりません）</div>
        </div>
        {!pickCustom ? (
          <div className="px-2 pb-2 space-y-1">
            <button onClick={() => snoozeBy(1)} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50">1日後から表示</button>
            <button onClick={() => snoozeBy(3)} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50">3日後から表示</button>
            <button onClick={() => snoozeBy(7)} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50">1週間後から表示</button>
            <button onClick={() => setPickCustom(true)} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50">日付指定…</button>
            <button onClick={onClose} className="w-full text-center px-4 py-3 text-sm rounded-lg text-gray-500 hover:bg-gray-50 mt-1 border-t border-gray-100">キャンセル</button>
          </div>
        ) : (
          <div className="px-4 pb-3 space-y-3">
            <DatePickerField
              value={customDate}
              onChange={setCustomDate}
              min={minDate}
              isDateDisabled={(d) => toYMD(d) >= deadlineYMD}
              placeholder="表示開始日を選択"
            />
            <div className="flex gap-2">
              <button onClick={() => setPickCustom(false)} className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-gray-100 text-gray-600">戻る</button>
              <button
                disabled={!customDate}
                onClick={() => customDate && onSnooze(customDate)}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-[#007AFF] text-white disabled:opacity-40"
              >
                先延ばす
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function TodayView({ tasks, cats, onComplete, onEdit, onSnooze }: TodayViewProps) {
  const today = useMemo(() => new Date(), []);
  const [snoozeTarget, setSnoozeTarget] = useState<Task | null>(null);

  const isClassRecurring = useCallback(
    (t: Task) => {
      if (!t.recurrence || t.recurrence === "none") return false;
      const cat = cats.find((c) => c.id === t.category);
      return !!cat?.timetableId;
    },
    [cats]
  );

  const { overdueList, priorityList, taskList } = useMemo(() => {
    const now = today.getTime();
    const notCompleted = tasks.filter((t) => !t.completed);

    // 期限超過は todo のみ。タスク開始日に関係なく全件出す。
    const overdue = notCompleted.filter((t) => t.kind !== "event" && isOverdue(t, today));

    // 期限超過以外: 開始日 (startOffsetDays/snooze 込み) で出るかを判定。
    // 予定 (event) は終了時刻が過ぎていない、かつ「今日」のものに限定。
    const nonOverdue = notCompleted.filter((t) => {
      if (isOverdue(t, today)) return false;
      if (t.kind === "event") {
        const endTs = t.endTime ? new Date(t.endTime).getTime() : new Date(t.deadline).getTime() + 3_600_000;
        if (endTs < now) return false;
        // 今日中に終わるか始まるイベントだけ
        return isDueToday(t, today) || (t.endTime && isDueToday({ ...t, deadline: t.endTime } as Task, today));
      }
      return isActiveOn(t, today);
    });

    // 授業繰り返しタスクはカテゴリごとに最短 1 件のみ。それ以外は全件残す。
    const classBuckets = new Map<string, Task>();
    const nonClass: Task[] = [];
    for (const t of nonOverdue) {
      if (isClassRecurring(t)) {
        const ex = classBuckets.get(t.category);
        if (!ex || new Date(t.deadline).getTime() < new Date(ex.deadline).getTime()) {
          classBuckets.set(t.category, t);
        }
      } else {
        nonClass.push(t);
      }
    }
    const filtered = [...nonClass, ...Array.from(classBuckets.values())];

    const byDeadline = (a: Task, b: Task) =>
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime();

    const isPriorityRow = (t: Task) => t.priority || isDueToday(t, today);
    const pri = filtered.filter(isPriorityRow).sort(byDeadline);
    const rest = filtered.filter((t) => !isPriorityRow(t)).sort(byDeadline);

    return {
      overdueList: overdue.sort(byDeadline),
      priorityList: pri,
      taskList: rest,
    };
  }, [tasks, today, isClassRecurring]);

  const totalCount = overdueList.length + priorityList.length + taskList.length;

  if (totalCount === 0) {
    return (
      <div className="px-4 py-10">
        <EmptyState title="今日の課題はありません" description="締切前の課題だけを見せるので、今は休んで大丈夫です。" />
      </div>
    );
  }

  const renderRow = (t: Task) =>
    t.kind === "event" ? (
      <EventCard key={t.id} task={t} cats={cats} onEdit={onEdit} />
    ) : (
      <TaskCard
        key={t.id}
        task={t}
        cats={cats}
        today={today}
        onComplete={onComplete}
        onEdit={onEdit}
        onLongPress={(task) => setSnoozeTarget(task)}
      />
    );

  return (
    <div className="pb-4">
      {overdueList.length > 0 && (
        <>
          <SectionLabel><span className="text-rose-500">期限超過</span></SectionLabel>
          <div className="px-4 space-y-2.5">{overdueList.map(renderRow)}</div>
        </>
      )}
      {priorityList.length > 0 && (
        <>
          <SectionLabel>優先タスク</SectionLabel>
          <div className="px-4 space-y-2.5">{priorityList.map(renderRow)}</div>
        </>
      )}
      {taskList.length > 0 && (
        <>
          {(overdueList.length > 0 || priorityList.length > 0) && <SectionLabel>タスク</SectionLabel>}
          <div className={`${overdueList.length > 0 || priorityList.length > 0 ? "px-4" : "px-4 py-4"} space-y-2.5`}>
            {taskList.map(renderRow)}
          </div>
        </>
      )}
      {snoozeTarget && (
        <SnoozeSheet
          task={snoozeTarget}
          today={today}
          onClose={() => setSnoozeTarget(null)}
          onSnooze={(ymd) => {
            onSnooze(snoozeTarget, ymd);
            setSnoozeTarget(null);
          }}
        />
      )}
    </div>
  );
}
