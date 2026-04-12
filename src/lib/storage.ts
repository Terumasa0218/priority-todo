import { Task, Category, Group, TimetableItem } from "./types";
import { DEFAULT_CATS } from "./constants";

const SK_T = "prioritodo_v6_tasks";
const SK_C = "prioritodo_v6_cats";
const SK_G = "prioritodo_v6_groups";
const SK_TT = "prioritodo_v6_timetable";

export const loadTasks = (): Task[] => {
  try {
    return JSON.parse(localStorage.getItem(SK_T) || "[]") || [];
  } catch {
    return [];
  }
};
export const saveTasks = (t: Task[]) => {
  try {
    localStorage.setItem(SK_T, JSON.stringify(t));
  } catch { /* ignore */ }
};

export const loadCategories = (): Category[] => {
  try {
    return JSON.parse(localStorage.getItem(SK_C) || "null") || DEFAULT_CATS;
  } catch {
    return DEFAULT_CATS;
  }
};
export const saveCategories = (c: Category[]) => {
  try {
    localStorage.setItem(SK_C, JSON.stringify(c));
  } catch { /* ignore */ }
};

export const loadGroups = (): Group[] => {
  try {
    return JSON.parse(localStorage.getItem(SK_G) || "[]") || [];
  } catch {
    return [];
  }
};
export const saveGroups = (g: Group[]) => {
  try {
    localStorage.setItem(SK_G, JSON.stringify(g));
  } catch { /* ignore */ }
};

export const loadTimetable = (): TimetableItem[] => {
  try {
    return JSON.parse(localStorage.getItem(SK_TT) || "[]") || [];
  } catch {
    return [];
  }
};
export const saveTimetable = (t: TimetableItem[]) => {
  try {
    localStorage.setItem(SK_TT, JSON.stringify(t));
  } catch { /* ignore */ }
};
