"use client";
import React from "react";

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function SurfaceCard({ children, className = "", ...rest }: SurfaceCardProps) {
  return <div className={`surface-card ${className}`} {...rest}>{children}</div>;
}
