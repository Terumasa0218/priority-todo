"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DAY } from "@/lib/constants";

interface DatePickerFieldProps {
  // YYYY-MM-DD（空文字なら未選択）
  value: string;
  onChange: (next: string) => void;
  // 選択不可日を判定する。trueを返すとグレーアウトされタップ不可
  isDateDisabled?: (date: Date) => boolean;
  // 入力欄の最小日付 YYYY-MM-DD
  min?: string;
  // 期間表示用。開始日ピッカーなど、選択日から終了日までを帯で見せたい場合に使う。
  rangeStart?: string;
  rangeEnd?: string;
  rangeEndFixed?: boolean;
  placeholder?: string;
  className?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const sameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const parseYMD = (s: string): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
};

export default function DatePickerField({
  value,
  onChange,
  isDateDisabled,
  min,
  rangeStart,
  rangeEnd,
  rangeEndFixed = false,
  placeholder = "日付を選択",
  className = "",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = parseYMD(value) || parseYMD(min || "") || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tempSelected, setTempSelected] = useState<Date | null>(parseYMD(value));
  const overlayRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    const base = parseYMD(value) || parseYMD(min || "") || new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setTempSelected(parseYMD(value));
    setOpen(true);
  };

  // ESC / 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const minDate = useMemo(() => parseYMD(min || ""), [min]);
  const highlightRange = useMemo(() => {
    const start = tempSelected || parseYMD(rangeStart || "");
    const end = parseYMD(rangeEnd || "");
    if (!end) return null;
    if (!start) return rangeEndFixed ? { start: end, end } : null;
    if (start.getTime() > end.getTime()) return null;
    return { start, end };
  }, [rangeStart, rangeEnd, rangeEndFixed, tempSelected]);

  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const offset = first.getDay(); // 0=Sun
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const isDisabled = (d: Date): boolean => {
    if (minDate && d < minDate) return true;
    if (isDateDisabled && isDateDisabled(d)) return true;
    return false;
  };

  const today = new Date();

  const labelText = (() => {
    const parsed = parseYMD(value);
    if (!parsed) return "";
    return `${parsed.getFullYear()}/${pad2(parsed.getMonth() + 1)}/${pad2(parsed.getDate())} (${DAY[parsed.getDay()]})`;
  })();

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className={`min-w-0 w-full h-[44px] overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 ${className}`}
      >
        {labelText || <span className="text-gray-400">{placeholder}</span>}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
          ref={overlayRef}
        >
          <div className="w-full max-w-sm bg-[#2a2a2c] rounded-2xl shadow-xl p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                className="text-blue-400 px-2 py-1 text-base"
                aria-label="前の月"
              >
                ‹
              </button>
              <div className="text-sm font-medium">
                {viewMonth.getFullYear()}年{viewMonth.getMonth() + 1}月
              </div>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                className="text-blue-400 px-2 py-1 text-base"
                aria-label="次の月"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-400 mb-1">
              {DAY.map((d, i) => (
                <div key={d} className={`text-center py-1 ${i === 0 ? "text-rose-300" : i === 6 ? "text-blue-300" : ""}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-x-0 gap-y-1">
              {grid.map((d, i) => {
                if (!d) return <div key={`b${i}`} className="h-11" />;
                const disabled = isDisabled(d);
                const isSelected = tempSelected && sameYMD(d, tempSelected);
                const isToday = sameYMD(d, today);
                const isInRange = !!highlightRange && !disabled && d.getTime() >= highlightRange.start.getTime() && d.getTime() <= highlightRange.end.getTime();
                const isRangeStart = !!highlightRange && isInRange && sameYMD(d, highlightRange.start);
                const isRangeEnd = !!highlightRange && isInRange && sameYMD(d, highlightRange.end);
                const isFixedEndOnly = rangeEndFixed && isRangeEnd && isRangeStart && !tempSelected && !rangeStart;
                const startsRangeSegment = isInRange && (isRangeStart || i % 7 === 0);
                const endsRangeSegment = isInRange && (isRangeEnd || i % 7 === 6);
                const bandClass = isInRange && !(isRangeStart && isRangeEnd)
                  ? startsRangeSegment
                    ? "left-1/2 right-0"
                    : endsRangeSegment
                      ? "left-0 right-1/2"
                      : "left-0 right-0"
                  : "";
                const dayClass = disabled
                  ? "text-gray-600 opacity-40"
                  : isFixedEndOnly
                    ? "bg-blue-500/90 text-white font-semibold ring-4 ring-blue-400/10"
                  : isRangeStart
                    ? "bg-blue-500 text-white font-semibold shadow-sm shadow-blue-500/25"
                    : isRangeEnd
                      ? `${rangeEndFixed ? "bg-blue-500/90 ring-4 ring-blue-400/10" : "bg-blue-500"} text-white font-semibold`
                      : isSelected
                        ? "bg-blue-500 text-white font-semibold"
                        : isToday
                          ? "text-blue-400 font-semibold"
                          : isInRange
                            ? "text-white font-semibold"
                            : "text-white";
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      if (rangeEndFixed && rangeEnd) {
                        const fixedEnd = parseYMD(rangeEnd);
                        if (fixedEnd && sameYMD(d, fixedEnd)) return;
                      }
                      setTempSelected(d);
                    }}
                    className={`relative h-11 w-full text-sm flex items-center justify-center transition-colors ${
                      disabled ? "cursor-not-allowed" : "hover:bg-white/10"
                    }`}
                    aria-label={isRangeEnd && rangeEndFixed && !isRangeStart ? `${d.getDate()}日 締切日（固定）` : undefined}
                  >
                    {bandClass && <span aria-hidden className={`absolute inset-y-1 ${bandClass} bg-blue-500/15`} />}
                    <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${dayClass}`}>
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-full bg-white/10 text-sm text-white"
              >
                閉じる
              </button>
              <button
                type="button"
                disabled={!tempSelected || (tempSelected && isDisabled(tempSelected))}
                onClick={() => {
                  if (tempSelected && !isDisabled(tempSelected)) {
                    onChange(toYMD(tempSelected));
                    setOpen(false);
                  }
                }}
                className="w-12 h-12 rounded-full bg-blue-500 text-white text-lg flex items-center justify-center disabled:opacity-40"
                aria-label="確定"
              >
                ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
