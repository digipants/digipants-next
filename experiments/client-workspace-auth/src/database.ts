import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";
import { assertDisposableLoopbackDatabaseUrl } from "./test-target.js";
import {
  assertStagingRuntimeDatabaseUrl, workspaceRuntimeMode,
} from "./workspace-runtime.js";

function clientFor(connectionString: string | undefined, name: string, expectedDatabase: string): PrismaClient {
  const mode = workspaceRuntimeMode();
  if (mode === "disabled") throw new Error("Client Workspace database access is disabled in this deployment context.");
  if (!connectionString) throw new Error(`${name} is required for the enabled Client Workspace runtime.`);
  if (mode === "local-test") {
    assertDisposableLoopbackDatabaseUrl(connectionString, expectedDatabase);
  } else {
    assertStagingRuntimeDatabaseUrl(connectionString, expectedDatabase, name);
  }
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    }),
  });
}

const globalDatabase = globalThis as typeof globalThis & {
  authExperimentAuthDb?: PrismaClient;
  authExperimentWorkspaceDb?: PrismaClient;
};

export function getAuthPrisma(): PrismaClient {
  return globalDatabase.authExperimentAuthDb ??= clientFor(process.env.AUTH_DATABASE_URL, "AUTH_DATABASE_URL", "auth_spike_test");
}

export function getWorkspacePrisma(): PrismaClient {
  return globalDatabase.authExperimentWorkspaceDb ??= clientFor(process.env.WORKSPACE_DATABASE_URL, "WORKSPACE_DATABASE_URL", "digipants_workspace_dev");
}
