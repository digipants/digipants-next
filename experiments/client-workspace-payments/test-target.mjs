const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertDisposablePaymentsDatabaseUrl(value) {
  if (!value) throw new Error("A disposable payment experiment database URL is required.");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("The payment database URL is invalid."); }
  if (!(parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") ||
      !LOOPBACK_HOSTS.has(parsed.hostname) ||
      decodeURIComponent(parsed.pathname.slice(1)) !== "cw_payments_test" ||
      (parsed.port !== "" && parsed.port !== "5432" && parsed.port !== "55434") ||
      ["host", "hostaddr", "service", "servicefile"].some((key) => parsed.searchParams.has(key))) {
    throw new Error("Only the named loopback payment test database is allowed.");
  }
  return parsed;
}
