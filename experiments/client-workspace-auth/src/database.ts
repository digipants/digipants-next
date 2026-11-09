import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";
import { assertDisposableLoopbackDatabaseUrl } from "./test-target.js";
import {
  assertProductionRuntimeDatabaseUrl, assertStagingRuntimeDatabaseUrl, workspaceRuntimeMode,
} from "./workspace-runtime.js";

function clientFor(name: "AUTH_DATABASE_URL" | "WORKSPACE_DATABASE_URL", stagingDatabase: string,
  productionName: "PRODUCTION_AUTH_DATABASE_URL" | "PRODUCTION_WORKSPACE_DATABASE_URL",
  productionDatabase: string): PrismaClient {
  const mode = workspaceRuntimeMode();
  if (mode === "disabled") throw new Error("Client Workspace database access is disabled in this deployment context.");
  const production = mode === "production";
  const connectionName = production ? productionName : name;
  const expectedDatabase = production ? productionDatabase : stagingDatabase;
  const connectionString = process.env[connectionName];
  if (!connectionString) throw new Error(`${name} is required for the enabled Client Workspace runtime.`);
  if (mode === "local-test") {
    assertDisposableLoopbackDatabaseUrl(connectionString, expectedDatabase);
  } else if (production) {
    assertProductionRuntimeDatabaseUrl(connectionString, expectedDatabase, connectionName);
  } else {
    assertStagingRuntimeDatabaseUrl(connectionString, expectedDatabase, connectionName);
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
  return globalDatabase.authExperimentAuthDb ??= clientFor(
    "AUTH_DATABASE_URL", "auth_spike_test", "PRODUCTION_AUTH_DATABASE_URL", "digipants_auth_prod",
  );
}

export function getWorkspacePrisma(): PrismaClient {
  return globalDatabase.authExperimentWorkspaceDb ??= clientFor(
    "WORKSPACE_DATABASE_URL", "digipants_workspace_dev", "PRODUCTION_WORKSPACE_DATABASE_URL", "digipants_workspace_prod",
  );
}
