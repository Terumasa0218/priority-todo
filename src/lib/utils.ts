import { DAY } from "./constants";
import { Task } from "./types";

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export function fmt(d: string) {
  const o = new Date(d);
  return `${o.getMonth() + 1}/${o.getDate()} (${DAY[o.getDay()]}) ${String(o.getHours()).padStart(2, "0")}:${String(o.getMinutes()).padStart(2, "0")}`;
}

export function remaining(d: string) {
  const ms = new Date(d).getTime() - Date.now();
  if (ms < 0) return { t: "期限超過", u: 4 };
  const h = ms / 36e5;
  if (h < 1) return { t: `${Math.ceil(ms / 6e4)}分`, u: 3 };
  if (h < 24) return { t: `${Math.ceil(h)}時間`, u: 3 };
  const days = Math.ceil(h / 24);
  return { t: `${days}日`, u: days <= 3 ? 2 : days <= 7 ? 1 : 0 };
}

export function urgColor(u: number) {
  if (u >= 4) return { bg: "#FCECED", fg: "#CD2B31" };
  if (u >= 3) return { bg: "#FFF0EC", fg: "#D4440C" };
  if (u >= 2) return { bg: "#FFF3D0", fg: "#9E6C00" };
  if (u >= 1) return { bg: "#EDF6FF", fg: "#3E63DD" };
  return { bg: "#F0F0F3", fg: "#60646C" };
}

export function advanceDate(d: Date, r: string) {
  switch (r) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
  }
}

export function calcEndDate(deadline: string, recurrence: string, count: number) {
  const d = new Date(deadline);
  for (let i = 0; i < count - 1; i++) advanceDate(d, recurrence);
  return d;
}

export function calcCount(deadline: string, recurrence: string, endDate: Date) {
  const d = new Date(deadline);
  const end = new Date(endDate);
  let c = 1;
  while (d < end && c < 200) {
    advanceDate(d, recurrence);
    c++;
  }
  return c;
}

export function snapToWeekday(endDate: Date, deadline: string, recurrence: string) {
  if (recurrence !== "weekly" && recurrence !== "biweekly") return endDate;
  const target = new Date(deadline).getDay();
  const end = new Date(endDate);
  const ed = end.getDay();
  if (ed === target) return end;
  let diff = ed - target;
  if (diff < 0) diff += 7;
  end.setDate(end.getDate() - diff);
  return end;
}

const firstClassDay = (from: Date, dayOfWeek: number) => {
  const d = new Date(from);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
};

export const calcOccurrenceCount = (task: Task): number => {
  if (task.recurrence === "none") return 1;
  const end = task.repeatEndDate ? new Date(task.repeatEndDate) : new Date(task.deadline);
  if (task.recurrence === "monthly") {
    const cur = new Date(task.deadline);
    let count = 0;
    while (cur <= end && count < 240) {
      count += 1;
      cur.setMonth(cur.getMonth() + 1);
    }
    return count;
  }
  if (typeof task.classDayOfWeek !== "number") return Math.max(1, task.repeatCount || 1);
  const cur = firstClassDay(new Date(task.deadline), task.classDayOfWeek);
  let count = 0;
  while (cur <= end && count < 240) {
    count += 1;
    cur.setDate(cur.getDate() + (task.recurrence === "biweekly" ? 14 : 7));
  }
  return count;
};

export function expandRecurring(task: Task, horizonDate: Date): Task[] {
  if (!task.recurrence || task.recurrence === "none") return [task];
  const results: Task[] = [];
  const horizon = new Date(horizonDate);
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 1);
  const endDate = task.repeatEndDate ? new Date(task.repeatEndDate) : horizon;
  const effectiveEnd = endDate < horizon ? endDate : horizon;

  const pushOccurrence = (current: Date) => {
    if (current < lookback) return;
    const key = current.toISOString().slice(0, 16);
    if ((task.completedOccurrences || []).includes(key)) return;
    results.push({
      ...task,
      id: `${task.id}_${current.getTime()}`,
      parentId: task.id,
      deadline: current.toISOString(),
      isOccurrence: true,
    });
  };

  if ((task.recurrence === "weekly" || task.recurrence === "biweekly") && typeof task.classDayOfWeek === "number") {
    const base = new Date(task.deadline);
    const offsetDays = task.offsetDays ?? 0;
    const [hh, mm] = (task.offsetTime || "23:59").split(":").map(Number);
    const classDate = firstClassDay(base, task.classDayOfWeek);
    let count = 0;
    while (classDate <= effectiveEnd && count < 240) {
      const due = new Date(classDate);
      due.setDate(due.getDate() + offsetDays);
      due.setHours(hh || 0, mm || 0, 0, 0);
      if (due <= effectiveEnd) pushOccurrence(due);
      classDate.setDate(classDate.getDate() + (task.recurrence === "biweekly" ? 14 : 7));
      count += 1;
    }
    return results;
  }

  const current = new Date(task.deadline);
  let count = 0;
  while (current <= effectiveEnd && count < 200) {
    pushOccurrence(current);
    const next = new Date(current);
    advanceDate(next, task.recurrence);
    current.setTime(next.getTime());
    count++;
  }
  return results;
}
