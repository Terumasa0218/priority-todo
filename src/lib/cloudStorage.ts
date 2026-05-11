import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AppSettings, Category, Task, TimetableConfig, TimetableItem } from "./types";
import { DEFAULT_APP_SETTINGS, DEFAULT_CATS, DEFAULT_TIMETABLE_CONFIG } from "./constants";
import { db } from "./firebase";
import {
  loadCategories,
  loadTasks,
  loadTimetable,
  loadTimetableConfig,
  loadAppSettings,
} from "./storage";

export interface AppSnapshot {
  tasks: Task[];
  cats: Category[];
  timetable: TimetableItem[];
  timetableConfig: TimetableConfig;
  settings: AppSettings;
}

const MIGRATION_PREFIX = "prioritodo_v6_migrated_";

const emptySnapshot: AppSnapshot = {
  tasks: [],
  cats: DEFAULT_CATS,
  timetable: [],
  timetableConfig: DEFAULT_TIMETABLE_CONFIG,
  settings: DEFAULT_APP_SETTINGS,
};

const userDoc = (uid: string) => {
  if (!db) return null;
  return doc(db, "users", uid, "private", "app_state");
};

const normalizeSnapshot = (raw: Partial<AppSnapshot> | null | undefined): AppSnapshot => ({
  tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
  cats: Array.isArray(raw?.cats) && raw.cats.length > 0 ? raw.cats : DEFAULT_CATS,
  timetable: Array.isArray(raw?.timetable) ? raw.timetable : [],
  timetableConfig: raw?.timetableConfig || DEFAULT_TIMETABLE_CONFIG,
  settings: {
    skipHolidayClasses: typeof raw?.settings?.skipHolidayClasses === "boolean"
      ? raw.settings.skipHolidayClasses
      : DEFAULT_APP_SETTINGS.skipHolidayClasses,
  },
});

export const loadCloudSnapshot = async (uid: string): Promise<AppSnapshot> => {
  const ref = userDoc(uid);
  if (!ref) return emptySnapshot;
  const snap = await getDoc(ref);
  if (!snap.exists()) return emptySnapshot;
  return normalizeSnapshot(snap.data() as Partial<AppSnapshot>);
};

export const saveCloudSnapshot = async (uid: string, payload: AppSnapshot): Promise<void> => {
  const ref = userDoc(uid);
  if (!ref) return;
  const body: Record<string, unknown> = { ...payload, updatedAt: serverTimestamp() };
  await setDoc(ref, body, { merge: true });
};

export const deleteCloudSnapshot = async (uid: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "private", "app_state"));
  await deleteDoc(doc(db, "users", uid));
};

const localSnapshot = (): AppSnapshot =>
  normalizeSnapshot({
    tasks: loadTasks(),
    cats: loadCategories(),
    timetable: loadTimetable(),
    timetableConfig: loadTimetableConfig(),
    settings: loadAppSettings(),
  });

const hasLocalData = (snapshot: AppSnapshot) =>
  snapshot.tasks.length > 0 ||
  snapshot.timetable.length > 0 ||
  snapshot.cats.length > 1;

export const migrateLocalToCloudOnce = async (uid: string): Promise<boolean> => {
  const migrationKey = `${MIGRATION_PREFIX}${uid}`;
  if (localStorage.getItem(migrationKey) === "1") return false;
  const cloud = await loadCloudSnapshot(uid);
  if (cloud.tasks.length > 0 || cloud.timetable.length > 0) {
    localStorage.setItem(migrationKey, "1");
    return false;
  }
  const local = localSnapshot();
  if (!hasLocalData(local)) {
    localStorage.setItem(migrationKey, "1");
    return false;
  }
  await saveCloudSnapshot(uid, local);
  localStorage.setItem(migrationKey, "1");
  return true;
};
