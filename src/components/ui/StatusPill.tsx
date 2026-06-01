"use client";
import React from "react";

type StatusTone = "red" | "amber" | "blue" | "gray" | "green";

interface StatusPillProps {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  red: "status-pill-red",
  amber: "status-pill-amber",
  blue: "status-pill-blue",
  gray: "status-pill-gray",
  green: "status-pill-green",
};

export default function StatusPill({ tone = "gray", children, className = "" }: StatusPillProps) {
  return <span className={`status-pill ${toneClass[tone]} ${className}`}>{children}</span>;
}
