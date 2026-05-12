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
//   "immediate": startOffsetDays/startDate ともに null（本日から）
//   "offset":    startOffsetDays = N (締切の N 日前から)
//   "custom":    startDate = YYYY-MM-DD (指定日から)
type StartMode = "immediate" | "offset" | "custom";
type Kind = "todo" | "event";

const START_PRESETS: { id: string; label: string; offset: number | null | "custom" }[] = [
  { id: "immediate", label: "本日から", offset: null },
  { id: "d3", label: "3日前", offset: 3 },
  { id: "d7", label: "1週間前", offset: 7 },
  { id: "d14", label: "2週間前", offset: 14 },
  { id: "due", label: "締切日当日", offset: 0 },
  { id: "custom", label: "日付指定", offset: "custom" },
];

const RECUR_OPTIONS: { id: Task["recurrence"]; label: string }[] = [
  { id: "none", label: "なし" },
  { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
  { id: "daily", label: "毎日" },
];

const toDateOnly = (iso: string): string => iso.slice(0, 10);

const inferStartState = (task: Task | null): { mode: StartMode; offsetStr: string; date: string } => {
  if (!task) return { mode: "immediate", offsetStr: "", date: "" };
  if (task.startDate) return { mode: "custom", offsetStr: "", date: toDateOnly(task.startDate) };
  if (typeof task.startOffsetDays === "number") return { mode: "offset", offsetStr: String(task.startOffsetDays), date: "" };
  return { mode: "immediate", offsetStr: "", date: "" };
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
  <div className="mt-3 mx-4 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08),0_2px_8px_rgba(27,39,75,0.04)]">{children}</div>
);

export default function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats, timetable }: TaskFormProps) {
  const isEdit = !!task;

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
  const [kind, setKind] = useState<Kind>(task?.kind || "todo");
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
  const [showAdvanced, setShowAdvanced] = useState<boolean>(() => !!task && ((task.recurrence && task.recurrence !== "none") || !!task.priority || task.reminder !== "1day"));
  const initialStart = useMemo(() => inferStartState(task), [task]);
  const [startMode, setStartMode] = useState<StartMode>(initialStart.mode);
  const [startOffsetDaysStr, setStartOffsetDaysStr] = useState<string>(initialStart.offsetStr);
  const [customStartDate, setCustomStartDate] = useState<string>(initialStart.date);
  const startOffsetDays = useMemo(() => {
    const n = parseInt(startOffsetDaysStr, 10);
    if (isNaN(n) || n < 0) return null;
    return Math.min(365, n);
  }, [startOffsetDaysStr]);
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
  const computedStartOffsetDays: number | null = startMode === "offset" ? startOffsetDays : null;
  const computedStartDate: string | null = useMemo(() => {
    if (startMode !== "custom" || !customStartDate) return null;
    return new Date(`${customStartDate}T00:00:00`).toISOString();
  }, [startMode, customStartDate]);

  const startHelpText = useMemo(() => {
    if (startMode === "immediate") return "→ 作成時から「今日の課題」に表示します";
    if (startMode === "custom") {
      if (!customStartDate) return "→ 開始日を選択してください";
      const d = new Date(`${customStartDate}T00:00:00`);
      return `→ ${fmtDateMDW(d)} から「今日の課題」に表示します`;
    }
    // offset
    if (startOffsetDays == null) return "→ 日数を入力してください";
    if (startOffsetDays === 0) return "→ 締切日当日に「今日の課題」に表示します";
    return `→ 締切の${startOffsetDays}日前から「今日の課題」に表示します`;
  }, [startMode, customStartDate, startOffsetDays]);

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
    if (kind === "event") {
      if (endTime && new Date(endTime).getTime() < new Date(deadline).getTime()) { setFormError("終了時刻は開始時刻より後にしてください"); return; }
    } else {
      if (recurrence !== "none" && !isTimetableRecurring && repeatEndDate && new Date(repeatEndDate).getTime() < new Date(deadline).getTime()) { setFormError("最終締切日は初回締切日以降に設定してください"); return; }
      if (recurrence === "biweekly" && (biweeklyInterval < 2 || biweeklyInterval > 8)) { setFormError("隔週の間隔は2〜8週間で入力してください"); return; }
      if (isTimetableRecurring && !classStartDate) { setFormError("授業の開始日を入力してください"); return; }
      if (startMode === "offset" && startOffsetDays == null) { setFormError("タスク開始日の日数を入力してください"); return; }
      if (startMode === "custom" && !customStartDate) { setFormError("タスク開始日を選択してください"); return; }
      if (startMode === "custom" && customStartDate && new Date(`${customStartDate}T00:00:00`).getTime() > new Date(deadline).getTime()) { setFormError("タスク開始日は締切より前に設定してください"); return; }
    }
    setFormError("");
    setSaving(true);

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

  // 種別切替
  const KindSwitch = (
    <div className="mt-3 mx-4 rounded-[24px] border border-white/80 bg-white p-1.5 shadow-[0_12px_32px_rgba(27,39,75,0.07)]">
      <div className="grid grid-cols-2 gap-1">
        {(["todo", "event"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`min-h-11 py-2 rounded-[18px] text-sm font-semibold transition-colors ${kind === k ? "bg-[#007AFF] text-white shadow-[0_8px_18px_rgba(0,122,255,0.22)]" : "text-gray-500"}`}
          >
            {k === "todo" ? "課題" : "時間が決まった予定"}
          </button>
        ))}
      </div>
    </div>
  );

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
        <label className="block text-sm mb-2 text-gray-900 font-medium">締切</label>
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <div className="min-w-0">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="締切日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="min-w-0 w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200" />
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
        <span className="text-sm text-gray-900 font-medium block mb-1">いつから取りかかる？</span>
        <span className="text-[11px] text-gray-400 block mb-2">締切の何日前から「今日の課題」に出すか</span>
        <div className="flex gap-1.5 flex-wrap">
          {START_PRESETS.map((p) => {
            const isSelected =
              p.offset === "custom"
                ? startMode === "custom"
                : p.offset === null
                  ? startMode === "immediate"
                  : startMode === "offset" && startOffsetDays === p.offset;
            const chipDate = typeof p.offset === "number" && p.offset >= 0 ? (() => {
              const d = new Date(deadline);
              d.setDate(d.getDate() - p.offset);
              return fmtDateMD(d);
            })() : null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (p.offset === "custom") {
                    setStartMode("custom");
                    if (!customStartDate) setCustomStartDate(toDateOnly(deadline));
                  } else if (p.offset === null) {
                    setStartMode("immediate");
                    setStartOffsetDaysStr("");
                  } else {
                    setStartMode("offset");
                    setStartOffsetDaysStr(String(p.offset));
                  }
                }}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium leading-tight transition-colors ${isSelected ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-600"}`}
              >
                <span>{p.label}</span>
                {chipDate && <span className="text-[9px] opacity-70 mt-0.5">{chipDate}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">自由入力:</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            value={startOffsetDaysStr}
            onChange={(e) => {
              setStartOffsetDaysStr(e.target.value);
              if (e.target.value !== "") setStartMode("offset");
            }}
            onBlur={() => {
              if (startOffsetDays != null) {
                setStartOffsetDaysStr(String(startOffsetDays));
              } else if (startMode === "offset") {
                setStartOffsetDaysStr("");
                setStartMode("immediate");
              }
            }}
            className="w-20 text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
            placeholder="0"
          />
          <span className="text-xs text-gray-500">日前</span>
        </div>
        {startMode === "custom" && (
          <div className="mt-3">
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
      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="提出先URL・資料URL（任意）" className="w-full px-4 py-3 text-sm border-b border-gray-100" />
      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ（任意）" rows={3} className="w-full px-4 py-3 text-sm resize-none" />
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
        <label className="block text-sm mb-2 text-gray-900 font-medium">初回締切日</label>
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
        <div className="min-w-0">
          <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="初回締切日を選択" />
        </div>
        <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="min-w-0 w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200" />
      </div>
        <div className="text-[11px] text-gray-400 mt-1">第1回の課題提出日。以降の回はこれを基準に自動展開（祝日は休講としてスキップ）</div>
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
          <div className="text-[11px] text-gray-400 mt-0.5">繰り返し・最優先・通知を必要なときだけ設定</div>
        </div>
        <span className="text-xs font-semibold text-blue-500">{showAdvanced ? "閉じる" : "開く"}</span>
      </button>
    </div>
  );

  // 通常カテゴリの繰り返しブロック
  const NormalRecurringScheduleBlock = (
    <Card>
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="block text-sm mb-2 text-gray-900 font-medium">初回締切日</label>
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <div className="min-w-0">
            <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="初回締切日を選択" />
          </div>
          <input type="time" value={deadlineTime} onChange={(e) => updateDeadlineTime(e.target.value)} className="min-w-0 w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200" />
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
          {(recurrence === "weekly" || recurrence === "biweekly") && "（初回と同じ曜日のみ選択可）"}
          {recurrence === "monthly" && "（初回と同じ日付のみ選択可）"}
        </div>
      </div>
    </Card>
  );

  // セクション順: まず課題登録に必要な項目だけ見せ、詳細設定は折りたたむ
  const renderSections = (): React.ReactNode[] => {
    const sections: React.ReactNode[] = [];
    if (kind === "event") {
      sections.push(EventTimeCard);
      sections.push(UrlMemoCard);
      sections.push(AdvancedToggleCard);
      if (showAdvanced) {
        sections.push(PriorityCard);
        sections.push(ReminderCard);
      }
      return sections;
    }

    if (recurrence === "none") {
      sections.push(DeadlineCard);
    }
    sections.push(StartDateCard);
    sections.push(UrlMemoCard);
    sections.push(AdvancedToggleCard);
    if (showAdvanced) {
      sections.push(RecurrenceCard);
      if (recurrence !== "none") {
        sections.push(isTimetableRecurring ? TimetableScheduleBlock : NormalRecurringScheduleBlock);
      }
      sections.push(PriorityCard);
      sections.push(ReminderCard);
    }
    return sections;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F8FC] safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="bg-white/95 border-b border-slate-200/70 shadow-[0_10px_28px_rgba(27,39,75,0.06)] safe-top">
        <div className="flex items-center justify-between px-4 py-3 min-h-[52px]">
          <button onClick={onClose} className="text-sm text-blue-500 font-medium px-2 py-1 -mx-2">キャンセル</button>
          <span className="text-sm font-semibold text-gray-900">{isEdit ? (kind === "event" ? "予定の編集" : "課題の編集") : (kind === "event" ? "新しい予定" : "新しい課題")}</span>
          <button onClick={handleSave} disabled={saving} className="text-sm font-bold text-white bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 rounded-full shadow-sm active:scale-[0.98] transition-transform">保存</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-24 safe-bottom">
        {/* 課題 / 予定 切り替え */}
        {KindSwitch}

        <div className="mt-3 mx-4 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08),0_2px_8px_rgba(27,39,75,0.04)]">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
            placeholder={
              showError && !title.trim()
                ? (kind === "event" ? "予定名を入力してください" : "課題名を入力してください")
                : (kind === "event" ? "予定名を入力" : "課題名を入力")
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
