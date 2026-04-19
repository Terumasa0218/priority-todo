"use client";
import React, { useMemo, useState } from "react";
import { IconPencil } from "@/components/Icons";
import { Category, TimetableConfig, TimetableItem } from "@/lib/types";
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
}

interface EditingState {
  mode: "create" | "edit";
  item: TimetableItem;
}

const ON_DEMAND_PERIOD = 999;
const isOnDemandPeriod = (period: number) => period >= ON_DEMAND_PERIOD;
const getOnDemandSlotIndex = (period: number) => Math.max(0, period - ON_DEMAND_PERIOD);
const normalizePeriod = (period: number) => Math.max(1, Math.floor(period));
const buildPeriods = (maxPeriod: number) => {
  const safeMax = Math.max(6, Math.floor(maxPeriod));
  return Array.from({ length: Math.min(6, safeMax) }, (_, idx) => {
    const period = idx + 1;
    return { value: period, label: `${period}限` };
  });
};

export default function TimetableView({ items, setItems, setCats, config, setConfig, onShare }: TimetableViewProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showError, setShowError] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const periodOptions = useMemo(() => buildPeriods(config.maxPeriod), [config.maxPeriod]);
  const onDemandSlotsByDay = DAYS.map((_, idx) => {
    const value = Number(config.onDemandSlotsByDay?.[idx] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value))) : 0;
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableItem>();
    items.forEach((it) => {
      if (isOnDemandPeriod(it.period)) return;
      if (it.day < 1 || it.day > 5) return;
      const normalized = normalizePeriod(it.period);
      const maxStart = 6;
      if (normalized < 1 || normalized > maxStart) return;
      map.set(`${it.day}-${normalized}`, { ...it, period: normalized });
    });
    return map;
  }, [items, config.maxPeriod]);

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
  }, [items]);

  const getNextOnDemandPeriod = (day: number) => {
    const dayItems = onDemandMap.get(day) ?? [];
    const nextIdx = dayItems.length === 0 ? 0 : Math.max(...dayItems.map((it) => getOnDemandSlotIndex(it.period))) + 1;
    return ON_DEMAND_PERIOD + nextIdx;
  };

  const openCreate = (day: number, period: number) => {
    setEditing({
      mode: "create",
      item: {
        id: uid(),
        name: "",
        day,
        period,
        teacher: "",
        room: "",
        color: PALETTE[4],
      },
    });
    setShowError(false);
  };

  const openEdit = (item: TimetableItem) => {
    setEditing({ mode: "edit", item: { ...item, period: isOnDemandPeriod(item.period) ? item.period : normalizePeriod(item.period) } });
    setShowError(false);
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

  const handleSave = () => {
    if (!editing) return;
    if (!editing.item.name.trim()) {
      setShowError(true);
      return;
    }

    const nextItem = {
      ...editing.item,
      period: isOnDemandPeriod(editing.item.period) ? editing.item.period : normalizePeriod(editing.item.period),
      name: editing.item.name.trim(),
    };

    setItems((prev) => {
      const filtered = prev.filter((it) => {
        if (it.id === nextItem.id) return false;
        if (isOnDemandPeriod(nextItem.period)) return true;
        return !(it.day === nextItem.day && !isOnDemandPeriod(it.period) && normalizePeriod(it.period) === nextItem.period);
      });
      return [...filtered, nextItem];
    });

    upsertCategoryByTimetable(nextItem);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!editing || editing.mode !== "edit") return;
    const id = editing.item.id;
    setItems((prev) => prev.filter((it) => it.id !== id));
    removeCategoryByTimetable(id);
    setEditing(null);
  };

  const applyCustomize = (maxPeriodInput: number, showOnDemandInput: boolean, onDemandSlotsInput: number[]) => {
    const evenMax = 6;
    const nextOnDemandSlotsByDay = DAYS.map((_, idx) => {
      const value = Number(onDemandSlotsInput[idx] ?? 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value))) : 0;
    });
    setConfig({ maxPeriod: evenMax, showOnDemand: showOnDemandInput, onDemandSlotsByDay: nextOnDemandSlotsByDay });
    setItems((prev) => prev.filter((it) => {
      if (isOnDemandPeriod(it.period)) return it.day >= 1 && it.day <= 5;
      return it.day >= 1 && it.day <= 5 && normalizePeriod(it.period) <= evenMax - 1;
    }));
    setShowCustomize(false);
  };

  const handleShare = async () => {
    setSharing(true);
    setShareMessage(null);
    try {
      const link = await onShare();
      if (!link) {
        setShareMessage("共有リンクを生成リンクを作成できませんでした");
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

  return (
    <div className="px-2 py-4">
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={handleShare} disabled={sharing || items.length === 0} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          共有
        </button>
        <button onClick={() => setShowCustomize(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">
          <IconPencil size={13} />カスタム
        </button>
      </div>
      {shareMessage && <div className="mb-2 text-[11px] text-right text-gray-500">{shareMessage}</div>}

      <div className="border border-gray-300 rounded-xl overflow-hidden bg-white">
        <div className="grid" style={{ gridTemplateColumns: "50px repeat(5, minmax(0, 1fr))" }}>
          <div className="bg-gray-50 border-b border-r border-gray-300 h-9" />
          {DAYS.map((d) => (
            <div key={d.value} className="h-9 border-b border-gray-300 text-center text-xs font-semibold text-gray-600 flex items-center justify-center bg-gray-50">{d.label}</div>
          ))}

          {periodOptions.map((slot) => (
            <React.Fragment key={slot.value}>
              <div className="h-20 border-r border-b border-gray-300 flex items-center justify-center text-[11px] text-gray-500 bg-gray-50">{slot.label}</div>
              {DAYS.map((d) => {
                const key = `${d.value}-${slot.value}`;
                const item = cellMap.get(key);
                if (!item) {
                  return <button key={key} onClick={() => openCreate(d.value, slot.value)} className="h-20 border-b border-gray-300 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors">＋</button>;
                }
                return (
                  <button key={key} onClick={() => openEdit(item)} className="h-20 border-b border-gray-300 p-1.5 text-left transition-colors hover:brightness-95" style={{ backgroundColor: `${item.color}20`, borderLeft: `3px solid ${item.color}` }}>
                    <div className="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-3">{item.name}</div>
                    <div className="text-[10px] text-gray-500 truncate mt-1">{item.room || "教室未設定"}</div>
                  </button>
                );
              })}
            </React.Fragment>
          ))}

          {config.showOnDemand && (
            <>
              <div className="min-h-20 border-r border-b border-gray-300 flex items-center justify-center text-xs text-gray-500 bg-gray-50 font-medium px-2">オンデマンド</div>
              {DAYS.map((d, idx) => {
                const minimumSlots = onDemandSlotsByDay[idx];
                const dayItems = onDemandMap.get(d.value) ?? [];
                const slotCount = Math.max(minimumSlots, dayItems.length);
                return (
                  <div key={d.value} className="min-h-20 border-b border-gray-300 p-1.5">
                    <div className="space-y-1">
                      {Array.from({ length: slotCount }, (_, slotIdx) => {
                        const item = dayItems.find((it) => getOnDemandSlotIndex(it.period) === slotIdx) ?? null;
                        return (
                          <button
                            key={`${d.value}-${slotIdx}`}
                            onClick={() => (item ? openEdit(item) : openCreate(d.value, ON_DEMAND_PERIOD + slotIdx))}
                            className={`w-full h-11 rounded-md border text-[11px] px-2 text-left transition-colors ${item ? "hover:brightness-95" : "border-dashed border-gray-300 text-gray-400 hover:bg-gray-50"}`}
                            style={item ? { backgroundColor: `${item.color}18`, borderColor: `${item.color}88` } : undefined}
                          >
                            <span className="block text-[10px] text-gray-500 mb-0.5">{d.label}曜 {slotIdx + 1}</span>
                            <span className="block truncate">{item ? item.name : "未設定"}</span>
                          </button>
                        );
                      })}
                      <button onClick={() => openCreate(d.value, getNextOnDemandPeriod(d.value))} className="w-full h-8 rounded-md border border-dashed border-gray-300 text-[11px] text-gray-400 hover:bg-gray-50 transition-colors">＋追加</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {config.showOnDemand && (
        <div className="mt-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">オンデマンド授業</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            {DAYS.map((d) => {
              const dayItems = onDemandMap.get(d.value) ?? [];
              return (
                <div key={d.value} className="space-y-2">
                  {dayItems.length === 0 ? (
                    <div className="h-14 rounded-md border border-gray-200 bg-gray-50 text-[10px] text-gray-300 flex items-center justify-center">-</div>
                  ) : (
                    dayItems.map((item, idx) => (
                      <button key={item.id} onClick={() => openEdit(item)} className="w-full rounded-md border px-2 py-2 text-left text-[11px] hover:brightness-95 transition-colors" style={{ backgroundColor: `${item.color}14`, borderColor: `${item.color}88` }}>
                        <span className="block text-[10px] text-gray-500">{d.label}曜配信 {idx + 1}</span>
                        <span className="block font-medium text-gray-800 truncate">{item.name}</span>
                      </button>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCustomize && (
        <div className="fixed inset-0 z-50 bg-gray-50/95 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setShowCustomize(false)} className="text-sm text-blue-500 font-medium">キャンセル</button>
            <span className="text-sm font-semibold text-gray-900">時間割のカスタム</span>
            <button
              onClick={() => {
                const periodInput = document.getElementById("max-period-input") as HTMLInputElement | null;
                const toggle = document.getElementById("ondemand-toggle") as HTMLInputElement | null;
                const slotInputs = DAYS.map((d) => {
                  const input = document.getElementById(`ondemand-slots-day-${d.value}`) as HTMLInputElement | null;
                  return Number(input?.value ?? config.onDemandSlotsByDay?.[d.value - 1] ?? 0);
                });
                applyCustomize(Number(periodInput?.value || config.maxPeriod), !!toggle?.checked, slotInputs);
              }}
              className="text-sm font-semibold text-blue-500"
            >保存</button>
          </div>
          <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-sm text-gray-900 mb-1">最大時限</div>
              <input id="max-period-input" type="number" min={2} max={20} step={2} defaultValue={config.maxPeriod} className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm" />
              <p className="text-[11px] text-gray-400 mt-1">偶数で入力（例: 6 / 8 / 10）。1・2限、3・4限のセットで表示します。</p>
            </div>
            <label className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-900">下部にオンデマンド枠を表示</span>
              <input id="ondemand-toggle" type="checkbox" defaultChecked={config.showOnDemand} className="w-4 h-4" />
            </label>
            <div className="px-4 py-3">
              <div className="text-sm text-gray-900 mb-2">オンデマンド枠数（曜日ごと）</div>
              <div className="grid grid-cols-5 gap-2">
                {DAYS.map((d, idx) => (
                  <label key={d.value} className="space-y-1">
                    <span className="text-[11px] text-gray-500">{d.label}曜</span>
                    <input id={`ondemand-slots-day-${d.value}`} type="number" min={0} max={20} step={1} defaultValue={config.onDemandSlotsByDay?.[idx] ?? 0} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-sm" />
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">設定した枠数は初期プレースホルダーとして表示されます。実際のオンデマンド授業は下段の＋追加で無制限に追加できます。</p>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
            <button onClick={() => setEditing(null)} className="text-sm text-blue-500 font-medium">キャンセル</button>
            <span className="text-sm font-semibold text-gray-900">{editing.mode === "edit" ? "授業の編集" : "授業の追加"}</span>
            <button onClick={handleSave} className="text-sm font-semibold text-blue-500">保存</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <input
                type="text"
                value={editing.item.name}
                onChange={(e) => {
                  setEditing((prev) => prev ? { ...prev, item: { ...prev.item, name: e.target.value } } : prev);
                  if (e.target.value.trim()) setShowError(false);
                }}
                placeholder="授業名を入力"
                className={`w-full px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b ${showError && !editing.item.name.trim() ? "border-red-300 bg-red-50/50" : "border-gray-100"}`}
                autoFocus
              />
              {showError && !editing.item.name.trim() && <div className="px-4 py-2 text-xs text-red-500 bg-red-50/50">授業名を入力してください</div>}
              {!isOnDemandPeriod(editing.item.period) && (
                <>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-900">曜日</span>
                    <select value={editing.item.day} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, day: Number(e.target.value) } } : prev)} className="text-sm text-gray-500 bg-transparent focus:outline-none">
                      {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}曜</option>)}
                    </select>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-900">時限</span>
                    <select value={editing.item.period} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, period: Number(e.target.value) } } : prev)} className="text-sm text-gray-500 bg-transparent focus:outline-none">
                      {periodOptions.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                    </select>
                  </div>
                </>
              )}
              {isOnDemandPeriod(editing.item.period) && <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">オンデマンド枠 {DAYS.find((d) => d.value === editing.item.day)?.label}曜 {getOnDemandSlotIndex(editing.item.period) + 1}</div>}
              <input type="text" value={editing.item.teacher} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, teacher: e.target.value } } : prev)} placeholder="教員名（任意）" className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
              <input type="text" value={editing.item.room} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, room: e.target.value } } : prev)} placeholder="教室（任意）" className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
              <div className="px-4 py-3">
                <span className="text-sm text-gray-900 block mb-2">色</span>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((co) => (
                    <button key={co} onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, color: co } } : prev)} className={`w-6 h-6 rounded-full transition-all ${editing.item.color === co ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`} style={{ backgroundColor: co }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {editing.mode === "edit" && (
            <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200">
              <button onClick={handleDelete} className="text-sm text-red-500 font-medium">削除</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
