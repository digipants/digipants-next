// app/pricing/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — DigiPants",
  description:
    "Transparent digital marketing plans that deliver measurable growth within weeks. Choose Starter, Growth, Performance, or Custom to fit your goals.",
  alternates: {
    canonical: "https://digipants.com/pricing/",
  },
  openGraph: {
    title: "Pricing — DigiPants",
    description:
      "Transparent plans for hotels, D2C brands, and service businesses. Get results in weeks, not months.",
    url: "https://digipants.com/pricing/",
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: "https://digipants.com/og/pricing-cover.jpg", // ideally generate a branded image
        width: 1200,
        height: 630,
        alt: "DigiPants Pricing Plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — DigiPants",
    description:
      "Choose the right DigiPants plan to accelerate your growth: Starter, Growth, Performance, or Custom.",
    images: ["https://digipants.com/og/pricing-cover.jpg"],
  },
  keywords: [
    "DigiPants pricing",
    "digital marketing plans",
    "performance marketing",
    "CRO packages",
    "AI automation services",
  ],
};

type Plan = {
  name: string;
  price: string;
  period?: string;
  highlight?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "₹75k",
    period: "/month",
    features: [
      "Account & analytics setup",
      "Landing page/message pass",
      "Initial creative tests",
      "Weekly reporting",
    ],
  },
  {
    name: "Growth",
    price: "₹1.2L",
    period: "/month",
    highlight: true,
    features: [
      "Google + Meta management",
      "2–4 A/B tests / month",
      "Klaviyo flows",
      "CRO backlog",
    ],
  },
  {
    name: "Performance",
    price: "₹2L+",
    period: "/month",
    features: [
      "Creative pipeline & concept matrix",
      "Advanced measurement (CAPI/SS)",
      "Experiment cadence",
      "ROAS dashboards",
    ],
  },
  {
    name: "Custom",
    price: "Let’s talk",
    features: [
      "Multi-brand / markets",
      "Custom automations & agents",
      "Deep analytics",
      "Ad hoc R&D",
    ],
  },
];

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24 py-12 md:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      {/* Hero */}
      <Section>
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Pricing that maps to outcomes.
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
              Pick a plan, or we’ll tailor one around your goals, margins, and
              timeline. Most teams see lift in 30–90 days.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop"
              alt="Pricing and planning"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </Section>

      {/* Plans */}
      <Section>
        <div className="grid gap-6 md:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm"
            >
              <div
                className={`p-6 ${
                  p.highlight ? "bg-zinc-50 dark:bg-white/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  {p.highlight && (
                    <span className="text-xs rounded-full border px-2 py-0.5 border-zinc-200/70 dark:border-zinc-700/60">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  {p.period && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {" "}
                      {p.period}
                    </span>
                  )}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact-us/"
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                    p.highlight
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
                  }`}
                >
                  Get started
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* What’s included */}
      <Section>
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
          What’s included
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            [
              "Weekly rhythm",
              "Status, dashboards, and clear next steps—no fluff.",
            ],
            [
              "Experiment backlog",
              "Hypotheses prioritized by impact/effort and data confidence.",
            ],
            [
              "Transparent reporting",
              "We tie activities to ROAS, CPA, and LTV—not vanity metrics.",
            ],
          ].map(([t, c]) => (
            <div
              key={t}
              className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5"
            >
              <div className="font-semibold">{t}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {c}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQs */}
      <Section>
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
          FAQs
        </h2>
        <div className="mt-6 space-y-4">
          {[
            [
              "How fast can we start?",
              "We can kick off within a week once access and goals are clear.",
            ],
            [
              "Is there a minimum term?",
              "Month-to-month for Starter; quarterly for Growth/Performance.",
            ],
            [
              "Do you work internationally?",
              "Yes—billing in INR or USD, campaigns across regions.",
            ],
          ].map(([q, a]) => (
            <details
              key={q}
              className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4"
            >
              <summary className="font-semibold cursor-pointer">{q}</summary>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {a}
              </p>
            </details>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/contact-us/"
            className="text-sm font-semibold hover:opacity-80"
          >
            Still deciding? Talk to us →
          </Link>
        </div>
      </Section>
    </div>
  );
}
