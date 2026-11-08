import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./examples/d1/drizzle",
  schema: "./db/schema.ts",
  dialect: "sqlite",
});
