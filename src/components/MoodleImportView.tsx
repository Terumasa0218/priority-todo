"use client";
import React, { useMemo, useState } from "react";
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

const formatDeadline = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function MoodleImportView({ tasks, cats, timetable, onImport }: MoodleImportViewProps) {
  const [fileName, setFileName] = useState("");
  const [candidates, setCandidates] = useState<MoodleImportCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const existingUids = useMemo(() => new Set(tasks.map((task) => task.moodleUid).filter(Boolean)), [tasks]);
  const categoryById = useMemo(() => new Map(cats.map((cat) => [cat.id, cat])), [cats]);
  const newCandidates = candidates.filter((candidate) => !existingUids.has(candidate.uid));
  const selectedCandidates = newCandidates.filter((candidate) => selected.has(candidate.uid));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = parseMoodleIcs(text, timetable, cats);
      setCandidates(parsed);
      setSelected(new Set(parsed.filter((candidate) => candidate.includeByDefault).map((candidate) => candidate.uid)));
      setMessage(parsed.length > 0 ? `${parsed.length}件の予定を読み込みました` : "VEVENTが見つかりませんでした");
    } catch (error) {
      console.error("Moodle ICS parse failed:", error);
      setCandidates([]);
      setSelected(new Set());
      setMessage("読み込みに失敗しました。Moodleカレンダーの .ics ファイルか確認してください。");
    }
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
        <section className="rounded-[28px] border border-white/80 bg-white shadow-[0_18px_48px_rgba(27,39,75,0.08)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">取り込み候補</h3>
              <p className="text-[11px] text-slate-400">重複済みを除き {selectedCandidates.length}/{newCandidates.length} 件選択中</p>
            </div>
            <button onClick={importSelected} className="rounded-full bg-[#007AFF] px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={selectedCandidates.length === 0}>追加</button>
          </div>
          <div className="divide-y divide-slate-100">
            {candidates.map((candidate) => {
              const duplicate = existingUids.has(candidate.uid);
              const cat = candidate.categoryId ? categoryById.get(candidate.categoryId) : null;
              const checked = selected.has(candidate.uid) && !duplicate;
              return (
                <button
                  key={candidate.uid}
                  type="button"
                  onClick={() => !duplicate && toggle(candidate.uid)}
                  disabled={duplicate}
                  className={`w-full px-4 py-3 text-left transition-colors ${duplicate ? "bg-slate-50 opacity-60" : "active:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold ${checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{KIND_LABEL[candidate.kind]}</span>
                        {duplicate && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">取り込み済み</span>}
                        {cat && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: cat.color }}>{cat.label}</span>}
                        {!cat && candidate.timetableCode && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">未紐付け {candidate.timetableCode}</span>}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-slate-900">{candidate.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">締切 {formatDeadline(candidate.deadline)}</p>
                      {candidate.url && <p className="mt-0.5 truncate text-[11px] text-blue-500">{candidate.url}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
