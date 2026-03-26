import { neon } from "@neondatabase/serverless";
import type { DataStore } from "./store";

let sqlInstance: ReturnType<typeof neon> | null = null;

export function postgresConnectionString(): string | undefined {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
}

export function isPostgresStoreEnabled(): boolean {
  return Boolean(postgresConnectionString());
}

function sql() {
  const cs = postgresConnectionString();
  if (!cs) throw new Error("POSTGRES_URL or DATABASE_URL is not set");
  if (!sqlInstance) sqlInstance = neon(cs);
  return sqlInstance;
}

let tableEnsured = false;

export async function ensureCrewdocTable(): Promise<void> {
  if (tableEnsured) return;
  const s = sql();
  await s`
    CREATE TABLE IF NOT EXISTS crewdoc_kv (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload jsonb NOT NULL
    )
  `;
  tableEnsured = true;
}

export async function loadStoreFromPostgres(): Promise<DataStore | null> {
  if (!isPostgresStoreEnabled()) return null;
  await ensureCrewdocTable();
  const rows = (await sql()`
    SELECT payload FROM crewdoc_kv WHERE id = 1
  `) as { payload: unknown }[];
  if (!rows.length) return null;
  const payload = rows[0].payload;
  const parsed =
    typeof payload === "string"
      ? (JSON.parse(payload) as DataStore)
      : (payload as DataStore);
  return parsed;
}

export async function saveStoreToPostgres(store: DataStore): Promise<void> {
  if (!isPostgresStoreEnabled()) {
    throw new Error("POSTGRES_URL or DATABASE_URL is not set");
  }
  await ensureCrewdocTable();
  const s = sql();
  const json = JSON.stringify(store);
  /** Serialize writers so concurrent serverless calls are less likely to clobber JSON. */
  await s.transaction([
    s`SELECT pg_advisory_xact_lock(842001)`,
    s`
      INSERT INTO crewdoc_kv (id, payload) VALUES (1, ${json}::jsonb)
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload
    `,
  ]);
}
