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

type StartMode = "immediate" | "d3" | "d7" | "d14" | "due" | "custom";
type Kind = "todo" | "event";

const START_PRESETS: { id: StartMode; label: string; daysBefore: number | null }[] = [
  { id: "immediate", label: "本日から", daysBefore: null },
  { id: "d3", label: "3日前から", daysBefore: 3 },
  { id: "d7", label: "1週間前から", daysBefore: 7 },
  { id: "d14", label: "2週間前から", daysBefore: 14 },
  { id: "due", label: "締切日当日", daysBefore: 0 },
  { id: "custom", label: "日付指定", daysBefore: null },
];

const RECUR_OPTIONS: { id: Task["recurrence"]; label: string }[] = [
  { id: "none", label: "なし" },
  { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
  { id: "daily", label: "毎日" },
];

const toDateOnly = (iso: string): string => iso.slice(0, 10);

const inferStartMode = (task: Task | null): StartMode => {
  if (!task) return "immediate";
  if (typeof task.startOffsetDays === "number") {
    if (task.startOffsetDays === 0) return "due";
    if (task.startOffsetDays === 3) return "d3";
    if (task.startOffsetDays === 7) return "d7";
    if (task.startOffsetDays === 14) return "d14";
    return "custom";
  }
  if (!task.startDate) return "immediate";
  const dl = new Date(task.deadline).getTime();
  const st = new Date(task.startDate).getTime();
  const days = Math.round((dl - st) / 86_400_000);
  if (days === 0) return "due";
  if (days === 3) return "d3";
  if (days === 7) return "d7";
  if (days === 14) return "d14";
  return "custom";
};

const fmtDateMD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const fmtDateMDW = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}(${DAY[d.getDay()]})`;
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
  <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">{children}</div>
);

export default function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats, timetable }: TaskFormProps) {
  const isEdit = !!task;

  const getDefault = () => {
    if (prefillDate) {
      const d = new Date(prefillDate);
      d.setHours(23, 59);
      return d.toISOString().slice(0, 16);
    }
    const d = new Date();
    d.setHours(d.getHours() + 1, 0);
    return d.toISOString().slice(0, 16);
  };

  // ----- 共通 state -----
  const [kind, setKind] = useState<Kind>(task?.kind || "todo");
  const [title, setTitle] = useState(task?.title || "");
  const [deadline, setDeadline] = useState(task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : getDefault());
  const [endTime, setEndTime] = useState(task?.endTime ? new Date(task.endTime).toISOString().slice(0, 16) : "");
  const [category, setCategory] = useState(task?.category || (cats[0]?.id || "default"));
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>(task?.recurrence || "none");
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [priority, setPriority] = useState<boolean>(task?.priority || false);
  const [startMode, setStartMode] = useState<StartMode>(inferStartMode(task));
  const [customStartDate, setCustomStartDate] = useState<string>(task?.startDate ? toDateOnly(task.startDate) : "");
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

  const deadlineDate = deadline.slice(0, 10);
  const deadlineTime = deadline.slice(11, 16) || "23:59";

  const updateDeadlineDate = (nextDate: string) => {
    if (!nextDate) return;
    setDeadline(`${nextDate}T${deadlineTime}`);
  };

  const updateDeadlineTime = (nextTime: string) => {
    if (!nextTime) return;
    const baseDate = deadlineDate || toDateTimeLocal(new Date()).slice(0, 10);
    setDeadline(`${baseDate}T${nextTime}`);
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
    setRepeatEndDate(d.toISOString().slice(0, 10));
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
      repeatEndDate: lastClass.toISOString().slice(0, 10),
    };
  }, [isTimetableRecurring, classStartDate, deadline, classCount, intervalDays]);

  // ---- タスク表示開始日 ----
  const computedStartDateForFirstOccurrence = useMemo(() => {
    if (startMode === "immediate") return null;
    if (startMode === "custom") return customStartDate || null;
    const preset = START_PRESETS.find((p) => p.id === startMode);
    if (preset?.daysBefore == null) return null;
    const d = new Date(deadline);
    d.setDate(d.getDate() - preset.daysBefore);
    return d.toISOString().slice(0, 10);
  }, [startMode, customStartDate, deadline]);

  const startHelpText = useMemo(() => {
    switch (startMode) {
      case "immediate": return "→ 本日から今日のタスクに表示します";
      case "d3": return "→ 締切日の3日前から今日のタスクに表示します";
      case "d7": return "→ 締切日の1週間前から今日のタスクに表示します";
      case "d14": return "→ 締切日の2週間前から今日のタスクに表示します";
      case "due": return "→ 締切日当日に今日のタスクに表示します";
      case "custom": {
        if (!customStartDate) return "→ 開始日を選択してください";
        const d = new Date(customStartDate);
        return `→ ${fmtDateMDW(d)} から今日のタスクに表示します`;
      }
    }
  }, [startMode, customStartDate]);

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
      repeatCount: task?.repeatCount || 15,
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

  const handleSave = () => {
    if (!title.trim()) { setShowError(true); setFormError(kind === "event" ? "予定名を入力してください" : "タスク名を入力してください"); return; }
    if (kind === "event") {
      if (endTime && new Date(endTime).getTime() < new Date(deadline).getTime()) { setFormError("終了時刻は開始時刻より後にしてください"); return; }
    } else {
      if (recurrence !== "none" && !isTimetableRecurring && repeatEndDate && new Date(repeatEndDate).getTime() < new Date(deadline).getTime()) { setFormError("最終締切日は初回締切日以降に設定してください"); return; }
      if (recurrence === "biweekly" && (biweeklyInterval < 2 || biweeklyInterval > 8)) { setFormError("隔週の間隔は2〜8週間で入力してください"); return; }
      if (startMode === "custom" && customStartDate && new Date(customStartDate).getTime() > new Date(deadline).getTime()) { setFormError("タスク表示開始日は締切より前に設定してください"); return; }
      if (isTimetableRecurring && !classStartDate) { setFormError("授業の開始日を入力してください"); return; }
    }
    setFormError("");

    if (kind === "event") {
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

    const preset = START_PRESETS.find((p) => p.id === startMode);
    const startOffsetDays: number | null = preset?.daysBefore != null ? preset.daysBefore : null;
    const startDate: string | null = computedStartDateForFirstOccurrence;

    onSave({
      id: task?.parentId || task?.id || uid(),
      kind: "todo",
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      startDate,
      startOffsetDays,
      recurrence,
      repeatCount: recurrence === "none" ? null : (isTimetableRecurring ? classCount : (task?.repeatCount || 15)),
      repeatEndDate: recurrence === "none"
        ? null
        : (isTimetableRecurring ? (derivedFromClassSchedule?.repeatEndDate || null) : repeatEndDate),
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      offsetTime: isTimetableRecurring ? derivedFromClassSchedule?.offsetTime : undefined,
      classDayOfWeek: isTimetableRecurring ? classDayOfWeek : undefined,
      classStartDate: isTimetableRecurring ? classStartDate : undefined,
      offsetDays: isTimetableRecurring ? derivedFromClassSchedule?.offsetDays : undefined,
      biweeklyInterval: recurrence === "biweekly" ? biweeklyInterval : undefined,
    });
  };

  // 種別切替
  const KindSwitch = (
    <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100 p-1">
      <div className="grid grid-cols-2 gap-1">
        {(["todo", "event"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`py-2 rounded-lg text-xs font-medium transition-colors ${kind === k ? "bg-[#007AFF] text-white" : "text-gray-500"}`}
          >
            {k === "todo" ? "やること" : "予定（時間枠）"}
          </button>
        ))}
      </div>
    </div>
  );

  const RecurrenceCard = (
    <Card>
      <div className="px-4 py-3">
        <span className="text-sm text-gray-900 mb-2 block font-medium">繰り返し</span>
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
        <label className="block text-sm mb-2 text-gray-900 font-medium">締切</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="締切日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
        </div>
      </div>
    </Card>
  );

  // 予定（イベント）用の時間枠カード
  const EventTimeCard = (
    <Card>
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">開始時刻</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="開始日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
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
        <span className="text-sm text-gray-900 font-medium block mb-2">タスク表示開始日</span>
        <div className="flex gap-1.5 flex-wrap">
          {START_PRESETS.map((p) => {
            const chipDate = p.daysBefore != null ? (() => {
              const d = new Date(deadline);
              d.setDate(d.getDate() - p.daysBefore!);
              return fmtDateMD(d);
            })() : null;
            return (
              <button
                key={p.id}
                onClick={() => setStartMode(p.id)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium leading-tight transition-colors ${startMode === p.id ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-600"}`}
              >
                <span>{p.label}</span>
                {chipDate && <span className="text-[9px] opacity-70 mt-0.5">{chipDate}</span>}
              </button>
            );
          })}
        </div>
        {startMode === "custom" && (
          <div className="mt-2">
            <DatePickerField
              value={customStartDate}
              onChange={(v) => setCustomStartDate(v)}
              placeholder="開始日を選択"
            />
          </div>
        )}
        <div className="mt-2 text-xs font-medium text-blue-600 leading-relaxed">{startHelpText}</div>
      </div>
    </Card>
  );

  const UrlMemoCard = (
    <Card>
      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="w-full px-4 py-3 text-sm border-b border-gray-100" />
      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" rows={3} className="w-full px-4 py-3 text-sm resize-none" />
    </Card>
  );

  const ReminderCard = (
    <Card>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-900 font-medium">通知アラーム</span>
        <select value={reminder} onChange={(e) => setReminder(e.target.value)} className="text-sm">
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
        <label className="block text-sm mb-2 text-gray-900 font-medium">初回締切日</label>
        <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="初回締切日を選択" />
        </div>
        <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
      </div>
        <div className="text-[11px] text-gray-400 mt-1">第1回の課題提出日。以降の回はこれを基準に自動展開（祝日は休講としてスキップ）</div>
      </div>
    </Card>
  );

  // 通常カテゴリの繰り返しブロック
  const NormalRecurringScheduleBlock = (
    <Card>
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">初回締切日</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="初回締切日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
        </div>
      </div>
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
          {(recurrence === "weekly" || recurrence === "biweekly") && "（繰り返し日に一致する日付のみ選択可）"
          || (recurrence === "monthly" && "（毎月の繰り返し日に一致する日付のみ選択可）")}
        </div>
      </div>
    </Card>
  );

  // セクション順
  const renderSections = (): React.ReactNode[] => {
    const sections: React.ReactNode[] = [];
    if (kind === "event") {
      sections.push(EventTimeCard);
      sections.push(PriorityCard);
      sections.push(ReminderCard);
      sections.push(UrlMemoCard);
      return sections;
    }

    sections.push(RecurrenceCard);
    if (recurrence === "none") {
      sections.push(DeadlineCard);
    } else if (isTimetableRecurring) {
      sections.push(TimetableScheduleBlock);
    } else {
      sections.push(NormalRecurringScheduleBlock);
    }
    sections.push(PriorityCard);
    sections.push(StartDateCard);
    sections.push(ReminderCard);
    sections.push(UrlMemoCard);
    return sections;
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="bg-white border-b border-gray-200 safe-top">
        <div className="flex items-center justify-between px-4 py-3 min-h-[52px]">
          <button onClick={onClose} className="text-sm text-blue-500 font-medium px-2 py-1 -mx-2">キャンセル</button>
          <span className="text-sm font-semibold text-gray-900">{isEdit ? (kind === "event" ? "予定の編集" : "タスクの編集") : (kind === "event" ? "新しい予定" : "新しいタスク")}</span>
          <button onClick={handleSave} className="text-sm font-bold text-white bg-[#007AFF] hover:bg-[#0062CC] px-4 py-1.5 rounded-full shadow-sm active:scale-[0.98] transition-transform">保存</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-24 safe-bottom">
        {/* やること / 予定 切り替え */}
        {KindSwitch}

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
            placeholder={kind === "event" ? "予定名を入力" : "タスク名を入力"}
            className={`w-full px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b ${showError && !title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`}
            autoFocus
          />
          {showError && !title.trim() && (
            <div className="px-4 py-2 text-xs text-red-500 border-b border-red-100 bg-red-50/40">
              {kind === "event" ? "予定名を入力してください" : "タスク名を入力してください"}
            </div>
          )}
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
