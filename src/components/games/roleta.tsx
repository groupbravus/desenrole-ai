"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Challenge {
  emoji: string;
  title: string;
  text: string;
}

const SEGMENT_EMOJIS = ["💋", "🔥", "👀", "🤫", "📱", "👏", "😏", "🎯"];
const SEGMENT_COUNT = SEGMENT_EMOJIS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(index: number) {
  const start = index * SEGMENT_ANGLE;
  const end = start + SEGMENT_ANGLE;
  const a = polar(100, 100, 94, start);
  const b = polar(100, 100, 94, end);
  return `M 100 100 L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 94 94 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

export function Roleta() {
  const t = useTranslations("games.roleta");
  const challenges = t.raw("challenges") as Challenge[];

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Challenge | null>(null);

  function spin() {
    if (spinning) return;
    setResult(null);
    setSpinning(true);
    const extraTurns = 5 * 360;
    const randomOffset = Math.floor(Math.random() * 360);
    setRotation((current) => current + extraTurns + randomOffset);
  }

  function handleStop() {
    if (!spinning) return;
    setSpinning(false);
    const picked =
      challenges[Math.floor(Math.random() * challenges.length)] ?? null;
    setResult(picked);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div
          aria-hidden
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/3"
        >
          <div className="h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-accent drop-shadow-[0_2px_6px_rgba(230,162,60,0.4)]" />
        </div>

        <div
          className="h-64 w-64 sm:h-72 sm:w-72"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 4s cubic-bezier(0.12, 0.8, 0.2, 1)"
              : "none",
          }}
          onTransitionEnd={handleStop}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
            {SEGMENT_EMOJIS.map((emoji, index) => {
              const mid = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
              const pos = polar(100, 100, 62, mid);
              return (
                <g key={emoji}>
                  <path
                    d={wedgePath(index)}
                    fill={
                      index % 2 === 0
                        ? "var(--color-surface-raised)"
                        : "var(--color-surface-overlay)"
                    }
                    stroke="var(--color-border-strong)"
                    strokeWidth="1"
                  />
                  <text
                    x={pos.x}
                    y={pos.y}
                    fontSize="17"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${mid} ${pos.x} ${pos.y})`}
                  >
                    {emoji}
                  </text>
                </g>
              );
            })}
            <circle
              cx="100"
              cy="100"
              r="94"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="2"
            />
            <circle
              cx="100"
              cy="100"
              r="14"
              fill="var(--color-surface)"
              stroke="var(--color-accent)"
              strokeWidth="2"
            />
            <circle cx="100" cy="100" r="4" fill="var(--color-accent)" />
          </svg>
        </div>
      </div>

      <Button size="lg" onClick={spin} disabled={spinning}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {spinning ? t("spinning") : t("spin")}
      </Button>

      {result && (
        <Card className="animate-fade-up w-full max-w-md border-accent/25 p-6 text-center">
          <p className="text-4xl" aria-hidden>
            {result.emoji}
          </p>
          <h3 className="mt-3 font-semibold text-accent">{result.title}</h3>
          <p className="mt-1.5 leading-relaxed text-foreground">
            {result.text}
          </p>
        </Card>
      )}
    </div>
  );
}
