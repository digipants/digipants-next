import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Code2, ShoppingBag, TrendingUp } from "lucide-react";
import ContactForm from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact DigiPants | Start a Project",
  description:
    "Tell DigiPants about your AI, software engineering, web, e-commerce, or digital growth project.",
  alternates: { canonical: "https://digipants.com/contact-us/" },
  openGraph: {
    title: "Contact DigiPants | Start a Project",
    description:
      "Share the goals and context behind your next product or growth project.",
    url: "https://digipants.com/contact-us/",
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: "https://digipants.com/aegisprotection.webp",
        width: 1920,
        height: 1038,
        alt: "AegisProtection web application by DigiPants",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact DigiPants | Start a Project",
    description:
      "Share the goals and context behind your next product or growth project.",
    images: ["https://digipants.com/aegisprotection.webp"],
  },
  keywords: [
    "contact DigiPants",
    "software development enquiry",
    "AI engineering project",
    "digital growth enquiry",
  ],
};

const AREAS = [
  { icon: Bot, label: "AI & automation" },
  { icon: Code2, label: "Software & web" },
  { icon: ShoppingBag, label: "E-commerce" },
  { icon: TrendingUp, label: "Digital growth" },
];

export default function ContactPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Contact DigiPants
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">
              Tell us what you’re working on.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              Share the opportunity, what you have in place, and where you need
              support. We work across product engineering and digital growth.
            </p>
            <a
              href="mailto:support@digipants.com"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 outline-none hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:text-zinc-100 dark:hover:text-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
            >
              support@digipants.com <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              How we can help
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              A useful first conversation starts with context.
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {AREAS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <Icon
                    className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A short outline of your goals, users, current setup, and
              constraints is enough to begin. Please don’t include passwords or
              other confidential information.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Project enquiry
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Send us a few details
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Fields marked required help us understand and respond to your
            enquiry.
          </p>
          <div className="mt-7">
            <ContactForm />
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-950 dark:text-white">
            Helpful context
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <li>What you’re aiming to build or improve.</li>
            <li>Who it is for and what should work well for them.</li>
            <li>Relevant constraints, existing tools, or important dates.</li>
          </ul>
          <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Prefer email?
            </p>
            <a
              href="mailto:support@digipants.com"
              className="mt-1 inline-flex font-semibold text-zinc-900 outline-none hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white dark:hover:text-emerald-300 dark:focus-visible:ring-emerald-400"
            >
              support@digipants.com
            </a>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              DigiPants · Lucknow, India
            </p>
            <Link
              href="/services/"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 outline-none hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white dark:hover:text-emerald-300 dark:focus-visible:ring-emerald-400"
            >
              Explore services <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
