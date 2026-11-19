import "server-only";
import type { Advisor, Client, Household, ServiceTeamMember } from "@/lib/types";
import { sql } from "../db";
import { notFound } from "../http";

export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function maskAccountNumber(accountNumber: string) {
  const parts = accountNumber.split("-");
  const core = parts.length > 1 ? parts[1] : accountNumber;
  return `••••${core.replace(/\D/g, "").slice(-4)}`;
}

interface ClientRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  is_primary: boolean;
}

export async function listClients(householdId: string): Promise<Client[]> {
  const rows = await sql<ClientRow>("select * from clients where household_id = $1 order by is_primary desc, id", [householdId]);
  return rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    fullName: `${r.first_name} ${r.last_name}`,
    dateOfBirth: r.date_of_birth,
    email: r.email,
    phone: r.phone,
    addressLine: r.address_line,
    city: r.city,
    state: r.state,
    postalCode: r.postal_code,
    isPrimary: r.is_primary,
  }));
}

export async function getHousehold(householdId: string): Promise<Household> {
  const [row] = await sql<{
    id: string;
    name: string;
    segment: string;
    client_since: string;
    service_team: ServiceTeamMember[] | string;
    advisor_id: string;
    advisor_name: string;
    title: string;
    branch: string;
    address_line: string;
    city: string;
    state: string;
    phone: string;
    email: string;
  }>(
    `select h.id, h.name, h.segment, h.client_since, h.service_team, a.id as advisor_id, a.name as advisor_name,
            a.title, a.branch, a.address_line, a.city, a.state, a.phone, a.email
       from households h join advisors a on a.id = h.advisor_id
      where h.id = $1`,
    [householdId],
  );
  if (!row) throw notFound("Household");
  const advisor: Advisor = {
    id: row.advisor_id,
    name: row.advisor_name,
    title: row.title,
    branch: row.branch,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
  };
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    clientSince: row.client_since,
    advisor,
    serviceTeam: typeof row.service_team === "string" ? JSON.parse(row.service_team) : row.service_team,
    clients: await listClients(householdId),
  };
}
