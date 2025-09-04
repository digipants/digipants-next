// app/services/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import AnimatedSection from "@/components/animate/AnimatedSection";
import AnimatedCard from "@/components/animate/AnimatedCard";
import {
  ArrowUpRight,
  Award,
  Rocket,
  Briefcase,
  Sparkles,
  BookOpen,
  Globe,
} from "lucide-react";
import { PropsWithChildren } from "react";

import JsonLd from "@/components/seo/JsonLd";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which plan should I choose?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Starter is for quick wins and validation. Growth adds steady experimentation. Performance is for aggressive scaling or complex stacks. Custom is tailored for unique goals or compliance needs.",
      },
    },
    {
      "@type": "Question",
      name: "How fast do we see results?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most clients see early signals in 30–45 days and meaningful lift within 6–12 weeks, depending on channel mix, data quality, and velocity of experiments.",
      },
    },
    {
      "@type": "Question",
      name: "What’s included each month?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A prioritized roadmap, ad ops (Google/Meta), CRO tests, analytics maintenance, reporting, and async/weekly check-ins. Exact scope varies by plan.",
      },
    },
    {
      "@type": "Question",
      name: "Can we pause or cancel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Monthly plans can pause or cancel with notice per your agreement. We hand off assets and documentation on request.",
      },
    },
    {
      "@type": "Question",
      name: "Do you work with hotels, D2C, and services?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We specialize in hotels (direct bookings), D2C (Shopify), and service businesses. We adapt playbooks per vertical and stage.",
      },
    },
  ],
} as const;

export const metadata: Metadata = {
  title: "Services — DigiPants",
  description:
    "Performance marketing, CRO, analytics, and AI automations for hotels, D2C brands, and service businesses—built to ship fast and compound growth.",
  alternates: { canonical: "https://digipants.com/services/" },
  openGraph: {
    title: "Services — DigiPants",
    description:
      "Google & Meta Ads, CRO/UX, analytics pipelines, server-side tracking, AI agents, and Shopify growth.",
    url: "https://digipants.com/services/",
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: "https://digipants.com/og/services-cover.jpg",
        width: 1200,
        height: 630,
        alt: "DigiPants Services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Services — DigiPants",
    description:
      "End-to-end growth systems: ads, CRO, analytics, and AI automations.",
    images: ["https://digipants.com/og/services-cover.jpg"],
  },
  keywords: [
    "digital marketing services",
    "performance marketing",
    "CRO agency",
    "conversion rate optimization",
    "analytics implementation",
    "server-side tracking",
    "AI automation",
    "Shopify growth",
    "hotel marketing",
  ],
};

type Service = {
  title: string;
  blurb: string;
  bullets: string[];
  img: string;
};

const SERVICES = [
  {
    title: "Performance Marketing",
    desc: "Google Ads (Search, PMax), Meta Ads, and landing pages engineered for ROI.",
    icon: <Rocket className="w-5 h-5" />,
    tags: ["google ads", "pmax", "meta", "cro"],
  },
  {
    title: "AI Agents & Automations",
    desc: "WhatsApp flows, on‑site assistants, lead routing, CRM workflows, and reporting.",
    icon: <Sparkles className="w-5 h-5" />,
    tags: ["whatsapp", "chatbots", "zapier", "make"],
  },
  {
    title: "E‑commerce Growth (Shopify)",
    desc: "Store setup, product strategy, Klaviyo flows, upsells, subscriptions, LTV.",
    icon: <Briefcase className="w-5 h-5" />,
    tags: ["shopify", "klaviyo", "ux", "ltv"],
  },
  {
    title: "Hotel Booking Funnels",
    desc: "Direct booking strategy: parity pages, PMax+Meta mix, OTA sync, analytics.",
    icon: <Award className="w-5 h-5" />,
    tags: ["hotels", "pms", "ota", "meta"],
  },
  {
    title: "SEO & Content Systems",
    desc: "Compound traffic via content clusters, internal linking, and intent mapping.",
    icon: <BookOpen className="w-5 h-5" />,
    tags: ["seo", "content", "clusters", "schema"],
  },
  {
    title: "Analytics & Measurement",
    desc: "GA4, GTM, server‑side events, conversion APIs, dashboards, and audits.",
    icon: <Globe className="w-5 h-5" />,
    tags: ["ga4", "gtm", "ssr", "capi"],
  },
];

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

function Container({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

function Section({
  children,
  ...props
}: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) {
  return (
    <section className="scroll-mt-24 py-12 md:py-16" {...props}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <JsonLd data={faqSchema} />
      {/* Hero */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Services built for lift—
              <br className="hidden sm:block" /> measured to scale.
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
              We ship small, prove value, then compound—tying experiments to
              business goals and clear dashboards.
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
              src="https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop"
              alt="Workshop and planning board"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </Section>

      {/* Service grid */}
      <AnimatedSection id="services">
        <Container>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Services
            </h2>
            <a
              href="#contact"
              className="text-sm inline-flex items-center gap-1 hover:underline"
            >
              Get a custom plan <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {SERVICES.map((srv) => (
              <AnimatedCard
                key={srv.title}
                initial={{ y: 12, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Card className="p-6 h-full">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      {srv.icon}
                    </span>
                    <h3 className="font-semibold">{srv.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {srv.desc}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {srv.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Card>
              </AnimatedCard>
            ))}
          </div>
        </Container>
      </AnimatedSection>

      {/* Approach recap */}
      <Section>
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
          How we work
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            [
              "Discovery",
              "Goals, constraints, data access. Quick wins identified.",
            ],
            ["Plan", "90-day roadmap with measurable milestones."],
            ["Build & test", "Ship weekly, 2–4 experiments/month."],
            ["Scale", "Roll winners across channels & funnels."],
          ].map(([t, c]) => (
            <div
              key={t}
              className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5"
            >
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Step
              </div>
              <div className="mt-1 font-semibold">{t}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {c}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/work/"
            className="text-sm font-semibold hover:opacity-80"
          >
            See case studies →
          </Link>
        </div>
      </Section>
    </div>
  );
}
