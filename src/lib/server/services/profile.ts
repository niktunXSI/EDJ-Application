import "server-only";
import { z } from "zod";
import { ALERT_CHANNELS, ALERT_KEYS, type AlertSettings } from "@/lib/domain";
import type { Preferences } from "@/lib/types";
import { sql } from "../db";
import { defaultAlerts } from "../seed";
import { iso } from "./household";

interface PreferencesRow {
  paperless_statements: boolean;
  paperless_tax_documents: boolean;
  paperless_confirmations: boolean;
  alerts: AlertSettings | string;
  updated_at: Date | string;
}

function normaliseAlerts(value: unknown): AlertSettings {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const alerts = defaultAlerts();
  for (const key of ALERT_KEYS) {
    for (const channel of ALERT_CHANNELS) {
      const v = (parsed as Record<string, Record<string, unknown>> | null)?.[key]?.[channel];
      if (typeof v === "boolean") alerts[key][channel] = v;
    }
  }
  return alerts;
}

function toPreferences(row: PreferencesRow): Preferences {
  return {
    paperlessStatements: row.paperless_statements,
    paperlessTaxDocuments: row.paperless_tax_documents,
    paperlessConfirmations: row.paperless_confirmations,
    alerts: normaliseAlerts(row.alerts),
    updatedAt: iso(row.updated_at),
  };
}

export async function getPreferences(householdId: string): Promise<Preferences> {
  await sql("insert into preferences (household_id, alerts) values ($1, $2) on conflict (household_id) do nothing", [
    householdId,
    JSON.stringify(defaultAlerts()),
  ]);
  const [row] = await sql<PreferencesRow>("select * from preferences where household_id = $1", [householdId]);
  return toPreferences(row);
}

const channelSchema = z.object({ email: z.boolean().optional(), text: z.boolean().optional() }).strict();

export const preferencesUpdateSchema = z
  .object({
    paperlessStatements: z.boolean().optional(),
    paperlessTaxDocuments: z.boolean().optional(),
    paperlessConfirmations: z.boolean().optional(),
    alerts: z.partialRecord(z.enum(ALERT_KEYS), channelSchema).optional(),
  })
  .strict();

export async function updatePreferences(householdId: string, raw: unknown): Promise<Preferences> {
  const input = preferencesUpdateSchema.parse(raw);
  const current = await getPreferences(householdId);
  const alerts = current.alerts;
  for (const [key, channels] of Object.entries(input.alerts ?? {})) {
    for (const channel of ALERT_CHANNELS) {
      const value = channels?.[channel];
      if (typeof value === "boolean") alerts[key as keyof AlertSettings][channel] = value;
    }
  }
  const [row] = await sql<PreferencesRow>(
    `update preferences set paperless_statements = $2, paperless_tax_documents = $3, paperless_confirmations = $4,
                            alerts = $5, updated_at = now()
      where household_id = $1 returning *`,
    [
      householdId,
      input.paperlessStatements ?? current.paperlessStatements,
      input.paperlessTaxDocuments ?? current.paperlessTaxDocuments,
      input.paperlessConfirmations ?? current.paperlessConfirmations,
      JSON.stringify(alerts),
    ],
  );
  return toPreferences(row);
}
