import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.AUTH_DATABASE_URL ?? "",
    ...(process.env.AUTH_SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.AUTH_SHADOW_DATABASE_URL }
      : {}),
  },
});
