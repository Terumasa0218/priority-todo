import { Task } from "./types";

export const DAILY_LOAD_BUDGET = 100;

const MS_DAY = 86_400_000;

export type TaskType = NonNullable<Task["taskType"]>;

export interface DayOverrides {
  date: string; // YYYY-MM-DD
  skipped: string[];
  pinned: string[];
}

export interface ScoredTask {
  task: Task;
  remainingMinutes: number;
  remainingDays: number;
  todayRequiredMinutes: number;
  unstartedDays: number;
  progressRate: number;
  baseLoad: number;
  effectiveLoad: number;
  weightedLoad: number;
  urgencyScore: number;
  priorityScore: number;
  reasons: string[];
}

export interface TodayPlan {
  date: string;
  budget: number;
  totalLoad: number;
  dueToday: ScoredTask[];
  goals: ScoredTask[];
  alternatives: ScoredTask[];
}

export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

const diffDays = (from: Date, to: Date): number => {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_DAY);
};

export const pickTaskTypeDefault = (dueAt: string | Date, today: Date = new Date()): TaskType => {
  const due = new Date(dueAt);
  const days = diffDays(today, due);
  if (days <= 1) return "single";
  if (days <= 6) return "mid";
  return "long";
};

const defaultEstimate = (taskType: TaskType): number => {
  switch (taskType) {
    case "single": return 30;
    case "mid": return 120;
    case "long": return 300;
    case "daily": return 20;
  }
};

export const resolveTaskType = (task: Task): TaskType => {
  if (task.recurrence === "daily") return "daily";
  return task.taskType || "single";
};

export const resolveEstimatedMinutes = (task: Task): number => {
  const v = task.estimatedMinutes;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return defaultEstimate(resolveTaskType(task));
};

export const calcProgressRate = (task: Task): number => {
  if (task.completed) return 1;
  const est = resolveEstimatedMinutes(task);
  const logged = Math.max(0, task.loggedMinutes || 0);
  if (est <= 0) return 0;
  return Math.max(0, Math.min(1, logged / est));
};

export const calcRemainingMinutes = (task: Task): number => {
  const est = resolveEstimatedMinutes(task);
  const logged = Math.max(0, task.loggedMinutes || 0);
  return Math.max(0, est - logged);
};

export const calcRemainingDays = (task: Task, today: Date = new Date()): number => {
  if (!task.deadline) return Infinity;
  const due = new Date(task.deadline);
  const d = diffDays(today, due);
  return Math.max(1, d); // spec §9.1 max(..., 1)
};

const rawDaysToDue = (task: Task, today: Date = new Date()): number => {
  if (!task.deadline) return Infinity;
  return diffDays(today, new Date(task.deadline));
};

export const calcTodayRequiredMinutes = (task: Task, today: Date = new Date()): number => {
  const rem = calcRemainingMinutes(task);
  if (rem <= 0) return 0;
  const days = calcRemainingDays(task, today);
  if (!Number.isFinite(days)) return 0;
  return Math.ceil(rem / days);
};

export const calcUnstartedDays = (task: Task, today: Date = new Date()): number => {
  const base = task.lastWorkedAt || task.createdAt;
  if (!base) return 0;
  return Math.max(0, diffDays(new Date(base), today));
};

const BASE_LOAD: Record<TaskType, number> = {
  single: 10,
  mid: 30,
  long: 50,
  daily: 20,
};

export const calcBaseLoad = (task: Task): number => BASE_LOAD[resolveTaskType(task)];

export const calcEffectiveLoad = (task: Task): number => {
  const base = calcBaseLoad(task);
  const progress = calcProgressRate(task);
  return Math.ceil(base * (1 - progress));
};

const isDoneTodayDaily = (task: Task, today: Date): boolean => {
  if (resolveTaskType(task) !== "daily") return false;
  const last = task.lastWorkedAt ? new Date(task.lastWorkedAt) : null;
  if (!last) return false;
  return diffDays(last, today) === 0;
};

export const calcWeightedLoad = (task: Task, today: Date = new Date()): number => {
  let load = calcEffectiveLoad(task);
  const days = rawDaysToDue(task, today);
  const progress = calcProgressRate(task);
  const type = resolveTaskType(task);
  const importance = task.importance ?? (task.priority ? 3 : 2);
  const unstarted = calcUnstartedDays(task, today);
  const est = resolveEstimatedMinutes(task);
  const remMin = calcRemainingMinutes(task);

  if (days <= 3) load += 10;
  if (unstarted >= 2) load += 10;
  if (importance === 3) load += 10;
  if (type === "daily" && !isDoneTodayDaily(task, today)) load += 10;

  if (progress >= 0.8) load -= 20;
  else if (progress >= 0.5) load -= 10;

  if (type === "single" && est <= 30 && remMin <= 30 && days <= 0) load -= 5;

  return Math.max(5, Math.min(100, load));
};

export const calcUrgencyScore = (task: Task, today: Date = new Date()): number => {
  const days = rawDaysToDue(task, today);
  let score: number;
  if (!Number.isFinite(days)) score = 0;
  else if (days < 0) score = 100; // overdue - will add +30 below
  else if (days === 0) score = 100;
  else if (days === 1) score = 80;
  else if (days <= 3) score = 60;
  else if (days <= 7) score = 35;
  else score = 10;

  const todayReq = calcTodayRequiredMinutes(task, today);
  const unstarted = calcUnstartedDays(task, today);
  if (todayReq > 0 && unstarted > 0) score += 10;
  if (Number.isFinite(days) && days < 0) score += 30;
  const importance = task.importance ?? (task.priority ? 3 : 2);
  if (importance === 3) score += 10;
  return score;
};

export const calcPriorityScore = (task: Task, today: Date = new Date()): number => {
  const urgency = calcUrgencyScore(task, today);
  const importance = task.importance ?? (task.priority ? 3 : 2);
  const importanceBonus = importance === 3 ? 10 : importance === 2 ? 5 : 0;
  const stagnation = Math.min(calcUnstartedDays(task, today) * 3, 15);
  const pace = calcTodayRequiredMinutes(task, today) > 0 ? 15 : 0;
  return urgency + importanceBonus + stagnation + pace;
};

const describeReasons = (task: Task, today: Date): string[] => {
  const reasons: string[] = [];
  const days = rawDaysToDue(task, today);
  const todayReq = calcTodayRequiredMinutes(task, today);
  const progress = calcProgressRate(task);
  const unstarted = calcUnstartedDays(task, today);
  const importance = task.importance ?? (task.priority ? 3 : 2);
  const type = resolveTaskType(task);

  if (Number.isFinite(days)) {
    if (days < 0) reasons.push("期限超過");
    else if (days === 0) reasons.push("今日締切");
    else if (days === 1) reasons.push("明日締切");
    else if (days <= 3) reasons.push(`締切${days}日`);
  }
  if (todayReq > 0) reasons.push(`今日${todayReq}分`);
  if (progress > 0 && progress < 1) reasons.push(`進捗${Math.round(progress * 100)}%`);
  if (unstarted >= 2) reasons.push(`未着手${unstarted}日`);
  if (importance === 3) reasons.push("重要度高");
  if (type === "daily" && !isDoneTodayDaily(task, today)) reasons.push("毎日");
  return reasons;
};

export const scoreTask = (task: Task, today: Date = new Date()): ScoredTask => ({
  task,
  remainingMinutes: calcRemainingMinutes(task),
  remainingDays: calcRemainingDays(task, today),
  todayRequiredMinutes: calcTodayRequiredMinutes(task, today),
  unstartedDays: calcUnstartedDays(task, today),
  progressRate: calcProgressRate(task),
  baseLoad: calcBaseLoad(task),
  effectiveLoad: calcEffectiveLoad(task),
  weightedLoad: calcWeightedLoad(task, today),
  urgencyScore: calcUrgencyScore(task, today),
  priorityScore: calcPriorityScore(task, today),
  reasons: describeReasons(task, today),
});

const isDueToday = (task: Task, today: Date): boolean => {
  if (!task.deadline) return false;
  return diffDays(today, new Date(task.deadline)) === 0;
};

const isCandidate = (task: Task, today: Date): boolean => {
  const type = resolveTaskType(task);
  const days = rawDaysToDue(task, today);
  const unstarted = calcUnstartedDays(task, today);
  const importance = task.importance ?? (task.priority ? 3 : 2);
  const todayReq = calcTodayRequiredMinutes(task, today);
  if (type === "daily") return !isDoneTodayDaily(task, today);
  if (!task.deadline) {
    // §17: 締切未設定は 重要度3 かつ 未着手日数 3日以上 のみ候補化
    return importance === 3 && unstarted >= 3;
  }
  if (todayReq > 0) return true;
  if (Number.isFinite(days) && days <= 3) return true;
  if (unstarted >= 2) return true;
  if (importance === 3) return true;
  return false;
};

const isAlternative = (scored: ScoredTask): boolean => {
  const t = scored.task;
  if (t.completed) return false;
  const days = rawDaysToDue(t);
  const est = resolveEstimatedMinutes(t);
  if (scored.weightedLoad > 20) return false;
  const nearDeadline = Number.isFinite(days) && days <= 7;
  const lightEstimate = est <= 30;
  return nearDeadline || lightEstimate;
};

export const buildTodayPlan = (
  tasks: Task[],
  today: Date = new Date(),
  overrides?: DayOverrides,
  budget: number = DAILY_LOAD_BUDGET
): TodayPlan => {
  const dateKey = toDateKey(today);
  const validOverrides = overrides && overrides.date === dateKey ? overrides : { date: dateKey, skipped: [], pinned: [] };
  const skipped = new Set(validOverrides.skipped);
  const pinned = new Set(validOverrides.pinned);

  const active = tasks.filter((t) => !t.completed);

  const dueToday = active
    .filter((t) => isDueToday(t, today))
    .map((t) => scoreTask(t, today))
    .sort((a, b) => {
      if (b.weightedLoad !== a.weightedLoad) return b.weightedLoad - a.weightedLoad;
      return new Date(a.task.deadline).getTime() - new Date(b.task.deadline).getTime();
    });
  const dueIds = new Set(dueToday.map((s) => s.task.id));

  const pool = active
    .filter((t) => !dueIds.has(t.id))
    .filter((t) => pinned.has(t.id) || (!skipped.has(t.id) && isCandidate(t, today)))
    .map((t) => scoreTask(t, today))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const goals: ScoredTask[] = [];
  const leftovers: ScoredTask[] = [];
  let remainingBudget = budget - dueToday.reduce((sum, s) => sum + s.weightedLoad, 0);
  let overflowUsed = false;

  // pinned first
  pool.filter((s) => pinned.has(s.task.id)).forEach((s) => {
    goals.push(s);
    remainingBudget -= s.weightedLoad;
  });
  pool
    .filter((s) => !pinned.has(s.task.id))
    .forEach((s) => {
      if (s.weightedLoad <= remainingBudget) {
        goals.push(s);
        remainingBudget -= s.weightedLoad;
      } else if (!overflowUsed && s.urgencyScore >= 80) {
        goals.push(s);
        remainingBudget -= s.weightedLoad;
        overflowUsed = true;
      } else {
        leftovers.push(s);
      }
    });

  const goalIds = new Set(goals.map((s) => s.task.id));
  const alternatives = active
    .filter((t) => !dueIds.has(t.id) && !goalIds.has(t.id) && !skipped.has(t.id))
    .map((t) => scoreTask(t, today))
    .concat(leftovers.filter((s) => !goalIds.has(s.task.id)))
    .filter(isAlternative)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8);

  const totalLoad = [...dueToday, ...goals].reduce((sum, s) => sum + s.weightedLoad, 0);

  return {
    date: dateKey,
    budget,
    totalLoad,
    dueToday,
    goals,
    alternatives,
  };
};

export const buildUpcoming = (
  tasks: Task[],
  today: Date,
  windowDays: number
): ScoredTask[] => {
  const end = new Date(today);
  end.setDate(end.getDate() + windowDays);
  return tasks
    .filter((t) => !t.completed && t.deadline)
    .filter((t) => {
      const due = new Date(t.deadline);
      return due >= startOfDay(today) && due <= end;
    })
    .map((t) => scoreTask(t, today))
    .sort((a, b) => {
      const da = new Date(a.task.deadline).getTime();
      const db = new Date(b.task.deadline).getTime();
      if (da !== db) return da - db;
      return b.priorityScore - a.priorityScore;
    });
};

export const ensureDayOverrides = (
  overrides: DayOverrides | null | undefined,
  today: Date = new Date()
): DayOverrides => {
  const dateKey = toDateKey(today);
  if (!overrides || overrides.date !== dateKey) {
    return { date: dateKey, skipped: [], pinned: [] };
  }
  return {
    date: overrides.date,
    skipped: Array.isArray(overrides.skipped) ? overrides.skipped : [],
    pinned: Array.isArray(overrides.pinned) ? overrides.pinned : [],
  };
};
