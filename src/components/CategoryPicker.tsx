"use client";
import React, { useMemo, useState } from "react";
import { Category } from "@/lib/types";
import { PALETTE } from "@/lib/constants";
import { orderedPalette, uid } from "@/lib/utils";
import { IconPlus, IconCheck, IconChevD } from "./Icons";

interface CategoryPickerProps {
  cats: Category[];
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
  selected: string;
  onSelect: (id: string) => void;
}

export default function CategoryPicker({ cats, setCats, selected, onSelect }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const palette = useMemo(() => orderedPalette(PALETTE, cats.map((c) => c.color)), [cats]);
  const [newColor, setNewColor] = useState(palette[0]);
  const current = cats.find((c) => c.id === selected) || cats[0] || { label: "未分類", color: "#889096" };

  const startCreating = () => {
    setNewColor(palette[0]);
    setCreating(true);
  };

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    const cat: Category = { id: uid(), label: newLabel.trim(), color: newColor };
    setCats((prev) => [...prev, cat]);
    onSelect(cat.id);
    setNewLabel("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div>
      <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="text-sm text-gray-900">カテゴリ</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: current.color }} />
          <span className="text-sm text-gray-600">{current.label}</span>
          <IconChevD size={14} stroke="#999" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {cats.map((c) => (
            <div
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false); setCreating(false); }}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected === c.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm text-gray-800 flex-1">{c.label}</span>
              {selected === c.id && <IconCheck size={14} stroke="#3B82F6" sw={2.5} />}
            </div>
          ))}
          {!creating ? (
            <button onClick={startCreating} className="flex items-center gap-2 px-4 py-2.5 w-full text-sm text-blue-500 hover:bg-blue-50 transition-colors border-t border-gray-100">
              <IconPlus size={14} /> 新しいカテゴリを作成
            </button>
          ) : (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2.5">
              <input
                type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="カテゴリ名"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400"
                autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-1.5 flex-wrap">
                {palette.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${newColor === c ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button>
                <button onClick={handleCreate} disabled={!newLabel.trim()} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-[#007AFF] disabled:bg-gray-300">作成</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
