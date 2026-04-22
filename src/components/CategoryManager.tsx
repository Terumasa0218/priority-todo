"use client";
import React, { useState } from "react";
import { Category } from "@/lib/types";
import { PALETTE } from "@/lib/constants";
import { IconTrash } from "./Icons";

interface CategoryManagerProps {
  cats: Category[];
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
  onClose: () => void;
  onDeleteCategory: (catId: string) => void;
}

export default function CategoryManager({ cats, setCats, onClose, onDeleteCategory }: CategoryManagerProps) {
  const [eid, setEid] = useState<string | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eColor, setEColor] = useState("");

  const startEdit = (c: Category) => {
    setEid(c.id);
    setELabel(c.label);
    setEColor(c.color);
  };

  const saveEdit = () => {
    if (!eLabel.trim()) return;
    setCats((prev) => prev.map((c) => (c.id === eid ? { ...c, label: eLabel.trim(), color: eColor } : c)));
    setEid(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col safe-x" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-top">
        <button onClick={onClose} className="text-sm text-blue-500 font-medium">戻る</button>
        <span className="text-sm font-semibold text-gray-900">カテゴリ管理</span>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto safe-bottom">
        <p className="px-4 pt-4 pb-2 text-xs text-gray-400">カテゴリの名前や色を変更できます。</p>
        <div className="mx-4 bg-white rounded-xl overflow-hidden border border-gray-100">
          {cats.map((c, i) => (
            <div key={c.id} className={i < cats.length - 1 ? "border-b border-gray-100" : ""}>
              {eid === c.id ? (
                <div className="px-4 py-3 space-y-3">
                  <input type="text" value={eLabel} onChange={(e) => setELabel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" autoFocus />
                  <div className="flex gap-1.5 flex-wrap">
                    {PALETTE.map((co) => (
                      <button key={co} onClick={() => setEColor(co)}
                        className={`w-6 h-6 rounded-full transition-all ${eColor === co ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`}
                        style={{ backgroundColor: co }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEid(null)} className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 bg-gray-100">取消</button>
                    <button onClick={saveEdit} className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gray-900">保存</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center px-4 py-3">
                  <span className="w-4 h-4 rounded-full flex-shrink-0 mr-3" style={{ backgroundColor: c.color }} />
                  <span className="text-sm text-gray-900 flex-1">{c.label}</span>
                  <button onClick={() => startEdit(c)} className="text-xs text-blue-500 px-2">編集</button>
                  {c.id !== "default" && !c.timetableId && (
                    <button onClick={() => { onDeleteCategory(c.id); setCats((prev) => prev.filter((x) => x.id !== c.id)); }} className="p-1 text-gray-300 hover:text-red-500">
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
