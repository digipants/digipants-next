"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, FolderKanban, LockKeyhole, LogOut } from "lucide-react";

type Project = { id: string; title: string; state: string; revision: string };
type Status = "loading" | "ready" | "unavailable";

const STATES: Record<string, string> = {
  planned: "Planning",
  active: "Active",
  paused: "Paused",
  change_review: "Change review",
  handover: "Handover",
  closed: "Closed",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function acceptProject(value: unknown, projectId: string): Project | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (p.id !== projectId || !UUID.test(projectId) ||
      typeof p.title !== "string" || p.title.trim().length < 1 || p.title.length > 200 ||
      typeof p.state !== "string" || !Object.hasOwn(STATES, p.state) ||
      typeof p.revision !== "string" || !/^[1-9]\\d{0,18}$/.test(p.revision)) return null;
  // Never preserve extra properties from the server or future API fields.
  return { id: projectId, title: p.title, state: p.state, revision: p.revision };
}

export default function WorkspaceProject({ tenantId, projectId }: {
  tenantId: string;
  projectId: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [project, setProject] = useState<Project | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setProject(null);
    setStatus("loading");
    const load = async () => {
      try {
        const response = await fetch(
          `/api/workspace/tenants/${tenantId}/projects/${projectId}/`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Project unavailable");
        const body: unknown = await response.json();
        const validated = acceptProject(
          body && typeof body === "object" ? (body as { project?: unknown }).project : null,
          projectId,
        );
        if (!validated) throw new Error("Project unavailable");
        if (!controller.signal.aborted) {
          setProject(validated);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setProject(null);
          setStatus("unavailable");
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [tenantId, projectId]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setProject(null);
    setStatus("unavailable");
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    } finally {
      // Never keep protected project content on-screen after sign-out attempt.
      window.location.replace("/workspace/login/");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700 dark:text-emerald-300">DigiPants Client Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your project</h1>
        </div>
        <button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"><LogOut size={16} /> Sign out</button>
      </header>

      {status === "loading" && (
        <section role="status" aria-live="polite" className="rounded-2xl border border-zinc-200 p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">Checking your current session and project access…</section>
      )}

      {status === "unavailable" && (
        <section role="alert" className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <LockKeyhole size={26} aria-hidden className="text-zinc-500" />
          <h2 className="mt-4 text-xl font-semibold">This project is unavailable</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">We could not verify current access. Sign in again or ask your DigiPants project owner to check the invitation and project permissions.</p>
          <a className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-300" href="/workspace/login/">Return to sign in</a>
        </section>
      )}

      {status === "ready" && project && (
        <>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200"><BadgeCheck size={18} /> Access verified</div>
            <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight">{project.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">This overview comes from a published, access-controlled database record. It is not the illustrative workspace preview.</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project state</p>
              <p className="mt-2 text-xl font-semibold">{STATES[project.state]}</p>
              <p className="mt-3 text-xs text-zinc-500">Current owner-published project state</p>
            </section>
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Published revision</p>
              <p className="mt-2 text-xl font-semibold">Revision {project.revision}</p>
              <p className="mt-3 text-xs text-zinc-500">Read-only source record</p>
            </section>
          </div>
          <section className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
            <div className="flex items-center gap-2"><FolderKanban size={20} className="text-emerald-700 dark:text-emerald-300" /><h3 className="text-lg font-semibold">Project updates and approvals</h3></div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Detailed milestones, requirements, private documents and invoices are not connected to this authenticated view yet. They will appear only after staff approval, access controls and independent security checks are complete. No sample progress or payment status is presented as real.</p>
          </section>
        </>
      )}
    </div>
  );
}
