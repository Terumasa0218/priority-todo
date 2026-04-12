"use client";
import React, { useMemo, useState } from "react";
import { Category, TimetableItem } from "@/lib/types";
import { PALETTE, PERIODS } from "@/lib/constants";
import { uid } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
] as const;

interface TimetableViewProps {
  items: TimetableItem[];
  setItems: React.Dispatch<React.SetStateAction<TimetableItem[]>>;
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
}

interface EditingState {
  mode: "create" | "edit";
  item: TimetableItem;
}

export default function TimetableView({ items, setItems, setCats }: TimetableViewProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showError, setShowError] = useState(false);

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableItem>();
    items.forEach((it) => map.set(`${it.day}-${it.period}`, it));
    return map;
  }, [items]);

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
    setEditing({ mode: "edit", item });
    setShowError(false);
  };

  const upsertCategoryByTimetable = (item: TimetableItem) => {
    setCats((prev) => {
      const idx = prev.findIndex((c) => c.timetableId === item.id);
      if (idx >= 0) {
        return prev.map((c) => (c.timetableId === item.id ? { ...c, label: item.name, color: item.color } : c));
      }
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
    const nextItem = { ...editing.item, name: editing.item.name.trim() };
    setItems((prev) => {
      const filtered = prev.filter((it) => it.id !== nextItem.id && !(it.day === nextItem.day && it.period === nextItem.period));
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

  return (
    <div className="px-4 py-4">
      <div className="overflow-x-auto">
        <div className="min-w-[560px] border border-gray-100 rounded-xl overflow-hidden bg-white">
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(6, minmax(0, 1fr))" }}>
            <div className="bg-gray-50 border-b border-r border-gray-100 h-10" />
            {DAYS.map((d) => (
              <div key={d.value} className="h-10 border-b border-gray-100 text-center text-xs font-semibold text-gray-600 flex items-center justify-center bg-gray-50">{d.label}</div>
            ))}
            {PERIODS.map((label, pidx) => {
              const period = pidx + 1;
              return (
                <React.Fragment key={label}>
                  <div className="h-22 border-r border-b border-gray-100 flex items-center justify-center text-xs text-gray-500 bg-gray-50">{label}</div>
                  {DAYS.map((d) => {
                    const key = `${d.value}-${period}`;
                    const item = cellMap.get(key);
                    if (!item) {
                      return (
                        <button key={key} onClick={() => openCreate(d.value, period)} className="h-22 border-b border-gray-100 flex items-center justify-center text-gray-200 hover:text-gray-400 hover:bg-gray-50 transition-colors">+
                        </button>
                      );
                    }
                    return (
                      <button
                        key={key}
                        onClick={() => openEdit(item)}
                        className="h-22 border-b border-gray-100 p-2 text-left transition-colors hover:brightness-95"
                        style={{ backgroundColor: `${item.color}20`, borderLeft: `3px solid ${item.color}` }}
                      >
                        <div className="text-xs font-semibold text-gray-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-gray-500 truncate mt-1">{item.room || "教室未設定"}</div>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

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
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">曜日</span>
                <select
                  value={editing.item.day}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, day: Number(e.target.value) } } : prev)}
                  className="text-sm text-gray-500 bg-transparent focus:outline-none"
                >
                  {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}曜</option>)}
                </select>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-900">時限</span>
                <select
                  value={editing.item.period}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, period: Number(e.target.value) } } : prev)}
                  className="text-sm text-gray-500 bg-transparent focus:outline-none"
                >
                  {PERIODS.map((p, idx) => <option key={p} value={idx + 1}>{p}</option>)}
                </select>
              </div>
              <input type="text" value={editing.item.teacher} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, teacher: e.target.value } } : prev)} placeholder="教員名（任意）" className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
              <input type="text" value={editing.item.room} onChange={(e) => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, room: e.target.value } } : prev)} placeholder="教室（任意）" className="w-full px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-100" />
              <div className="px-4 py-3">
                <span className="text-sm text-gray-900 block mb-2">色</span>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((co) => (
                    <button
                      key={co}
                      onClick={() => setEditing((prev) => prev ? { ...prev, item: { ...prev.item, color: co } } : prev)}
                      className={`w-6 h-6 rounded-full transition-all ${editing.item.color === co ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`}
                      style={{ backgroundColor: co }}
                    />
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
