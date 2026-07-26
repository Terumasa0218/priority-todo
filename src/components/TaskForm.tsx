"use client";

import React, { useMemo, useState } from "react";
import { Category, Task, TimetableItem } from "@/lib/types";
import { DAY, REMINDERS } from "@/lib/constants";
import { calcOccurrenceCount, uid } from "@/lib/utils";
import CategoryPicker from "./CategoryPicker";
import DatePickerField from "./DatePickerField";
import { IconCalendar, IconChevD, IconFlag, IconLink, IconRepeat } from "./Icons";

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

const RECUR_OPTIONS: { id: Exclude<Task["recurrence"], "none">; label: string }[] = [
  { id: "weekly", label: "毎週" },
  { id: "biweekly", label: "隔週" },
  { id: "monthly", label: "毎月" },
  { id: "daily", label: "毎日" },
];

const pad2 = (value: number) => String(value).padStart(2, "0");
const toDateTimeLocal = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const FormSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`border-b border-slate-100 bg-white ${className}`}>{children}</section>
);

const Toggle = ({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    role="switch"
    aria-checked={checked}
    className={`flex h-8 w-[52px] flex-none items-center rounded-full p-1 transition-colors ${checked ? "bg-[#0B7DEE]" : "bg-slate-300"}`}
  >
    <span className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);

export default function TaskForm({ task, onSave, onDelete, onClose, prefillDate, cats, setCats, timetable }: TaskFormProps) {
  const isEdit = !!task;
  const isEventEdit = task?.kind === "event";
  const getDefaultDeadline = () => {
    const date = prefillDate ? new Date(prefillDate) : new Date();
    if (prefillDate) date.setHours(23, 59, 0, 0);
    else date.setHours(date.getHours() + 1, 0, 0, 0);
    return toDateTimeLocal(date);
  };

  const [title, setTitle] = useState(task?.title || "");
  const [deadline, setDeadline] = useState(task?.deadline ? toDateTimeLocal(new Date(task.deadline)) : getDefaultDeadline());
  const [endTime, setEndTime] = useState(task?.endTime ? toDateTimeLocal(new Date(task.endTime)) : "");
  const [category, setCategory] = useState(task?.category || cats[0]?.id || "default");
  const [priority, setPriority] = useState(task?.priority || false);
  const [memo, setMemo] = useState(task?.memo || "");
  const [url, setUrl] = useState(task?.url || "");
  const [showNotes, setShowNotes] = useState(Boolean(task?.memo || task?.url));
  const [recurrence, setRecurrence] = useState<Task["recurrence"]>(task?.recurrence || "none");
  const [repeatSettingsEnabled, setRepeatSettingsEnabled] = useState(Boolean(task?.recurrence && task.recurrence !== "none"));
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate || "");
  const [reminder, setReminder] = useState(task?.reminder || "1day");
  const [biweeklyIntervalStr, setBiweeklyIntervalStr] = useState(String(task?.biweeklyInterval ?? 2));
  const [classStartDate, setClassStartDate] = useState(task?.classStartDate || "");
  const [classCountStr, setClassCountStr] = useState(String(task?.repeatCount || 14));
  const [showError, setShowError] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const deadlineDate = deadline.slice(0, 10);
  const deadlineTime = deadline.slice(11, 16) || "23:59";
  const todayDate = toDateTimeLocal(new Date()).slice(0, 10);
  const selectedCategory = cats.find((item) => item.id === category);
  const selectedTimetable = selectedCategory?.timetableId ? timetable.find((item) => item.id === selectedCategory.timetableId) : null;
  const isTimetableCourse = Boolean(selectedCategory?.timetableId);
  const isWeeklyLike = recurrence === "weekly" || recurrence === "biweekly";
  const isClassBasedRecurring = isTimetableCourse && isWeeklyLike;
  const biweeklyInterval = useMemo(() => {
    const parsed = Number.parseInt(biweeklyIntervalStr, 10);
    return Number.isNaN(parsed) ? 2 : Math.max(2, Math.min(8, parsed));
  }, [biweeklyIntervalStr]);
  const classCount = useMemo(() => {
    const parsed = Number.parseInt(classCountStr, 10);
    return Number.isNaN(parsed) ? 1 : Math.max(1, Math.min(50, parsed));
  }, [classCountStr]);
  const classDayOfWeek = useMemo(() => {
    if (classStartDate) return new Date(`${classStartDate}T00:00:00`).getDay();
    if (selectedTimetable) return selectedTimetable.day;
    return task?.classDayOfWeek ?? new Date(deadline).getDay();
  }, [classStartDate, deadline, selectedTimetable, task?.classDayOfWeek]);
  const defaultRepeatEndDate = useMemo(() => {
    const date = new Date(deadline);
    date.setDate(date.getDate() + 98);
    return toDateTimeLocal(date).slice(0, 10);
  }, [deadline]);
  const effectiveRepeatEndDate = repeatEndDate || defaultRepeatEndDate;
  const intervalDays = recurrence === "biweekly" ? biweeklyInterval * 7 : 7;

  const derivedClassSchedule = useMemo(() => {
    if (!isClassBasedRecurring || !classStartDate) return null;
    const firstClass = new Date(`${classStartDate}T00:00:00`);
    const firstDeadline = new Date(deadline);
    const deadlineDay = new Date(firstDeadline);
    deadlineDay.setHours(0, 0, 0, 0);
    const offsetDays = Math.round((deadlineDay.getTime() - firstClass.getTime()) / 86_400_000);
    const lastClass = new Date(firstClass);
    lastClass.setDate(lastClass.getDate() + (classCount - 1) * intervalDays);
    const lastDeadline = new Date(lastClass);
    lastDeadline.setDate(lastDeadline.getDate() + offsetDays);
    return {
      offsetDays,
      offsetTime: `${pad2(firstDeadline.getHours())}:${pad2(firstDeadline.getMinutes())}`,
      repeatEndDate: toDateTimeLocal(lastDeadline).slice(0, 10),
    };
  }, [classCount, classStartDate, deadline, intervalDays, isClassBasedRecurring]);

  const occurrenceCount = useMemo(() => {
    if (recurrence === "none") return 1;
    if (isClassBasedRecurring) return classCount;
    return calcOccurrenceCount({
      ...(task || ({} as Task)),
      id: task?.id || "preview",
      title,
      deadline: new Date(deadline).toISOString(),
      category,
      priority,
      startDate: null,
      startOffsetDays: null,
      recurrence,
      repeatCount: classCount,
      repeatEndDate: isClassBasedRecurring ? (derivedClassSchedule?.repeatEndDate || effectiveRepeatEndDate) : effectiveRepeatEndDate,
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      classDayOfWeek: isClassBasedRecurring ? classDayOfWeek : undefined,
      classStartDate: isClassBasedRecurring ? classStartDate : undefined,
      biweeklyInterval,
    });
  }, [biweeklyInterval, category, classCount, classDayOfWeek, classStartDate, deadline, derivedClassSchedule?.repeatEndDate, effectiveRepeatEndDate, isClassBasedRecurring, memo, priority, recurrence, reminder, task, title, url]);

  const updateDeadlineDate = (nextDate: string) => {
    if (nextDate) setDeadline(`${nextDate}T${deadlineTime}`);
  };

  const updateDeadlineTime = (nextTime: string) => {
    if (nextTime) setDeadline(`${deadlineDate || todayDate}T${nextTime}`);
  };

  const save = () => {
    if (saving) return;
    if (!title.trim()) {
      setShowError(true);
      return;
    }
    if (isEventEdit && endTime && new Date(endTime).getTime() < new Date(deadline).getTime()) {
      setFormError("終了時刻は開始時刻より後にしてください");
      return;
    }
    if (!isEventEdit && recurrence !== "none") {
      if (recurrence === "biweekly" && (biweeklyInterval < 2 || biweeklyInterval > 8)) {
        setFormError("隔週の間隔は2〜8週間で入力してください");
        return;
      }
      if (isClassBasedRecurring && !classStartDate) {
        setFormError("初回授業日を入力してください");
        return;
      }
      if (!isClassBasedRecurring && new Date(effectiveRepeatEndDate).getTime() < new Date(deadline).getTime()) {
        setFormError("最終締切日は初回締切日以降に設定してください");
        return;
      }
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
      // 旧データとの互換項目は残すが、新規・再保存した課題では表示開始日を持たない。
      startDate: null,
      startOffsetDays: null,
      recurrence,
      repeatCount: recurrence === "none" ? null : (isClassBasedRecurring ? classCount : (task?.repeatCount || 14)),
      repeatEndDate: recurrence === "none" ? null : (isClassBasedRecurring ? (derivedClassSchedule?.repeatEndDate || null) : effectiveRepeatEndDate),
      reminder,
      memo,
      url,
      completed: false,
      completedAt: null,
      completedOccurrences: task?.completedOccurrences || [],
      snoozedOccurrences: task?.snoozedOccurrences,
      order: task?.order ?? null,
      createdAt: task?.createdAt || new Date().toISOString(),
      offsetTime: isClassBasedRecurring ? derivedClassSchedule?.offsetTime : undefined,
      classDayOfWeek: isClassBasedRecurring ? classDayOfWeek : undefined,
      classStartDate: isClassBasedRecurring ? classStartDate : undefined,
      offsetDays: isClassBasedRecurring ? derivedClassSchedule?.offsetDays : undefined,
      biweeklyInterval: recurrence === "biweekly" ? biweeklyInterval : undefined,
    });
  };

  const repeatSummary = isClassBasedRecurring
    ? classStartDate
      ? `第1回から第${classCount}回までを作成します`
      : `初回授業日を選ぶと、第1回から第${classCount}回までを作成します`
    : `${occurrenceCount}回分の課題を作成します`;

  const RepeatSettings = repeatSettingsEnabled && !isEventEdit ? (
    <FormSection>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950"><IconRepeat size={16} stroke="#0B7DEE" /> 繰り返し設定</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {RECUR_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRecurrence(option.id)}
              className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${recurrence === option.id ? "bg-[#0B7DEE] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {recurrence === "biweekly" && (
        <div className="border-t border-slate-100 px-5 py-4">
          <label className="block text-sm font-semibold text-slate-900">間隔</label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={2}
              max={8}
              value={biweeklyIntervalStr}
              onChange={(event) => setBiweeklyIntervalStr(event.target.value)}
              onBlur={() => setBiweeklyIntervalStr(String(biweeklyInterval))}
              className="h-11 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center font-semibold text-slate-900 outline-none focus:border-blue-400"
            />
            <span className="text-sm text-slate-500">週間おき</span>
          </div>
        </div>
      )}

      {isClassBasedRecurring ? (
        <>
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconCalendar size={16} stroke="#64748B" /> 初回授業日</label>
              <span className="text-xs font-medium text-slate-400">{DAY[classDayOfWeek]}曜日</span>
            </div>
            <DatePickerField value={classStartDate} onChange={setClassStartDate} placeholder="第1回授業の日付" />
            <p className="mt-2 text-xs leading-relaxed text-slate-500">過去の日付も選べます。</p>
          </div>
          <div className="border-t border-slate-100 px-5 py-4">
            <label className="block text-sm font-semibold text-slate-900">授業回数</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={classCountStr}
                onChange={(event) => setClassCountStr(event.target.value)}
                onBlur={() => setClassCountStr(String(classCount))}
                className="h-11 w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center font-semibold text-slate-900 outline-none focus:border-blue-400"
                aria-label="授業回数"
              />
              <span className="text-sm text-slate-500">回</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{repeatSummary}</p>
          </div>
        </>
      ) : (
        <div className="border-t border-slate-100 px-5 py-4">
          <label className="mb-2 block text-sm font-semibold text-slate-900">最終締切日</label>
          <DatePickerField
            value={effectiveRepeatEndDate}
            onChange={setRepeatEndDate}
            min={deadlineDate}
            isDateDisabled={(date) => date.getTime() < new Date(`${deadlineDate}T00:00:00`).getTime()}
            placeholder="最終締切日を選択"
          />
          <p className="mt-2 text-xs text-slate-500">締切日を起点に、{occurrenceCount}回分の課題を作成します。</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">締切前の通知</div>
          <p className="mt-0.5 text-xs text-slate-500">{reminder === "none" ? "通知しません" : `締切の${REMINDERS.find((item) => item.id === reminder)?.label || "1日前"}に通知`}</p>
        </div>
        <select value={reminder} onChange={(event) => setReminder(event.target.value)} className="h-10 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none">
          {REMINDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
    </FormSection>
  ) : null;

  return (
    <div className="fullscreen-form-shell z-50 flex flex-col bg-white safe-x">
      <header className="border-b border-slate-200 bg-white/95 safe-top">
        <div className="flex min-h-[60px] items-center justify-between px-5 py-3">
          <button type="button" onClick={onClose} className="px-1 py-2 text-sm font-semibold text-[#0B7DEE]">キャンセル</button>
          <h1 className="text-base font-bold text-slate-950">{isEventEdit ? "予定の編集" : isEdit ? "課題の編集" : "新しい課題"}</h1>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#0B7DEE] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">保存</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white pb-8 safe-bottom">
        <FormSection>
          <input
            autoFocus={!isEdit}
            type="text"
            inputMode="text"
            enterKeyHint="done"
            value={title}
            onChange={(event) => { setTitle(event.target.value); if (event.target.value.trim()) setShowError(false); }}
            placeholder={showError ? (isEventEdit ? "予定名を入力してください" : "課題名を入力してください") : (isEventEdit ? "予定名を入力" : "課題名を入力")}
            className={`h-16 w-full border-b px-5 text-base font-medium text-slate-950 outline-none placeholder:text-slate-400 ${showError ? "border-rose-300 bg-rose-50/50 placeholder:text-rose-500" : "border-slate-100"}`}
          />
          <CategoryPicker cats={cats} setCats={setCats} selected={category} onSelect={setCategory} />
        </FormSection>

        {isEventEdit ? (
          <FormSection>
            <div className="px-5 py-4">
              <label className="mb-2 block text-sm font-semibold text-slate-900">開始</label>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} placeholder="開始日を選択" />
                <input type="time" value={deadlineTime} onChange={(event) => updateDeadlineTime(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-base font-semibold text-slate-900 outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <label className="mb-2 block text-sm font-semibold text-slate-900">終了 <span className="font-normal text-slate-400">任意</span></label>
              <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-blue-400" />
            </div>
          </FormSection>
        ) : (
          <>
            <FormSection>
              <div className="px-5 py-4">
                <label className="mb-2 block text-sm font-semibold text-slate-900">{repeatSettingsEnabled && isClassBasedRecurring ? "初回課題提出日" : "締切"}</label>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                  <DatePickerField value={deadlineDate} onChange={updateDeadlineDate} min={todayDate} placeholder="締切日を選択" />
                  <input type="time" value={deadlineTime} onChange={(event) => updateDeadlineTime(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-base font-semibold text-slate-900 outline-none focus:border-blue-400" aria-label="締切時刻" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconRepeat size={16} stroke="#64748B" /> 繰り返し設定</div>
                  <p className="mt-0.5 text-xs text-slate-500">毎週・隔週などを設定</p>
                </div>
                <Toggle
                  checked={repeatSettingsEnabled}
                  label="繰り返し設定"
                  onClick={() => setRepeatSettingsEnabled((enabled) => {
                    const next = !enabled;
                    setRecurrence(next ? (recurrence === "none" ? "weekly" : recurrence) : "none");
                    return next;
                  })}
                />
              </div>
            </FormSection>
            {RepeatSettings}
          </>
        )}

        <FormSection>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconFlag size={16} stroke="#64748B" /> 最優先</div>
            <Toggle checked={priority} label="最優先" onClick={() => setPriority((value) => !value)} />
          </div>
        </FormSection>

        <FormSection>
          <button type="button" onClick={() => setShowNotes((value) => !value)} className="flex w-full items-center justify-between px-5 py-4 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconLink size={16} stroke="#64748B" /> 提出先URL・メモ</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-[#0B7DEE]">{showNotes ? "閉じる" : "追加"}<IconChevD size={14} style={{ transform: showNotes ? "rotate(180deg)" : undefined }} /></span>
          </button>
          {showNotes && (
            <div className="border-t border-slate-100 px-5 pb-5 pt-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">提出先URL</span>
                <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400" />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-semibold text-slate-900">メモ</span>
                <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="補足・提出条件・先生からの注意など" rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400" />
              </label>
            </div>
          )}
        </FormSection>

        {formError && <p className="mx-5 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{formError}</p>}
        {isEdit && <button type="button" onClick={() => onDelete(task!.parentId || task!.id)} className="mx-5 mt-6 text-sm font-semibold text-rose-600">この課題を削除</button>}
      </main>
    </div>
  );
}
