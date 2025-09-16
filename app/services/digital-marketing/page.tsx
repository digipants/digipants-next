// app/services/digital-marketing/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Target, BarChart3, Users, ArrowUpRight, Linkedin } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import AnimatedSection from "@/components/animate/AnimatedSection";
import { link } from "fs";

export const metadata: Metadata = {
  title: "Digital Marketing — DigiPants",
  description:
    "Performance marketing across Google and Meta with CRO, analytics, and experimentation. Ship fast, measure everything, scale winners.",
  alternates: { canonical: "https://digipants.com/services/digital-marketing/" },
  openGraph: {
    title: "Digital Marketing — DigiPants",
    description:
      "Google & Meta Ads, CRO, analytics pipelines, and experiment‑driven growth.",
    url: "https://digipants.com/services/digital-marketing/",
    siteName: "DigiPants",
    images: [
      {
        url: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
        width: 1200,
        height: 630,
        alt: "DigiPants Digital Marketing",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Marketing — DigiPants",
    description:
      "Full‑funnel performance marketing with clear roadmaps and reporting.",
    images: [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  keywords: [
    "digital marketing",
    "performance marketing",
    "google ads",
    "meta ads",
    "conversion rate optimization",
    "analytics",
    "server‑side tracking",
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
      name: "Digital Marketing",
      item: "https://digipants.com/services/digital-marketing/",
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
    title: "Audit & Goals",
    desc: "Accounts, tracking, creative, and funnel. Define KPIs and constraints.",
  },
  {
    title: "Strategy & Plan",
    desc: "Audience, offers, and channel mix with a 90‑day roadmap.",
  },
  {
    title: "Creative & LPs",
    desc: "Concept matrix, UGC iterations, and landing pages built to convert.",
  },
  {
    title: "Launch",
    desc: "Capped budgets, control groups, and clean campaign structures.",
  },
  {
    title: "Optimize",
    desc: "Daily checks, A/B tests, audience splits, and bid/creative tweaks.",
  },
  {
    title: "Scale & Report",
    desc: "Roll winners, budget ramp, and dashboards for decision‑makers.",
  },
];

const TOOLS = [
  "Google Ads (Search, PMax)",
  "Meta Ads",
  "Klaviyo",
  "Shopify",
  "GA4",
  "GTM",
  "Conversion API / Server‑side",
  "Looker Studio",
  "Hotjar",
  "VWO / Optimizely",
];

const TEAM = [
  {
    name: "Bhupendra Kumar",
    role: "Growth & Performance",
    img: "/bhupendra.jpg",
    blurb:
      "Leads acquisition strategy, analytics, and experimentation cadence.",
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
    name: "Parul",
    role: "QA & Automation",
    img: "/Parul.jpeg",
    blurb: "Regression, E2E flows, and performance checks before each release.",
    linkedin: "https://www.linkedin.com/in/parul-maurya-3951b22b1/",
  },
  {
    name: "Kshama",
    role: "Project Ops",
    img: "/Kshama.jpg",
    blurb: "Schedules, status, and documentation to keep shipping on time.",
    linkedin: "https://www.linkedin.com/in/kshama-tiwari-138903231/",
  },
];

export default function DigitalMarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <JsonLd data={breadcrumbSchema} />

      {/* Hero */}
      <AnimatedSection>
        <Section>
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
                Digital Marketing
              </h1>
              <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
                Performance marketing that compounds: Google & Meta Ads, CRO,
                analytics, and clear reporting to scale what works.
              </p>
              <div className="mt-8 flex gap-3">
                <Link
                  href="/pricing/"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                >
                  See pricing
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
                src="https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?q=80&w=1400&auto=format&fit=crop"
                alt="Campaign planning and analytics"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </Section>
      </AnimatedSection>

      {/* Process */}
      <AnimatedSection>
        <Section>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Target className="w-5 h-5" /> Process
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
        </Section>
      </AnimatedSection>

      {/* Tools */}
      <AnimatedSection id="tools">
        <Section>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Tools & Channels
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
        </Section>
      </AnimatedSection>

      {/* Team */}
      <AnimatedSection id="team">
        <Section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5" /> Growth Team
            </h2>
            <Link
              href="/contact-us/"
              className="text-sm font-medium hover:opacity-80"
            >
              Work with us →
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
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
        </Section>
      </AnimatedSection>

      {/* CTA */}
      <Section>
        <Card>
          <div className="p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Let’s grow
              </div>
              <h3 className="mt-1 text-2xl font-extrabold">
                Ship experiments, measure ruthlessly, scale winners.
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
                Share your goals and constraints. We’ll propose a plan and start
                with the quickest revenue lift.
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
                href="/services/"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
              >
                See services
              </Link>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

