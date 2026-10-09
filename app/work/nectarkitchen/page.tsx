import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "nectarkitchen");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/nectarkitchen/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-amber-950", glow: "bg-orange-300/30", label: "Food / ordering", mark: "NK",
    badges: ["Digital menu", "Pickup", "Delivery"],
    context: "NectarKitchen needed a responsive ordering presence for its Lucknow kitchen, with a clear path from menu discovery to pickup or delivery.",
    approach: [
      "Organized the website around a responsive digital menu, cart, and WhatsApp order handoff.",
      "Made pickup and delivery explicit fulfilment choices before the order is sent for confirmation.",
      "Connected the web presence with local search optimization and Google Business Profile integration.",
    ],
    deliverables: ["Responsive food-ordering website", "Digital menu and cart", "WhatsApp order handoff", "Pickup and delivery selection", "Local search and structured data setup"],
    highlights: ["Lucknow-focused ordering experience", "Pickup and delivery pathways", "Local discovery support"],
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "Schema.org structured data", "Google Business Profile"],
  }} />;
}
