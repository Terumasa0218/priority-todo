"use client";
import React, { useMemo, useRef } from "react";

interface ParticleBurstProps {
  x: number;
  y: number;
}

export default function ParticleBurst({ x, y }: ParticleBurstProps) {
  const particles = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 30 + Math.random() * 40;
      const size = 4 + Math.random() * 5;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const colors = ["#111827", "#6B7280", "#9CA3AF", "#374151", "#D1D5DB"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dur = 0.3 + Math.random() * 0.2;
      return { tx, ty, size, color, dur };
    });
  }, []);

  return (
    <div style={{ position: "fixed", left: x, top: y, pointerEvents: "none", zIndex: 9999 }}>
      {particles.map((p, i) => (
        <ParticleEl key={i} p={p} />
      ))}
    </div>
  );
}

function ParticleEl({ p }: { p: { tx: number; ty: number; size: number; color: string; dur: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={(el) => {
        if (el) {
          el.animate(
            [
              { transform: `translate(${-p.size / 2}px, ${-p.size / 2}px) scale(1)`, opacity: 1 },
              { transform: `translate(${p.tx}px, ${p.ty}px) scale(0.2)`, opacity: 0 },
            ],
            { duration: p.dur * 1000, easing: "ease-out", fill: "forwards" }
          );
        }
      }}
      style={{
        position: "absolute",
        width: p.size,
        height: p.size,
        borderRadius: p.size > 6 ? "2px" : "50%",
        backgroundColor: p.color,
        transform: `translate(${-p.size / 2}px, ${-p.size / 2}px)`,
      }}
    />
  );
}
