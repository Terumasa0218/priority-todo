import { Category } from "./types";

export const DAY = ["日", "月", "火", "水", "木", "金", "土"];

export const PALETTE = [
  "#CD2B31", "#D4440C", "#E5A500", "#30A46C", "#5B5BD6",
  "#8E4EC6", "#3E63DD", "#0EA5E9", "#889096", "#E879A2",
  "#F97316", "#65A30D", "#0D9488", "#6D28D9", "#475569",
  "#DC2626", "#2563EB", "#16A34A", "#CA8A04", "#9333EA",
];

export const RECUR = [
  { id: "none", label: "なし" },
  { id: "daily", label: "毎日" },
  { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
] as const;

export const FILTERS = [
  { id: "today", label: "今日", days: 0 },
  { id: "week", label: "1週間", days: 7 },
  { id: "2week", label: "2週間", days: 14 },
  { id: "month", label: "1ヶ月", days: 30 },
  { id: "all", label: "すべて", days: Infinity },
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

export const PERIODS = ["1限", "2限", "3限", "4限", "5限", "6限"] as const;

export const MEMBER_COLORS = [
  "#5B5BD6", "#CD2B31", "#30A46C", "#E5A500", "#8E4EC6",
  "#3E63DD", "#0EA5E9", "#D4440C", "#65A30D", "#E879A2",
];
