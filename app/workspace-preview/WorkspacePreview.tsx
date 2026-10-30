"use client";

import { useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, CreditCard, FileCheck2, FileText,
  FolderKanban, LayoutDashboard, LockKeyhole, MessageSquareText, Receipt,
  ShieldCheck, Sparkles, WalletCards,
} from "lucide-react";

type Section = "overview" | "progress" | "proposal" | "billing";
type Scenario = "on-track" | "awaiting-review" | "delayed";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "progress", label: "Project progress", icon: FolderKanban },
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "billing", label: "Invoices & payments", icon: CreditCard },
] as const;

const milestones = [
  { number: "01", title: "Discovery & project brief", detail: "Goals, requirements and scope confirmed", state: "Complete", progress: 100 },
  { number: "02", title: "Experience & visual direction", detail: "Key screens and visual direction reviewed", state: "Complete", progress: 100 },
  { number: "03", title: "Build & integrations", detail: "Responsive pages and core functionality in progress", state: "In progress", progress: 64 },
  { number: "04", title: "Quality assurance", detail: "Accessibility, performance and cross-device checks", state: "Upcoming", progress: 0 },
  { number: "05", title: "Handover & launch review", detail: "Final approval and handover preparation", state: "Upcoming", progress: 0 },
];

const events = [
  { day: "18", month: "JAN", title: "Build progress shared", detail: "An illustrative update and two example screen previews were added.", icon: FolderKanban },
  { day: "15", month: "JAN", title: "Visual direction approved", detail: "The example design milestone was marked complete.", icon: CheckCircle2 },
  { day: "12", month: "JAN", title: "Project scope confirmed", detail: "Example deliverables, exclusions and responsibilities were reviewed.", icon: FileCheck2 },
];

const scenarioLabels: Record<Scenario, { title: string; note: string; tone: string }> = {
  "on-track": { title: "In progress", note: "The build is underway. Your next update is being prepared.", tone: "emerald" },
  "awaiting-review": { title: "Awaiting your review", note: "The next sample milestone requires client feedback.", tone: "amber" },
  delayed: { title: "Schedule under review", note: "A sample dependency is being assessed by the project owner.", tone: "rose" },
};

function SectionHeading({ overline, title, caption, action }: {
  overline: string; title: string; caption?: string; action?: React.ReactNode;
}) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300">{overline}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[28px]">{title}</h2>
      {caption && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{caption}</p>}
    </div>
    {action}
  </div>;
}

function StatusPill({ status = "In progress" }: { status?: string }) {
  const className = status === "Complete" || status === "Paid"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800"
    : status === "In progress" || status === "Issued"
    ? "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800"
    : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{status}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-slate-200/90 bg-white shadow-[0_10px_30px_-28px_rgba(15,23,42,.35)] dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</section>;
}

function Timeline({ compact = false }: { compact?: boolean }) {
  return <ol className="space-y-0">
    {(compact ? events.slice(0, 2) : events).map((event, index) => {
      const Icon = event.icon;
      return <li key={event.title} className="flex gap-3.5">
        <div className="flex w-10 shrink-0 flex-col items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon size={18} strokeWidth={1.9} /></span>
          {index < (compact ? 1 : events.length - 1) && <span className="my-2 w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
        </div>
        <div className={`min-w-0 flex-1 ${index < (compact ? 1 : events.length - 1) ? "pb-6" : "pb-1"}`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{event.detail}</p>
          <p className="mt-2 text-[11px] font-semibold tracking-wide text-slate-400">{event.day} {event.month} · SAMPLE ACTIVITY</p>
        </div>
      </li>;
    })}
  </ol>;
}

function Milestones({ compact = false }: { compact?: boolean }) {
  return <div className="space-y-0">
    {(compact ? milestones.slice(0, 3) : milestones).map((milestone, index) => (
      <div key={milestone.number} className={`flex gap-4 ${index < (compact ? 2 : milestones.length - 1) ? "border-b border-slate-100 pb-5 mb-5 dark:border-slate-800" : ""}`}>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-sm font-bold ${milestone.state === "Complete" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : milestone.state === "In progress" ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>
          {milestone.state === "Complete" ? <Check size={19}/> : milestone.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{milestone.title}</h3><StatusPill status={milestone.state}/></div>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{milestone.detail}</p>
          {milestone.progress > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={`${milestone.title}: ${milestone.progress}%`}>
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${milestone.progress}%` }} />
          </div>}
        </div>
      </div>
    ))}
  </div>;
}

function Overview({ onNavigate, scenario }: { onNavigate: (value: Section) => void; scenario: Scenario }) {
  const status = scenarioLabels[scenario];
  return <>
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5">
        <div className="mb-7 flex items-start justify-between text-slate-400"><span className="text-xs font-semibold uppercase tracking-[.09em]">Project phase</span><FolderKanban size={18}/></div>
        <p className="text-[30px] font-semibold tracking-tight text-slate-900 dark:text-white">03 <span className="text-base font-normal text-slate-400">/ 05</span></p>
        <p className="mt-1 text-xs text-slate-500">Build & integrations</p>
      </Card>
      <Card className="p-5">
        <div className="mb-7 flex items-start justify-between text-slate-400"><span className="text-xs font-semibold uppercase tracking-[.09em]">Sample next step</span><CalendarDays size={18}/></div>
        <p className="text-[20px] font-semibold tracking-tight text-slate-900 dark:text-white">Design review</p>
        <p className="mt-2 text-xs text-slate-500">A client checkpoint · illustrative only</p>
      </Card>
      <Card className="p-5">
        <div className="mb-7 flex items-start justify-between text-slate-400"><span className="text-xs font-semibold uppercase tracking-[.09em]">Project updates</span><MessageSquareText size={18}/></div>
        <p className="text-[30px] font-semibold tracking-tight text-slate-900 dark:text-white">03</p>
        <p className="mt-1 text-xs text-slate-500">Published example updates</p>
      </Card>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Delivery roadmap</p><h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Your milestones</h3></div><button onClick={() => onNavigate("progress")} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">All milestones <ArrowRight size={15}/></button></div>
        <Milestones compact/>
      </Card>
      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Shared activity</p><h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">What's new</h3></div><Clock3 size={19} className="text-slate-400"/></div>
        <Timeline compact/>
        <button onClick={() => onNavigate("progress")} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">See project activity <ArrowRight size={15}/></button>
      </Card>
    </div>
    <Card className="mt-5 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Clear next action</p><h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{status.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{status.note}</p></div>
      <button onClick={() => onNavigate("proposal")} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">View sample proposal <ArrowUpRight size={17}/></button>
    </Card>
  </>;
}

function Progress() {
  return <>
    <SectionHeading overline="Project delivery" title="A clear view of every milestone" caption="Only owner-approved project updates would appear here in a live workspace. Everything shown below is a fictional example."/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
      <Card className="p-6 sm:p-8">
        <div className="mb-7 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-slate-900 dark:text-white">Five-stage delivery plan</h3><span className="text-xs text-slate-500">03 / 05 stages</span></div>
        <Milestones/>
      </Card>
      <Card className="p-6 sm:p-7">
        <h3 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Published updates</h3>
        <Timeline/>
        <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white"><ShieldCheck size={17} className="text-emerald-600"/> Reviewed before sharing</p><p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">Drafts, internal engineering notes and unapproved work are not customer-visible.</p></div>
      </Card>
    </div>
  </>;
}

function Proposal({ onNavigate }: { onNavigate: (value: Section) => void }) {
  const [showExample, setShowExample] = useState(false);
  return <>
    <SectionHeading overline="Scope and approval" title="Know exactly what you're agreeing to" caption="A versioned proposal keeps deliverables, exclusions, timeline and commercial terms in one place."/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-emerald-700 dark:text-emerald-300">PROPOSAL · VERSION 02</p><h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">A focused website refresh</h3></div><StatusPill status="Issued"/></div>
        <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">Make the example studio's offering easier to understand, with a clear path for visitors to contact the team.</p>
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div><h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><CheckCircle2 size={17} className="text-emerald-600"/> Included</h4><ul className="mt-3 space-y-2 text-[13px] leading-5 text-slate-600 dark:text-slate-300"><li>Responsive homepage and service pages</li><li>Accessible contact experience</li><li>Testing and handover guidance</li></ul></div>
          <div><h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><CircleHelp size={17} className="text-slate-400"/> Excluded</h4><ul className="mt-3 space-y-2 text-[13px] leading-5 text-slate-600 dark:text-slate-300"><li>Brand identity or copywriting</li><li>E-commerce functionality</li><li>Ongoing hosting or maintenance</li></ul></div>
        </div>
        <div className="mt-7 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"><p className="text-sm font-semibold text-slate-900 dark:text-white">Illustrative delivery range: 4–6 weeks</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Subject to approved scope, capacity, client materials, contracting and kickoff conditions. No real delivery date is committed.</p></div>
        <button onClick={() => setShowExample(v => !v)} aria-expanded={showExample} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950">{showExample ? "Hide" : "Show"} sample decision guidance <ChevronRight size={17}/></button>
        {showExample && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-[13px] leading-6 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"><strong>Live approval is not enabled.</strong> In the future, you will be able to accept a specific proposal version, request changes or decline it. Acceptance will still require separate contracting, payment conditions and authorized kickoff checks. No decision is recorded from this demo.</div>}
      </Card>
      <Card className="p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example commercial summary</p><p className="mt-3 text-[32px] font-semibold tracking-tight text-slate-900 dark:text-white">₹1,20,000</p><p className="mt-1 text-xs text-slate-500">Fictional INR amount · no official quote or tax treatment</p>
        <div className="mt-7 space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800">
          {[["Discovery & design", "₹30,000"], ["Implementation", "₹60,000"], ["Quality assurance", "₹30,000"]].map(([title, value]) => <div key={title} className="flex justify-between gap-3 text-sm"><span className="text-slate-500 dark:text-slate-400">{title}</span><strong className="text-slate-900 dark:text-white">{value}</strong></div>)}
        </div>
        <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Illustration only. Real pricing, tax, scope, invoice and client identity must be approved separately.</div>
        <button onClick={() => onNavigate("billing")} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">View example billing <ArrowRight size={17}/></button>
      </Card>
    </div>
  </>;
}

function Billing() {
  return <>
    <SectionHeading overline="Billing visibility" title="Clarity from invoice to reconciliation" caption="A customer-friendly billing overview is being designed around verified payments, approvals and audit history. These are fictional example records."/>
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example project value</p><p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">₹1,20,000</p><p className="mt-1 text-xs text-slate-500">Illustrative amount only</p></Card>
      <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example recorded payments</p><p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">₹30,000</p><p className="mt-1 text-xs text-slate-500">Sample status, not a transaction</p></Card>
      <Card className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example balance</p><p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">₹90,000</p><p className="mt-1 text-xs text-slate-500">Not an invoice or payment request</p></Card>
    </div>
    <Card className="mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-6 sm:px-8"><div><h3 className="text-lg font-semibold text-slate-900 dark:text-white">Sample invoices</h3><p className="mt-1 text-xs text-slate-500">No invoices are issued, linked or downloadable.</p></div><Receipt size={20} className="text-emerald-700 dark:text-emerald-300"/></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/70"><tr><th className="px-6 py-3 sm:px-8">Invoice</th><th className="px-4 py-3">Milestone</th><th className="px-4 py-3">Amount</th><th className="px-6 py-3 sm:px-8">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        <tr><td className="px-6 py-5 font-semibold text-slate-900 dark:text-white sm:px-8">DEMO-INV-001</td><td className="px-4 py-5 text-slate-500">Discovery & design</td><td className="px-4 py-5 font-medium text-slate-900 dark:text-white">₹30,000</td><td className="px-6 py-5 sm:px-8"><StatusPill status="Paid"/></td></tr>
        <tr><td className="px-6 py-5 font-semibold text-slate-900 dark:text-white sm:px-8">DEMO-INV-002</td><td className="px-4 py-5 text-slate-500">Implementation</td><td className="px-4 py-5 font-medium text-slate-900 dark:text-white">₹60,000</td><td className="px-6 py-5 sm:px-8"><StatusPill status="Upcoming"/></td></tr>
        <tr><td className="px-6 py-5 font-semibold text-slate-900 dark:text-white sm:px-8">DEMO-INV-003</td><td className="px-4 py-5 text-slate-500">Quality assurance</td><td className="px-4 py-5 font-medium text-slate-900 dark:text-white">₹30,000</td><td className="px-6 py-5 sm:px-8"><StatusPill status="Upcoming"/></td></tr>
      </tbody></table></div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-6 py-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 sm:px-8"><LockKeyhole size={16} className="text-slate-500"/><strong>Payments are disabled.</strong> No gateway, checkout link or real balance is connected.</div>
    </Card>
  </>;
}

export default function WorkspacePreview() {
  const [section, setSection] = useState<Section>("overview");
  const [scenario, setScenario] = useState<Scenario>("on-track");
  const status = scenarioLabels[scenario];
  return <div data-workspace-synthetic-preview className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900 dark:bg-[#0b1014] dark:text-slate-100">
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#102b25] px-5 py-3 text-center text-[11px] font-semibold tracking-wide text-white sm:text-xs">
      <span className="inline-flex items-center gap-1.5 text-emerald-300"><Sparkles size={15}/> INTERACTIVE DESIGN PREVIEW</span>
      <span className="hidden h-4 w-px bg-white/30 sm:block"/>
      <span>Everything here is fictional. No account, approval, payment or project is live.</span>
    </div>
    <div className="mx-auto grid max-w-[1480px] lg:min-h-[900px] lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-[#10221f] px-5 pb-5 pt-7 text-white lg:px-6 lg:pt-9" aria-label="Workspace navigation">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500 text-lg font-black tracking-tight text-emerald-950">dp</div><div><p className="text-base font-bold tracking-tight">DigiPants</p><p className="text-[11px] text-emerald-200/75">Client Workspace · concept</p></div></div>
        <div className="mt-9 rounded-2xl border border-white/10 bg-white/[.06] p-4">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-200 font-bold text-emerald-950">ES</span><div><p className="text-sm font-semibold">Example Studio</p><p className="text-[11px] text-emerald-100/70">Fictional client</p></div></div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-emerald-100/70"><ShieldCheck size={14}/> Preview identity only</div>
        </div>
        <p className="mb-3 mt-7 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100/45">Workspace</p>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible" aria-label="Preview sections">
          {navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 lg:w-full ${section === id ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20" : "text-white/65 hover:bg-white/10 hover:text-white"}`}><Icon size={18} strokeWidth={1.8}/>{label}{section === id && <ChevronRight size={15} className="ml-auto hidden lg:block"/>}</button>)}
        </nav>
        <div className="mt-7 hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.075] to-transparent p-5 lg:block">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><MessageSquareText size={18}/></div>
          <p className="mt-4 text-sm font-semibold">Clear updates. Fewer surprises.</p>
          <p className="mt-2 text-xs leading-6 text-white/55">The real experience will share approved progress and the next action in one place.</p>
        </div>
        <p className="mt-7 hidden text-[11px] text-white/35 lg:block">Illustrative concept · not connected</p>
      </aside>
      <main className="min-w-0 px-4 pb-16 pt-7 sm:px-7 lg:px-10 lg:pt-10 xl:px-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">EXAMPLE STUDIO / WORKSPACE</p><p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">A single place to follow your project</p></div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><BadgeCheck size={15}/> Synthetic demo</span>
        </div>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Welcome to your workspace</p><h1 className="mt-2 max-w-2xl text-[30px] font-semibold leading-[1.12] tracking-[-.045em] text-slate-900 dark:text-white sm:text-[43px]">A clearer picture of your project.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">Your scope, progress, reviews and billing — in one calm, shared view.</p></div>
        </div>
        <Card className="mt-7 overflow-hidden !border-0 bg-[#0e3c32] p-6 text-white dark:bg-[#0e3c32] sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-200/75">Example Studio · website refresh</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"><span className="h-2 w-2 rounded-full bg-emerald-300"/>{status.title}</span><span className="text-xs text-emerald-100/70">Phase 3 of 5</span></div><p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75">{status.note}</p></div>
            <div className="shrink-0 rounded-xl bg-white/10 px-4 py-3"><label htmlFor="preview-scenario" className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-emerald-100/75">Explore sample states</label><select id="preview-scenario" value={scenario} onChange={e => setScenario(e.target.value as Scenario)} className="w-full rounded-lg border border-white/15 bg-[#12473c] px-2 py-2 text-xs font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-200"><option value="on-track">In progress</option><option value="awaiting-review">Awaiting client review</option><option value="delayed">Schedule under review</option></select></div>
          </div>
        </Card>
        <div className="mt-8">
          {section === "overview" && <><SectionHeading overline="Your dashboard" title="Everything important, at a glance" caption="A first look at what customers could see once authenticated project records are safely connected."/><Overview onNavigate={setSection} scenario={scenario}/></>}
          {section === "progress" && <Progress/>}
          {section === "proposal" && <Proposal onNavigate={setSection}/>}
          {section === "billing" && <Billing/>}
        </div>
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-[11px] leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400"><span>© DigiPants · Illustrative Client Workspace preview</span><span className="inline-flex items-center gap-1.5"><LockKeyhole size={13}/> No real data, authentication or payments</span></footer>
      </main>
    </div>
  </div>;
}
