import { Task } from "./types";
import { getEffectiveStartDate } from "./utils";

const MS_DAY = 86_400_000;

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

export const diffDays = (from: Date, to: Date): number => {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_DAY);
};

// タスク開始日（startOffsetDays / startDate / snoozedOccurrences 由来）を考慮し、
// 今日「今日のタスク」に出してよいかどうか
export const isActiveOn = (task: Task, today: Date = new Date()): boolean => {
  const eff = getEffectiveStartDate(task);
  if (!eff) return true;
  return diffDays(today, new Date(eff)) <= 0;
};

export const isDueToday = (task: Task, today: Date = new Date()): boolean => {
  if (!task.deadline) return false;
  return diffDays(today, new Date(task.deadline)) === 0;
};

export const isOverdue = (task: Task, today: Date = new Date()): boolean => {
  if (!task.deadline) return false;
  return new Date(task.deadline).getTime() < today.getTime();
};

export interface TaskFacts {
  overdue: boolean;
  dueToday: boolean;
  daysToDue: number | null;
  started: boolean; // 開始日が past or unset
  startingToday: boolean;
}

export const taskFacts = (task: Task, today: Date = new Date()): TaskFacts => {
  const hasDeadline = !!task.deadline;
  const daysToDue = hasDeadline ? diffDays(today, new Date(task.deadline)) : null;
  const overdue = hasDeadline && new Date(task.deadline).getTime() < today.getTime();
  const dueToday = hasDeadline && !overdue && daysToDue === 0;
  const eff = getEffectiveStartDate(task);
  const started = !eff || diffDays(today, new Date(eff)) <= 0;
  const startingToday = !!eff && diffDays(today, new Date(eff)) === 0;
  return { overdue, dueToday, daysToDue, started, startingToday };
};
