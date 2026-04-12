"use client";
import React, { useState, useEffect } from "react";
import { Task, Category } from "@/lib/types";
import { DAY, RECUR, REMINDERS } from "@/lib/constants";
import { uid, calcEndDate, calcCount, snapToWeekday } from "@/lib/utils";
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
}

export default function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats }: TaskFormProps) {
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
  const [repeatCount, setRepeatCount] = useState(task?.repeatCount || 15);
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (recurrence === "none") return;
    const end = calcEndDate(deadline, recurrence, repeatCount);
    setRepeatEndDate(end.toISOString().slice(0, 10));
  }, [recurrence, repeatCount, deadline]);

  const handleEndDateChange = (val: string) => {
    const snapped = snapToWeekday(new Date(val), deadline, recurrence);
    const s = snapped.toISOString().slice(0, 10);
    setRepeatEndDate(s);
    setRepeatCount(Math.max(1, calcCount(deadline, recurrence, snapped)));
  };

  const handleCountChange = (d: number) => setRepeatCount(Math.max(1, Math.min(99, repeatCount + d)));
  const deadlineDay = DAY[new Date(deadline).getDay()];

  const handleSave = () => {
    if (!title.trim()) { setShowError(true); return; }
    onSave({
      id: task?.parentId || task?.id || uid(),
      title: title.trim(),
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      recurrence: recurrence as Task["recurrence"],
      repeatCount: recurrence === "none" ? null : repeatCount,
      repeatEndDate: recurrence === "none" ? null : repeatEndDate,
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
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
          <div>
            <input
              type="text" value={title}
              onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setShowError(false); }}
              placeholder="タスク名を入力"
              className={`w-full px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b ${showError && !title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`}
              autoFocus
            />
            {showError && !title.trim() && <div className="px-4 py-2 text-xs text-red-500 bg-red-50/50">タスク名を入力してください</div>}
          </div>
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2"><IconFlag filled={priority} /><span className="text-sm text-gray-900">最優先</span></div>
            <button onClick={() => setPriority(!priority)}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative flex-shrink-0 ${priority ? "bg-red-500" : "bg-gray-300"}`}>
              <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${priority ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3">
            <label className="block text-sm text-gray-900 mb-2">締切</label>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-gray-400" />
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-900 mb-2 block">繰り返し</span>
            <div className="flex gap-1.5 flex-wrap">
              {RECUR.map((r) => (
                <button key={r.id} onClick={() => setRecurrence(r.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${recurrence === r.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {recurrence !== "none" && (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-900">終了日</span>
                  <span className="text-xs text-gray-400">毎{deadlineDay}曜に自動調整</span>
                </div>
                <input type="date" value={repeatEndDate} onChange={(e) => handleEndDateChange(e.target.value)}
                  min={new Date(deadline).toISOString().slice(0, 10)}
                  className="w-full text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus:outline-none focus:border-gray-400" />
              </div>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">回数</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCountChange(-1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold">-</button>
                  <span className="text-sm font-medium text-gray-900 w-8 text-center">{repeatCount}</span>
                  <button onClick={() => handleCountChange(1)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-bold">+</button>
                  <span className="text-xs text-gray-400 ml-1">回</span>
                </div>
              </div>
            </>
          )}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-900">通知アラーム</span>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)}
              className="appearance-none bg-transparent text-sm text-gray-500 text-right focus:outline-none cursor-pointer">
              {REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL"
            className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" rows={3}
            className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none" />
        </div>
        <div className="h-24" />
      </div>
      {isEdit && (
        <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200">
          <button onClick={() => onDelete(task!.parentId || task!.id)} className="text-sm text-red-500 font-medium">削除</button>
        </div>
      )}
    </div>
  );
}
