export function resolveWorkspaceTestTarget({ databaseUrl, neonApproval, localApproval, expectedNeonHost }) {
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    throw new Error("Set the guarded test DATABASE_URL.");
  }
  if (neonApproval === "1" && localApproval === "1") {
    throw new Error("Choose exactly one database-test target.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("The guarded test DATABASE_URL is invalid.");
  }
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("The guarded test DATABASE_URL must use PostgreSQL.");
  }
  if (parsedUrl.pathname !== "/digipants_workspace_dev") {
    throw new Error("The guarded database name does not match the synthetic test database.");
  }

  if (neonApproval === "1") {
    if (typeof expectedNeonHost !== "string" ||
        !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+neon\.tech$/i.test(expectedNeonHost)) {
      throw new Error("Set WORKSPACE_DB_TEST_EXPECTED_HOST to the separately approved exact Neon hostname.");
    }
    if ((parsedUrl.port && parsedUrl.port !== "5432") ||
        ["host", "hostaddr", "port", "service", "servicefile"].some((key) => parsedUrl.searchParams.has(key))) {
      throw new Error("DATABASE_URL contains an unapproved Neon connection override.");
    }
    if (parsedUrl.hostname.toLowerCase() !== expectedNeonHost.toLowerCase()) {
      throw new Error("DATABASE_URL host does not match WORKSPACE_DB_TEST_EXPECTED_HOST.");
    }
    return "neon";
  }

  if (localApproval === "1" && ["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
    return "local";
  }
  throw new Error("Use an exact approved Neon host or explicitly enable a loopback-only test database.");
}
