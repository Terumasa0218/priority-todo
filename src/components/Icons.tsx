"use client";
import React from "react";

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  d: string;
  size?: number;
  stroke?: string;
  sw?: number;
}

const Icon = ({ d, size = 16, stroke = "currentColor", sw = 1.8, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}><path d={d} /></svg>
);

export const IconPlus = (p: Omit<IconProps, "d">) => <Icon d="M12 5v14M5 12h14" {...p} />;
export const IconCheck = (p: Omit<IconProps, "d">) => <Icon d="M5 13l4 4L19 7" {...p} />;
export const IconX = (p: Omit<IconProps, "d">) => <Icon d="M18 6L6 18M6 6l12 12" {...p} />;
export const IconChevL = (p: Omit<IconProps, "d">) => <Icon d="M15 18l-6-6 6-6" {...p} />;
export const IconChevR = (p: Omit<IconProps, "d">) => <Icon d="M9 6l6 6-6 6" {...p} />;
export const IconChevD = (p: Omit<IconProps, "d">) => <Icon d="M6 9l6 6 6-6" {...p} />;
export const IconGrip = (p: Omit<IconProps, "d">) => <Icon d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" sw={3} {...p} />;
export const IconRepeat = (p: Omit<IconProps, "d">) => <Icon d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h12M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H5" {...p} />;
export const IconList = (p: Omit<IconProps, "d">) => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />;
export const IconCalendar = (p: Omit<IconProps, "d">) => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" {...p} />;
export const IconArchive = (p: Omit<IconProps, "d">) => <Icon d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" {...p} />;
export const IconSettings = (p: Omit<IconProps, "d">) => <Icon d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" {...p} />;
export const IconTrash = (p: Omit<IconProps, "d">) => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" {...p} />;
export const IconBook = (p: Omit<IconProps, "d">) => <Icon d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" {...p} />;
export const IconUsers = (p: Omit<IconProps, "d">) => <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" {...p} />;

export const IconFlag = ({ filled, size = 16, ...p }: { filled?: boolean; size?: number } & React.SVGAttributes<SVGSVGElement>) =>
  filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#CD2B31" stroke="#CD2B31" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );

export const IconPalette = ({ size = 16, stroke = "currentColor", ...p }: { size?: number; stroke?: string } & React.SVGAttributes<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="3" y1="21" x2="10" y2="14" strokeWidth={2.2} />
    <path d="M9.5 14.5L10.5 12.5L12 13.5L10.5 15z" fill={stroke} stroke="none" />
    <path d="M12 5c-4 0-7 3-7 6.5S8 18 12 18c1 0 1.5-.5 1.5-1s-.2-.7-.5-1c-.3-.3-.5-.6-.5-1 0-.8.7-1.5 1.5-1.5H16c2.8 0 5-2.2 5-5 0-3.9-3.6-7-9-7.5z" />
    <circle cx="10" cy="9" r="1" fill={stroke} stroke="none" />
    <circle cx="14" cy="8" r="1" fill={stroke} stroke="none" />
    <circle cx="17" cy="11" r="1" fill={stroke} stroke="none" />
  </svg>
);

export const IconClock = (p: Omit<IconProps, "d">) => <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" {...p} />;
