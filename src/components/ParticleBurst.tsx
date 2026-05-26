"use client";
import React, { useMemo } from "react";

interface ParticleBurstProps {
  x: number;
  y: number;
}

export default function ParticleBurst({ x, y }: ParticleBurstProps) {
  const particles = useMemo(() => {
    const count = 10;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (noise(i, 1) - 0.5) * 0.5;
      const dist = 22 + noise(i, 2) * 30;
      const size = 3 + noise(i, 3) * 4;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const colors = ["#93C5FD", "#A7F3D0", "#FBCFE8", "#DDD6FE", "#FDE68A", "#C7D2FE"];
      const color = colors[Math.floor(noise(i, 4) * colors.length)];
      const dur = 0.35 + noise(i, 5) * 0.22;
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

function noise(index: number, salt: number) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleEl({ p }: { p: { tx: number; ty: number; size: number; color: string; dur: number } }) {
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
