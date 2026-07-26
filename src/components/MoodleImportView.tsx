"use client";
import React, { useEffect, useMemo, useState } from "react";
import DatePickerField from "@/components/DatePickerField";
import { getMoodleImportStatus, MoodleImportCandidate, MoodleImportStatus, parseMoodleIcs } from "@/lib/moodleIcs";
import {
  clearMoodleCalendarUrlSettings,
  fetchMoodleCalendar,
  loadMoodleCalendarUrlSettings,
  MoodleCalendarUrlSettings,
  normalizeMoodleCalendarUrl,
  saveMoodleCalendarUrlSettings,
} from "@/lib/moodleCalendarUrl";
import { Category, Task, TimetableItem } from "@/lib/types";

interface MoodleImportViewProps {
  tasks: Task[];
  cats: Category[];
  timetable: TimetableItem[];
  onImport: (candidates: MoodleImportCandidate[]) => void;
}

const KIND_LABEL: Record<MoodleImportCandidate["kind"], string> = {
  assignment: "課題",
  quiz: "小テスト",
  survey: "アンケート",
  other: "その他",
};

const STATUS_LABEL: Record<MoodleImportStatus, string> = {
  new: "新規",
  update: "更新あり",
  unchanged: "変更なし",
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toLocalTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "23:59";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const composeLocalIso = (date: string, time: string) => `${date}T${time || "23:59"}:00`;

const formatDeadline = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const formatSyncTime = (iso: string | null) => {
  if (!iso) return "まだ同期していません";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "まだ同期していません";
  return `最終同期: ${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const getEmptyImportMessage = (ics: string) =>
  /BEGIN:VEVENT\s*/i.test(ics)
    ? "予定は見つかりましたが、課題候補として取り込めませんでした"
    : "予定が入っていないカレンダーファイルです";

export default function MoodleImportView({ tasks, cats, timetable, onImport }: MoodleImportViewProps) {
  const [fileName, setFileName] = useState("");
  const [candidates, setCandidates] = useState<MoodleImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [urlSettings, setUrlSettings] = useState<MoodleCalendarUrlSettings | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUrlSettings, setShowUrlSettings] = useState(false);
  const [expandedCandidateUid, setExpandedCandidateUid] = useState<string | null>(null);

  useEffect(() => {
    const settings = loadMoodleCalendarUrlSettings();
    setCalendarUrl(settings.url);
    setUrlSettings(settings);
  }, []);

  const existingByUid = useMemo(
    () => {
      const map = new Map<string, Task>();
      for (const task of tasks) {
        if (task.moodleUid) map.set(task.moodleUid, task);
      }
      return map;
    },
    [tasks]
  );
  const categoryById = useMemo(() => new Map(cats.map((cat) => [cat.id, cat])), [cats]);
  const candidateStatuses = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.uid, getMoodleImportStatus(candidate, existingByUid.get(candidate.uid))])),
    [candidates, existingByUid]
  );
  const actionableCandidates = candidates.filter((candidate) => candidateStatuses.get(candidate.uid) !== "unchanged");
  const selectedCandidates = actionableCandidates.filter((candidate) => selected.has(candidate.uid));
  const invalidSelectedCount = selectedCandidates.filter((candidate) => !candidate.title.trim() || !toLocalDate(candidate.deadline)).length;
  const canImport = selectedCandidates.length > 0 && invalidSelectedCount === 0;
  const stats = useMemo(() => {
    const newCount = candidates.filter((candidate) => candidateStatuses.get(candidate.uid) === "new").length;
    const updateCount = candidates.filter((candidate) => candidateStatuses.get(candidate.uid) === "update").length;
    const unchangedCount = candidates.filter((candidate) => candidateStatuses.get(candidate.uid) === "unchanged").length;
    const unlinkedCodeCount = candidates.filter((candidate) => candidate.timetableCode && !candidate.categoryId).length;
    return { newCount, updateCount, unchangedCount, unlinkedCodeCount };
  }, [candidates, candidateStatuses]);

  const setParsedCandidates = (ics: string) => {
    const parsed = parseMoodleIcs(ics, timetable, cats);
    setCandidates(parsed);
    setSelected(new Set(parsed.filter((candidate) => {
      const status = getMoodleImportStatus(candidate, existingByUid.get(candidate.uid));
      return status !== "unchanged" && (candidate.includeByDefault || status === "update");
    }).map((candidate) => candidate.uid)));
    return parsed;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = setParsedCandidates(text);
      setMessage(parsed.length > 0 ? `${parsed.length}件の予定を読み込みました` : getEmptyImportMessage(text));
    } catch {
      setCandidates([]);
      setSelected(new Set());
      setMessage("読み込みに失敗しました。Moodleカレンダーの .ics ファイルか確認してください。");
    }
  };

  const saveCalendarUrl = () => {
    try {
      const url = normalizeMoodleCalendarUrl(calendarUrl);
      const next = { url, lastSyncedAt: urlSettings?.lastSyncedAt || null };
      saveMoodleCalendarUrlSettings(next);
      setCalendarUrl(url);
      setUrlSettings(next);
      setShowUrlSettings(false);
      setMessage("MoodleカレンダーURLをこの端末に保存しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "URLを保存できませんでした");
    }
  };

  const syncFromCalendarUrl = async () => {
    try {
      const url = normalizeMoodleCalendarUrl(calendarUrl);
      const saved = { url, lastSyncedAt: urlSettings?.lastSyncedAt || null };
      saveMoodleCalendarUrlSettings(saved);
      setCalendarUrl(url);
      setUrlSettings(saved);
      setIsSyncing(true);
      setMessage(null);
      const text = await fetchMoodleCalendar(url);
      const parsed = setParsedCandidates(text);
      const next = { url, lastSyncedAt: new Date().toISOString() };
      saveMoodleCalendarUrlSettings(next);
      setUrlSettings(next);
      setFileName("MoodleカレンダーURL");
      setMessage(parsed.length > 0 ? `URLから${parsed.length}件の予定を読み込みました` : getEmptyImportMessage(text));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "URL同期に失敗しました");
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCalendarUrl = () => {
    clearMoodleCalendarUrlSettings();
    setCalendarUrl("");
    setUrlSettings({ url: "", lastSyncedAt: null });
    setMessage("この端末に保存したMoodleカレンダーURLを削除しました");
  };

  const updateCandidate = (uid: string, patch: Partial<MoodleImportCandidate>) => {
    setCandidates((prev) => prev.map((candidate) => (candidate.uid === uid ? { ...candidate, ...patch } : candidate)));
  };

  const updateDeadlineDate = (candidate: MoodleImportCandidate, date: string) => {
    updateCandidate(candidate.uid, { deadline: composeLocalIso(date, toLocalTime(candidate.deadline)) });
  };

  const updateDeadlineTime = (candidate: MoodleImportCandidate, time: string) => {
    const date = toLocalDate(candidate.deadline);
    if (!date) return;
    updateCandidate(candidate.uid, { deadline: composeLocalIso(date, time) });
  };

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const importSelected = () => {
    if (selectedCandidates.length === 0) {
      setMessage("取り込む課題を選択してください");
      return;
    }
    if (invalidSelectedCount > 0) {
      setMessage("選択中の候補に、課題名または締切が未入力のものがあります");
      return;
    }
    onImport(selectedCandidates);
    setCandidates((prev) => prev.filter((candidate) => !selected.has(candidate.uid)));
    setSelected(new Set());
    const addCount = selectedCandidates.filter((candidate) => candidateStatuses.get(candidate.uid) === "new").length;
    const updateCount = selectedCandidates.filter((candidate) => candidateStatuses.get(candidate.uid) === "update").length;
    const parts = [
      addCount > 0 ? `${addCount}件を追加` : "",
      updateCount > 0 ? `${updateCount}件を更新` : "",
    ].filter(Boolean);
    setMessage(parts.length > 0 ? `${parts.join("、")}しました` : "反映する変更はありません");
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="px-4 pb-2 pt-4">
            <h2 className="text-base font-black text-slate-950">Moodle連携</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">カレンダーから課題候補を読み込み、追加・更新を反映します。</p>
          </div>
          <span className="mr-4 mt-4 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">β</span>
        </div>
        <div className="border-t border-slate-100 px-4 py-4">
          {urlSettings?.url && !showUrlSettings ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">カレンダーURLを保存済み</p>
                  <p className="mt-1 text-xs text-slate-500">{formatSyncTime(urlSettings.lastSyncedAt)}</p>
                </div>
                <button type="button" onClick={() => void syncFromCalendarUrl()} disabled={isSyncing} className="shrink-0 rounded-full bg-[#0B7DEE] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isSyncing ? "同期中..." : "今すぐ同期"}</button>
              </div>
              <button type="button" onClick={() => setShowUrlSettings(true)} className="mt-3 text-xs font-semibold text-[#0B7DEE]">URLを変更</button>
            </div>
          ) : (
            <div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">MoodleカレンダーURL</span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={calendarUrl}
                  onChange={(event) => setCalendarUrl(event.target.value)}
                  placeholder="https://..."
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-blue-300"
                />
              </label>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">URLはこの端末だけに保存します。カレンダーを読み取る情報を含むため、他人に共有しないでください。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={saveCalendarUrl} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">URLを保存</button>
                <button type="button" onClick={() => void syncFromCalendarUrl()} disabled={!calendarUrl.trim() || isSyncing} className="rounded-full bg-[#0B7DEE] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isSyncing ? "同期中..." : "保存して同期"}</button>
                {urlSettings?.url && <button type="button" onClick={() => { clearCalendarUrl(); setShowUrlSettings(false); }} className="rounded-full px-3 py-2 text-xs font-bold text-slate-500">URLを削除</button>}
              </div>
            </div>
          )}
          {message && <p className="mt-3 text-xs font-medium text-slate-600">{message}</p>}
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-left">
            <span><span className="block text-sm font-semibold text-slate-900">.icsファイルから取り込む</span><span className="mt-0.5 block text-xs text-slate-500">URL同期できない場合はこちらを使います</span></span>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">選択</span>
            <input type="file" accept=".ics,text/calendar" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
          </label>
          {fileName && <p className="mt-2 text-[11px] text-slate-400">選択中: {fileName}</p>}
          {!message && urlSettings?.url && <p className="mt-2 text-[11px] text-slate-400">{formatSyncTime(urlSettings.lastSyncedAt)}</p>}
        </div>
      </section>

      {candidates.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">取り込み候補</h3>
              <p className="text-[11px] text-slate-400">新規・更新を {selectedCandidates.length}/{actionableCandidates.length} 件選択中</p>
            </div>
            <button onClick={importSelected} className="rounded-full bg-[#007AFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={!canImport}>反映</button>
          </div>
          <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-4 py-3 text-center">
            <div className="rounded-2xl bg-blue-50 px-2 py-2">
              <div className="text-sm font-black text-blue-600">{stats.newCount}</div>
              <div className="text-[10px] font-bold text-blue-500">新規</div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-2 py-2">
              <div className="text-sm font-black text-amber-600">{stats.updateCount}</div>
              <div className="text-[10px] font-bold text-amber-500">更新あり</div>
            </div>
            <div className="rounded-2xl bg-slate-100 px-2 py-2">
              <div className="text-sm font-black text-slate-500">{stats.unchangedCount}</div>
              <div className="text-[10px] font-bold text-slate-500">変更なし</div>
            </div>
            <div className="rounded-2xl bg-rose-50 px-2 py-2">
              <div className="text-sm font-black text-rose-600">{stats.unlinkedCodeCount}</div>
              <div className="text-[10px] font-bold text-rose-500">未紐付け</div>
            </div>
          </div>
          <div className="space-y-3 bg-slate-50/70 p-3">
            {candidates.map((candidate) => {
              const status = candidateStatuses.get(candidate.uid) || "new";
              const readonly = status === "unchanged";
              const cat = candidate.categoryId ? categoryById.get(candidate.categoryId) : null;
              const checked = selected.has(candidate.uid) && !readonly;
              const dateValue = toLocalDate(candidate.deadline);
              const timeValue = toLocalTime(candidate.deadline);
              const expanded = expandedCandidateUid === candidate.uid;
              return (
                <article
                  key={candidate.uid}
                  className={`rounded-[22px] border border-white/90 bg-white p-3 shadow-[0_10px_24px_rgba(27,39,75,0.06)] ${readonly ? "opacity-65" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => !readonly && toggle(candidate.uid)}
                      disabled={readonly}
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent"} ${readonly ? "cursor-not-allowed" : "active:scale-95"}`}
                      aria-label={checked ? "取り込み対象から外す" : "取り込み対象にする"}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{KIND_LABEL[candidate.kind]}</span>
                        {status === "new" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">{STATUS_LABEL[status]}</span>}
                        {status === "update" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">{STATUS_LABEL[status]}</span>}
                        {status === "unchanged" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{STATUS_LABEL[status]}</span>}
                        {cat && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: cat.color }}>自動分類: {cat.label}</span>}
                        {!cat && candidate.timetableCode && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">未紐付け {candidate.timetableCode}</span>}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{candidate.title || "課題名未入力"}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDeadline(candidate.deadline)} / 最も早い締切候補を採用</p>
                    </div>
                  </div>
                  {!readonly && <button type="button" onClick={() => setExpandedCandidateUid((value) => value === candidate.uid ? null : candidate.uid)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#0B7DEE]">{expanded ? "編集を閉じる" : "内容を編集"}</button>}
                  {expanded && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">課題名</span>
                      <input
                        value={candidate.title}
                        onChange={(event) => updateCandidate(candidate.uid, { title: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                        disabled={readonly}
                      />
                    </label>
                    <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                      <label className="block min-w-0">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">締切日</span>
                        {readonly ? (
                          <div className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-500">{dateValue}</div>
                        ) : (
                          <DatePickerField value={dateValue} onChange={(date) => updateDeadlineDate(candidate, date)} className="rounded-2xl" />
                        )}
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">時刻</span>
                        <input
                          type="time"
                          value={timeValue}
                          onChange={(event) => updateDeadlineTime(candidate, event.target.value)}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                          disabled={readonly}
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">授業・カテゴリ</span>
                      <select
                        value={candidate.categoryId || ""}
                        onChange={(event) => updateCandidate(candidate.uid, { categoryId: event.target.value || null })}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                        disabled={readonly}
                      >
                        <option value="">未分類</option>
                        {cats.map((category) => (
                          <option key={category.id} value={category.id}>{category.label}</option>
                        ))}
                      </select>
                      {candidate.timetableCode && (
                        <span className="mt-1 block text-[10px] font-medium text-slate-400">
                          Moodle CATEGORIES コード: {candidate.timetableCode}{cat ? ` / ${cat.label} に一致` : " / コード未設定の授業なら次回から自動分類します"}
                        </span>
                      )}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">提出先URL</span>
                      <input
                        value={candidate.url}
                        onChange={(event) => updateCandidate(candidate.uid, { url: event.target.value })}
                        placeholder="https://..."
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-300"
                        disabled={readonly}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">メモ</span>
                      <textarea
                        value={candidate.description}
                        onChange={(event) => updateCandidate(candidate.uid, { description: event.target.value })}
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300"
                        disabled={readonly}
                      />
                    </label>
                  </div>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
