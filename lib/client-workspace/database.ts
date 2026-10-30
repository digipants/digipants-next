import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForWorkspaceDatabase = globalThis as typeof globalThis & {
  workspacePrisma?: PrismaClient;
};

/**
 * Lazily creates one small Prisma pool per warm Node process. This module is
 * server-only; callers still need a validated session and must authorize each
 * operation against the effective grants loaded from PostgreSQL.
 */
export function getWorkspacePrisma(): PrismaClient {
  if (globalForWorkspaceDatabase.workspacePrisma) {
    return globalForWorkspaceDatabase.workspacePrisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Client Workspace database is not configured.");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    }),
  });

  globalForWorkspaceDatabase.workspacePrisma = client;
  return client;
}
