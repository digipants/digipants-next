"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";

const BEARER = /^[A-Za-z0-9_-]{43}$/;
const CHALLENGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Phase = "checking" | "recipient" | "mailbox" | "mfa" | "complete" | "unavailable";
const mailUrl = "/api/workspace/invites/proof/";

function safeCode(value: unknown): string {
  return typeof value === "string" && BEARER.test(value) ? value : "";
}

async function authPost(path: string, body: Record<string, string | boolean>, headers?: HeadersInit) {
  return fetch("/api/auth/" + path, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: {"content-type": "application/json", ...headers},
    body: JSON.stringify(body),
  });
}

export default function WorkspaceInvitation() {
  const [phase,setPhase] = useState<Phase>("checking");
  const [bearer,setBearer] = useState("");
  const [email,setEmail] = useState("");
  const [name,setName] = useState("");
  const [proof,setProof] = useState("");
  const [challengeId,setChallengeId] = useState("");
  const [password,setPassword] = useState("");
  const [totpUri,setTotpUri] = useState("");
  const [backupCodes,setBackupCodes] = useState<string[]>([]);
  const [totp,setTotp] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  useEffect(() => {
    // Fragment never reaches an HTTP path/query or any server access log.
    // Remove it on mount, before any mail/identity request. No localStorage,
    // sessionStorage, analytics or third-party component receives the bearer.
    const match = /^#invite=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    window.history.replaceState(window.history.state,"","/workspace/invite/");
    if (!match || !BEARER.test(match[1])) {
      setPhase("unavailable");
      return;
    }
    setBearer(match[1]);
    setPhase("recipient");
  }, []);

  async function requestMailboxProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !bearer || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const session = await fetch(mailUrl, {
        method: "GET", credentials: "same-origin", cache: "no-store",
        referrerPolicy: "no-referrer", redirect: "error",
      });
      const init = await session.json().catch(() => null);
      if (!session.ok || typeof init?.csrf !== "string") throw new Error("Unavailable");
      const result = await fetch(mailUrl, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        redirect: "error", referrerPolicy: "no-referrer",
        headers: {
          "content-type": "application/json",
          "x-workspace-csrf": init.csrf,
        },
        body: JSON.stringify({
          invite: bearer,
          email: email.trim().toLowerCase(),
        }),
      });
      const data = await result.json().catch(() => null);
      if (!result.ok || !CHALLENGE_ID.test(data?.challengeId ?? "")) throw new Error("Unavailable");
      setEmail(email.trim().toLowerCase());
      setChallengeId(data.challengeId);
      setPhase("mailbox");
    } catch {
      setError("Mailbox verification is not available for this invitation. Contact the project owner.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !bearer || !CHALLENGE_ID.test(challengeId) ||
        !BEARER.test(proof) || password.length < 12 ||
        password.length > 128 || !name.trim() || name.trim().length > 160) return;
    setBusy(true);
    setError("");
    try {
      const signup = await authPost("sign-up/email", {
        name: name.trim(),
        email,
        password,
      }, {
        "x-digipants-workspace-invitation": bearer,
        "x-digipants-mail-challenge-id": challengeId,
        "x-digipants-mail-proof": proof,
      });
      if (!signup.ok) throw new Error("Signup denied");

      // A successful signup DOES NOT assign project permissions. This stage
      // prepares TOTP; only a future verified MFA sign-in can read a project.
      setBearer("");
      setProof("");
      setChallengeId("");
      const enable = await authPost("two-factor/enable", {
        method: "totp", password,
      });
      setPassword("");
      const result = await enable.json().catch(() => null);
      if (!enable.ok || result?.method !== "totp" ||
          typeof result?.totpURI !== "string" ||
          !result.totpURI.startsWith("otpauth://totp/") ||
          !Array.isArray(result.backupCodes) ||
          !result.backupCodes.every((c: unknown) => typeof c === "string")) {
        setError("Your account was created, but authenticator setup needs assistance. Contact your DigiPants project owner; do not retry signup.");
        setPhase("unavailable");
        return;
      }
      setTotpUri(result.totpURI);
      setBackupCodes(result.backupCodes);
      setPhase("mfa");
    } catch {
      setError("Invitation verification could not be completed. Check the exact invited email and your one-time code. If you already registered, contact your project owner.");
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
      const verified = await authPost("two-factor/verify-totp", {
        code: totp,
      });
      setTotp("");
      if (!verified.ok) throw new Error("Verification rejected");
      setTotpUri("");
      setBackupCodes([]);
      const signedOut = await authPost("sign-out", {});
      if (!signedOut.ok) {
        setError("Authenticator enrollment verified, but sign-out could not be confirmed. Close this browser tab and contact support.");
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
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <LockKeyhole size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700 dark:text-emerald-300">Private invitation</p>
          <h1 className="mt-1 text-2xl font-semibold">Join DigiPants Client Workspace</h1>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        {phase === "checking" && <p role="status">Checking your invitation link…</p>}
        {phase === "unavailable" && <>
          <h2 className="text-xl font-semibold">Invitation unavailable</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">This link is missing, expired, already used or cannot be verified. For security, DigiPants does not reveal which condition applies.</p>
        </>}
        {phase === "recipient" && <>
          <MailCheck size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Confirm the invited mailbox</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Enter the exact email address the project owner invited. We'll send a separate one-time verification code to that mailbox.</p>
          <form onSubmit={requestMailboxProof} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Invited email
              <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" />
            </label>
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy?"Checking…":"Send verification code"}</button>
          </form>
        </>}
        {phase === "mailbox" && <>
          <KeyRound size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Verify your email and create an account</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">If the invitation is valid, a one-time code was sent to your invited email. The code expires after 10 minutes. Registration does not automatically grant project access.</p>
          <form onSubmit={createAccount} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">One-time email code
              <input required minLength={43} maxLength={43} autoComplete="off" spellCheck={false} value={proof} onChange={e=>setProof(e.target.value.trim())} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-mono text-sm dark:border-zinc-700" />
            </label>
            <label className="block text-sm font-semibold">Your name
              <input required maxLength={160} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" />
            </label>
            <label className="block text-sm font-semibold">New password (12+ characters)
              <input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 font-normal dark:border-zinc-700" />
            </label>
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy?"Verifying…":"Verify and create account"}</button>
          </form>
        </>}
        {phase === "mfa" && <>
          <ShieldCheck size={27} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Secure your account with an authenticator</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Save your backup codes privately, then add the authenticator URI below to your authenticator app. Never share the URI or backup codes.</p>
          <p className="mt-4 break-all rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">{totpUri}</p>
          <p className="mt-4 text-sm font-semibold">Backup codes (save once, offline)</p>
          <ul className="mt-2 grid grid-cols-2 gap-2">{backupCodes.map(code=><li key={code} className="break-all rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">{code}</li>)}</ul>
          <form onSubmit={finishMfa} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Six-digit authenticator code
              <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,"").slice(0,6))} autoComplete="one-time-code" className="mt-2 block w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-3 text-lg dark:border-zinc-700" />
            </label>
            <button type="submit" disabled={busy || totp.length!==6} className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{busy?"Verifying…":"Verify authenticator"}</button>
          </form>
        </>}
        {phase === "complete" && <>
          <CheckCircle2 size={28} className="text-emerald-700 dark:text-emerald-300" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Account security setup complete</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Your project owner still needs to explicitly approve your project membership. Once approved, sign in with your password and authenticator. No project permissions are granted by account creation alone.</p>
          <a href="/workspace/login/" className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-300">Go to secure sign-in</a>
        </>}
        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">Questions about this invitation? Contact <a className="underline underline-offset-2" href="mailto:support@digipants.com">support@digipants.com</a>.</p>
    </div>
  );
}
