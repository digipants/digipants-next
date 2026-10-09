import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "educatia");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/educatia/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-indigo-950", glow: "bg-fuchsia-300/25", label: "Education / impact", mark: "ED",
    badges: ["Mission communication", "Community initiatives", "Engagement"],
    context: "Educatia Welfare Trust needed a clear online presence to communicate its educational mission, community initiatives, and ways for people to engage.",
    approach: [
      "Translated the Trust’s mission into a focused, accessible digital presence.",
      "Structured programme, campaign, gallery, news, and organisational content without adding unverified outcome claims.",
      "Connected membership, contact, and donation pathways to the public-facing experience.",
    ],
    deliverables: ["Responsive trust website", "Programme and campaign pages", "Gallery and news sections", "Membership, contact, and donation flows"],
    highlights: ["Purpose-led communication", "Education-focused content architecture", "Multiple engagement routes"],
    stack: ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS 3", "MongoDB", "Razorpay", "Nodemailer"],
  }} />;
}
