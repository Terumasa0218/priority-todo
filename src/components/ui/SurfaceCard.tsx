"use client";
import React from "react";

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function SurfaceCard({ children, className = "" }: SurfaceCardProps) {
  return <div className={`surface-card ${className}`}>{children}</div>;
}
