// app/services/web-development/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Wrench,
  Users,
  ArrowUpRight,
  Linkedin,
} from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import AnimatedSection from "@/components/animate/AnimatedSection";

export const metadata: Metadata = {
  title: "Web Development — DigiPants",
  description:
    "Modern websites and web apps built with Next.js, React, and TypeScript. Fast, accessible, SEO‑friendly, and measurable from day one.",
  alternates: { canonical: "https://digipants.com/services/web-development/" },
  openGraph: {
    title: "Web Development — DigiPants",
    description:
      "Websites and apps engineered for speed, UX, and measurable business outcomes.",
    url: "https://digipants.com/services/web-development/",
    siteName: "DigiPants",
    images: [
      {
        url: "https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "DigiPants Web Development",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Development — DigiPants",
    description:
      "Next.js, React, and TypeScript websites built to ship fast and scale.",
    images: [
      "https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  keywords: [
    "web development",
    "next.js agency",
    "react development",
    "typescript",
    "tailwind css",
    "vercel",
    "performance web",
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://digipants.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Services",
      item: "https://digipants.com/services/",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Web Development",
      item: "https://digipants.com/services/web-development/",
    },
  ],
} as const;

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24 py-12 md:py-16">
      <Container>{children}</Container>
    </section>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

const PROCESS: { title: string; desc: string }[] = [
  {
    title: "Discovery",
    desc: "Goals, audience, constraints, and must‑have integrations. Define success metrics.",
  },
  {
    title: "Architecture & UX",
    desc: "IA, page flows, wireframes, and a component‑driven design system.",
  },
  {
    title: "Build",
    desc: "Next.js + TypeScript with reusable UI, forms, state, and API routes.",
  },
  {
    title: "Integrations",
    desc: "CMS, auth, payments, CRM, and analytics with robust error handling.",
  },
  {
    title: "QA & Performance",
    desc: "Accessibility, cross‑browser, Core Web Vitals, and automated checks.",
  },
  {
    title: "Launch & Handover",
    desc: "Zero‑downtime deploy, docs, and training; iterate on data‑backed roadmap.",
  },
];

const TOOLS = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Node.js",
  "Vercel / Netlify",
  "Sanity / Contentful",
  "Shopify / Stripe",
  "PostgreSQL / Prisma",
  "Auth.js",
  "Playwright / Cypress",
  "Jest",
  "GitHub Actions",
  "GA4 / GTM",
];

const TEAM = [
  {
    name: "Bhupendra Kumar",
    role: "Tech Lead, Full‑stack",
    img: "/bhupendra.jpg",
    blurb: "Owns architecture, performance budgets, and end‑to‑end delivery.",
    linkedin: "https://www.linkedin.com/in/bhupendraprofile/",
  },
  {
    name: "Aman",
    role: "Frontend Engineer (React/Next.js)",
    img: "/Aman.jpeg",
    blurb: "Builds UI components, forms, and interactions with TypeScript.",
    linkedin: "https://www.linkedin.com/in/aman-kharwar-0a6843212/",
  },
  {
    name: "Aryan",
    role: "Full‑stack Developer",
    img: "/Aryan.jpeg",
    blurb:
      "Owns responsive design, accessibility, and polish across breakpoints.",
    linkedin: "https://www.linkedin.com/in/aryan-bhashkar/",
  },
  {
    name: "Himanshu",
    role: "UI Engineer (Tailwind)",
    img: "/Himanshu.jpeg",
    blurb: "APIs, integrations, and data flow between services and UI.",
    linkedin: "https://www.linkedin.com/in/himanshusingh261/",
  },
];

export default function WebDevelopmentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <JsonLd data={breadcrumbSchema} />

      {/* Hero */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Web Development
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
              Modern websites and web apps engineered for speed, accessibility,
              and measurable business outcomes. Ship fast, scale safely.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/work/"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              >
                See work
              </Link>
              <Link
                href="/contact-us/"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
              >
                Start a project
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=2070&auto=format&fit=crop"
              alt="Design and development planning"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </Section>

      {/* Process */}
      <AnimatedSection className="py-12 md:py-16">
        <Container>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Process
            </h2>
            <a
              href="#tools"
              className="text-sm inline-flex items-center gap-1 hover:underline"
            >
              Tools <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PROCESS.map((p) => (
              <Card key={p.title} className="p-6 h-full">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Step
                </div>
                <div className="mt-1 font-semibold">{p.title}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {p.desc}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </AnimatedSection>

      {/* Tools & Stack */}
      <AnimatedSection id="tools" className="py-12 md:py-16">
        <Container>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5" /> Tools & Stack
            </h2>
            <a
              href="#team"
              className="text-sm inline-flex items-center gap-1 hover:underline"
            >
              Team <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <Card className="p-6">
            <div className="flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <span
                  key={t}
                  className="text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1"
                >
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </Container>
      </AnimatedSection>

      {/* Team */}
      <AnimatedSection id="team" className="py-12 md:py-16">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5" /> Developer Team
            </h2>
            <Link
              href="/contact-us/"
              className="text-sm font-medium hover:opacity-80"
            >
              Work with us →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3 lg:grid-cols-3">
            {TEAM.map((m) => (
              <Card key={m.name}>
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <img
                      src={m.img}
                      alt={m.name}
                      className="h-16 w-16 rounded-xl object-cover border border-zinc-200/60 dark:border-zinc-800/60"
                    />
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {m.role}
                      </div>
                    </div>
                    <a
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${m.name} on LinkedIn`}
                      className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  </div>
                  <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {m.blurb}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </AnimatedSection>

      {/* CTA */}
      <Section>
        <Card>
          <div className="p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Let’s build
              </div>
              <h3 className="mt-1 text-2xl font-extrabold">
                Faster websites, measurable impact.
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
                Send your goals and constraints. We’ll scope the quickest path
                to launch and a 90‑day roadmap to compound results.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/contact-us/"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              >
                Start a project
              </Link>
              <Link
                href="/work/"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
              >
                See work
              </Link>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

