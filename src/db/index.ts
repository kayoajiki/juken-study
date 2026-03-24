import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _db: LibSQLDatabase<typeof schema> | null = null;
let _client: Client | null = null;

function createLibsqlClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  return createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
}

/** Server / Node のみで使用（Middleware では使わない） */
export function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    _client = createLibsqlClient();
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export type Database = LibSQLDatabase<typeof schema>;
export * from "./schema";
