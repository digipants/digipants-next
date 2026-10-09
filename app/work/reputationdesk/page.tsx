import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "reputationdesk");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/reputationdesk/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-zinc-950", glow: "bg-rose-300/25", label: "Intelligence / monitoring", mark: "RD",
    badges: ["Source collection", "Narrative analysis", "Human review"],
    context: "Public-information monitoring needs a structured way to collect sources, understand developing narratives, and route interpretation through human review.",
    approach: [
      "Organized public-information collection into monitoring workflows and dashboards.",
      "Applied AI-assisted narrative analysis while keeping human review in the loop.",
      "Added alerts and reporting for reviewable intelligence without exposing private clients or monitored individuals.",
    ],
    deliverables: ["Public-information collection", "Monitoring dashboards", "Narrative analysis", "Alerts and reporting", "Human-review workflows"],
    highlights: ["Evidence-oriented monitoring", "AI assistance with human review", "Confidential operating context"],
    stack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 3", "PostgreSQL", "Prisma", "NextAuth", "OpenAI API", "Nodemailer"],
  }} />;
}
