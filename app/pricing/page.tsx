import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  Code2,
  ShoppingBag,
} from "lucide-react";

const pageTitle =
  "Custom Engagements — AI, Software & Digital Growth | DigiPants";
const pageDescription =
  "Explore custom engagements in AI engineering, software, e-commerce, and digital growth. Start with a conversation about your requirements.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: "https://digipants.com/pricing/" },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "https://digipants.com/pricing/",
    siteName: "DigiPants",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const ENGAGEMENT_PATHWAYS = [
  {
    title: "AI & Automation",
    description:
      "Explore practical AI systems and automation shaped around analysis, decision-making, and repeatable workflows.",
    icon: Bot,
  },
  {
    title: "Custom Software Engineering",
    description:
      "Discuss a purpose-built product, platform, dashboard, or integration designed for your users and operating needs.",
    icon: Code2,
  },
  {
    title: "Web Development & E-commerce",
    description:
      "Plan a content-rich website, online store, or ordering experience that makes discovery and transactions clear.",
    icon: ShoppingBag,
  },
  {
    title: "Digital Growth & Performance",
    description:
      "Bring acquisition, search visibility, conversion, and measurement into focus around your business priorities.",
    icon: ChartNoAxesCombined,
  },
];

const ENQUIRY_STEPS = [
  {
    number: "01",
    title: "Discuss requirements",
    description:
      "Tell us about the challenge, your goals, and the context around the work.",
  },
  {
    number: "02",
    title: "Review the scope",
    description:
      "We’ll review what you need, clarify priorities, and identify a suitable direction together.",
  },
  {
    number: "03",
    title: "Receive a tailored proposal",
    description:
      "You’ll receive a proposal shaped around the agreed scope and relevant next steps.",
  },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950";

export default function PricingPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Custom engagements
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">
              A focused engagement, shaped around your needs.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8 dark:text-zinc-400">
              Every project starts with the problem to solve. We’ll understand
              your requirements and explore the right approach across AI,
              software, commerce, and digital growth.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact-us/"
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 ${focusRing}`}
              >
                Discuss your project <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/services/"
                className={`inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 ${focusRing}`}
              >
                Explore our services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="pathways-title">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Where we can help
            </p>
            <h2
              id="pathways-title"
              className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white"
            >
              Start with the challenge in front of you.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              These pathways reflect our current services. The right scope
              depends on your requirements and the context of the work.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ENGAGEMENT_PATHWAYS.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="group rounded-2xl border border-zinc-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-emerald-400/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
                <Link
                  href="/contact-us/"
                  className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 transition group-hover:gap-3 dark:text-emerald-300 ${focusRing}`}
                >
                  Discuss this service{" "}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              A clear starting point
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
              From first conversation to a considered proposal.
            </h2>
          </div>
          <ol className="mt-9 grid gap-4 md:grid-cols-3">
            {ENQUIRY_STEPS.map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="text-sm font-semibold tracking-wider text-emerald-700 dark:text-emerald-400">
                  {step.number}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-20 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Have a project in mind?
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
              Let’s start with a conversation.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Share what you’re looking to solve. We’ll take it from there.
            </p>
          </div>
          <Link
            href="/contact-us/"
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 ${focusRing}`}
          >
            Get in touch <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
