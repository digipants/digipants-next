"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";

type Phase = "recipient" | "proof" | "mfa" | "complete" | "unavailable";
const ENDPOINT = "/api/workspace/founder/verification/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Za-z0-9_-]{43}$/;

async function authPost(path: string, body: Record<string, string>) {
  return fetch("/api/auth/" + path + "/", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function FounderEnrollment() {
  const [phase, setPhase] = useState<Phase>("recipient");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [proof, setProof] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim() || email.length > 254) return;
    setBusy(true);
    setError("");
    try {
      const session = await fetch(ENDPOINT, {
        credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer",
      });
      const init = await session.json().catch(() => null);
      if (!session.ok || typeof init?.csrf !== "string") throw new Error("unavailable");
      const response = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { "content-type": "application/json", "x-workspace-csrf": init.csrf },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.challengeId !== "string" || !UUID.test(result.challengeId)) {
        throw new Error("unavailable");
      }
      setChallengeId(result.challengeId);
      setEmail(email.trim().toLowerCase());
      setPhase("proof");
    } catch {
      setError("Founder mailbox verification is not available yet. Ask DigiPants to check the protected staging setup.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !UUID.test(challengeId) || !CODE.test(proof) ||
        password.length < 12 || password.length > 128 || !name.trim() || name.trim().length > 160) return;
    setBusy(true);
    setError("");
    try {
      // The dedicated route carries the proof as headers so it cannot end up in
      // the page URL, referrer, or browser history.
      const verifiedSignup = await fetch("/api/auth/sign-up/email/", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: {
          "content-type": "application/json",
          "x-digipants-founder-bootstrap-challenge-id": challengeId,
          "x-digipants-founder-mail-proof": proof,
        },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      if (!verifiedSignup.ok) throw new Error("signup-denied");
      setProof("");
      setChallengeId("");
      const enable = await authPost("two-factor/enable", { method: "totp", password });
      setPassword("");
      const result = await enable.json().catch(() => null);
      if (!enable.ok || result?.method !== "totp" || typeof result?.totpURI !== "string" ||
          !result.totpURI.startsWith("otpauth://totp/") || !Array.isArray(result.backupCodes) ||
          !result.backupCodes.every((value: unknown) => typeof value === "string")) {
        setError("Your account was created, but authenticator setup needs assistance. Contact DigiPants support.");
        setPhase("unavailable");
        return;
      }
      setTotpUri(result.totpURI);
      setBackupCodes(result.backupCodes);
      setPhase("mfa");
    } catch {
      setError("Mailbox verification or account setup could not be completed. Check the exact address and one-time code; if you already registered, contact DigiPants support.");
    } finally {
      setBusy(false);
    }
  }

  async function finishMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(totp)) return;
    setBusy(true);
    setError("");
    try {
      const verified = await authPost("two-factor/verify-totp", { code: totp });
      setTotp("");
      if (!verified.ok) throw new Error("mfa-denied");
      setTotpUri("");
      setBackupCodes([]);
      const signedOut = await authPost("sign-out", {});
      if (!signedOut.ok) {
        setError("Authenticator setup was verified, but sign-out could not be confirmed. Close this tab and contact support.");
        setPhase("complete");
      } else {
        setPhase("complete");
      }
    } catch {
      setError("Authenticator verification failed. Enter a fresh six-digit code and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-14 sm:py-20">
      <div className="mb-7 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"><LockKeyhole size={22} aria-hidden="true" /></span>
        <div><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700 dark:text-emerald-300">One-time founder setup</p><h1 className="mt-1 text-2xl font-semibold">DigiPants Client Workspace</h1></div>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        {phase === "recipient" && <>
          <MailCheck size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Verify your founder mailbox</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Enter the personal mailbox selected for the pilot. A one-time code will be sent only to the approved founder address.</p>
          <form onSubmit={requestProof} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Founder email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" /></label>
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy ? "Checking…" : "Send verification code"}</button>
          </form>
        </>}
        {phase === "proof" && <>
          <KeyRound size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Create your staff account</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">If the mailbox is eligible, its one-time code expires in 10 minutes. Account creation is limited to the pilot project and requires authenticator setup.</p>
          <form onSubmit={createAccount} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">One-time email code<input required minLength={43} maxLength={43} autoComplete="off" spellCheck={false} value={proof} onChange={event => setProof(event.target.value.trim())} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-mono text-sm dark:border-zinc-700" /></label>
            <label className="block text-sm font-semibold">Your name<input required maxLength={160} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" /></label>
            <label className="block text-sm font-semibold">New password (12+ characters)<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" /></label>
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy ? "Verifying…" : "Verify and create account"}</button>
          </form>
        </>}
        {phase === "mfa" && <>
          <ShieldCheck size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Enroll your authenticator</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Add the setup URI to your authenticator app and save these recovery codes offline. The URI and codes are shown once and are not saved to browser storage.</p>
          <p className="mt-4 break-all rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">{totpUri}</p>
          <p className="mt-4 text-sm font-semibold">Recovery codes</p>
          <ul className="mt-2 grid grid-cols-2 gap-2">{backupCodes.map(code => <li key={code} className="break-all rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">{code}</li>)}</ul>
          <form onSubmit={finishMfa} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Six-digit authenticator code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={totp} onChange={event => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-lg dark:border-zinc-700" /></label>
            <button type="submit" disabled={busy || totp.length !== 6} className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy ? "Verifying…" : "Verify authenticator"}</button>
          </form>
        </>}
        {phase === "complete" && <>
          <CheckCircle2 size={28} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Founder account secured</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">The one-time staff bootstrap is consumed. Sign in with your password and authenticator to open the synthetic pilot project.</p>
          <a href="/workspace/login/" className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-300">Continue to sign in</a>
        </>}
        {phase === "unavailable" && <><h2 className="text-xl font-semibold">Enrollment unavailable</h2><p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Contact DigiPants support to finish account security setup.</p></>}
        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      </section>
      <p className="mt-6 text-center text-xs text-zinc-500">This one-time setup is protected by the staging password and mailbox ownership check.</p>
    </div>
  );
}
