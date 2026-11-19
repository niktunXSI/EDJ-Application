import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from "@/lib/domain";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@/lib/format";
import type { AllocationSlice } from "@/lib/types";

export function AllocationDonut({ slices, size = 168, label = "Invested" }: { slices: AllocationSlice[]; size?: number; label?: string }) {
  const radius = 15.9155;
  const total = slices.reduce((s, x) => s + x.value, 0);
  const offsets = slices.map((_, i) => 25 - slices.slice(0, i).reduce((s, x) => s + x.weight * 100, 0));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label="Asset allocation" className="shrink-0">
        <circle cx="21" cy="21" r={radius} fill="transparent" stroke="#efeadd" strokeWidth="5.5" />
        {slices.map((slice, i) => {
          const pct = slice.weight * 100;
          return (
            <circle
              key={slice.assetClass}
              cx="21"
              cy="21"
              r={radius}
              fill="transparent"
              stroke={ASSET_CLASS_COLORS[slice.assetClass]}
              strokeWidth="5.5"
              strokeDasharray={`${Math.max(pct - 0.4, 0)} ${100 - Math.max(pct - 0.4, 0)}`}
              strokeDashoffset={offsets[i]}
            />
          );
        })}
        <text x="21" y="20" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 2.6 }}>
          {label}
        </text>
        <text x="21" y="24.2" textAnchor="middle" className="fill-foreground font-semibold" style={{ fontSize: 3.6 }}>
          {formatCompactCurrency(total)}
        </text>
      </svg>
      <ul className="w-full space-y-2">
        {slices.map((slice) => (
          <li key={slice.assetClass} className="flex items-center gap-2.5 text-[13px]">
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: ASSET_CLASS_COLORS[slice.assetClass] }} />
            <span className="flex-1 text-foreground">{ASSET_CLASS_LABELS[slice.assetClass]}</span>
            <span className="tabular text-muted-foreground">{formatCurrency(slice.value, { whole: true })}</span>
            <span className="tabular w-14 text-right font-medium">{formatPercent(slice.weight).replace(".00", "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
