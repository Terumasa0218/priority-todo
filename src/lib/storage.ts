import { AppSettings, Task, Category, TimetableItem, TimetableConfig } from "./types";
import { DEFAULT_APP_SETTINGS, DEFAULT_CATS, DEFAULT_TIMETABLE_CONFIG } from "./constants";

const SK_T = "prioritodo_v6_tasks";
const SK_C = "prioritodo_v6_cats";
const SK_TT = "prioritodo_v6_timetable";
const SK_TTC = "prioritodo_v6_timetable_config";
const SK_SETTINGS = "prioritodo_v6_app_settings";
const LEGACY_SKIP_HOLIDAY_CLASSES = "prioritodo_skip_holiday_classes";

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

export const loadTimetableConfig = (): TimetableConfig => {
  try {
    const raw = JSON.parse(localStorage.getItem(SK_TTC) || "null");
    const maxPeriod = Number(raw?.maxPeriod);
    const legacyOnDemandSlots = Number(raw?.onDemandSlots);
    const onDemandSlotsByDayRaw = Array.isArray(raw?.onDemandSlotsByDay) ? raw.onDemandSlotsByDay : null;
    const onDemandSlotsByDay = onDemandSlotsByDayRaw
      ? [1, 2, 3, 4, 5].map((day) => {
        const value = Number(onDemandSlotsByDayRaw[day - 1]);
        return Number.isFinite(value) && value >= 0 ? Math.min(5, Math.floor(value)) : 0;
      })
      : [1, 2, 3, 4, 5].map((day) => (Number.isFinite(legacyOnDemandSlots) && day <= legacyOnDemandSlots ? 1 : 0));

    return {
      maxPeriod: Number.isFinite(maxPeriod) ? Math.min(18, Math.max(2, Math.floor(maxPeriod / 2) * 2)) : DEFAULT_TIMETABLE_CONFIG.maxPeriod,
      showOnDemand: typeof raw?.showOnDemand === "boolean" ? raw.showOnDemand : DEFAULT_TIMETABLE_CONFIG.showOnDemand,
      onDemandSlotsByDay,
    };
  } catch {
    return DEFAULT_TIMETABLE_CONFIG;
  }
};

export const saveTimetableConfig = (config: TimetableConfig) => {
  try {
    localStorage.setItem(SK_TTC, JSON.stringify(config));
  } catch { /* ignore */ }
};


export const loadAppSettings = (): AppSettings => {
  try {
    const raw = JSON.parse(localStorage.getItem(SK_SETTINGS) || "null");
    if (typeof raw?.skipHolidayClasses === "boolean") {
      return { skipHolidayClasses: raw.skipHolidayClasses };
    }

    const legacy = localStorage.getItem(LEGACY_SKIP_HOLIDAY_CLASSES);
    if (legacy === "0" || legacy === "1") {
      return { skipHolidayClasses: legacy === "1" };
    }

    return DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(SK_SETTINGS, JSON.stringify(settings));
    localStorage.removeItem(LEGACY_SKIP_HOLIDAY_CLASSES);
  } catch { /* ignore */ }
};
