"use client";

import { useState } from "react";
import {
  CheckCircle2, ClipboardList, Clock3, FileCheck2, FileText, FolderOpen,
  HelpCircle, LockKeyhole, ShieldCheck,
} from "lucide-react";

// Illustrative constants only. This module intentionally cannot fetch, upload,
// approve, download, or read actual client material.
const sharedDocuments = [
  { id: "DOC-01", title: "Project brief", kind: "Scope", version: "v02", published: "18 Jan", note: "Example of the current reviewed project brief" },
  { id: "DOC-02", title: "Visual direction summary", kind: "Design", version: "v01", published: "15 Jan", note: "Example of a client-safe design decision" },
  { id: "DOC-03", title: "Delivery milestone overview", kind: "Delivery", version: "v03", published: "18 Jan", note: "Example of a milestone summary, not source code" },
] as const;

const openQuestions = [
  { id: "Q-01", question: "Confirm the primary contact for final content review", owner: "Client", state: "Awaiting answer" },
  { id: "Q-02", question: "Confirm whether existing analytics events should be retained", owner: "DigiPants", state: "Under review" },
] as const;

const cardClass = "rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-[0_10px_30px_-28px_rgba(15,23,42,.35)] dark:border-slate-800 dark:bg-slate-900 sm:p-7";
const mutedClass = "text-[13px] leading-6 text-slate-500 dark:text-slate-400";

function Title({ eyebrow, heading, description }: { eyebrow: string; heading: string; description: string }) {
  return <div className="mb-6">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">{eyebrow}</p>
    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[28px]">{heading}</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
  </div>;
}

export function RequirementsPreview() {
  return <section aria-labelledby="requirements-heading">
    <Title eyebrow="Project definition" heading="Requirements you can trace" description="An example of how the latest shared brief, boundaries and open questions could appear after review by DigiPants." />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,1fr)]">
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={19} className="text-emerald-700 dark:text-emerald-300"/>
            <h3 id="requirements-heading" className="font-semibold">Example Studio website refresh</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Shared sample · v02</span>
        </div>
        <p className={"mt-4 " + mutedClass}>Create a clear service website that makes enquiries easy and performs well on mobile. This brief is entirely fictional and cannot be edited or approved here.</p>
        <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Illustrative inclusions</p>
            <ul className={"list-inside list-disc space-y-2 " + mutedClass}>
              <li>Responsive service pages</li>
              <li>Accessible enquiry experience</li>
              <li>Basic search and analytics setup</li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Illustrative exclusions</p>
            <ul className={"list-inside list-disc space-y-2 " + mutedClass}>
              <li>Custom CRM development</li>
              <li>Paid third-party subscriptions</li>
              <li>Ongoing advertising management</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <ShieldCheck size={17} className="text-emerald-700 dark:text-emerald-300"/>
          In the real workspace, only an authorized staff-reviewed revision would be published to the client.
        </div>
      </div>
      <div className={cardClass}>
        <div className="flex items-center gap-2"><FileCheck2 size={19} className="text-emerald-700 dark:text-emerald-300"/><h3 className="font-semibold">Revision summary</h3></div>
        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Shared version</dt><dd className="font-semibold">02 · fictional</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Review state</dt><dd className="font-semibold">Example confirmed</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Example update</dt><dd className="font-semibold">18 Jan</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Approval action</dt><dd className="font-semibold">Disabled</dd></div>
        </dl>
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          A material scope change should create a new reviewed version; it must not quietly overwrite a previously issued proposal.
        </div>
      </div>
    </div>
    <div className={cardClass + " mt-5"}>
      <div className="flex items-center gap-2"><HelpCircle size={19} className="text-emerald-700 dark:text-emerald-300"/><h3 className="text-lg font-semibold">Open clarification questions</h3></div>
      <p className={"mt-2 " + mutedClass}>Read-only examples. There is no message submission, assignment or decision action.</p>
      <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
        {openQuestions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.question}</p><p className="mt-1 text-xs text-slate-500">Example owner: {item.owner}</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{item.state}</span>
        </div>)}
      </div>
    </div>
  </section>;
}

export function DocumentsPreview() {
  const [kind, setKind] = useState("All");
  const visible = sharedDocuments.filter((document) => kind === "All" || document.kind === kind);
  return <section aria-labelledby="documents-heading">
    <Title eyebrow="Shared deliverables" heading="Documents with clear versions" description="Only client-published files would appear here. These sample rows do not represent stored files and cannot be downloaded." />
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2"><FolderOpen size={19} className="text-emerald-700 dark:text-emerald-300"/><h3 id="documents-heading" className="font-semibold">Published document register</h3></div>
        <div className="flex items-center gap-2">
          <label htmlFor="preview-document-filter" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Category</label>
          <select id="preview-document-filter" value={kind} onChange={(event) => setKind(event.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option>All</option><option>Scope</option><option>Design</option><option>Delivery</option>
          </select>
        </div>
      </div>
      <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800" aria-live="polite">
        {visible.map((document) => <article key={document.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><FileText size={18}/></div>
            <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white">{document.title}</h4><p className={"mt-1 " + mutedClass}>{document.note}</p><p className="mt-2 text-xs text-slate-400">{document.kind} · {document.version} · sample published {document.published}</p></div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 size={14}/> Published example</span>
        </article>)}
      </div>
      <p className={"mt-4 flex items-center gap-2 border-t border-slate-100 pt-5 dark:border-slate-800 " + mutedClass}><Clock3 size={16}/> This list updates locally when filtered; there are no server requests.</p>
    </div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <LockKeyhole size={20} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"/>
      <div><p className="text-sm font-semibold">Private means private</p><p className={"mt-1 " + mutedClass}>Internal working files, unpublished revisions and developer evidence must stay out of client listings. Future downloads will require tenant-scoped authorization and short-lived private access links.</p></div>
    </div>
  </section>;
}
