import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "aikitchen");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/aikitchen/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-violet-950", glow: "bg-cyan-300/25", label: "Food / innovation", mark: "AI",
    badges: ["Meal plans", "Delivery", "Dine-in", "WhatsApp ordering"],
    context: "AIKitchen is a smart cloud-kitchen website for Lucknow, presenting meal plans, subscriptions, individual meals, delivery, dine-in, and WhatsApp-first ordering.",
    approach: [
      "Positioned the offering around a smart cloud-kitchen model for Lucknow.",
      "Presented meal plans and subscriptions alongside individual meals for different ordering needs.",
      "Made delivery, dine-in, and WhatsApp-first ordering visible in the service journey.",
    ],
    deliverables: ["Smart cloud-kitchen website", "Meal-plan and subscription presentation", "Individual meal ordering", "Delivery and dine-in pathways", "WhatsApp-first ordering"],
    highlights: ["Lucknow-focused food service", "Multiple ordering modes", "Clear meal-plan discovery"],
    stack: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS 3", "Nodemailer"],
  }} />;
}
