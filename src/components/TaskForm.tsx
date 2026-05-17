"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Task, Category, TimetableItem } from "@/lib/types";
import { REMINDERS, DAY } from "@/lib/constants";
import { uid, calcOccurrenceCount } from "@/lib/utils";
import CategoryPicker from "./CategoryPicker";
import DatePickerField from "./DatePickerField";

interface TaskFormProps {
  task: Task | null;
  onSave: (data: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  prefillDate: Date | null;
  cats: Category[];
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
  timetable: TimetableItem[];
}

// タスク開始日 = 「今日のタスク」に出し始める日。
// ユーザーには「開始日時 〜 締切」の期間として見せる。
// 既存データとの互換のため、offset 形式の古い値は編集時に実日時へ変換する。

const RECUR_OPTIONS: { id: Task["recurrence"]; label: string }[] = [
  { id: "none", label: "なし" },
  { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
  { id: "daily", label: "毎日" },
];

const toDateOnly = (iso: string): string => iso.slice(0, 10);
const toTimeOnly = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const inferStartState = (task: Task | null, deadlineLocal: string): { date: string; time: string } => {
  if (task?.startDate) return { date: toDateOnly(task.startDate), time: toTimeOnly(task.startDate) };
  if (task && typeof task.startOffsetDays === "number") {
    const d = new Date(deadlineLocal);
    d.setDate(d.getDate() - task.startOffsetDays);
    d.setHours(0, 0, 0, 0);
    return { date: toDateOnly(toDateTimeLocal(d)), time: "00:00" };
  }
  return { date: "", time: "" };
};

const fmtDateMDW = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${DAY[d.getDay()]})`;
const fmtDateYMDW = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}（${DAY[d.getDay()]}）`;
const toDateTimeLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
};

// 共通 UI ヘルパー（コンポーネント外で定義してリレンダー時の再マウントを防ぐ）
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-2 mx-4 overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(27,39,75,0.05)]">{children}</div>
);

export default function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats, timetable }: TaskFormProps) {
  const isEdit = !!task;
  const isEventEdit = task?.kind === "event";

  const getDefault = () => {
    if (prefillDate) {
      const d = new Date(prefillDate);
      d.setHours(23, 59, 0, 0);
      return toDateTimeLocal(d);
    }
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toDateTimeLocal(d);
  };

  // ----- 共通 state -----
  const [title, setTitle] = useState(task?.title || "");
  const [deadline, setDeadline] = useState(task?.deadline ? toDateTimeLocal(new Date(task.deadline)) : getDefault());
  const [endTime, setEndTime] = useState(task?.endTime ? toDateTimeLocal(new Date(task.endTime)) : "");
  const [category, setCategory] = useState(task?.category || (cats[0]?.id || "default"));
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>(task?.recurrence || "none");
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [priority, setPriority] = useState<boolean>(task?.priority || false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => !!task && ((task.recurrence && task.recurrence !== "none") || task.reminder !== "1day"));
  const initialStart = inferStartState(task, task?.deadline ? toDateTimeLocal(new Date(task.deadline)) : getDefault());
  const [customStartDate, setCustomStartDate] = useState<string>(initialStart.date);
  const [customStartTime, setCustomStartTime] = useState<string>(initialStart.time);
  const [classDayOfWeek, setClassDayOfWeek] = useState<number>(task?.classDayOfWeek ?? new Date(task?.deadline || deadline).getDay());
  // 数字入力は string で保持して、空欄入力中の強制リセットを防ぐ。読み取りは useMemo で sanitize する
  const [biweeklyIntervalStr, setBiweeklyIntervalStr] = useState<string>(String(task?.biweeklyInterval ?? 2));
  // 授業科目用の追加 state
  const [classStartDate, setClassStartDate] = useState<string>(task?.classStartDate || "");
  const [classCountStr, setClassCountStr] = useState<string>(String(task?.repeatCount || 14));
  const biweeklyInterval = useMemo(() => {
    const n = parseInt(biweeklyIntervalStr, 10);
    if (isNaN(n) || n < 2) return 2;
    return Math.min(8, n);
  }, [biweeklyIntervalStr]);
  const classCount = useMemo(() => {
    const n = parseInt(classCountStr, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(50, n);
  }, [classCountStr]);
  const [showError, setShowError] = useState(false);
  const [formError, setFormError] = useState("");

  const todayDate = toDateOnly(toDateTimeLocal(new Date()));
  const fallbackStartTime = toDateTimeLocal(new Date()).slice(11, 16);
  const deadlineDate = deadline.slice(0, 10);
  const deadlineTime = deadline.slice(11, 16) || "23:59";
  const deadlineLabel = useMemo(() => {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return "締切を選択してください";
    return `${fmtDateYMDW(d)} ${deadlineTime}`;
  }, [deadline, deadlineTime]);

  const updateDeadlineDate = (nextDate: string) => {
    if (!nextDate) return;
    setDeadline(`${nextDate}T${deadlineTime}`);
    if (customStartDate && customStartDate > nextDate) setCustomStartDate(nextDate);
  };

  const updateDeadlineTime = (nextTime: string) => {
    if (!nextTime) return;
    const baseDate = deadlineDate || toDateTimeLocal(new Date()).slice(0, 10);
    setDeadline(`${baseDate}T${nextTime}`);
    if (customStartDate === baseDate && customStartTime && customStartTime > nextTime) setCustomStartTime(nextTime);
  };

  const selectedCat = cats.find((c) => c.id === category);
  const isTimetableCourse = !!selectedCat?.timetableId;
  const isTimetableRecurring = isTimetableCourse && (recurrence === "weekly" || recurrence === "biweekly");
  const intervalDays = recurrence === "biweekly" ? Math.max(2, biweeklyInterval) * 7 : 7;

  // 授業科目: カテゴリが時間割なら自動で classDayOfWeek を補完
  useEffect(() => {
    if (!selectedCat?.timetableId) return;
    const hit = timetable.find((t) => t.id === selectedCat.timetableId);
    if (hit) setClassDayOfWeek(hit.day);
  }, [selectedCat, timetable]);

  // 授業科目: 開始日選択時、その曜日に classDayOfWeek を上書き
  useEffect(() => {
    if (!classStartDate) return;
    const d = new Date(`${classStartDate}T00:00:00`);
    setClassDayOfWeek(d.getDay());
  }, [classStartDate]);

  // 通常カテゴリ繰り返し: 終了日の自動初期化
  useEffect(() => {
    if (recurrence === "none" || isTimetableRecurring) return;
    if (repeatEndDate) return;
    const d = new Date(deadline);
    d.setDate(d.getDate() + 7 * 14);
    setRepeatEndDate(toDateTimeLocal(d).slice(0, 10));
  }, [recurrence, deadline, repeatEndDate, isTimetableRecurring]);

  // 授業科目スケジュールから保存用の値を導出
  const derivedFromClassSchedule = useMemo(() => {
    if (!isTimetableRecurring || !classStartDate) return null;
    const start = new Date(`${classStartDate}T00:00:00`);
    const dl = new Date(deadline);
    const dlDateOnly = new Date(dl);
    dlDateOnly.setHours(0, 0, 0, 0);
    // 締切時刻
    const offsetTime = `${String(dl.getHours()).padStart(2, "0")}:${String(dl.getMinutes()).padStart(2, "0")}`;
    // 授業日 → 締切日 のオフセット日数
    const offsetDays = Math.round((dlDateOnly.getTime() - start.getTime()) / 86_400_000);
    // 最終回の終了日 (授業日基準)
    const lastClass = new Date(start);
    lastClass.setDate(lastClass.getDate() + (Math.max(1, classCount) - 1) * intervalDays);
    return {
      offsetTime,
      offsetDays,
      repeatEndDate: toDateTimeLocal(lastClass).slice(0, 10),
    };
  }, [isTimetableRecurring, classStartDate, deadline, classCount, intervalDays]);

  // ---- タスク開始日 ----
  // 保存用: startOffsetDays / startDate（ISO） を導出
  const computedStartOffsetDays: number | null = null;
  const computedStartDate: string | null = useMemo(() => {
    if (!customStartDate) return null;
    return new Date(`${customStartDate}T${customStartTime || fallbackStartTime}:00`).toISOString();
  }, [customStartDate, customStartTime, fallbackStartTime]);

  const startHelpText = useMemo(() => {
    if (!customStartDate) return "未入力なら、作成した瞬間から「今日の課題」に表示します";
    const d = new Date(`${customStartDate}T00:00:00`);
    return `${fmtDateMDW(d)} ${customStartTime || fallbackStartTime} から「今日の課題」に表示します`;
  }, [customStartDate, customStartTime, fallbackStartTime]);

  const occurrenceCount = useMemo(() => {
    if (recurrence === "none") return 1;
    if (isTimetableRecurring) return Math.max(1, classCount);
    if (!repeatEndDate) return 1;
    return calcOccurrenceCount({
      ...(task || {} as Task),
      id: task?.id || "tmp",
      title,
      deadline: new Date(deadline).toISOString(),
      category,
      priority: false,
      recurrence,
      repeatCount: task?.repeatCount || 14,
      repeatEndDate,
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      classDayOfWeek,
      biweeklyInterval,
    });
  }, [recurrence, repeatEndDate, isTimetableRecurring, classCount, task, title, deadline, category, reminder, memo, url, classDayOfWeek, biweeklyInterval]);

  const [saving, setSaving] = useState(false);
  const handleSave = () => {
    if (saving) return;
    if (!title.trim()) { setShowError(true); setFormError(""); return; }
    if (isEventEdit) {
      if (endTime && new Date(endTime).getTime() < new Date(deadline).getTime()) { setFormError("終了時刻は開始時刻より後にしてください"); return; }
    } else {
      if (recurrence !== "none" && !isTimetableRecurring && repeatEndDate && new Date(repeatEndDate).getTime() < new Date(deadline).getTime()) { setFormError("最終締切日は初回締切日以降に設定してください"); return; }
      if (recurrence === "biweekly" && (biweeklyInterval < 2 || biweeklyInterval > 8)) { setFormError("隔週の間隔は2〜8週間で入力してください"); return; }
      if (isTimetableRecurring && !classStartDate) { setFormError("授業の開始日を入力してください"); return; }
      if (computedStartDate && new Date(computedStartDate).getTime() > new Date(deadline).getTime()) { setFormError("取り組む期間の開始日時は締切以前にしてください"); return; }
    }
    setFormError("");
    setSaving(true);

    if (isEventEdit) {
      onSave({
        id: task?.parentId || task?.id || uid(),
        kind: "event",
        title: title.trim(),
        deadline: new Date(deadline).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        category,
        priority,
        startDate: null,
        startOffsetDays: null,
        recurrence: "none",
        repeatCount: null,
        repeatEndDate: null,
        reminder,
        memo,
        url,
        completed: false,
        completedAt: null,
        completedOccurrences: task?.completedOccurrences || [],
        order: task?.order ?? null,
        createdAt: task?.createdAt || new Date().toISOString(),
      });
      return;
    }

    onSave({
      id: task?.parentId || task?.id || uid(),
      kind: "todo",
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      startDate: computedStartDate,
      startOffsetDays: computedStartOffsetDays,
      recurrence,
      repeatCount: recurrence === "none" ? null : (isTimetableRecurring ? classCount : (task?.repeatCount || 14)),
      repeatEndDate: recurrence === "none"
        ? null
        : (isTimetableRecurring ? (derivedFromClassSchedule?.repeatEndDate || null) : repeatEndDate),
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      snoozedOccurrences: task?.snoozedOccurrences,
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      offsetTime: isTimetableRecurring ? derivedFromClassSchedule?.offsetTime : undefined,
      classDayOfWeek: isTimetableRecurring ? classDayOfWeek : undefined,
      classStartDate: isTimetableRecurring ? classStartDate : undefined,
      offsetDays: isTimetableRecurring ? derivedFromClassSchedule?.offsetDays : undefined,
      biweeklyInterval: recurrence === "biweekly" ? biweeklyInterval : undefined,
    });
  };

  const RecurrenceCard = (
    <Card>
      <div className="px-4 py-3">
        <span className="text-sm text-gray-900 mb-1 block font-medium">繰り返し</span>
        <span className="text-[11px] text-gray-400 block mb-2">毎週の小テストやレスポンスカードに使います</span>
        <div className="flex gap-1.5 flex-wrap">
          {RECUR_OPTIONS.map((r) => (
            <button key={r.id} onClick={() => setRecurrence(r.id)} className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors ${recurrence === r.id ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-500"}`}>{r.label}</button>
          ))}
        </div>
      </div>
    </Card>
  );

  const DeadlineCard = (
    <Card>
      <div className="px-4 py-3">
        <label className="block text-sm mb-2 text-gray-900 font-semibold">締切</label>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2 items-center">
          <div className="min-w-0">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} min={todayDate} placeholder="締切日を選択" />
          </div>
          <input
            type="time"
            value={deadlineTime}
            onChange={(e) => updateDeadlineTime(e.target.value)}
            className="min-w-0 w-[88px] h-[44px] justify-self-end text-base text-center bg-gray-50 rounded-xl px-2 py-2 border border-gray-200 tabular-nums appearance-none"
            aria-label="締切時刻"
          />
        </div>
      </div>
    </Card>
  );

  // 予定（イベント）用の時間枠カード
  const EventTimeCard = (
    <Card>
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">開始時刻</label>
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <div className="min-w-0">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="開始日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="min-w-0 w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200" />
        </div>
      </div>
      <div className="px-4 py-3">
        <label className="block text-sm mb-2 text-gray-900 font-medium">終了時刻 <span className="text-[10px] text-gray-400 font-normal">任意</span></label>
        <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
      </div>
    </Card>
  );

  const PriorityCard = (
    <Card>
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-900 font-medium">最優先</span>
          <div className="text-[10px] text-gray-400">リスト先頭に固定表示</div>
        </div>
        <button
          onClick={() => setPriority((p) => !p)}
          aria-label="最優先"
          aria-pressed={priority}
          className={`relative w-11 h-6 rounded-full transition-colors ${priority ? "bg-rose-500" : "bg-gray-300"}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${priority ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>
    </Card>
  );

  const StartDateCard = (
    <Card>
      <div className="px-4 py-3">
        <span className="text-sm text-gray-900 font-semibold block mb-1">課題に取り組む期間</span>
        <span className="text-[11px] text-gray-400 block mb-3">未入力なら作成した瞬間から表示します。終了は締切と一致します。</span>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2 items-end">
          <div className="min-w-0">
            <span className="block text-[11px] text-gray-500 mb-1">開始日</span>
            <DatePickerField
              value={customStartDate}
              onChange={(v) => {
                setCustomStartDate(v);
                if (!customStartTime) setCustomStartTime(fallbackStartTime);
              }}
              placeholder="開始日を選択"
              min={todayDate}
              rangeStart={customStartDate}
              rangeEnd={deadlineDate}
              isDateDisabled={(d) => d.getTime() > new Date(`${deadlineDate}T00:00:00`).getTime()}
            />
          </div>
          <label className="min-w-0 block">
            <span className="block text-[11px] text-gray-500 mb-1">開始時刻</span>
            <input
              type="time"
              value={customStartTime}
              onChange={(e) => setCustomStartTime(e.target.value)}
              className="min-w-0 w-[88px] h-[44px] text-base text-center bg-gray-50 rounded-xl px-2 py-2 border border-gray-200 tabular-nums appearance-none"
              aria-label="取り組み開始時刻"
            />
          </label>
        </div>
        <div className="mt-2 text-xs font-medium text-blue-600 leading-relaxed">{startHelpText}</div>
        <div className="mt-1 text-[11px] text-gray-400 leading-relaxed">締切: {deadlineLabel}</div>
      </div>
    </Card>
  );

  const UrlMemoCard = (
    <Card>
      <label className="block px-4 pt-3 pb-2 border-b border-gray-100">
        <span className="block text-sm text-gray-900 font-medium mb-2">提出先URL</span>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200" />
      </label>
      <label className="block px-4 pt-3 pb-3">
        <span className="block text-sm text-gray-900 font-medium mb-2">メモ</span>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="補足・提出条件・先生からの注意など" rows={3} className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 resize-none" />
      </label>
    </Card>
  );

  const ReminderCard = (
    <Card>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-sm text-gray-900 font-medium">締切前の通知</span>
          <div className="text-[10px] text-gray-400">通知機能は環境依存です。締切の指定時間前の目安として保存します。</div>
        </div>
        <select value={reminder} onChange={(e) => setReminder(e.target.value)} className="text-sm bg-transparent">
          {REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
    </Card>
  );

  // 授業科目の繰り返しブロック（再設計版）
  const TimetableScheduleBlock = (
    <Card>
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="text-sm mb-1 text-gray-900 font-medium">授業曜日（時間割から自動）</div>
        <div className="text-xs text-gray-500">{DAY[classDayOfWeek]}曜日</div>
      </div>
      {recurrence === "biweekly" && (
        <div className="px-4 py-3 border-b border-gray-100">
          <label className="text-sm text-gray-900 font-medium">何週間に1回提出</label>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={8}
              value={biweeklyIntervalStr}
              onChange={(e) => setBiweeklyIntervalStr(e.target.value)}
              onBlur={() => setBiweeklyIntervalStr(String(biweeklyInterval))}
              className="w-20 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200"
            />
            <span className="text-gray-500">週間おき</span>
          </div>
        </div>
      )}
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">授業の開始日</label>
        <DatePickerField value={classStartDate} onChange={(v) => setClassStartDate(v)} placeholder="第1回授業の日付" />
        <div className="text-[11px] text-gray-400 mt-1">第1回授業の日付。例: 4/3</div>
      </div>
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">授業の回数</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={classCountStr}
            onChange={(e) => setClassCountStr(e.target.value)}
            onBlur={() => setClassCountStr(String(classCount))}
            className="w-24 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200"
          />
          <span className="text-sm text-gray-500">回</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1">半期は通常 14〜15 回</div>
      </div>
      <div className="px-4 py-3">
        <div className="text-sm text-gray-900 font-medium">初回締切</div>
        <div className="text-[11px] text-gray-400 mt-1">上の締切を第1回として、以降の回を授業日に合わせて自動展開します。</div>
      </div>
    </Card>
  );

  const AdvancedToggleCard = (
    <div className="mx-4 mt-3">
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full rounded-[24px] border border-white/80 bg-white px-4 py-3 text-left flex items-center justify-between shadow-[0_12px_32px_rgba(27,39,75,0.07)] active:scale-[0.99] transition-transform"
      >
        <div>
          <div className="text-sm font-semibold text-gray-900">詳細設定</div>
          <div className="text-[11px] text-gray-400 mt-0.5">繰り返し・通知を必要なときだけ設定</div>
        </div>
        <span className="text-xs font-semibold text-blue-500">{showAdvanced ? "閉じる" : "開く"}</span>
      </button>
    </div>
  );

  // 通常カテゴリの繰り返しブロック
  const NormalRecurringScheduleBlock = (
    <Card>
      {recurrence === "biweekly" && (
        <div className="px-4 py-3 border-b border-gray-100">
          <label className="text-sm text-gray-900 font-medium">何週間に1回</label>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={8}
              value={biweeklyIntervalStr}
              onChange={(e) => setBiweeklyIntervalStr(e.target.value)}
              onBlur={() => setBiweeklyIntervalStr(String(biweeklyInterval))}
              className="w-20 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200"
            />
            <span className="text-gray-500">週間おき</span>
          </div>
        </div>
      )}
      <div className="px-4 py-3">
        <label className="text-sm text-gray-900 font-medium block mb-2">最終締切日</label>
        <DatePickerField
          value={repeatEndDate}
          onChange={(v) => setRepeatEndDate(v)}
          min={toDateOnly(deadline)}
          isDateDisabled={(d) => {
            if (d.getTime() < new Date(toDateOnly(deadline)).getTime()) return true;
            if (recurrence === "daily") return false;

            const first = new Date(toDateOnly(deadline));
            const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const cur = new Date(first);
            let guard = 0;
            while (cur.getTime() <= candidate.getTime() && guard < 240) {
              if (cur.getTime() === candidate.getTime()) return false;
              if (recurrence === "weekly") cur.setDate(cur.getDate() + 7);
              else if (recurrence === "biweekly") cur.setDate(cur.getDate() + Math.max(2, biweeklyInterval) * 7);
              else if (recurrence === "monthly") cur.setMonth(cur.getMonth() + 1);
              else break;
              guard += 1;
            }
            return recurrence === "weekly" || recurrence === "biweekly" || recurrence === "monthly";
          }}
          placeholder="最終回の締切日を選択"
        />
        <div className="text-xs text-gray-400 mt-1">
          全{occurrenceCount}回
          {(recurrence === "weekly" || recurrence === "biweekly") && "（初回と同じ曜日のみ選択可）"}
          {recurrence === "monthly" && "（初回と同じ日付のみ選択可）"}
        </div>
      </div>
    </Card>
  );

  // セクション順: まず課題登録に必要な項目だけ見せ、詳細設定は折りたたむ
  const renderSections = (): React.ReactNode[] => {
    const sections: React.ReactNode[] = [];
    if (isEventEdit) {
      sections.push(EventTimeCard);
      sections.push(UrlMemoCard);
      sections.push(AdvancedToggleCard);
      if (showAdvanced) {
        sections.push(PriorityCard);
        sections.push(ReminderCard);
      }
      return sections;
    }

    sections.push(DeadlineCard);
    sections.push(PriorityCard);
    sections.push(AdvancedToggleCard);
    if (showAdvanced) {
      sections.push(RecurrenceCard);
      if (recurrence !== "none") {
        sections.push(isTimetableRecurring ? TimetableScheduleBlock : NormalRecurringScheduleBlock);
      }
      sections.push(ReminderCard);
    }
    sections.push(StartDateCard);
    sections.push(UrlMemoCard);
    return sections;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F8FC] safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="bg-white/95 border-b border-slate-200/70 shadow-[0_10px_28px_rgba(27,39,75,0.06)] safe-top">
        <div className="flex items-center justify-between px-4 py-3 min-h-[52px]">
          <button onClick={onClose} className="text-sm text-blue-500 font-medium px-2 py-1 -mx-2">キャンセル</button>
          <span className="text-sm font-semibold text-gray-900">{isEventEdit ? "予定の編集" : isEdit ? "課題の編集" : "新しい課題"}</span>
          <button onClick={handleSave} disabled={saving} className="text-sm font-bold text-white bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 rounded-full shadow-sm active:scale-[0.98] transition-transform">保存</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-24 safe-bottom">
        <div className="mt-3 mx-4 overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(27,39,75,0.05)]">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
            placeholder={
              showError && !title.trim()
                ? (isEventEdit ? "予定名を入力してください" : "課題名を入力してください")
                : (isEventEdit ? "予定名を入力" : "課題名を入力")
            }
            className={`w-full px-4 py-3.5 text-sm text-gray-900 focus:outline-none border-b ${
              showError && !title.trim()
                ? "border-red-300 bg-red-50/50 placeholder-red-500"
                : "border-gray-100 placeholder-gray-400"
            }`}
            autoFocus={!isEdit}
          />
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </div>

        {renderSections()}

        {formError && !(showError && !title.trim()) && <div className="mt-3 mx-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
        <div className="h-24" />
      </div>
      {isEdit && <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200"><button onClick={() => onDelete(task!.parentId || task!.id)} className="text-sm text-red-500 font-medium">削除</button></div>}
    </div>
  );
}
