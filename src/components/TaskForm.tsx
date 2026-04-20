"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Task, Subtask, Category, TimetableItem } from "@/lib/types";
import { RECUR, REMINDERS, DAY } from "@/lib/constants";
import { uid, calcOccurrenceCount } from "@/lib/utils";
import CategoryPicker from "./CategoryPicker";

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

type StartMode = "immediate" | "d3" | "d7" | "d14" | "custom";

const START_PRESETS: { id: StartMode; label: string; daysBefore: number | null }[] = [
  { id: "immediate", label: "すぐ表示", daysBefore: null },
  { id: "d3", label: "3日前から", daysBefore: 3 },
  { id: "d7", label: "7日前から", daysBefore: 7 },
  { id: "d14", label: "14日前から", daysBefore: 14 },
  { id: "custom", label: "日付指定", daysBefore: null },
];

const toDateOnly = (iso: string): string => iso.slice(0, 10);

const inferStartMode = (task: Task | null): StartMode => {
  if (!task?.startDate) return "immediate";
  const dl = new Date(task.deadline).getTime();
  const st = new Date(task.startDate).getTime();
  const days = Math.round((dl - st) / 86_400_000);
  if (days === 3) return "d3";
  if (days === 7) return "d7";
  if (days === 14) return "d14";
  return "custom";
};

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

  const [title, setTitle] = useState(task?.title || "");
  const [deadline, setDeadline] = useState(task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : getDefault());
  const [category, setCategory] = useState(task?.category || (cats[0]?.id || "default"));
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>(task?.recurrence || "none");
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [priority, setPriority] = useState<boolean>(task?.priority || false);
  const [startMode, setStartMode] = useState<StartMode>(inferStartMode(task));
  const [customStartDate, setCustomStartDate] = useState<string>(task?.startDate ? toDateOnly(task.startDate) : "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState("");
  const [classDayOfWeek, setClassDayOfWeek] = useState<number>(task?.classDayOfWeek ?? new Date(task?.deadline || deadline).getDay());
  const [offsetDays, setOffsetDays] = useState<number>(task?.offsetDays ?? 0);
  const [offsetTime, setOffsetTime] = useState(task?.offsetTime || "23:59");
  const [showError, setShowError] = useState(false);
  const [formError, setFormError] = useState("");
  const [biweeklyInterval, setBiweeklyInterval] = useState<number>(task?.biweeklyInterval ?? 2);

  useEffect(() => {
    if (recurrence === "none") {
      setRepeatEndDate("");
      return;
    }
    if (repeatEndDate) return;
    const d = new Date(deadline);
    d.setDate(d.getDate() + 7 * 14);
    setRepeatEndDate(d.toISOString().slice(0, 10));
  }, [recurrence, deadline, repeatEndDate]);

  const selectedCat = cats.find((c) => c.id === category);
  const isTimetableCourse = !!selectedCat?.timetableId;

  useEffect(() => {
    const c = cats.find((x) => x.id === category);
    if (!c?.timetableId || recurrence === "monthly") return;
    const hit = timetable.find((t) => t.id === c.timetableId);
    if (hit) setClassDayOfWeek(hit.day);
  }, [category, cats, timetable, recurrence]);

  const computedStartDate = useMemo(() => {
    if (startMode === "immediate") return null;
    if (startMode === "custom") return customStartDate || null;
    const preset = START_PRESETS.find((p) => p.id === startMode);
    if (!preset?.daysBefore) return null;
    const d = new Date(deadline);
    d.setDate(d.getDate() - preset.daysBefore);
    return d.toISOString().slice(0, 10);
  }, [startMode, customStartDate, deadline]);

  const preview = useMemo(() => {
    if (!isTimetableCourse || (recurrence !== "weekly" && recurrence !== "biweekly")) return "";
    const base = new Date(deadline);
    const diff = (classDayOfWeek - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff + offsetDays);
    const [h, m] = offsetTime.split(":").map(Number);
    base.setHours(h || 0, m || 0, 0, 0);
    return `${base.getMonth() + 1}/${base.getDate()}(${DAY[base.getDay()]}) ${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`;
  }, [recurrence, deadline, classDayOfWeek, offsetDays, offsetTime, isTimetableCourse]);

  const occurrenceCount = useMemo(() => {
    if (recurrence === "none" || !repeatEndDate) return 1;
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
      offsetDays,
      offsetTime,
      biweeklyInterval,
    });
  }, [recurrence, repeatEndDate, task, title, deadline, category, reminder, memo, url, classDayOfWeek, offsetDays, offsetTime, biweeklyInterval]);

  const addSubtask = () => {
    const v = newSubtask.trim();
    if (!v) return;
    setSubtasks((prev) => [...prev, { id: uid(), title: v, done: false }]);
    setNewSubtask("");
  };

  const toggleSubtask = (id: string) => {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    if (!title.trim()) { setShowError(true); setFormError("タイトルを入力してください"); return; }
    if (recurrence !== "none" && repeatEndDate && new Date(repeatEndDate).getTime() < new Date(deadline).getTime()) { setFormError("終了日は開始日以降に設定してください"); return; }
    if (recurrence === "biweekly" && (biweeklyInterval < 2 || biweeklyInterval > 8)) { setFormError("隔週の間隔は2〜8週間で入力してください"); return; }
    if (startMode === "custom" && customStartDate && new Date(customStartDate).getTime() > new Date(deadline).getTime()) { setFormError("着手開始日は締切より前に設定してください"); return; }
    setFormError("");
    onSave({
      id: task?.parentId || task?.id || uid(),
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      startDate: computedStartDate || null,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      recurrence,
      repeatCount: recurrence === "none" ? null : (task?.repeatCount || 15),
      repeatEndDate: recurrence === "none" ? null : repeatEndDate,
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      offsetTime: isTimetableCourse && (recurrence === "weekly" || recurrence === "biweekly") ? offsetTime : undefined,
      classDayOfWeek: isTimetableCourse && (recurrence === "weekly" || recurrence === "biweekly") ? classDayOfWeek : undefined,
      offsetDays: isTimetableCourse && (recurrence === "weekly" || recurrence === "biweekly") ? offsetDays : undefined,
      biweeklyInterval: recurrence === "biweekly" ? biweeklyInterval : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onClose} className="text-sm text-blue-500 font-medium">キャンセル</button>
        <span className="text-sm font-semibold text-gray-900">{isEdit ? "タスクの編集" : "新しいタスク"}</span>
        <button onClick={handleSave} className="text-sm font-semibold text-blue-500">保存</button>
      </div>
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
            placeholder="タスク名を入力"
            className={`w-full px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b ${showError && !title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`}
            autoFocus
          />
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </div>

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100 p-4">
          <label className="block text-sm mb-2 text-gray-900">締切</label>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
        </div>

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-900">最優先</span>
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
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">着手開始日</span>
              <span className="text-[10px] text-gray-400">この日までは今日の一覧に出ない</span>
            </div>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {START_PRESETS.map((p) => {
                const chipDate = p.daysBefore !== null ? (() => {
                  const d = new Date(deadline);
                  d.setDate(d.getDate() - p.daysBefore!);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                })() : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setStartMode(p.id)}
                    className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium leading-tight ${startMode === p.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
                  >
                    <span>{p.label}</span>
                    {chipDate && <span className="text-[9px] opacity-70 mt-0.5">{chipDate}</span>}
                  </button>
                );
              })}
            </div>
            {startMode === "custom" && (
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="mt-2 w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200"
              />
            )}
            <div className="mt-2 text-xs font-medium">
              {computedStartDate ? (
                <span className="text-blue-600">→ {(() => { const d = new Date(computedStartDate); return `${d.getMonth() + 1}/${d.getDate()}(${DAY[d.getDay()]})`; })()} から今日の一覧に表示</span>
              ) : (
                <span className="text-gray-400">→ すぐに今日の一覧に表示</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-900">サブタスク</span>
            <span className="text-[10px] text-gray-400">任意</span>
          </div>
          {subtasks.length > 0 && (
            <div className="px-4 py-2 space-y-1.5">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button onClick={() => toggleSubtask(s.id)} className={`w-4 h-4 rounded border-2 flex-shrink-0 ${s.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                    {s.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg>}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? "line-through text-gray-400" : "text-gray-800"}`}>{s.title}</span>
                  <button onClick={() => removeSubtask(s.id)} className="text-[11px] text-gray-400 hover:text-red-500">削除</button>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2 flex items-center gap-2 border-t border-gray-100">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
              placeholder="サブタスクを追加"
              className="flex-1 text-sm bg-transparent focus:outline-none"
            />
            <button onClick={addSubtask} className="text-xs text-blue-500 font-medium">追加</button>
          </div>
        </div>

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-900 mb-2 block">繰り返し</span>
            <div className="flex gap-1.5 flex-wrap">
              {RECUR.map((r) => (
                <button key={r.id} onClick={() => setRecurrence(r.id)} className={`px-2.5 py-1.5 rounded-lg text-xs ${recurrence === r.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{r.label}</button>
              ))}
              <button onClick={() => setRecurrence("daily")} className={`px-2.5 py-1.5 rounded-lg text-xs ${recurrence === "daily" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>毎日</button>
            </div>
          </div>
          {isTimetableCourse && (recurrence === "weekly" || recurrence === "biweekly") && (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm mb-1 text-gray-900">授業曜日（時間割から自動）</div>
                <div className="text-xs text-gray-500">{DAY[classDayOfWeek]}曜日</div>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-3 gap-2 items-end">
                <label className="text-xs text-gray-500">授業日の何日後<input type="number" min={0} max={30} value={offsetDays} onChange={(e) => setOffsetDays(Number(e.target.value || 0))} className="w-full mt-1 px-2 py-2 rounded border border-gray-200" /></label>
                <label className="text-xs text-gray-500 col-span-2">締切時刻<input type="time" value={offsetTime} onChange={(e) => setOffsetTime(e.target.value)} className="w-full mt-1 px-2 py-2 rounded border border-gray-200" /></label>
                <div className="col-span-3 text-xs text-gray-500">初回締切: {preview}</div>
              </div>
            </>
          )}
          {recurrence === "biweekly" && (
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-sm text-gray-900">間隔</label>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <input type="number" min={2} max={8} value={biweeklyInterval} onChange={(e) => setBiweeklyInterval(Number(e.target.value || 2))} className="w-20 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />週間おき
              </div>
            </div>
          )}
          {recurrence !== "none" && (
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-sm text-gray-900">終了日</label>
              <input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="w-full mt-1 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
              <div className="text-xs text-gray-400 mt-1">全{occurrenceCount}回</div>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-900">通知アラーム</span>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)} className="text-sm">
              {REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        {formError && <div className="mt-3 mx-4 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}

        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="w-full px-4 py-3 text-sm border-b border-gray-100" />
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" rows={3} className="w-full px-4 py-3 text-sm resize-none" />
        </div>
        <div className="h-24" />
      </div>
      {isEdit && <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200"><button onClick={() => onDelete(task!.parentId || task!.id)} className="text-sm text-red-500 font-medium">削除</button></div>}
    </div>
  );
}
