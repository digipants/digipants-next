const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertDisposableLoopbackDatabaseUrl(value: string | undefined, expectedDatabase: string): URL {
  if (!value) throw new Error("A disposable local PostgreSQL URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The disposable PostgreSQL URL is invalid.");
  }
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol)) ||
      !LOOPBACK_HOSTS.has(parsed.hostname) ||
      decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabase ||
      (parsed.port !== "" && parsed.port !== "5432") ||
      ["host", "hostaddr", "service", "servicefile"].some((key) => parsed.searchParams.has(key))) {
    throw new Error("Only the named loopback PostgreSQL test database is allowed.");
  }
  return parsed;
}
