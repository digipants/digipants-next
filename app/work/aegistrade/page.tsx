import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "aegistrade");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/aegistrade/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-emerald-950", glow: "bg-lime-300/25", label: "Trading / research", mark: "AT",
    badges: ["Strategy evaluation", "Risk governance", "Live shadow"],
    context: "Algorithmic trading research needs a controlled environment for comparing strategies, applying governance rules, and observing behavior before any real-money execution decision.",
    approach: [
      "Structured research around strategy evaluation and market regime classification.",
      "Added deterministic risk governance and a CCXT-backed exchange boundary for market data and authenticated account reads.",
      "Used live-shadow monitoring to observe behavior without presenting the platform as autonomous real-money trading.",
    ],
    deliverables: ["Strategy evaluation and backtesting", "Deterministic risk governance", "Market regime classification", "Exchange market-data integration", "Live-shadow monitoring"],
    highlights: ["Research-first operating model", "Clear separation from real-money execution", "Contained shadow observation"],
    stack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 4", "FastAPI", "Python", "Pydantic", "SQLAlchemy", "Prisma / PostgreSQL", "CCXT", "WebSockets"],
  }} />;
}
