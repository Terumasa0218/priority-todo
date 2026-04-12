export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO
  category: string; // カテゴリID
  priority: boolean;
  recurrence: "none" | "daily" | "weekly" | "biweekly" | "monthly";
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
  day: number; // 1=月, 2=火, ..., 6=土
  period: number; // 1〜6
  teacher: string;
  room: string;
  color: string;
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
