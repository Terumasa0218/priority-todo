import { Category, TimetableItem } from "./types";

export type MoodleImportKind = "assignment" | "quiz" | "survey" | "other";

export interface MoodleImportCandidate {
  uid: string;
  title: string;
  description: string;
  deadline: string;
  url: string;
  kind: MoodleImportKind;
  includeByDefault: boolean;
  timetableCode: string;
  categoryId: string | null;
  lastModified: string | null;
  sourceHash: string;
}

interface RawEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  lastModified: string;
  categories: string;
}

const ASSIGNMENT_WORDS = ["提出期限", "課題", "レポート", "ワークシート", "提出"];
const QUIZ_WORDS = ["小テスト", "受験可能期間の終了", "テスト", "quiz"];
const SURVEY_WORDS = ["アンケート終了", "レスポンス", "response"];
const SKIP_DEFAULT_WORDS = ["アンケート開始", "受験可能期間の開始", "欠席届"];

export const unfoldIcs = (ics: string): string =>
  ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");

const unescapeText = (value: string): string =>
  value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();

const getPropName = (line: string) => line.slice(0, Math.max(0, line.indexOf(":"))).split(";")[0].toUpperCase();
const getPropValue = (line: string) => {
  const idx = line.indexOf(":");
  return idx >= 0 ? line.slice(idx + 1) : "";
};

const parseEvents = (ics: string): RawEvent[] => {
  const text = unfoldIcs(ics);
  const events: RawEvent[] = [];
  let current: Partial<RawEvent> | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trimEnd();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current?.uid || current?.summary) {
        events.push({
          uid: current.uid || `${current.summary}-${current.dtstart}-${events.length}`,
          summary: current.summary || "Moodle課題",
          description: current.description || "",
          dtstart: current.dtstart || "",
          dtend: current.dtend || "",
          lastModified: current.lastModified || "",
          categories: current.categories || "",
        });
      }
      current = null;
      continue;
    }
    if (!current || !trimmed.includes(":")) continue;

    const prop = getPropName(trimmed);
    const value = unescapeText(getPropValue(trimmed));
    if (prop === "UID") current.uid = value;
    if (prop === "SUMMARY") current.summary = value;
    if (prop === "DESCRIPTION") current.description = value;
    if (prop === "DTSTART") current.dtstart = value;
    if (prop === "DTEND") current.dtend = value;
    if (prop === "LAST-MODIFIED") current.lastModified = value;
    if (prop === "CATEGORIES") current.categories = value;
  }

  return events;
};

const toIsoFromIcsDate = (value: string): string | null => {
  const raw = value.trim();
  const dateOnly = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T23:59:00`;
  }

  const dateTime = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!dateTime) return null;
  const [, y, mo, d, h, mi, s, z] = dateTime;
  if (h === "24") return `${y}-${mo}-${d}T23:59:00`;
  if (z) return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

const parseTextDates = (text: string, fallbackYear: number): string[] => {
  const dates: string[] = [];
  const normalized = text.replace(/[年月]/g, "/").replace(/日/g, " ");
  const re = /(?:(20\d{2})[/-])?(\d{1,2})[/-](\d{1,2})(?:\s*(\d{1,2})(?::(\d{2}))?)?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const year = Number(match[1] || fallbackYear);
    const month = Number(match[2]);
    const day = Number(match[3]);
    let hour = match[4] ? Number(match[4]) : 23;
    let minute = match[5] ? Number(match[5]) : 59;
    if (hour >= 24) {
      hour = 23;
      minute = 59;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  }
  return dates;
};

const earliest = (values: string[]): string | null => {
  const sorted = values
    .filter(Boolean)
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);
  return sorted[0]?.value || null;
};

export const extractTimetableCode = (categories: string): string => {
  const matches = categories.match(/\d{4}(?!\d)/g);
  if (matches?.length) return matches[matches.length - 1];
  const digits = categories.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
};

const extractUrl = (text: string): string => {
  const match = text.match(/https?:\/\/[^\s<>"]+/i);
  return match ? match[0].replace(/[),.。]+$/, "") : "";
};

const classify = (summary: string, description: string): { kind: MoodleImportKind; includeByDefault: boolean } => {
  const haystack = `${summary}\n${description}`.toLowerCase();
  const hasAny = (words: string[]) => words.some((word) => haystack.includes(word.toLowerCase()));
  if (hasAny(SKIP_DEFAULT_WORDS)) return { kind: "other", includeByDefault: false };
  if (hasAny(QUIZ_WORDS)) return { kind: "quiz", includeByDefault: true };
  if (hasAny(SURVEY_WORDS)) return { kind: "survey", includeByDefault: true };
  if (hasAny(ASSIGNMENT_WORDS)) return { kind: "assignment", includeByDefault: true };
  return { kind: "other", includeByDefault: false };
};

const sourceHash = (event: RawEvent) => {
  const source = [
    event.uid,
    event.summary,
    event.description,
    event.dtstart,
    event.dtend,
    event.lastModified,
    event.categories,
  ].join("|");
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33) ^ source.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

export const parseMoodleIcs = (ics: string, timetable: TimetableItem[], cats: Category[]): MoodleImportCandidate[] => {
  const codeToCategory = new Map<string, string>();
  for (const item of timetable) {
    const code = extractTimetableCode(item.timetableCode || "");
    if (!item.moodleEnabled || code.length !== 4) continue;
    const cat = cats.find((c) => c.timetableId === item.id);
    if (cat) codeToCategory.set(code, cat.id);
  }

  const deduped = new Map<string, MoodleImportCandidate>();
  for (const event of parseEvents(ics)) {
    const firstDate = toIsoFromIcsDate(event.dtstart) || toIsoFromIcsDate(event.dtend) || new Date().toISOString();
    const fallbackYear = new Date(firstDate).getFullYear();
    const deadline = earliest([
      toIsoFromIcsDate(event.dtstart),
      toIsoFromIcsDate(event.dtend),
      ...parseTextDates(`${event.summary}\n${event.description}`, fallbackYear),
    ].filter((value): value is string => !!value));
    if (!deadline) continue;

    const timetableCode = extractTimetableCode(event.categories);
    const classification = classify(event.summary, event.description);
    const candidate: MoodleImportCandidate = {
      uid: event.uid,
      title: event.summary.replace(/\s+/g, " ").trim() || "Moodle課題",
      description: event.description,
      deadline,
      url: extractUrl(event.description),
      kind: classification.kind,
      includeByDefault: classification.includeByDefault,
      timetableCode,
      categoryId: timetableCode ? codeToCategory.get(timetableCode) || null : null,
      lastModified: toIsoFromIcsDate(event.lastModified),
      sourceHash: sourceHash(event),
    };
    deduped.set(candidate.uid, candidate);
  }

  return [...deduped.values()].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
};
