"use client";
import React from "react";
import { IconBook, IconLogOut, IconPalette, IconSettings } from "@/components/Icons";

interface AppHeaderProps {
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
  onCategories,
  onSettings,
  onHelp,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="glass-header sticky top-0 z-40 safe-top">
      <div className="mx-auto flex max-w-lg items-center justify-end gap-1.5 px-4 py-2.5">
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
    </header>
  );
}
