import { Category, TimetableConfig } from "./types";

export const DAY = ["日", "月", "火", "水", "木", "金", "土"];
export const WEEKDAY_LABELS = ["", "月", "火", "水", "木", "金"] as const;

export const PALETTE = [
  "#DC2626", "#CD2B31", "#D4440C", "#F97316", "#E5A500",
  "#CA8A04", "#65A30D", "#16A34A", "#30A46C", "#0D9488",
  "#0EA5E9", "#2563EB", "#3E63DD", "#5B5BD6", "#6D28D9",
  "#8E4EC6", "#9333EA", "#E879A2", "#889096", "#475569",
];

export const RECUR = [
  { id: "none", label: "なし" },
    { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
] as const;

export const FILTERS = [
  { id: "today", label: "今日", days: 0 },
  { id: "week", label: "1週間", days: 7 },
  { id: "2week", label: "2週間", days: 14 },
  { id: "month", label: "1ヶ月", days: 30 },
  { id: "all", label: "全体", days: Infinity },
] as const;

export const REMINDERS = [
  { id: "none", label: "なし" },
  { id: "30min", label: "30分前" },
  { id: "1hour", label: "1時間前" },
  { id: "3hour", label: "3時間前" },
  { id: "1day", label: "1日前" },
  { id: "3day", label: "3日前" },
] as const;

export const DEFAULT_CATS: Category[] = [
  { id: "default", label: "未分類", color: "#889096" },
];

export const PERIODS = ["1・2限", "3・4限", "5・6限"] as const;

export const DEFAULT_TIMETABLE_CONFIG: TimetableConfig = {
  maxPeriod: 6,
  showOnDemand: true,
  onDemandSlotsByDay: [0, 0, 0, 0, 0],
};

export const MEMBER_COLORS = [
  "#5B5BD6", "#CD2B31", "#30A46C", "#E5A500", "#8E4EC6",
  "#3E63DD", "#0EA5E9", "#D4440C", "#65A30D", "#E879A2",
];
