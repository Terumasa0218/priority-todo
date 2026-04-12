"use client";
import React, { useState, useEffect, useRef } from "react";
import { Task, Category, TouchDragState } from "@/lib/types";
import { remaining, urgColor, fmt } from "@/lib/utils";
import { IconGrip, IconCheck, IconFlag, IconRepeat, IconTrash, IconChevR } from "./Icons";
import ParticleBurst from "./ParticleBurst";

interface TaskRowProps {
  task: Task;
  cats: Category[];
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  idx: number;
  touchDrag: TouchDragState;
}

export default function TaskRow({ task, cats, onComplete, onEdit, onDelete, idx, touchDrag }: TaskRowProps) {
  const rem = remaining(task.deadline);
  const uc = urgColor(rem.u);
  const cat = cats.find((c) => c.id === task.category) || { label: "未分類", color: "#889096" };
  const isOverdue = rem.u >= 4;
  const [popping, setPopping] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);
  const checkRef = useRef<HTMLButtonElement>(null);

  const hasMemo = task.memo && task.memo.trim();
  const hasUrl = task.url && task.url.trim();

  const handleComplete = () => {
    const rect = checkRef.current?.getBoundingClientRect();
    if (rect) setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setPopping(true);
    setTimeout(() => onComplete(task), 500);
  };

  useEffect(() => {
    if (burst) {
      const t = setTimeout(() => setBurst(null), 600);
      return () => clearTimeout(t);
    }
  }, [burst]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ctxMenu]);

  // Swipe
  const onTouchStartSwipe = (e: React.TouchEvent) => {
    if (touchDrag.active) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  };
  const onTouchMoveSwipe = (e: React.TouchEvent) => {
    if (touchDrag.active) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dy > 20 && !swiping.current) return;
    if (dx < -10) { swiping.current = true; setSwipeX(Math.max(dx, -80)); }
    else if (showDeleteBtn && dx > 10) { setSwipeX(Math.min(dx - 80, 0)); }
  };
  const onTouchEndSwipe = () => {
    if (touchDrag.active) return;
    if (swipeX < -40) { setSwipeX(-80); setShowDeleteBtn(true); }
    else { setSwipeX(0); setShowDeleteBtn(false); }
  };

  // Long press drag
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTouchStartDrag = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      touchDrag.start(idx, e.touches[0].clientY);
    }, 500);
  };
  const onTouchMoveCancelDrag = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const onTouchEndDrag = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  // PC right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`relative overflow-hidden ${popping ? "task-shrink" : ""}`}>
      {burst && <ParticleBurst x={burst.x} y={burst.y} />}
      {/* Delete button behind (swipe) */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center">
        <button onClick={() => onDelete(task)} className="text-white text-xs font-medium">削除</button>
      </div>
      {/* Card */}
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => { onTouchStartSwipe(e); onTouchStartDrag(e); }}
        onTouchMove={(e) => { onTouchMoveSwipe(e); onTouchMoveCancelDrag(); }}
        onTouchEnd={() => { onTouchEndSwipe(); onTouchEndDrag(); }}
        onContextMenu={handleContextMenu}
      >
        <div
          className={`flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 transition-colors ${
            touchDrag.active && touchDrag.dragIdx === idx ? "opacity-50 bg-gray-100" : ""
          } ${isOverdue ? "bg-red-50/70" : task.priority ? "bg-red-50/30" : ""}`}
          style={task.priority || isOverdue ? { borderLeft: "3px solid #CD2B31" } : { borderLeft: "3px solid transparent" }}
        >
          {/* Grip */}
          <div className="text-gray-300 flex-shrink-0 mt-0.5"><IconGrip size={14} /></div>
          {/* Checkbox */}
          <button ref={checkRef} onClick={handleComplete}
            className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex-shrink-0 mt-0.5" />
          {/* Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !task.isGroupTask && onEdit(task)}>
            <div className="flex items-center gap-2">
              {task.priority && <IconFlag filled size={13} />}
              <span className={`text-sm font-medium truncate ${isOverdue ? "text-red-700" : "text-gray-900"}`}>{task.title}</span>
              {task.recurrence && task.recurrence !== "none" && <IconRepeat size={12} stroke="#889096" />}
              {task.isGroupTask && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded flex-shrink-0">{task.groupName}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-xs text-gray-400">{cat.label}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-400">{fmt(task.deadline)}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: uc.bg, color: uc.fg }}>
                {rem.u >= 4 ? rem.t : `あと${rem.t}`}
              </span>
            </div>
            {/* Memo preview */}
            {hasMemo && (
              <div className="mt-1.5 text-xs text-gray-400 leading-relaxed" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                {task.memo}
              </div>
            )}
            {/* URL preview */}
            {hasUrl && (
              <div className="mt-1 flex items-center gap-1">
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
                <span className="text-[11px] text-blue-400 truncate">{task.url.replace(/^https?:\/\//, "").slice(0, 30)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* PC Context menu */}
      {ctxMenu && (
        <div className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => { onEdit(task); setCtxMenu(null); }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap">編集</button>
          <button onClick={() => { onDelete(task); setCtxMenu(null); }}
            className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 whitespace-nowrap">削除</button>
        </div>
      )}
    </div>
  );
}
