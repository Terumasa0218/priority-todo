import { TimetableItem } from "./types";

export interface SharedTimetable {
  version: 1;
  items: { name: string; day: number; period: string; teacher?: string; room?: string; color: string; }[];
}

export const createTimetableShareToken = (items: TimetableItem[]): string => {
  const payload: SharedTimetable = {
    version: 1,
    items: items
      .filter((it) => it.day >= 1 && it.day <= 5 && it.period >= 1 && it.period <= 6)
      .map((it) => ({ name: it.name, day: it.day, period: String(it.period), teacher: it.teacher || undefined, room: it.room || undefined, color: it.color })),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
};

export const loadTimetableShareToken = (token: string): SharedTimetable | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(token)))) as SharedTimetable;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
};
