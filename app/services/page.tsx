// app/services/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Services | DigiPants",
  description:
    "Performance marketing, CRO/UX, analytics, and AI automations—shipped fast, measured rigorously.",
  openGraph: { title: "Services | DigiPants", url: "/services/" },
};

type Service = {
  title: string;
  blurb: string;
  bullets: string[];
  img: string;
};

const SERVICES: Service[] = [
  {
    title: "Performance Marketing",
    blurb:
      "Capture intent with Google Search & PMax. Find scale with Meta creative testing that compounds.",
    bullets: [
      "Account audit & restructure",
      "Offer/LP testing cadence",
      "Creative matrix & concept sprints",
      "Weekly reporting & ROAS guardrails",
    ],
    img: "https://source.unsplash.com/featured/1200x800?search,ads",
  },
  {
    title: "CRO & UX",
    blurb:
      "Friction down, clarity up. Hypothesis-driven A/B tests that turn attention into revenue.",
    bullets: [
      "Heuristic + analytics review",
      "Prioritized test backlog",
      "Message clarity, social proof, pricing",
      "Speed passes & Core Web Vitals",
    ],
    img: "https://source.unsplash.com/featured/1200x800?ux,design",
  },
  {
    title: "AI Agents & Automations",
    blurb:
      "WhatsApp flows, on-site assistants, CRM routing. Faster replies, better qualification.",
    bullets: [
      "WhatsApp & web assistants",
      "Lead scoring & routing",
      "CRM follow-ups & reminders",
      "Dashboards & alerts",
    ],
    img: "https://source.unsplash.com/featured/1200x800?ai,assistant",
  },
  {
    title: "Analytics & Measurement",
    blurb:
      "Trust the numbers. GA4/GTM events, CAPI/server-side conversions, and ROAS dashboards.",
    bullets: [
      "Tracking plan & event schema",
      "GTM setup & QA",
      "Server-side conversions / CAPI",
      "Funnel & channel dashboards",
    ],
    img: "https://source.unsplash.com/featured/1200x800?analytics,graphs",
  },
  {
    title: "E-commerce (Shopify)",
    blurb:
      "Launch fast, iterate faster. Theme setup, Klaviyo flows, LTV lifts with upsells & subs.",
    bullets: [
      "Theme setup & speed",
      "Klaviyo browse/cart/post-purchase",
      "Upsells & subscriptions",
      "Offer testing & bundles",
    ],
    img: "https://source.unsplash.com/featured/1200x800?shopify,store",
  },
  {
    title: "Hotels (Direct Bookings)",
    blurb:
      "More direct, less OTA. Parity pages, PMax + Meta mix, remarketing & cart-abandon flows.",
    bullets: [
      "Offer parity landing pages",
      "PMax + Meta remarketing",
      "Cart-abandon automations",
      "Direct share tracking",
    ],
    img: "https://source.unsplash.com/featured/1200x800?hotel,travel",
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

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
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
      <Section>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm"
            >
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={s.img}
                  alt={s.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {s.blurb}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

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
