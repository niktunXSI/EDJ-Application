"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { HISTORY_RANGES, HISTORY_RANGE_LABELS, type HistoryRange } from "@/lib/domain";
import { formatCompactCurrency, formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import type { ValueHistory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Change } from "./change";

const W = 800;
const H = 220;

export function ValueChart({
  initial,
  initialRange = "1y",
  endpoint,
  caption = "Change in value",
}: {
  initial: ValueHistory;
  initialRange?: HistoryRange;
  endpoint: string;
  caption?: string;
}) {
  const [range, setRange] = useState<HistoryRange>(initialRange);
  const [history, setHistory] = useState(initial);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const geometry = useMemo(() => {
    const points = history.points;
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || max * 0.05 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;
    const ticks = [0.2, 0.5, 0.8].map((t) => lo + (hi - lo) * t);
    return { line, area, x, y, ticks, lo, hi };
  }, [history]);

  function choose(next: HistoryRange) {
    if (next === range) return;
    setRange(next);
    startTransition(async () => {
      try {
        setHistory(await apiFetch<ValueHistory>(`${endpoint}?range=${next}`));
      } catch (error) {
        toast.error(errorMessage(error));
      }
    });
  }

  const points = history.points;
  const active = hover !== null ? points[hover] : null;
  const positive = history.change >= 0;
  const stroke = positive ? "#1d4a37" : "#9b2c1f";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          {active ? (
            <span>
              <span className="tabular text-[15px] font-semibold text-foreground">{formatCurrency(active.value)}</span>
              <span className="ml-2">{formatDate(active.date)}</span>
            </span>
          ) : (
            <span>
              {caption} ({HISTORY_RANGE_LABELS[range]}): <Change amount={history.change} percent={history.changePercent} className="text-[13px]" />
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Time range" className="inline-flex rounded-md border border-border bg-muted/60 p-0.5">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === range}
              onClick={() => choose(r)}
              className={cn(
                "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
                r === range ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {HISTORY_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("relative transition-opacity", pending && "opacity-50")}>
        {geometry ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between py-0 text-[10.5px] text-muted-foreground">
              {[...geometry.ticks].reverse().map((t, i) => (
                <span key={i} className="tabular" style={{ position: "absolute", top: `${(1 - (t - geometry.lo) / (geometry.hi - geometry.lo)) * 100}%`, transform: "translateY(-50%)" }}>
                  {formatCompactCurrency(t)}
                </span>
              ))}
            </div>
            <div className="relative ml-12 h-[220px]">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-full w-full overflow-visible"
                role="img"
                aria-label={`Account value over ${HISTORY_RANGE_LABELS[range]}`}
                onMouseLeave={() => setHover(null)}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
                  setHover(Math.round(ratio * (points.length - 1)));
                }}
              >
                <defs>
                  <linearGradient id="value-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {geometry.ticks.map((t, i) => (
                  <line key={i} x1="0" x2={W} y1={geometry.y(t)} y2={geometry.y(t)} stroke="#e2dccd" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={geometry.area} fill="url(#value-fill)" />
                <path d={geometry.line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                {hover !== null && (
                  <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1="0" y2={H} stroke="#23272b" strokeOpacity="0.35" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
              {hover !== null && active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(geometry.x(hover) / W) * 100}%`, top: `${(geometry.y(active.value) / H) * 100}%`, background: stroke }}
                />
              )}
            </div>
            <div className="ml-12 mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatShortDate(points[0].date)}</span>
              <span>{formatShortDate(points[Math.floor(points.length / 2)].date)}</span>
              <span>{formatShortDate(points[points.length - 1].date)}</span>
            </div>
          </>
        ) : (
          <p className="py-16 text-center text-[13px] text-muted-foreground">No value history is available for this range yet.</p>
        )}
      </div>
    </div>
  );
}
