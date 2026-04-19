"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Task, Category, TimetableItem } from "@/lib/types";
import { RECUR, REMINDERS, DAY } from "@/lib/constants";
import { uid, calcOccurrenceCount } from "@/lib/utils";
import CategoryPicker from "./CategoryPicker";
import { IconFlag } from "./Icons";

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
  const [priority, setPriority] = useState(task?.priority || false);
  const [recurrence, setRecurrence] = useState(task?.recurrence || "none");
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [taskType, setTaskType] = useState<Task["taskType"]>(task?.taskType || undefined);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(task?.estimatedMinutes || 0);
  const [importance, setImportance] = useState<1 | 2 | 3>(task?.importance || (task?.priority ? 3 : 2));
  const [classDayOfWeek, setClassDayOfWeek] = useState<number>(task?.classDayOfWeek ?? new Date(task?.deadline || deadline).getDay());
  const [offsetDays, setOffsetDays] = useState<number>(task?.offsetDays ?? 0);
  const [offsetTime, setOffsetTime] = useState(task?.offsetTime || "23:59");
  const [showError, setShowError] = useState(false);

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

  useEffect(() => {
    const c = cats.find((x) => x.id === category);
    if (!c?.timetableId || recurrence === "monthly") return;
    const hit = timetable.find((t) => t.id === c.timetableId);
    if (hit) setClassDayOfWeek(hit.day);
  }, [category, cats, timetable, recurrence]);

  useEffect(() => {
    if (taskType) return;
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (days <= 1) setTaskType("single");
    else if (days <= 6) setTaskType("mid");
    else setTaskType("long");
  }, [deadline, taskType]);

  const preview = useMemo(() => {
    if (recurrence !== "weekly" && recurrence !== "biweekly") return "";
    const base = new Date(deadline);
    const diff = (classDayOfWeek - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff + offsetDays);
    const [h, m] = offsetTime.split(":").map(Number);
    base.setHours(h || 0, m || 0, 0, 0);
    return `${base.getMonth() + 1}/${base.getDate()}(${DAY[base.getDay()]}) ${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`;
  }, [recurrence, deadline, classDayOfWeek, offsetDays, offsetTime]);

  const occurrenceCount = useMemo(() => {
    if (recurrence === "none" || !repeatEndDate) return 1;
    return calcOccurrenceCount({
      ...(task || {} as Task),
      id: task?.id || "tmp",
      title,
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      taskType: taskType || "single",
      estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : undefined,
      loggedMinutes: task?.loggedMinutes || 0,
      importance,
      lastWorkedAt: task?.lastWorkedAt || null,
      recurrence: recurrence as Task["recurrence"],
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
    });
  }, [recurrence, repeatEndDate, task, title, deadline, category, priority, reminder, memo, url, classDayOfWeek, offsetDays, offsetTime]);

  const handleSave = () => {
    if (!title.trim()) { setShowError(true); return; }
    onSave({
      id: task?.parentId || task?.id || uid(),
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      taskType: taskType || "single",
      estimatedMinutes: estimatedMinutes > 0 ? estimatedMinutes : undefined,
      loggedMinutes: task?.loggedMinutes || 0,
      importance,
      lastWorkedAt: task?.lastWorkedAt || null,
      recurrence: recurrence as Task["recurrence"],
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
      classDayOfWeek: recurrence === "weekly" || recurrence === "biweekly" ? classDayOfWeek : undefined,
      offsetDays: recurrence === "weekly" || recurrence === "biweekly" ? offsetDays : undefined,
      offsetTime: recurrence === "weekly" || recurrence === "biweekly" ? offsetTime : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onClose} className="text-sm text-blue-500 font-medium">キャンセル</button>
        <span className="text-sm font-semibold text-gray-900">{isEdit ? "予定の編集" : "新しい予定"}</span>
        <button onClick={handleSave} className="text-sm font-semibold text-blue-500">保存</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }} placeholder="タスク名を入力" className={`w-full px-4 py-3.5 text-sm ${showError && !title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`} autoFocus />
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100 p-4">
          <label className="block text-sm mb-2">締切</label>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm mb-2 block">繰り返し</span>
            <div className="flex gap-1.5 flex-wrap">
              {RECUR.map((r) => <button key={r.id} onClick={() => setRecurrence(r.id)} className={`px-2.5 py-1.5 rounded-lg text-xs ${recurrence === r.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{r.label}</button>)}
            </div>
          </div>
          {(recurrence === "weekly" || recurrence === "biweekly") && (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm mb-2">授業曜日</div>
                <div className="flex gap-1.5">{[1,2,3,4,5].map((d) => <button key={d} onClick={() => setClassDayOfWeek(d)} className={`px-3 py-1.5 rounded-md text-xs ${classDayOfWeek === d ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>{DAY[d]}</button>)}</div>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-3 gap-2 items-end">
                <label className="text-xs text-gray-500">授業日の何日後<input type="number" min={0} max={30} value={offsetDays} onChange={(e) => setOffsetDays(Number(e.target.value || 0))} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200" /></label>
                <label className="text-xs text-gray-500 col-span-2">締切時刻<input type="time" value={offsetTime} onChange={(e) => setOffsetTime(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200" /></label>
                <div className="col-span-3 text-xs text-gray-500">初回締切: {preview}</div>
              </div>
            </>
          )}
          {recurrence !== "none" && (
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="text-sm">終了日</label>
              <input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="w-full mt-1 text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200" />
              <div className="text-xs text-gray-400 mt-1">全{occurrenceCount}回</div>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between"><span className="text-sm">通知アラーム</span><select value={reminder} onChange={(e) => setReminder(e.target.value)} className="text-sm">{REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm">タスク種別</span>
            <select value={taskType || "single"} onChange={(e) => setTaskType(e.target.value as Task["taskType"])} className="text-sm">
              <option value="single">単発</option><option value="mid">中期</option><option value="long">長期</option><option value="daily">毎日</option>
            </select>
          </div>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm">見積時間（分）</span>
            <input type="number" min={0} step={15} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value || 0))} className="w-28 px-2 py-1.5 rounded border border-gray-200 text-sm" />
          </div>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm">重要度</span>
            <select value={importance} onChange={(e) => setImportance(Number(e.target.value) as 1 | 2 | 3)} className="text-sm"><option value={1}>低</option><option value={2}>中</option><option value={3}>高</option></select>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100"><div className="flex items-center gap-2"><IconFlag filled={priority} /><span className="text-sm">最優先</span></div><button onClick={() => setPriority(!priority)} className={`w-12 h-7 rounded-full relative ${priority ? "bg-red-500" : "bg-gray-300"}`}><div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white ${priority ? "translate-x-5" : ""}`} /></button></div>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="w-full px-4 py-3 text-sm border-b border-gray-100" />
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" rows={3} className="w-full px-4 py-3 text-sm resize-none" />
        </div>
        <div className="h-24" />
      </div>
      {isEdit && <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200"><button onClick={() => onDelete(task!.parentId || task!.id)} className="text-sm text-red-500 font-medium">削除</button></div>}
    </div>
  );
}
