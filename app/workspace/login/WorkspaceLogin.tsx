"use client";

import { useEffect, useState, type FormEvent } from "react";

type Stage = "credentials" | "mfa" | "complete";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PROJECT_PATH = new RegExp("^/workspace/tenants/" + UUID + "/projects/" + UUID + "/?$", "i");

async function postAuth(path: string, body: Record<string, unknown>) {
  return fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function WorkspaceLogin() {
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextPath = new URLSearchParams(window.location.search).get("next");
    // Redirect only to an exact relative project path; never external hosts,
    // browser fragments, query strings, alternate schemes or auth endpoints.
    if (nextPath && PROJECT_PATH.test(nextPath)) setNext(nextPath);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      const response = await postAuth("sign-in/email", {
        email: email.trim().toLowerCase(), password,
      });
      const result = await response.json().catch(() => null);
      setPassword("");
      if (!response.ok || result?.twoFactorRedirect !== true) {
        setError("Sign-in could not be completed. Use an invited account with verified MFA.");
        return;
      }
      setStage("mfa");
    } catch {
      setError("The private sign-in service is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\\d{6}$/.test(code)) return;
    setBusy(true);
    setError("");
    try {
      const response = await postAuth("two-factor/verify-totp", { code, trustDevice: false });
      setCode("");
      if (!response.ok) {
        setError("Verification failed. Check your authenticator and try again.");
        return;
      }
      const session = await fetch("/api/auth/get-session", {
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
      });
      const body = await session.json().catch(() => null);
      if (!session.ok || !body?.session?.id) {
        setError("Your session was not confirmed. Please sign in again.");
        setStage("credentials");
        return;
      }
      if (next) {
        window.location.assign(next);
        return;
      }
      setStage("complete");
    } catch {
      setError("Verification is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-16 sm:py-24">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" aria-hidden>DP</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Private project access</p>
          <h1 className="text-2xl font-semibold tracking-tight">DigiPants Client Workspace</h1>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8" aria-labelledby="workspace-signin-title">
        {stage === "credentials" && (
          <>
            <h2 id="workspace-signin-title" className="text-xl font-semibold">Sign in to your project</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Access is limited to invited clients. Your account must have an approved project grant and verified two-factor authentication.</p>
            <form className="mt-6 space-y-5" onSubmit={signIn}>
              <label className="block text-sm font-medium">
                Email
                <input required autoComplete="username" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-zinc-700" />
              </label>
              <label className="block text-sm font-medium">
                Password
                <input required autoComplete="current-password" type="password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-zinc-700" />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{busy ? "Checking…" : "Continue securely"}</button>
            </form>
          </>
        )}

        {stage === "mfa" && (
          <>
            <h2 id="workspace-signin-title" className="text-xl font-semibold">Verify your authenticator</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Enter the six-digit time-based code from your authenticator. The project only opens after the server verifies this step and your current project access.</p>
            <form className="mt-6 space-y-5" onSubmit={verifyMfa}>
              <label className="block text-sm font-medium">
                Authenticator code
                <input required inputMode="numeric" autoComplete="one-time-code" type="text" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-lg tracking-[0.2em] focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-zinc-700" />
              </label>
              <button type="submit" disabled={busy || code.length !== 6} className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{busy ? "Verifying…" : "Verify and continue"}</button>
              <button type="button" className="text-sm underline underline-offset-4" onClick={() => { setStage("credentials"); setCode(""); setError(""); }}>Use another account</button>
            </form>
          </>
        )}

        {stage === "complete" && (
          <>
            <h2 id="workspace-signin-title" className="text-xl font-semibold">Sign-in verified</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Your session was verified. Open the exact project URL supplied by your DigiPants project owner. Access is rechecked for each project request.</p>
          </>
        )}

        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">{error}</p>}
      </section>
      <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">Invitation only. No project data is stored in this browser form. Access problems? Email <a className="underline underline-offset-2" href="mailto:support@digipants.com">support@digipants.com</a>.</p>
    </div>
  );
}
