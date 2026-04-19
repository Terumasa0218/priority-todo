"use client";
import React, { useMemo, useState } from "react";
import { IconPencil } from "@/components/Icons";
import { Category, Task, TimetableConfig, TimetableItem } from "@/lib/types";
import { PALETTE } from "@/lib/constants";
import { uid } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
] as const;

interface TimetableViewProps {
  items: TimetableItem[];
  setItems: React.Dispatch<React.SetStateAction<TimetableItem[]>>;
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
  config: TimetableConfig;
  setConfig: React.Dispatch<React.SetStateAction<TimetableConfig>>;
  onShare: () => Promise<string | null>;
  tasks: Task[];
  cats: Category[];
}

interface EditingState {
  mode: "create" | "edit";
  item: TimetableItem;
}

const ON_DEMAND_PERIOD = 999;
const isOnDemandPeriod = (period: number) => period >= ON_DEMAND_PERIOD;
const getOnDemandSlotIndex = (period: number) => Math.max(0, period - ON_DEMAND_PERIOD);
const normalizePeriod = (period: number) => (period % 2 === 0 ? period - 1 : period);
const buildPeriods = (maxPeriod: number) => {
  const safeMax = Math.max(2, maxPeriod % 2 === 0 ? maxPeriod : maxPeriod + 1);
  return Array.from({ length: safeMax / 2 }, (_, idx) => {
    const start = idx * 2 + 1;
    return { value: start, label: `${start}・${start + 1}限` };
  });
};

// Backward-compatible alias for historical references.
const buildPeriodGroups = (maxPeriod: number) => buildPeriods(maxPeriod);

export default function TimetableView({ items, setItems, setCats, config, setConfig, onShare }: TimetableViewProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showError, setShowError] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const periodOptions = useMemo(() => buildPeriodGroups(config.maxPeriod), [config.maxPeriod]);
  const onDemandSlotsByDay = DAYS.map((_, idx) => {
    const value = Number(config.onDemandSlotsByDay?.[idx] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value))) : 0;
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableItem>();
    normalizedItems.forEach((it) => {
      if (isOnDemandPeriod(it.period)) return;
      if (it.day < 1 || it.day > 5) return;
      const normalized = normalizePeriod(it.period);
      const maxStart = Math.max(1, (Math.floor(config.maxPeriod / 2) * 2) - 1);
      if (normalized < 1 || normalized > maxStart) return;
      map.set(`${it.day}-${normalized}`, { ...it, period: normalized });
    });
    return map;
  }, [normalizedItems, periodOptions]);

  const onDemandMap = useMemo(() => {
    const map = new Map<number, TimetableItem[]>();
    items.filter((it) => isOnDemandPeriod(it.period)).forEach((it) => {
      if (it.day < 1 || it.day > 5) return;
      const list = map.get(it.day) ?? [];
      list.push(it);
      map.set(it.day, list);
    });
    map.forEach((list, day) => {
      map.set(day, list.sort((a, b) => getOnDemandSlotIndex(a.period) - getOnDemandSlotIndex(b.period)));
    });
    return map;
  }, [normalizedItems]);

  const onDemandItems = useMemo(() => normalizedItems.filter((it) => isOnDemandPeriod(it.period)), [normalizedItems]);
  const detailCourse = normalizedItems.find((it) => it.id === detailCourseId) || null;
  const updateDetail = (patch: Partial<TimetableItem>) => {
    if (!detailCourse) return;
    setItems((prev) => prev.map((it) => (it.id === detailCourse.id ? { ...it, ...patch } : it)));
  };

  const upsertCategoryByTimetable = (item: TimetableItem) => {
    setCats((prev) => {
      const idx = prev.findIndex((c) => c.timetableId === item.id);
      if (idx >= 0) return prev.map((c) => (c.timetableId === item.id ? { ...c, label: item.name, color: item.color } : c));
      return [...prev, { id: uid(), label: item.name, color: item.color, timetableId: item.id }];
    });
  };

  const removeCategoryByTimetable = (timetableId: string) => {
    setCats((prev) => prev.filter((c) => c.timetableId !== timetableId));
  };

  const openCreate = (day: number, period: string) => setEditing({ mode: "create", item: { id: uid(), name: "", day, period, teacher: "", room: "", color: PALETTE[4], absenceLimit: 5, attendanceAbsent: 0, attendanceLate: 0, attendancePresent: 0, memo: "" } });
  const openEdit = (item: TimetableItem) => setEditing({ mode: "edit", item: { ...item } });

  const handleSave = () => {
    if (!editing) return;
    if (!editing.item.name.trim()) return setShowError(true);
    const nextItem = { ...editing.item, name: editing.item.name.trim(), period: normalizePeriod(editing.item.period) };
    setItems((prev) => {
      const normalizedPrev = prev.map((it) => ({ ...it, period: normalizePeriod(it.period) }));
      return [...normalizedPrev.filter((it) => (it.id !== nextItem.id) && (isOnDemandPeriod(nextItem.period) || it.day !== nextItem.day || it.period !== nextItem.period)), nextItem];
    });
    upsertCategoryByTimetable(nextItem);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!editing || editing.mode !== "edit") return;
    setItems((prev) => prev.filter((it) => it.id !== editing.item.id));
    removeCategoryByTimetable(editing.item.id);
    setEditing(null);
  };

  const applyCustomize = (maxPeriodInput: number, showOnDemandInput: boolean, onDemandSlotsInput: number[]) => {
    const evenMax = Math.max(2, Math.min(20, maxPeriodInput % 2 === 0 ? maxPeriodInput : maxPeriodInput + 1));
    const nextOnDemandSlotsByDay = DAYS.map((_, idx) => {
      const value = Number(onDemandSlotsInput[idx] ?? 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value))) : 0;
    });
    setConfig({ maxPeriod: evenMax, showOnDemand: showOnDemandInput, onDemandSlotsByDay: nextOnDemandSlotsByDay });
    setItems((prev) => prev.filter((it) => {
      if (isOnDemandPeriod(it.period)) return it.day >= 1 && it.day <= 5;
      const normalized = normalizePeriod(it.period);
      return it.day >= 1 && it.day <= 5 && periodOptions.slice(0, evenMax / 2).some((option) => option.value === normalized);
    }));
    setShowCustomize(false);
  };

  const handleShare = async () => {
    setSharing(true);
    setShareMessage(null);
    try {
      const link = await onShare();
      if (!link) {
        setShareMessage("共有リンクを作成できませんでした");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setShareMessage("リンクをコピーしました");
      } else {
        window.prompt("このリンクをコピーしてください", link);
        setShareMessage("リンクを作成しました");
      }
    } catch {
      setShareMessage("共有リンクの作成に失敗しました");
    } finally {
      setSharing(false);
    }
  };

  const linkedTasks = detailCourse
    ? (() => { const cat = cats.find((c) => c.timetableId === detailCourse.id); return tasks.filter((t) => !t.completed && !!cat && t.category === cat.id).length; })()
    : 0;

  return (
    <div className="px-2 py-4">
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={handleShare} disabled={items.length === 0 || sharing} className="px-3 py-2 min-h-11 text-xs rounded-md hover:bg-gray-100">{sharing ? "共有中..." : "共有"}</button>
        <button onClick={() => setShowCustomize(true)} className="px-3 py-2 min-h-11 text-xs rounded-md hover:bg-gray-100"><IconPencil size={13} />カスタム</button>
      </div>
      {shareMessage && <p className="mb-2 text-xs text-gray-500 text-right">{shareMessage}</p>}

      <div className="border border-gray-300 rounded-xl overflow-hidden bg-white">
        <div className="grid" style={{ gridTemplateColumns: "62px repeat(5, minmax(0, 1fr))" }}>
          <div className="bg-gray-50 border-b border-r border-gray-300 h-11" />
          {DAYS.map((d) => <div key={d.value} className="h-11 border-b border-gray-300 text-center text-sm font-semibold text-gray-600 flex items-center justify-center bg-gray-50">{d.label}</div>)}
          {periodOptions.map((label) => (
            <React.Fragment key={label.value}>
              <div className="h-28 border-r border-b border-gray-300 flex items-center justify-center text-xs text-gray-600 bg-gray-50">{label.label}</div>
              {DAYS.map((d) => {
                const key = `${d.value}-${label.value}`;
                const item = cellMap.get(key);
                return item ? (
                  <button key={key} onClick={() => setDetailCourseId(item.id)} className="h-28 border-b border-gray-300 p-2 text-left" style={{ backgroundColor: `${item.color}20`, borderLeft: `4px solid ${item.color}` }}>
                    <div className="text-xs font-semibold line-clamp-3">{item.name}</div>
                    <div className="text-[11px] text-gray-600 mt-1 truncate">{item.room || "教室未設定"}</div>
                  </button>
                ) : <button key={key} onClick={() => openCreate(d.value, label.value)} className="h-28 border-b border-gray-300 text-gray-300 hover:bg-gray-50">＋</button>;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {config.showOnDemand && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">オンデマンド授業</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {onDemandItems.map((item) => (
              <button key={item.id} onClick={() => setDetailCourseId(item.id)} className="min-w-44 h-24 rounded-lg border p-3 text-left" style={{ backgroundColor: `${item.color}14`, borderColor: `${item.color}88` }}>
                <span className="block font-medium text-sm truncate">{item.name}</span>
                <span className="block text-xs text-gray-500 mt-1 truncate">{DAYS.find((d) => d.value === item.day)?.label}曜配信</span>
              </button>
            ))}
            <button onClick={() => openCreate(1, `オンデマンド${onDemandItems.length + 1}`)} className="min-w-24 h-24 rounded-lg border border-dashed text-gray-400">＋</button>
          </div>
        </div>
      )}

      {showCustomize && (
        <div className="fixed inset-0 z-50 bg-gray-50/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowCustomize(false)} className="text-sm text-blue-500 font-medium">キャンセル</button><span className="text-sm font-semibold">時間割のカスタム</span>
            <button onClick={() => {
              const periodInput = document.getElementById("max-period-input") as HTMLInputElement | null;
              const toggle = document.getElementById("ondemand-toggle") as HTMLInputElement | null;
              applyCustomize(Number(periodInput?.value || config.maxPeriod), !!toggle?.checked);
            }} className="text-sm font-semibold text-blue-500">保存</button>
          </div>
          <div className="mt-4 mx-4 bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <label className="block text-sm">最大時限<input id="max-period-input" type="number" min={2} max={18} step={2} defaultValue={config.maxPeriod} className="w-full mt-1 px-3 py-2 rounded-md border border-gray-200" /></label>
            <label className="flex items-center justify-between text-sm">オンデマンド表示<input id="ondemand-toggle" type="checkbox" defaultChecked={config.showOnDemand} /></label>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200"><button onClick={() => setEditing(null)} className="text-sm text-blue-500">キャンセル</button><span className="text-sm font-semibold">{editing.mode === "edit" ? "授業の編集" : "授業の追加"}</span><button onClick={handleSave} className="text-sm text-blue-500 font-semibold">保存</button></div>
          <div className="flex-1 overflow-y-auto mt-4 mx-4 bg-white rounded-xl border border-gray-100">
            <input type="text" value={editing.item.name} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, name: e.target.value } } : prev)} placeholder="授業名" className="w-full px-4 py-3 border-b" />
            {!isOnDemandPeriod(editing.item.period) && <div className="px-4 py-3 border-b flex items-center justify-between"><span className="text-sm">時限</span><select value={editing.item.period} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, period: e.target.value } } : prev)}>{periodOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>}
            <input type="text" value={editing.item.teacher} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, teacher: e.target.value } } : prev)} placeholder="教員名" className="w-full px-4 py-3 border-b" />
            <input type="text" value={editing.item.room} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, room: e.target.value } } : prev)} placeholder="教室" className="w-full px-4 py-3 border-b" />
          </div>
          {editing.mode === "edit" && <div className="px-4 py-3 bg-white border-t"><button onClick={handleDelete} className="text-sm text-red-500">削除</button></div>}
          {showError && <p className="px-4 py-2 text-xs text-red-500">授業名を入力してください</p>}
        </div>
      )}

      {detailCourse && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b"><button onClick={() => setDetailCourseId(null)} className="text-sm text-blue-500">戻る</button><span className="text-sm font-semibold">授業詳細</span><button onClick={() => openEdit(detailCourse)} className="text-sm text-blue-500">編集</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-white rounded-xl border p-4 text-sm space-y-1"><div className="font-semibold">{detailCourse.name}</div><div>教室: {detailCourse.room || "未設定"}</div><div>教員: {detailCourse.teacher || "未設定"}</div></div>
            <div className="bg-white rounded-xl border p-4 text-sm space-y-2">
              <div className="font-semibold">出欠</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(["attendancePresent", "attendanceAbsent", "attendanceLate"] as const).map((k, i) => <button key={k} onClick={() => updateDetail({ [k]: (detailCourse[k] || 0) + 1 })} className="border rounded-lg py-2">{["出席", "欠席", "遅刻"][i]} +<div>{detailCourse[k] || 0}</div></button>)}
              </div>
              <label className="text-xs block">欠席上限<input type="number" min={1} max={30} value={detailCourse.absenceLimit ?? 5} onChange={(e) => updateDetail({ absenceLimit: Number(e.target.value || 5) })} className="w-full mt-1 border rounded px-2 py-1" /></label>
              <div className="text-xs text-gray-500">あと{Math.max((detailCourse.absenceLimit ?? 5) - (detailCourse.attendanceAbsent ?? 0), 0)}回休める</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-sm">
              <div className="font-semibold mb-2">この授業の未完了タスク</div>
              <div className="text-xs text-gray-500">カテゴリ連携済みタスク: {linkedTasks}件</div>
            </div>
            <div className="bg-white rounded-xl border p-4 text-sm"><div className="font-semibold mb-2">メモ</div><textarea value={detailCourse.memo || ""} onChange={(e) => updateDetail({ memo: e.target.value })} rows={4} className="w-full border rounded p-2" /></div>
          </div>
        </div>
      )}
    </div>
  );
}
