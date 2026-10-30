import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma 7 keeps connection details out of schema.prisma. Requiring an
  // explicit direct URL prevents migration commands from falling back to a
  // guessed database; offline client generation does not connect.
  datasource: {
    url: process.env.DIRECT_URL ?? "",
    ...(process.env.SHADOW_DIRECT_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DIRECT_URL }
      : {}),
  },
});
