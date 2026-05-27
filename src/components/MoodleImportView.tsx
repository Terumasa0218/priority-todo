"use client";
import React, { useMemo, useState } from "react";
import DatePickerField from "@/components/DatePickerField";
import { MoodleImportCandidate, parseMoodleIcs } from "@/lib/moodleIcs";
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

export default function MoodleImportView({ tasks, cats, timetable, onImport }: MoodleImportViewProps) {
  const [fileName, setFileName] = useState("");
  const [candidates, setCandidates] = useState<MoodleImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const existingUids = useMemo(
    () => new Set(tasks.map((task) => task.moodleUid).filter((uid): uid is string => !!uid)),
    [tasks]
  );
  const categoryById = useMemo(() => new Map(cats.map((cat) => [cat.id, cat])), [cats]);
  const newCandidates = candidates.filter((candidate) => !existingUids.has(candidate.uid));
  const selectedCandidates = newCandidates.filter((candidate) => selected.has(candidate.uid));
  const invalidSelectedCount = selectedCandidates.filter((candidate) => !candidate.title.trim() || !toLocalDate(candidate.deadline)).length;
  const canImport = selectedCandidates.length > 0 && invalidSelectedCount === 0;
  const stats = useMemo(() => {
    const duplicateCount = candidates.filter((candidate) => existingUids.has(candidate.uid)).length;
    const autoLinkedCount = candidates.filter((candidate) => candidate.timetableCode && candidate.categoryId).length;
    const unlinkedCodeCount = candidates.filter((candidate) => candidate.timetableCode && !candidate.categoryId).length;
    return { duplicateCount, autoLinkedCount, unlinkedCodeCount };
  }, [candidates, existingUids]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = parseMoodleIcs(text, timetable, cats);
      setCandidates(parsed);
      setSelected(new Set(parsed.filter((candidate) => candidate.includeByDefault && !existingUids.has(candidate.uid)).map((candidate) => candidate.uid)));
      setMessage(parsed.length > 0 ? `${parsed.length}件の予定を読み込みました` : "VEVENTが見つかりませんでした");
    } catch (error) {
      console.error("Moodle ICS parse failed:", error);
      setCandidates([]);
      setSelected(new Set());
      setMessage("読み込みに失敗しました。Moodleカレンダーの .ics ファイルか確認してください。");
    }
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
    setMessage(`${selectedCandidates.length}件を課題として追加しました`);
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="rounded-[28px] border border-white/80 bg-white p-4 shadow-[0_18px_48px_rgba(27,39,75,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">Moodle ICS取り込み</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Moodleカレンダーから書き出した .ics ファイルを読み込み、課題候補だけを選んで追加します。</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">β</span>
        </div>
        <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-5 text-center active:scale-[0.99] transition-transform">
          <span className="text-sm font-bold text-blue-600">.icsファイルを選択</span>
          <span className="mt-1 text-[11px] text-slate-500">URL同期ではなく、まずは安全なファイル取り込みだけ対応しています</span>
          <input type="file" accept=".ics,text/calendar" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} />
        </label>
        {fileName && <p className="mt-2 text-[11px] text-slate-400">選択中: {fileName}</p>}
        {message && <p className="mt-2 text-xs font-medium text-slate-600">{message}</p>}
      </section>

      {candidates.length > 0 && (
        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">取り込み候補</h3>
              <p className="text-[11px] text-slate-400">重複済みを除き {selectedCandidates.length}/{newCandidates.length} 件選択中</p>
            </div>
            <button onClick={importSelected} className="rounded-full bg-[#007AFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={!canImport}>追加</button>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 px-4 py-3 text-center">
            <div className="rounded-2xl bg-blue-50 px-2 py-2">
              <div className="text-sm font-black text-blue-600">{stats.autoLinkedCount}</div>
              <div className="text-[10px] font-bold text-blue-500">自動紐付け</div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-2 py-2">
              <div className="text-sm font-black text-amber-600">{stats.duplicateCount}</div>
              <div className="text-[10px] font-bold text-amber-500">取り込み済み</div>
            </div>
            <div className="rounded-2xl bg-rose-50 px-2 py-2">
              <div className="text-sm font-black text-rose-600">{stats.unlinkedCodeCount}</div>
              <div className="text-[10px] font-bold text-rose-500">未紐付け</div>
            </div>
          </div>
          <div className="space-y-3 bg-slate-50/70 p-3">
            {candidates.map((candidate) => {
              const duplicate = existingUids.has(candidate.uid);
              const cat = candidate.categoryId ? categoryById.get(candidate.categoryId) : null;
              const checked = selected.has(candidate.uid) && !duplicate;
              const dateValue = toLocalDate(candidate.deadline);
              const timeValue = toLocalTime(candidate.deadline);
              return (
                <article
                  key={candidate.uid}
                  className={`rounded-[22px] border border-white/90 bg-white p-3 shadow-[0_10px_24px_rgba(27,39,75,0.06)] ${duplicate ? "opacity-65" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => !duplicate && toggle(candidate.uid)}
                      disabled={duplicate}
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent"} ${duplicate ? "cursor-not-allowed" : "active:scale-95"}`}
                      aria-label={checked ? "取り込み対象から外す" : "取り込み対象にする"}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{KIND_LABEL[candidate.kind]}</span>
                        {duplicate && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">取り込み済み</span>}
                        {cat && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: cat.color }}>自動分類: {cat.label}</span>}
                        {!cat && candidate.timetableCode && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">未紐付け {candidate.timetableCode}</span>}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">締切候補から最も早い日時を採用: {formatDeadline(candidate.deadline)}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">課題名</span>
                      <input
                        value={candidate.title}
                        onChange={(event) => updateCandidate(candidate.uid, { title: event.target.value })}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                        disabled={duplicate}
                      />
                    </label>
                    <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                      <label className="block min-w-0">
                        <span className="mb-1 block text-[11px] font-bold text-slate-500">締切日</span>
                        {duplicate ? (
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
                          disabled={duplicate}
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">授業・カテゴリ</span>
                      <select
                        value={candidate.categoryId || ""}
                        onChange={(event) => updateCandidate(candidate.uid, { categoryId: event.target.value || null })}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-300"
                        disabled={duplicate}
                      >
                        <option value="">未分類</option>
                        {cats.map((category) => (
                          <option key={category.id} value={category.id}>{category.label}</option>
                        ))}
                      </select>
                      {candidate.timetableCode && (
                        <span className="mt-1 block text-[10px] font-medium text-slate-400">
                          Moodle CATEGORIES コード: {candidate.timetableCode}{cat ? ` / ${cat.label} に一致` : " / 未登録のため手動選択できます"}
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
                        disabled={duplicate}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-slate-500">メモ</span>
                      <textarea
                        value={candidate.description}
                        onChange={(event) => updateCandidate(candidate.uid, { description: event.target.value })}
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-300"
                        disabled={duplicate}
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
