export interface MoodleCalendarUrlSettings {
  url: string;
  lastSyncedAt: string | null;
}

const STORAGE_KEY = "prioritodo_moodle_calendar_url";

const EMPTY_SETTINGS: MoodleCalendarUrlSettings = {
  url: "",
  lastSyncedAt: null,
};

// The calendar URL can contain a Moodle access token, so it stays on this device
// and is intentionally excluded from the Firestore application snapshot.
export const loadMoodleCalendarUrlSettings = (): MoodleCalendarUrlSettings => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return {
      url: typeof raw?.url === "string" ? raw.url : "",
      lastSyncedAt: typeof raw?.lastSyncedAt === "string" ? raw.lastSyncedAt : null,
    };
  } catch {
    return EMPTY_SETTINGS;
  }
};

export const saveMoodleCalendarUrlSettings = (settings: MoodleCalendarUrlSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
};

export const clearMoodleCalendarUrlSettings = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
};

export const normalizeMoodleCalendarUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("有効なMoodleカレンダーURLを入力してください");
  }
  if (url.protocol !== "https:") {
    throw new Error("MoodleカレンダーURLには https:// から始まるURLを入力してください");
  }
  return url.toString();
};

export const fetchMoodleCalendar = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Moodleカレンダーを取得できませんでした（HTTP ${response.status}）`);
    }

    const text = await response.text();
    if (!text.replace(/^\uFEFF/, "").includes("BEGIN:VCALENDAR")) {
      throw new Error("Moodleカレンダーとして読み取れない内容が返されました");
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Moodle")) throw error;
    throw new Error("URLから取得できませんでした。URLとネットワークを確認し、続く場合は .ics ファイル取り込みを使ってください");
  } finally {
    window.clearTimeout(timeout);
  }
};
