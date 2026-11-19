"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { update, pending, searchParams };
}

export function FilterSelect({
  param,
  label,
  options,
  allLabel,
  defaultValue,
  className,
}: {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  defaultValue?: string;
  className?: string;
}) {
  const { update, searchParams } = useUpdateParams();
  const value = searchParams.get(param) ?? defaultValue ?? "all";
  return (
    <Select value={value} onValueChange={(v) => update(param, v === "all" || v === defaultValue ? null : v)}>
      <SelectTrigger aria-label={label} className={cn("h-9 w-full bg-card sm:w-auto sm:min-w-[170px]", className)}>
        <SelectValue placeholder={label}>{options.find((o) => o.value === value)?.label ?? allLabel ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchFilter({ param = "q", placeholder }: { param?: string; placeholder: string }) {
  const { update, searchParams, pending } = useUpdateParams();
  const current = searchParams.get(param) ?? "";
  const [text, setText] = useState(current);
  const [synced, setSynced] = useState(current);
  if (synced !== current) {
    setSynced(current);
    setText(current);
  }
  useEffect(() => {
    if (text === current) return;
    const timer = setTimeout(() => update(param, text.trim() || null), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="relative w-full sm:w-64">
      <Search className={cn("pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground", pending && "animate-pulse")} />
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={80} className="h-9 bg-card pl-8" />
    </div>
  );
}
