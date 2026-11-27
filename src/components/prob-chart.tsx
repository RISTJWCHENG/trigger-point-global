"use client";

import { useMemo, useState } from "react";
import { cn, formatDateTime, formatPercent } from "@/lib/format";
import type { AnswerView, PointView } from "@/lib/types";

const COLORS = ["var(--action)", "var(--yes)", "var(--no)", "#8C7355", "#5E7388", "#6E6A62", "#4F5E56", "#7A6A78"];
const FRAMES = ["1D", "1W", "1M", "ALL"] as const;

export function ProbChart({
  points,
  answers,
  type,
}: {
  points: PointView[];
  answers: AnswerView[];
  type: "BINARY" | "MULTIPLE";
}) {
  const [frame, setFrame] = useState<(typeof FRAMES)[number]>("ALL");
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const height = 220;
  const pad = { l: 36, r: 12, t: 16, b: 22 };

  const shown = useMemo(() => {
    const now = points.length ? points[points.length - 1].t : Date.now();
    const windowMs = frame === "1D" ? 86_400_000 : frame === "1W" ? 7 * 86_400_000 : frame === "1M" ? 30 * 86_400_000 : 0;
    const filtered = windowMs ? points.filter((point) => point.t >= now - windowMs) : points;
    const source = filtered.length >= 2 ? filtered : points;
    if (source.length === 1) return [source[0], { ...source[0], t: source[0].t + 1 }];
    return source;
  }, [points, frame]);

  const series = useMemo(() => {
    if (type === "BINARY") {
      return [{ id: "YES", label: "Yes", color: COLORS[0], values: shown.map((point) => point.snapshot.YES ?? point.p) }];
    }
    return answers.map((answer, index) => ({
      id: answer.id,
      label: answer.text,
      color: COLORS[index % COLORS.length],
      values: shown.map((point) => point.snapshot[answer.id] ?? answer.probability),
    }));
  }, [answers, shown, type]);

  const t0 = shown[0]?.t ?? 0;
  const t1 = shown[shown.length - 1]?.t ?? 1;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const xAt = (t: number) => pad.l + ((t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * innerW);
  const yAt = (p: number) => pad.t + (1 - Math.min(1, Math.max(0, p))) * innerH;

  const hoverPoint = hover === null ? null : shown[Math.max(0, Math.min(shown.length - 1, hover))];
  const hoverX = hoverPoint ? xAt(hoverPoint.t) : 0;

  function move(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const target = t0 + Math.min(1, Math.max(0, ratio)) * (t1 - t0);
    let best = 0;
    let bestDist = Infinity;
    shown.forEach((point, index) => {
      const dist = Math.abs(point.t - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    setHover(best);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">Probability</h2>
        <div className="flex rounded-lg bg-pill p-0.5 text-xs">
          {FRAMES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFrame(item)}
              className={cn("rounded-md px-2 py-1", frame === item ? "bg-card text-ink shadow-card" : "text-secondary")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full touch-none"
          role="img"
          aria-label="Probability history"
          onPointerMove={move}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--line)" strokeWidth="1" />
              <text x={pad.l - 8} y={yAt(tick) + 3} textAnchor="end" fill="var(--muted)" fontSize="11">
                {Math.round(tick * 100)}
              </text>
            </g>
          ))}
          {type === "BINARY" && series[0] && (
            <path
              d={`${series[0].values
                .map((value, index) => `${index === 0 ? "M" : "L"}${xAt(shown[index].t).toFixed(1)},${yAt(value).toFixed(1)}`)
                .join(" ")} L${xAt(t1).toFixed(1)},${yAt(0).toFixed(1)} L${xAt(t0).toFixed(1)},${yAt(0).toFixed(1)} Z`}
              fill="var(--action)"
              opacity="0.08"
            />
          )}
          {series.map((item) => (
            <path
              key={item.id}
              d={item.values
                .map((value, index) => `${index === 0 ? "M" : "L"}${xAt(shown[index].t).toFixed(1)},${yAt(value).toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke={item.color}
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hoverPoint && (
            <line x1={hoverX} x2={hoverX} y1={pad.t} y2={height - pad.b} stroke="var(--muted)" strokeDasharray="3 3" />
          )}
          {hoverPoint &&
            series.map((item) => (
              <circle
                key={item.id}
                cx={hoverX}
                cy={yAt(item.values[hover ?? 0] ?? 0)}
                r="3.5"
                fill="var(--card)"
                stroke={item.color}
                strokeWidth="1.6"
              />
            ))}
        </svg>
        {hoverPoint && (
          <div
            className="pointer-events-none absolute top-3 z-10 w-max max-w-[220px] rounded-lg border border-line bg-card px-2.5 py-2 text-xs shadow-card"
            style={{ left: `clamp(8px, ${(hoverX / width) * 100}%, calc(100% - 180px))` }}
          >
            <div className="text-muted">{formatDateTime(hoverPoint.t)}</div>
            <div className="mt-1 space-y-0.5">
              {series.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="num font-medium text-ink">{formatPercent(item.values[hover ?? 0] ?? 0, 1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {type === "MULTIPLE" && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary">
          {series.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
