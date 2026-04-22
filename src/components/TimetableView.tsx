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

const ON_DEMAND_PREFIX = "オンデマンド";
const isOnDemandPeriod = (period: string) => String(period).startsWith(ON_DEMAND_PREFIX);
const getOnDemandSlotIndex = (period: string) => {
  const m = String(period).match(/^オンデマンド(\d+)$/);
  return m ? Math.max(0, Number(m[1]) - 1) : 0;
};
const buildOnDemandPeriod = (slotIndex: number) => `${ON_DEMAND_PREFIX}${slotIndex + 1}`;

const normalizePeriod = (period: string) => {
  if (isOnDemandPeriod(period)) return period;
  const m = String(period).match(/^(\d+)(?:・(\d+))?限$/);
  if (!m) return period;
  const start = Number(m[1]);
  const normalizedStart = start % 2 === 0 ? start - 1 : start;
  return `${normalizedStart}・${normalizedStart + 1}限`;
};

const buildPeriods = (maxPeriod: number) => {
  const safeMax = Math.max(2, maxPeriod % 2 === 0 ? maxPeriod : maxPeriod + 1);
  return Array.from({ length: safeMax / 2 }, (_, idx) => {
    const start = idx * 2 + 1;
    const label = `${start}・${start + 1}限`;
    return { value: label, label };
  });
};

const buildPeriodGroups = buildPeriods;

export default function TimetableView({ items, setItems, setCats, config, setConfig, onShare, tasks, cats }: TimetableViewProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showError, setShowError] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const periodOptions = useMemo(() => buildPeriodGroups(config.maxPeriod), [config.maxPeriod]);

  const normalizedItems = useMemo<TimetableItem[]>(
    () => items.map((it) => ({ ...it, period: normalizePeriod(String(it.period)) })),
    [items]
  );

  const onDemandSlotsByDay = DAYS.map((_, idx) => {
    const value = Number(config.onDemandSlotsByDay?.[idx] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableItem>();
    normalizedItems.forEach((it) => {
      if (isOnDemandPeriod(it.period)) return;
      if (it.day < 1 || it.day > 5) return;
      const normalized = normalizePeriod(it.period);
      if (!periodOptions.some((option) => option.value === normalized)) return;
      map.set(`${it.day}-${normalized}`, { ...it, period: normalized });
    });
    return map;
  }, [normalizedItems, periodOptions]);

  const onDemandMap = useMemo(() => {
    const map = new Map<number, TimetableItem[]>();
    normalizedItems.filter((it) => isOnDemandPeriod(it.period)).forEach((it) => {
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

  const todayDay = ((new Date().getDay() + 6) % 7) + 1;
  const todayClassCount = normalizedItems.filter((it) => it.day === todayDay && !isOnDemandPeriod(it.period)).length;
  const todayPending = tasks.filter((t) => !t.completed && new Date(t.deadline).toDateString() === new Date().toDateString()).length;

  const openCreate = (day: number, period: string) => {
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
        absenceLimit: 5,
        attendanceAbsent: 0,
        attendanceLate: 0,
        attendancePresent: 0,
        memo: "",
      },
    });
    setShowError(false);
  };

  const openEdit = (item: TimetableItem) => {
    setEditing({ mode: "edit", item: { ...item, period: normalizePeriod(item.period) } });
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
    const nextItem: TimetableItem = {
      ...editing.item,
      name: editing.item.name.trim(),
      period: normalizePeriod(editing.item.period),
    };
    setItems((prev) => {
      const filtered = prev.filter((it) => {
        if (it.id === nextItem.id) return false;
        if (isOnDemandPeriod(nextItem.period)) {
          return !(isOnDemandPeriod(it.period) && it.day === nextItem.day && getOnDemandSlotIndex(it.period) === getOnDemandSlotIndex(nextItem.period));
        }
        return !(it.day === nextItem.day && normalizePeriod(it.period) === nextItem.period);
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
    const evenMax = Math.max(2, Math.min(20, maxPeriodInput % 2 === 0 ? maxPeriodInput : maxPeriodInput + 1));
    const nextSlots = DAYS.map((_, idx) => {
      const value = Number(onDemandSlotsInput[idx] ?? 0);
      return Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
    });
    const nextPeriods = buildPeriodGroups(evenMax).map((p) => p.value);
    setConfig({ maxPeriod: evenMax, showOnDemand: showOnDemandInput, onDemandSlotsByDay: nextSlots });
    setItems((prev) => prev.filter((it) => {
      if (it.day < 1 || it.day > 5) return false;
      if (isOnDemandPeriod(it.period)) {
        if (!showOnDemandInput) return false;
        return getOnDemandSlotIndex(it.period) < nextSlots[it.day - 1];
      }
      return nextPeriods.includes(normalizePeriod(it.period));
    }));
    setShowCustomize(false);
  };

  const handleShare = async () => {
    setSharing(true);
    setShareMessage(null);
    try {
      if (items.length === 0) {
        setShareMessage("先に授業を追加してください");
        return;
      }
      const link = await onShare();
      if (!link) {
        setShareMessage("共有リンクを作成できませんでした");
        return;
      }
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "時間割", url: link });
          setShareMessage("共有しました");
          return;
        } catch (err) {
          const name = (err as { name?: string })?.name;
          if (name === "AbortError") {
            setShareMessage(null);
            return;
          }
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
          setShareMessage("リンクをコピーしました");
          return;
        } catch {
          /* fall through */
        }
      }
      window.prompt("このリンクをコピーしてください", link);
      setShareMessage("リンクを作成しました");
    } catch {
      setShareMessage("共有リンクの作成に失敗しました");
    } finally {
      setSharing(false);
    }
  };

  const maxOnDemandRows = Math.max(0, ...onDemandSlotsByDay);
  const showOnDemandRows = config.showOnDemand && maxOnDemandRows > 0;

  const editingIsOnDemand = editing ? isOnDemandPeriod(editing.item.period) : false;
  const editingOnDemandSlot = editing && editingIsOnDemand ? getOnDemandSlotIndex(editing.item.period) : 0;

  const linkedTaskCount = editing && editing.mode === "edit"
    ? (() => {
      const cat = cats.find((c) => c.timetableId === editing.item.id);
      if (!cat) return 0;
      return tasks.filter((t) => !t.completed && t.category === cat.id).length;
    })()
    : 0;

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div>
          <div className="text-sm font-semibold text-gray-900">時間割</div>
          <div className="text-[11px] text-gray-500 mt-0.5">今日 {todayClassCount}コマ・今日締切 {todayPending}件</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} disabled={sharing} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {sharing ? "共有中..." : "共有"}
          </button>
          <button onClick={() => setShowCustomize(true)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <IconPencil size={13} />カスタム
          </button>
        </div>
      </div>
      {shareMessage && <div className="mb-2 text-[11px] text-right text-gray-500">{shareMessage}</div>}

      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(5, minmax(0, 1fr))" }}>
          <div className="bg-gray-50 border-b border-r border-gray-200 h-9" />
          {DAYS.map((d) => (
            <div key={d.value} className={`h-9 border-b border-gray-200 text-center text-[11px] font-semibold flex items-center justify-center bg-gray-50 ${d.value === todayDay ? "text-blue-600" : "text-gray-600"}`}>{d.label}</div>
          ))}

          {periodOptions.map((slot) => (
            <React.Fragment key={slot.value}>
              <div className="h-[86px] border-r border-b border-gray-200 flex items-center justify-center text-[10px] leading-tight text-gray-500 bg-gray-50 text-center">{slot.label}</div>
              {DAYS.map((d) => {
                const key = `${d.value}-${slot.value}`;
                const item = cellMap.get(key);
                const isToday = d.value === todayDay;
                if (!item) {
                  return (
                    <button
                      key={key}
                      onClick={() => openCreate(d.value, slot.value)}
                      className={`h-[86px] border-b border-gray-200 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors ${isToday ? "bg-blue-50/30" : ""}`}
                      aria-label={`${d.label}曜 ${slot.label} を追加`}
                    >＋</button>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => openEdit(item)}
                    className="h-[86px] border-b border-gray-200 p-1.5 text-left transition-colors hover:brightness-95 active:brightness-90"
                    style={{ backgroundColor: `${item.color}1F`, borderLeft: `3px solid ${item.color}` }}
                  >
                    <div className="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-3">{item.name}</div>
                    {item.room && <div className="text-[10px] text-gray-500 truncate mt-1">{item.room}</div>}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {showOnDemandRows && (
        <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span>オンデマンド</span>
            <span className="text-[10px] text-gray-400 font-normal">曜日ごとの枠</span>
          </div>
          <div className="flex">
            {DAYS.map((d, dIdx) => {
              const count = onDemandSlotsByDay[dIdx];
              const dayItems = onDemandMap.get(d.value) ?? [];
              return (
                <div key={d.value} className="flex-1 border-r border-gray-200 last:border-r-0">
                  <div className={`h-7 text-center text-[11px] font-semibold flex items-center justify-center bg-gray-50/60 border-b border-gray-200 ${d.value === todayDay ? "text-blue-600" : "text-gray-600"}`}>{d.label}</div>
                  {count === 0 ? (
                    <div className="h-12 flex items-center justify-center text-[10px] text-gray-300">—</div>
                  ) : (
                    Array.from({ length: count }, (_, slotIdx) => {
                      const item = dayItems.find((it) => getOnDemandSlotIndex(it.period) === slotIdx) ?? null;
                      const key = `on-${d.value}-${slotIdx}`;
                      if (!item) {
                        return (
                          <button
                            key={key}
                            onClick={() => openCreate(d.value, buildOnDemandPeriod(slotIdx))}
                            className="w-full h-12 border-b border-gray-200 last:border-b-0 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors text-xs"
                            aria-label={`${d.label}曜 オンデマンド${slotIdx + 1} を追加`}
                          >＋</button>
                        );
                      }
                      return (
                        <button
                          key={key}
                          onClick={() => openEdit(item)}
                          className="w-full h-12 border-b border-gray-200 last:border-b-0 p-1.5 text-left transition-colors hover:brightness-95 active:brightness-90"
                          style={{ backgroundColor: `${item.color}1F`, borderLeft: `3px solid ${item.color}` }}
                        >
                          <div className="text-[10px] font-semibold text-gray-900 leading-tight line-clamp-2">{item.name}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCustomize && (
        <div className="fixed inset-0 z-50 bg-gray-50/95 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-top">
            <button onClick={() => setShowCustomize(false)} className="text-sm text-blue-500 font-medium">キャンセル</button>
            <span className="text-sm font-semibold text-gray-900">時間割のカスタム</span>
            <button
              onClick={() => {
                const periodInput = document.getElementById("max-period-input") as HTMLInputElement | null;
                const toggle = document.getElementById("ondemand-toggle") as HTMLInputElement | null;
                const slotInputs = DAYS.map((d, idx) => {
                  const input = document.getElementById(`ondemand-slots-day-${d.value}`) as HTMLInputElement | null;
                  return Number(input?.value ?? config.onDemandSlotsByDay?.[idx] ?? 0);
                });
                applyCustomize(Number(periodInput?.value || config.maxPeriod), !!toggle?.checked, slotInputs);
              }}
              className="text-sm font-semibold text-blue-500"
            >保存</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm text-gray-900 mb-1">最大時限</div>
                <input id="max-period-input" type="number" min={2} max={20} step={2} defaultValue={config.maxPeriod} className="w-full px-3 py-2 rounded-md border border-gray-200 text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">偶数で入力（例: 6 / 8 / 10）。1・2限、3・4限のセットで表示します。</p>
              </div>
              <label className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">オンデマンド枠を表示</span>
                <input id="ondemand-toggle" type="checkbox" defaultChecked={config.showOnDemand} className="w-4 h-4" />
              </label>
              <div className="px-4 py-3">
                <div className="text-sm text-gray-900 mb-2">オンデマンド枠数（曜日ごと）</div>
                <div className="grid grid-cols-5 gap-2">
                  {DAYS.map((d, idx) => (
                    <label key={d.value} className="space-y-1">
                      <span className="text-[11px] text-gray-500">{d.label}曜</span>
                      <input id={`ondemand-slots-day-${d.value}`} type="number" min={0} max={5} step={1} defaultValue={config.onDemandSlotsByDay?.[idx] ?? 0} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-sm" />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">曜日ごとに最下段の枠数を設定できます（最大5）。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-top">
            <button onClick={() => setEditing(null)} className="text-sm text-blue-500 font-medium">キャンセル</button>
            <span className="text-sm font-semibold text-gray-900">{editing.mode === "edit" ? "授業の編集" : "授業の追加"}</span>
            <button onClick={handleSave} className="text-sm font-semibold text-blue-500">保存</button>
          </div>
          <div className="flex-1 overflow-y-auto pb-24 safe-bottom">
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
              {!editingIsOnDemand ? (
                <>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-900">曜日</span>
                    <select
                      value={editing.item.day}
                      onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, day: Number(e.target.value) } } : prev)}
                      className="text-sm text-gray-700 bg-transparent focus:outline-none"
                    >
                      {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}曜</option>)}
                    </select>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-900">時限</span>
                    <select
                      value={editing.item.period}
                      onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, period: e.target.value } } : prev)}
                      className="text-sm text-gray-700 bg-transparent focus:outline-none"
                    >
                      {periodOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
                  オンデマンド枠 {DAYS.find((d) => d.value === editing.item.day)?.label}曜 {editingOnDemandSlot + 1}
                </div>
              )}
              <input
                type="text"
                value={editing.item.teacher}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, teacher: e.target.value } } : prev)}
                placeholder="教員名（任意）"
                className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100"
              />
              <input
                type="text"
                value={editing.item.room}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, room: e.target.value } } : prev)}
                placeholder="教室（任意）"
                className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100"
              />
              <div className="px-4 py-3">
                <span className="text-sm text-gray-900 block mb-2">色</span>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((co) => (
                    <button
                      key={co}
                      onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, color: co } } : prev)}
                      className={`w-7 h-7 rounded-full transition-all ${editing.item.color === co ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`}
                      style={{ backgroundColor: co }}
                      aria-label={`色 ${co}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {editing.mode === "edit" && (
              <>
                <div className="mt-4 mx-4 bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">出欠</div>
                  <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                    {([
                      ["attendancePresent", "出席"],
                      ["attendanceAbsent", "欠席"],
                      ["attendanceLate", "遅刻"],
                    ] as const).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, [k]: (prev.item[k] || 0) + 1 } } : prev)}
                        onContextMenu={(e) => { e.preventDefault(); setEditing((prev) => prev ? { ...prev, item: { ...prev.item, [k]: Math.max(0, (prev.item[k] || 0) - 1) } } : prev); }}
                        className="rounded-xl border border-gray-200 py-2.5 bg-gray-50 active:bg-gray-100"
                      >
                        <div className="text-xs text-gray-500">{label}</div>
                        <div className="text-base font-semibold mt-0.5">{editing.item[k] || 0}</div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100">
                    <label className="text-xs text-gray-500 block">欠席上限
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={editing.item.absenceLimit ?? 5}
                        onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, absenceLimit: Number(e.target.value || 5) } } : prev)}
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-300 rounded-full transition-all" style={{ width: `${Math.min(100, ((editing.item.attendanceAbsent ?? 0) / Math.max(editing.item.absenceLimit ?? 5, 1)) * 100)}%` }} />
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">あと{Math.max((editing.item.absenceLimit ?? 5) - (editing.item.attendanceAbsent ?? 0), 0)}回休める</div>
                  </div>
                </div>

                <div className="mt-4 mx-4 bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">メモ</div>
                  <textarea
                    value={editing.item.memo || ""}
                    onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, memo: e.target.value } } : prev)}
                    rows={4}
                    placeholder="課題・参考書・欠席連絡など"
                    className="w-full px-4 py-3 text-sm resize-none focus:outline-none"
                  />
                </div>

                {linkedTaskCount > 0 && (
                  <div className="mt-3 mx-4 text-[11px] text-gray-500">連携タスク: 未完了 {linkedTaskCount}件</div>
                )}
              </>
            )}
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
