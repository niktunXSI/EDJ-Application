import { databaseKind, sql } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export async function GET() {
  try {
    await sql("select 1");
    return json({ status: "ok", database: databaseKind() });
  } catch {
    return json({ status: "unavailable", database: databaseKind() }, 503);
  }
}
