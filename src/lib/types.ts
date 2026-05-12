export interface Task {
  id: string;
  title: string;
  // "todo" = やること（締切ベース、完了チェックあり、優先順位ソート対象）
  // "event" = 予定（バイト・面接など。完了チェックなし、時刻幅で表示）
  kind?: "todo" | "event"; // 未指定なら "todo"
  deadline: string; // ISO（todo: 締切、event: 開始時刻）
  endTime?: string;  // ISO。event のときだけ意味を持つ（終了時刻）
  category: string; // カテゴリID
  priority: boolean; // 最優先（リスト先頭固定）
  // タスク開始日。今日リストに出し始める日（ISO）。未指定なら即時表示。
  // 「日付指定」モード時のみ使う。プリセット選択時は startOffsetDays を使う。
  startDate?: string | null;
  // 締切から N 日前を表示開始とする規則。繰り返しタスクでは各 occurrence の
  // 締切から再計算される。
  startOffsetDays?: number | null;
  recurrence: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  classDayOfWeek?: number; // 0-6
  // 授業の初回授業日 (ISO yyyy-mm-dd)。時間割カテゴリの繰り返し展開で使う。
  // 未指定なら deadline + classDayOfWeek から最初の授業日を推定（後方互換）。
  classStartDate?: string;
  offsetDays?: number;
  offsetTime?: string;
  biweeklyInterval?: number;
  repeatCount: number | null;
  repeatEndDate: string | null;
  reminder: string;
  memo: string;
  url: string;
  // Moodle ICS 取り込み由来の課題を重複判定・更新検知するためのメタ情報。
  moodleUid?: string;
  moodleLastModified?: string | null;
  moodleCategoryCode?: string;
  moodleSourceHash?: string;
  completed: boolean;
  completedAt: string | null;
  completedOccurrences: string[];
  // 先延ばしされた occurrence。key = occurrence の deadline ISO の slice(0, 16)、
  // value = "YYYY-MM-DD"（その日まで「今日のタスク」に出さない）
  snoozedOccurrences?: Record<string, string>;
  order: number | null;
  createdAt: string;
  // 展開時に付与
  parentId?: string;
  isOccurrence?: boolean;
}

export interface Category {
  id: string;
  label: string;
  color: string;
  timetableId?: string; // 時間割との紐づけ
}

export interface TimetableItem {
  id: string;
  name: string;
  day: number; // 1=月, 2=火, ..., 5=金
  period: string; // "1・2限" 等、または "オンデマンドN"
  teacher: string;
  room: string;
  // Moodle連携を使う授業では、CATEGORIES の下4桁を時間割番号として保存する。
  moodleEnabled?: boolean;
  timetableCode?: string;
  attendancePresent?: number;
  attendanceAbsent?: number;
  attendanceLate?: number;
  absenceLimit?: number;
  memo?: string;
  color: string;
}

export interface TimetableConfig {
  maxPeriod: number; // 6, 8, 10 ...
  showOnDemand: boolean;
  onDemandSlotsByDay: number[]; // 月〜金のオンデマンド枠数
}

export interface AppSettings {
  // 授業繰り返しタスクで、授業日が祝日の回を休講扱いとして飛ばすか。
  skipHolidayClasses: boolean;
}

export interface TouchDragState {
  active: boolean;
  dragIdx: number | null;
  start: (idx: number, y: number) => void;
}
