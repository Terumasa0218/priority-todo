import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { TimetableConfig, TimetableItem } from "./types";
import { db } from "./firebase";

export interface TimetablePresetPayload {
  timetable: TimetableItem[];
  timetableConfig: TimetableConfig;
}

interface StoredTimetablePreset extends TimetablePresetPayload {
  creatorUid: string;
  createdAt: unknown;
}

const PRESET_COLLECTION = "timetable_presets";

export const createTimetablePreset = async (
  creatorUid: string,
  payload: TimetablePresetPayload
): Promise<string | null> => {
  if (!db) return null;
  const ref = await addDoc(collection(db, PRESET_COLLECTION), {
    creatorUid,
    timetable: payload.timetable,
    timetableConfig: payload.timetableConfig,
    createdAt: serverTimestamp(),
  } as StoredTimetablePreset);
  return ref.id;
};

export const loadTimetablePreset = async (
  presetId: string
): Promise<TimetablePresetPayload | null> => {
  if (!db) return null;
  const ref = doc(db, PRESET_COLLECTION, presetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<StoredTimetablePreset>;
  return {
    timetable: Array.isArray(data.timetable) ? data.timetable : [],
    timetableConfig: data.timetableConfig || { maxPeriod: 6, showOnDemand: true, onDemandSlotsByDay: [1, 1, 0, 0, 0] },
  };
};
