import { Task } from "./types";

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

export const isActiveOn = (task: Task, today: Date = new Date()): boolean => {
  if (!task.startDate) return true;
  return diffDays(today, new Date(task.startDate)) <= 0;
};

export const isDueToday = (task: Task, today: Date = new Date()): boolean => {
  if (!task.deadline) return false;
  return diffDays(today, new Date(task.deadline)) === 0;
};

export const isOverdue = (task: Task, today: Date = new Date()): boolean => {
  if (!task.deadline) return false;
  return new Date(task.deadline).getTime() < startOfDay(today).getTime();
};

export interface TaskFacts {
  overdue: boolean;
  dueToday: boolean;
  daysToDue: number | null;
  started: boolean; // startDate が past or unset
  startingToday: boolean;
}

export const taskFacts = (task: Task, today: Date = new Date()): TaskFacts => {
  const hasDeadline = !!task.deadline;
  const daysToDue = hasDeadline ? diffDays(today, new Date(task.deadline)) : null;
  const overdue = hasDeadline && new Date(task.deadline).getTime() < startOfDay(today).getTime();
  const dueToday = hasDeadline && daysToDue === 0;
  const started = !task.startDate || diffDays(today, new Date(task.startDate)) <= 0;
  const startingToday = !!task.startDate && diffDays(today, new Date(task.startDate)) === 0;
  return { overdue, dueToday, daysToDue, started, startingToday };
};

export const subtaskProgress = (task: Task): { done: number; total: number } => {
  const subs = task.subtasks || [];
  const done = subs.filter((s) => s.done).length;
  return { done, total: subs.length };
};
