import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/data";
import { CaseStudyPage } from "../CaseStudyPage";

const project = projects.find((item) => item.slug === "vidyanju");
export const metadata: Metadata = project ? { title: `${project.title} — DigiPants`, description: project.summary, alternates: { canonical: "https://digipants.com/work/vidyanju/" } } : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!project) return notFound();
  return <CaseStudyPage project={project} details={{
    cover: "bg-sky-950", glow: "bg-cyan-300/25", label: "Gifting / commerce", mark: "VI",
    badges: ["Curated hampers", "Bespoke requests", "Concierge enquiries"],
    context: "Premium gifting needs a commerce experience that supports curated products, product choices, and personal requests from discovery through local fulfilment.",
    approach: [
      "Structured a premium e-commerce journey around curated hampers and product variants.",
      "Added bespoke request and concierge enquiry pathways for more considered purchases.",
      "Supported cart-led shopping while keeping local Lucknow fulfilment part of the service experience.",
    ],
    deliverables: ["Custom gifting e-commerce platform", "Curated hampers", "Product variants", "Bespoke requests", "Cart and concierge enquiries", "Local Lucknow fulfilment"],
    highlights: ["Premium gifting presentation", "Flexible product selection", "Catalogue-grounded concierge and bespoke pathways"],
    stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS 4", "MongoDB / Mongoose", "Clerk", "Zod", "React Hook Form", "Razorpay"],
  }} />;
}
