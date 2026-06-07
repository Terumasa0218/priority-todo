"use client";
import React, { useMemo, useState } from "react";
import { IconPencil } from "@/components/Icons";
import DatePickerField from "@/components/DatePickerField";
import { Category, CourseTaskTemplate, Task, TimetableConfig, TimetableItem } from "@/lib/types";
import { PALETTE, REMINDERS } from "@/lib/constants";
import { orderedPalette } from "@/lib/utils";
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
  onCreateTaskFromTemplate: (item: TimetableItem) => boolean;
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

const normalizeTimetableCode = (value: string | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.slice(-4);
};

const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const createDefaultTemplate = (): CourseTaskTemplate => ({
  id: uid(),
  title: "レスポンスカード",
  recurrence: "weekly",
  firstClassDate: "",
  firstDueDate: "",
  firstDueTime: "23:59",
  endMode: "count",
  classCount: 14,
  finalDueDate: "",
  startOffsetDays: 0,
  reminder: "1day",
  memo: "",
  url: "",
  priority: false,
});

const FormCard = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-2 mx-4 overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(27,39,75,0.05)]">{children}</div>
);

export default function TimetableView({ items, setItems, setCats, config, setConfig, onShare, tasks, cats, onCreateTaskFromTemplate }: TimetableViewProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showError, setShowError] = useState(false);
  const [formError, setFormError] = useState("");
  const [showCustomize, setShowCustomize] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);

  const periodOptions = useMemo(() => buildPeriodGroups(config.maxPeriod), [config.maxPeriod]);

  const editingPalette = useMemo(() => {
    const used = [
      ...items.map((it) => it.color),
      ...cats.map((c) => c.color),
    ];
    return orderedPalette(PALETTE, used, editing?.item.color);
  }, [items, cats, editing?.item.color]);

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
    const used = [...items.map((it) => it.color), ...cats.map((c) => c.color)];
    const defaultColor = orderedPalette(PALETTE, used)[0];
    setEditing({
      mode: "create",
      item: {
        id: uid(),
        name: "",
        day,
        period,
        teacher: "",
        room: "",
        moodleEnabled: false,
        timetableCode: "",
        color: defaultColor,
        absenceLimit: 5,
        attendanceAbsent: 0,
        attendanceLate: 0,
        attendancePresent: 0,
        memo: "",
      },
    });
    setShowError(false);
    setFormError("");
    setTemplateMessage(null);
  };

  const openEdit = (item: TimetableItem) => {
    setEditing({
      mode: "edit",
      item: {
        ...item,
        period: normalizePeriod(item.period),
        moodleEnabled: !!item.moodleEnabled,
        timetableCode: normalizeTimetableCode(item.timetableCode),
      },
    });
    setShowError(false);
    setFormError("");
    setTemplateMessage(null);
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
    const normalizedCode = normalizeTimetableCode(editing.item.timetableCode);
    const template = editing.item.assignmentTemplate;
    const templateInvalid = !!template && (
      !template.title.trim() ||
      !template.firstClassDate ||
      !template.firstDueDate ||
      (template.endMode === "date" && !template.finalDueDate)
    );
    if (!editing.item.name.trim() || (editing.item.moodleEnabled && normalizedCode.length !== 4) || templateInvalid) {
      setShowError(true);
      setFormError(templateInvalid ? "課題テンプレートは、課題名・初回授業日・初回課題提出日・終了条件を入力してください。" : "");
      return;
    }
    const nextItem: TimetableItem = {
      ...editing.item,
      name: editing.item.name.trim(),
      period: normalizePeriod(editing.item.period),
      moodleEnabled: !!editing.item.moodleEnabled,
      timetableCode: editing.item.moodleEnabled ? normalizedCode : "",
      assignmentTemplate: editing.item.assignmentTemplate ?? null,
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

  const updateEditingTemplate = (patch: Partial<CourseTaskTemplate>) => {
    setEditing((prev) => {
      if (!prev?.item.assignmentTemplate) return prev;
      return { ...prev, item: { ...prev.item, assignmentTemplate: { ...prev.item.assignmentTemplate, ...patch } } };
    });
    setFormError("");
  };

  const generateFromTemplate = (item: TimetableItem) => {
    const ok = onCreateTaskFromTemplate(item);
    setTemplateMessage(ok ? `${item.name} の課題を作成しました` : "テンプレートの入力を確認してください");
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
  const moodleLinkedCount = normalizedItems.filter((it) => it.moodleEnabled && normalizeTimetableCode(it.timetableCode).length === 4).length;
  const templateCount = normalizedItems.filter((it) => !!it.assignmentTemplate).length;
  const editingCode = normalizeTimetableCode(editing?.item.timetableCode);
  const editingTemplate = editing?.item.assignmentTemplate ?? null;
  const editingTemplateInvalid = !!editingTemplate && (
    !editingTemplate.title.trim() ||
    !editingTemplate.firstClassDate ||
    !editingTemplate.firstDueDate ||
    (editingTemplate.endMode === "date" && !editingTemplate.finalDueDate)
  );
  const editingCanSave = !!editing && !!editing.item.name.trim() && (!editing.item.moodleEnabled || editingCode.length === 4) && !editingTemplateInvalid;

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div>
          <div className="text-sm font-semibold text-gray-900">時間割</div>
          <div className="text-[11px] text-gray-500 mt-0.5">今日 {todayClassCount}コマ・今日締切 {todayPending}件</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Moodle連携 {moodleLinkedCount}件・課題テンプレート {templateCount}件</div>
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
                    {item.moodleEnabled && item.timetableCode && <div className="text-[9px] font-semibold text-blue-600 mt-1">Moodle {item.timetableCode}</div>}
                    {item.assignmentTemplate && <div className="text-[9px] font-semibold text-emerald-600 mt-1">テンプレート</div>}
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
                          {item.moodleEnabled && item.timetableCode && <div className="text-[8px] font-semibold text-blue-600 mt-0.5">{item.timetableCode}</div>}
                          {item.assignmentTemplate && <div className="text-[8px] font-semibold text-emerald-600 mt-0.5">テンプレート</div>}
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
        <div className="fullscreen-form-shell z-50 flex flex-col bg-[#F7F8FC] safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
          <div className="bg-white/95 border-b border-slate-200/70 shadow-[0_10px_28px_rgba(27,39,75,0.06)] safe-top">
            <div className="flex items-center justify-between px-4 py-3 min-h-[52px]">
              <button onClick={() => setEditing(null)} className="text-sm text-blue-500 font-medium px-2 py-1 -mx-2">キャンセル</button>
              <span className="text-sm font-semibold text-gray-900">{editing.mode === "edit" ? "授業の編集" : "授業の追加"}</span>
              <button
                onClick={handleSave}
                disabled={!editingCanSave}
                className="text-sm font-bold text-white bg-[#007AFF] hover:bg-[#0062CC] disabled:bg-blue-300 disabled:cursor-not-allowed px-4 py-1.5 rounded-full shadow-sm active:scale-[0.98] transition-transform"
              >
                保存
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pb-24 safe-bottom">
            <div className="mt-3 mx-4 overflow-hidden rounded-[16px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(27,39,75,0.05)]">
              <input
                type="text"
                value={editing.item.name}
                onChange={(e) => {
                  setEditing((prev) => prev ? { ...prev, item: { ...prev.item, name: e.target.value } } : prev);
                  if (e.target.value.trim()) setShowError(false);
                }}
                placeholder={showError && !editing.item.name.trim() ? "授業名を入力してください" : "授業名を入力"}
                className={`w-full px-4 py-3.5 text-sm text-gray-900 focus:outline-none border-b ${
                  showError && !editing.item.name.trim()
                    ? "border-red-300 bg-red-50/50 placeholder-red-500"
                    : "border-gray-100 placeholder-gray-400"
                }`}
                autoFocus
              />
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="shrink-0 text-sm text-gray-900 font-medium">授業カテゴリ</span>
                <span className="min-w-0 truncate text-xs text-gray-500">保存すると課題作成画面の授業カテゴリに自動で表示されます</span>
              </div>
            </div>

            <FormCard>
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm text-gray-900 font-semibold mb-2">曜日</div>
                {!editingIsOnDemand ? (
                  <div className="grid grid-cols-5 gap-1.5">
                    {DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, day: d.value } } : prev)}
                        className={`h-10 rounded-xl text-sm font-semibold transition-colors ${editing.item.day === d.value ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-500"}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">{DAYS.find((d) => d.value === editing.item.day)?.label}曜のオンデマンド枠</div>
                )}
              </div>
              <div className="px-4 py-3">
                <label className="block text-sm text-gray-900 font-semibold mb-2">時限</label>
                {!editingIsOnDemand ? (
                  <select
                    value={editing.item.period}
                    onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, period: e.target.value } } : prev)}
                    className="w-full h-[44px] text-sm text-gray-900 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus:outline-none"
                  >
                    {periodOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                ) : (
                  <div className="h-[44px] flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">オンデマンド {editingOnDemandSlot + 1}</div>
                )}
              </div>
            </FormCard>

            <FormCard>
              <label className="block px-4 pt-3 pb-2 border-b border-gray-100">
                <span className="block text-sm text-gray-900 font-semibold mb-2">教室</span>
                <input
                  type="text"
                  value={editing.item.room}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, room: e.target.value } } : prev)}
                  placeholder="例: 2号館 201"
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 placeholder-gray-400 focus:outline-none"
                />
              </label>
              <label className="block px-4 pt-3 pb-3">
                <span className="block text-sm text-gray-900 font-semibold mb-2">教員名</span>
                <input
                  type="text"
                  value={editing.item.teacher}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, teacher: e.target.value } } : prev)}
                  placeholder="先生の名前"
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 placeholder-gray-400 focus:outline-none"
                />
              </label>
            </FormCard>

            <FormCard>
              <div className="px-4 py-3">
                <span className="text-sm text-gray-900 font-semibold block mb-2">色</span>
                <div className="grid grid-cols-8 gap-2">
                  {editingPalette.map((co) => (
                    <button
                      key={co}
                      type="button"
                      onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, color: co } } : prev)}
                      className={`h-8 rounded-full transition-all ${editing.item.color === co ? "ring-2 ring-offset-2 ring-gray-900 scale-105" : "ring-1 ring-black/5"}`}
                      style={{ backgroundColor: co }}
                      aria-label={`色 ${co}`}
                    />
                  ))}
                </div>
              </div>
            </FormCard>

            <FormCard>
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
                <div className="min-w-0">
                  <span className="text-sm text-gray-900 font-semibold">Moodle連携</span>
                  <div className="text-[10px] text-gray-400 mt-0.5">ICSのCATEGORIES下4桁と照合して、この授業へ自動分類します</div>
                </div>
                <button
                  type="button"
                  aria-label="Moodle連携"
                  aria-pressed={!!editing.item.moodleEnabled}
                  onClick={() => {
                    setEditing((prev) => prev ? { ...prev, item: { ...prev.item, moodleEnabled: !prev.item.moodleEnabled } } : prev);
                    setShowError(false);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${editing.item.moodleEnabled ? "bg-blue-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editing.item.moodleEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
              {editing.item.moodleEnabled && (
                <div className="px-4 py-3">
                  <label className="block text-sm text-gray-900 font-semibold mb-2">時間割番号 / Moodleコースコード <span className="text-rose-500 text-xs">必須</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editing.item.timetableCode || ""}
                    onChange={(e) => {
                      const code = normalizeTimetableCode(e.target.value);
                      setEditing((prev) => prev ? { ...prev, item: { ...prev.item, timetableCode: code } } : prev);
                      if (code.length === 4) setShowError(false);
                    }}
                    placeholder="例: 3001"
                    maxLength={4}
                    className={`w-full h-[44px] text-sm bg-gray-50 rounded-xl px-3 py-2 border focus:outline-none ${showError && editing.item.moodleEnabled && editingCode.length !== 4 ? "border-red-300 bg-red-50/50 placeholder-red-500" : "border-gray-200"}`}
                  />
                  <div className="mt-1 text-[11px] text-gray-400">例: 26-4-3001 の場合は 3001 だけ保存します。</div>
                  {showError && editing.item.moodleEnabled && editingCode.length !== 4 && <div className="mt-1 text-xs text-red-500">Moodle連携ありの場合は4桁のコードが必要です。</div>}
                </div>
              )}
            </FormCard>

            <FormCard>
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
                <div className="min-w-0">
                  <span className="text-sm text-gray-900 font-semibold">課題テンプレート</span>
                  <div className="text-[10px] text-gray-400 mt-0.5">毎週のレスポンスカードなどを、この授業から作成します</div>
                </div>
                <button
                  type="button"
                  aria-label="課題テンプレート"
                  aria-pressed={!!editing.item.assignmentTemplate}
                  onClick={() => {
                    setEditing((prev) => {
                      if (!prev) return prev;
                      const nextTemplate = prev.item.assignmentTemplate ? null : createDefaultTemplate();
                      return { ...prev, item: { ...prev.item, assignmentTemplate: nextTemplate } };
                    });
                    setFormError("");
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${editing.item.assignmentTemplate ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editing.item.assignmentTemplate ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </button>
              </div>
              {editing.item.assignmentTemplate && (
                <>
                  <label className="block px-4 pt-3 pb-2 border-b border-gray-100">
                    <span className="block text-sm text-gray-900 font-semibold mb-2">課題名</span>
                    <input
                      type="text"
                      value={editing.item.assignmentTemplate.title}
                      onChange={(e) => updateEditingTemplate({ title: e.target.value })}
                      placeholder="例: レスポンスカード"
                      className={`w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border placeholder-gray-400 focus:outline-none ${showError && !editing.item.assignmentTemplate.title.trim() ? "border-red-300 bg-red-50/50" : "border-gray-200"}`}
                    />
                  </label>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <span className="block text-sm text-gray-900 font-semibold mb-2">繰り返し</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["weekly", "biweekly"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateEditingTemplate({ recurrence: value })}
                          className={`h-9 rounded-xl text-xs font-semibold transition-colors ${editing.item.assignmentTemplate?.recurrence === value ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-500"}`}
                        >
                          {value === "weekly" ? "毎週" : "隔週"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="block text-sm text-gray-900 font-semibold mb-2">初回授業日</span>
                      <DatePickerField
                        value={editing.item.assignmentTemplate.firstClassDate}
                        onChange={(v) => updateEditingTemplate({ firstClassDate: v })}
                        min={todayYmd()}
                        placeholder="授業日"
                      />
                      <div className="mt-1 text-[10px] text-gray-400">この曜日を基準に作成</div>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-sm text-gray-900 font-semibold mb-2">初回課題提出日</span>
                      <DatePickerField
                        value={editing.item.assignmentTemplate.firstDueDate}
                        onChange={(v) => updateEditingTemplate({ firstDueDate: v })}
                        min={editing.item.assignmentTemplate.firstClassDate || todayYmd()}
                        placeholder="提出日"
                      />
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <span className="block text-sm text-gray-900 font-semibold mb-2">終了条件</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["count", "date"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateEditingTemplate({ endMode: value })}
                          className={`h-9 rounded-xl text-xs font-semibold transition-colors ${editing.item.assignmentTemplate?.endMode === value ? "bg-[#007AFF] text-white" : "bg-gray-100 text-gray-500"}`}
                        >
                          {value === "count" ? "授業回数" : "最終締切日"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-[88px_minmax(0,1fr)] gap-3">
                    <label className="min-w-0">
                      <span className="block text-sm text-gray-900 font-semibold mb-2">締切時刻</span>
                      <input
                        type="time"
                        value={editing.item.assignmentTemplate.firstDueTime}
                        onChange={(e) => updateEditingTemplate({ firstDueTime: e.target.value })}
                        className="w-[88px] h-[44px] text-base text-center bg-gray-50 rounded-xl px-2 py-2 border border-gray-200 tabular-nums appearance-none"
                      />
                    </label>
                    {editing.item.assignmentTemplate.endMode === "date" ? (
                      <div className="min-w-0">
                        <span className="block text-sm text-gray-900 font-semibold mb-2">最終締切日</span>
                        <DatePickerField
                          value={editing.item.assignmentTemplate.finalDueDate}
                          onChange={(v) => updateEditingTemplate({ finalDueDate: v })}
                          min={editing.item.assignmentTemplate.firstDueDate || editing.item.assignmentTemplate.firstClassDate || todayYmd()}
                          placeholder="最終日"
                        />
                      </div>
                    ) : (
                      <label className="min-w-0">
                        <span className="block text-sm text-gray-900 font-semibold mb-2">授業回数</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={50}
                            value={editing.item.assignmentTemplate.classCount}
                            onChange={(e) => updateEditingTemplate({ classCount: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                            className="w-24 h-[44px] text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
                          />
                          <span className="text-sm text-gray-500">回</span>
                        </div>
                      </label>
                    )}
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-2 gap-3">
                    <label>
                      <span className="block text-sm text-gray-900 font-semibold mb-2">表示開始</span>
                      <select
                        value={editing.item.assignmentTemplate.startOffsetDays ?? ""}
                        onChange={(e) => updateEditingTemplate({ startOffsetDays: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-full h-[44px] text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
                      >
                        <option value="">作成直後</option>
                        <option value={0}>締切当日</option>
                        <option value={1}>1日前</option>
                        <option value={3}>3日前</option>
                        <option value={7}>1週間前</option>
                      </select>
                    </label>
                    <label>
                      <span className="block text-sm text-gray-900 font-semibold mb-2">通知目安</span>
                      <select
                        value={editing.item.assignmentTemplate.reminder}
                        onChange={(e) => updateEditingTemplate({ reminder: e.target.value })}
                        className="w-full h-[44px] text-sm bg-gray-50 rounded-xl px-3 py-2 border border-gray-200"
                      >
                        {REMINDERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block px-4 pt-3 pb-2 border-b border-gray-100">
                    <span className="block text-sm text-gray-900 font-semibold mb-2">提出先URL</span>
                    <input
                      type="url"
                      value={editing.item.assignmentTemplate.url}
                      onChange={(e) => updateEditingTemplate({ url: e.target.value })}
                      placeholder="https://..."
                      className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 placeholder-gray-400 focus:outline-none"
                    />
                  </label>
                  <label className="block px-4 pt-3 pb-3">
                    <span className="block text-sm text-gray-900 font-semibold mb-2">メモ</span>
                    <textarea
                      value={editing.item.assignmentTemplate.memo}
                      onChange={(e) => updateEditingTemplate({ memo: e.target.value })}
                      rows={2}
                      placeholder="提出条件など"
                      className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 resize-none placeholder-gray-400 focus:outline-none"
                    />
                  </label>
                </>
              )}
            </FormCard>

            <FormCard>
              <label className="block px-4 pt-3 pb-3">
                <span className="block text-sm text-gray-900 font-semibold mb-2">メモ</span>
                <textarea
                  value={editing.item.memo || ""}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, memo: e.target.value } } : prev)}
                  rows={3}
                  placeholder="課題・参考書・欠席連絡など"
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200 resize-none placeholder-gray-400 focus:outline-none"
                />
              </label>
            </FormCard>

            {editing.mode === "edit" && (
              <FormCard>
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-900">出欠</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">授業ごとの出席状況をメモします</div>
                </div>
                <div className="px-4 py-3 grid grid-cols-3 gap-2">
                  {([
                    ["attendancePresent", "出席"],
                    ["attendanceAbsent", "欠席"],
                    ["attendanceLate", "遅刻"],
                  ] as const).map(([k, label]) => (
                    <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 flex flex-col items-center">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${label}を1減らす`}
                          onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, [k]: Math.max(0, (prev.item[k] || 0) - 1) } } : prev)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 text-base leading-none active:bg-gray-100"
                        >−</button>
                        <span className="text-base font-semibold w-6 text-center tabular-nums">{editing.item[k] || 0}</span>
                        <button
                          type="button"
                          aria-label={`${label}を1増やす`}
                          onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, [k]: (prev.item[k] || 0) + 1 } } : prev)}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 text-base leading-none active:bg-gray-100"
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500">欠席上限</div>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="欠席上限を1減らす"
                      onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, absenceLimit: Math.max(1, (prev.item.absenceLimit ?? 5) - 1) } } : prev)}
                      className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-lg leading-none active:bg-gray-100"
                    >−</button>
                    <span className="text-base font-semibold w-8 text-center tabular-nums">{editing.item.absenceLimit ?? 5}</span>
                    <button
                      type="button"
                      aria-label="欠席上限を1増やす"
                      onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, absenceLimit: Math.min(30, (prev.item.absenceLimit ?? 5) + 1) } } : prev)}
                      className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-lg leading-none active:bg-gray-100"
                    >+</button>
                    <span className="ml-2 text-[11px] text-gray-400">回まで</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-300 rounded-full transition-all" style={{ width: `${Math.min(100, ((editing.item.attendanceAbsent ?? 0) / Math.max(editing.item.absenceLimit ?? 5, 1)) * 100)}%` }} />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">あと{Math.max((editing.item.absenceLimit ?? 5) - (editing.item.attendanceAbsent ?? 0), 0)}回休める</div>
                </div>
              </FormCard>
            )}

            {editing.mode === "edit" && linkedTaskCount > 0 && (
              <div className="mt-3 mx-4 text-[11px] text-gray-500">連携タスク: 未完了 {linkedTaskCount}件</div>
            )}
            {editing.mode === "edit" && editing.item.assignmentTemplate && (
              <div className="mx-4 mt-3">
                <button
                  type="button"
                  onClick={() => generateFromTemplate(editing.item)}
                  disabled={editingTemplateInvalid}
                  className="w-full rounded-[16px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99] transition-transform disabled:bg-emerald-200 disabled:cursor-not-allowed"
                >
                  このテンプレートから課題を作成
                </button>
                <div className="mt-1 text-[11px] text-gray-400">作成後はタスクタブで繰り返し課題として表示されます。</div>
              </div>
            )}
            {(formError || templateMessage) && (
              <div className={`mt-3 mx-4 rounded-xl border px-3 py-2 text-xs ${formError ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {formError || templateMessage}
              </div>
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
