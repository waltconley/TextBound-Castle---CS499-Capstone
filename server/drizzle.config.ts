import { defineConfig } from "drizzle-kit";
import type { Config } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts", // Path to your Drizzle schema file
  out: "./drizzle", // Directory where migrations will be generated
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Drizzle-Kit needs this to connect
  },
  verbose: true,
  strict: true,
}) satisfies Config;
