export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO
  category: string; // カテゴリID
  priority: boolean;
  taskType?: "single" | "mid" | "long" | "daily";
  estimatedMinutes?: number;
  loggedMinutes?: number;
  importance?: 1 | 2 | 3;
  lastWorkedAt?: string | null;
  recurrence: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  classDayOfWeek?: number; // 0-6
  offsetDays?: number;
  offsetTime?: string;
  biweeklyInterval?: number;
  repeatCount: number | null;
  repeatEndDate: string | null;
  reminder: string;
  memo: string;
  url: string;
  completed: boolean;
  completedAt: string | null;
  completedOccurrences: string[];
  order: number | null;
  createdAt: string;
  // 展開時に付与
  parentId?: string;
  isOccurrence?: boolean;
  isGroupTask?: boolean;
  groupName?: string;
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

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  tasks: GroupTask[];
  createdAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  isMe: boolean;
}

export interface GroupTask {
  id: string;
  title: string;
  deadline: string;
  assignee: string | null;
  completed: boolean;
  createdAt: string;
}

export interface TouchDragState {
  active: boolean;
  dragIdx: number | null;
  start: (idx: number, y: number) => void;
}
