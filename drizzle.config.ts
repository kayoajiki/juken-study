import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./local-dev.db",
    ...(process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  },
});
