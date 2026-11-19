"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { ALERT_CHANNELS, ALERT_KEYS, ALERT_LABELS, type AlertChannel, type AlertKey } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type { Preferences } from "@/lib/types";

type PaperlessKey = "paperlessStatements" | "paperlessTaxDocuments" | "paperlessConfirmations";

const PAPERLESS: Array<{ key: PaperlessKey; label: string; description: string }> = [
  { key: "paperlessStatements", label: "Statements and reports", description: "Monthly statements and quarterly performance reports." },
  { key: "paperlessTaxDocuments", label: "Tax documents", description: "Forms 1099 and 5498. Paper copies are mailed if this is off." },
  { key: "paperlessConfirmations", label: "Trade confirmations", description: "A confirmation for every buy and sell." },
];

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: string, patch: Record<string, unknown>, optimistic: Preferences) {
    const previous = prefs;
    setPrefs(optimistic);
    setSaving(key);
    try {
      setPrefs(await apiFetch<Preferences>("/api/profile/preferences", { method: "PATCH", body: patch }));
      toast.success("Preferences saved");
    } catch (error) {
      setPrefs(previous);
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  const togglePaperless = (key: PaperlessKey, value: boolean) => void save(key, { [key]: value }, { ...prefs, [key]: value });

  const toggleAlert = (key: AlertKey, channel: AlertChannel, value: boolean) =>
    void save(`${key}.${channel}`, { alerts: { [key]: { [channel]: value } } }, {
      ...prefs,
      alerts: { ...prefs.alerts, [key]: { ...prefs.alerts[key], [channel]: value } },
    });

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 text-[13px] font-semibold">Paperless delivery</h3>
        <p className="mb-3 text-[12.5px] text-muted-foreground">Documents you choose to receive online appear on the Documents page.</p>
        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          {PAPERLESS.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor={p.key} className="min-w-0">
                <span className="block text-[13.5px] font-medium">{p.label}</span>
                <span className="block text-[12px] text-muted-foreground">{p.description}</span>
              </label>
              <Switch id={p.key} checked={prefs[p.key]} disabled={saving === p.key} onCheckedChange={(v) => togglePaperless(p.key, v)} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 text-[13px] font-semibold">Alerts</h3>
        <p className="mb-3 text-[12.5px] text-muted-foreground">Choose how we let you know about account events.</p>
        <div className="overflow-hidden rounded-md border border-border/70">
          <div className="grid grid-cols-[1fr_64px_64px] items-center bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            <span>Alert</span>
            <span className="text-center">Email</span>
            <span className="text-center">Text</span>
          </div>
          {ALERT_KEYS.map((key) => (
            <div key={key} className="grid grid-cols-[1fr_64px_64px] items-center border-t border-border/60 px-4 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-[13.5px] font-medium">{ALERT_LABELS[key].label}</p>
                <p className="text-[12px] text-muted-foreground">{ALERT_LABELS[key].description}</p>
              </div>
              {ALERT_CHANNELS.map((channel) => (
                <div key={channel} className="flex justify-center">
                  <Switch
                    aria-label={`${ALERT_LABELS[key].label} by ${channel}`}
                    checked={prefs.alerts[key][channel]}
                    disabled={saving === `${key}.${channel}`}
                    onCheckedChange={(v) => toggleAlert(key, channel, v)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      <p className="text-[11.5px] text-muted-foreground">Last updated {formatDateTime(prefs.updatedAt)}</p>
    </div>
  );
}
