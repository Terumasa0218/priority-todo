"use client";
import React from "react";
import { IconBook, IconLogOut, IconPalette, IconSettings } from "@/components/Icons";
import StatusPill from "./StatusPill";

interface AppHeaderProps {
  overdueCount: number;
  weekDone: number;
  onCategories: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onLogout: () => void;
}

const HeaderIconButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="app-header-action"
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

export default function AppHeader({
  overdueCount,
  weekDone,
  onCategories,
  onSettings,
  onHelp,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="glass-header sticky top-0 z-40 safe-top">
      <div className="mx-auto max-w-lg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-black tracking-tight text-slate-950">PrioriTodo</h1>
            <p className="mt-0.5 truncate text-[11px] font-medium tracking-wide text-slate-500">
              授業と課題を、今日やる順に
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {overdueCount > 0 && <StatusPill tone="red">{overdueCount}件超過</StatusPill>}
            <div className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-right shadow-sm">
              <div className="text-[9px] font-semibold text-slate-400">今週達成</div>
              <div className="text-sm font-black leading-none text-slate-900">{weekDone}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <HeaderIconButton label="カテゴリ編集" onClick={onCategories}>
            <IconPalette size={16} stroke="currentColor" />
          </HeaderIconButton>
          <HeaderIconButton label="設定" onClick={onSettings}>
            <IconSettings size={16} stroke="currentColor" />
          </HeaderIconButton>
          <HeaderIconButton label="使い方" onClick={onHelp}>
            <IconBook size={16} stroke="currentColor" />
          </HeaderIconButton>
          <HeaderIconButton label="ログアウト" onClick={onLogout}>
            <IconLogOut size={16} stroke="currentColor" />
          </HeaderIconButton>
        </div>
      </div>
    </header>
  );
}
