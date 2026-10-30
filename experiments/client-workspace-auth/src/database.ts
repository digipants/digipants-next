import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";
import { assertDisposableLoopbackDatabaseUrl } from "./test-target.js";

function clientFor(connectionString: string | undefined, name: string, expectedDatabase: string): PrismaClient {
  if (process.env.NODE_ENV === "production" || process.env.AUTH_EXPERIMENT_ENABLED !== "1") {
    throw new Error("The Better Auth experiment is disabled outside an explicitly enabled local/CI test.");
  }
  if (!connectionString) throw new Error(`${name} is required for the local auth experiment.`);
  assertDisposableLoopbackDatabaseUrl(connectionString, expectedDatabase);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, connectionTimeoutMillis: 5_000 }),
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
