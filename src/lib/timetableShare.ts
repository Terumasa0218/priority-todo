import { TimetableConfig, TimetableItem } from "./types";

export interface TimetablePresetPayload {
  timetable: TimetableItem[];
  timetableConfig: TimetableConfig;
}

const DEFAULT_CONFIG: TimetableConfig = {
  maxPeriod: 6,
  showOnDemand: true,
  onDemandSlotsByDay: [1, 1, 0, 0, 0],
};

const encodeBase64Url = (text: string) => {
  const utf8 = new TextEncoder().encode(text);
  let binary = "";
  utf8.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64Url = (encoded: string) => {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(`${base64}${padding}`);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const createTimetablePresetToken = (
  payload: TimetablePresetPayload
): string => encodeBase64Url(JSON.stringify(payload));

export const loadTimetablePresetFromToken = (
  token: string
): TimetablePresetPayload | null => {
  try {
    const parsed = JSON.parse(decodeBase64Url(token)) as Partial<TimetablePresetPayload>;
    const timetable = Array.isArray(parsed.timetable) ? parsed.timetable : [];
    const timetableConfig = parsed.timetableConfig || DEFAULT_CONFIG;
    return { timetable, timetableConfig };
  } catch {
    return null;
  }
};
