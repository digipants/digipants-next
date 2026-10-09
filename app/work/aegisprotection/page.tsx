import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "aegisprotection");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/aegisprotection/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-slate-950", glow: "bg-cyan-400/25", label: "Security / protection", mark: "AP",
    badges: ["URL analysis", "Browser extension", "Mobile apps"],
    context: "AegisProtection is an MVP for assessing suspicious messages, emails, URLs, screenshots, and online offers before a user clicks, replies, or pays. It brings evidence-based protection signals into web, browser, and mobile experiences.",
    approach: [
      "Designed AI-assisted URL safety analysis around a clear protection score.",
      "Extended the experience through a Manifest V3 browser extension and an Expo mobile application codebase.",
      "Connected analysis to threat intelligence so the result can be explained rather than presented as an opaque verdict.",
    ],
    deliverables: ["AI-assisted text, URL, and screenshot analysis", "Explainable protection scoring", "Chromium browser extension", "Expo mobile application codebase"],
    highlights: ["MVP with web, browser, and mobile surfaces", "Provider-neutral threat intelligence", "Advisory, explainable scoring"],
    stack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 3", "OpenAI API", "MongoDB / Mongoose", "Clerk", "Vite", "Expo / React Native"],
  }} />;
}
