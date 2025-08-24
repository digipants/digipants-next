import Link from "next/link";

type Service = { title: string; blurb: string; img: string; href: string };
type Work = { title: string; tag: string; img: string; href: string };
type Plan = {
  name: "Starter" | "Growth" | "Performance" | "Custom";
  price: string;
  period?: string;
  highlight?: boolean;
  features: string[];
  href: string;
};
type Person = {
  name: string;
  role: string;
  img: string;
  bio: string;
  href?: string;
};

const SERVICES: Service[] = [
  {
    title: "Performance Marketing",
    blurb:
      "Google Search & PMax to capture intent; Meta to test and scale creative.",
    img: "https://source.unsplash.com/featured/800x480?digital,marketing",
    href: "/services/",
  },
  {
    title: "CRO & UX",
    blurb:
      "A/B testing cadence, message clarity, social proof, and speed passes.",
    img: "https://source.unsplash.com/featured/800x480?ui,ux",
    href: "/services/",
  },
  {
    title: "AI Agents & Automations",
    blurb:
      "WhatsApp flows, on-site assistants, lead routing, follow-ups, reporting.",
    img: "https://source.unsplash.com/featured/800x480?ai,automation",
    href: "/services/",
  },
  {
    title: "Analytics & Measurement",
    blurb: "GA4/GTM schema, CAPI/server-side conversions, ROAS dashboards.",
    img: "https://source.unsplash.com/featured/800x480?analytics,dashboard",
    href: "/services/",
  },
  {
    title: "E-commerce (Shopify)",
    blurb:
      "Theme setup, speed upgrades, Klaviyo flows, upsells, subscriptions.",
    img: "https://source.unsplash.com/featured/800x480?shopify,ecommerce",
    href: "/services/",
  },
  {
    title: "Hotels (Direct Bookings)",
    blurb:
      "Parity pages vs OTAs, PMax + Meta, remarketing & cart-abandon flows.",
    img: "https://source.unsplash.com/featured/800x480?hotel,booking",
    href: "/services/",
  },
];

const WORK: Work[] = [
  {
    title: "Upscale Hotel — More Direct, Less OTA",
    tag: "Hotels",
    img: "https://source.unsplash.com/featured/900x560?hotel,lobby",
    href: "/work/",
  },
  {
    title: "PearlyTots — D2C Launch & Scale",
    tag: "D2C",
    img: "https://source.unsplash.com/featured/900x560?packaging,brand",
    href: "/work/",
  },
  {
    title: "QuickSqad — AI Support to Cut CAC",
    tag: "AI",
    img: "https://source.unsplash.com/featured/900x560?chatbot,ai",
    href: "/work/",
  },
];

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "₹75k",
    period: "/month",
    features: [
      "Account & analytics setup",
      "LP/message pass",
      "Initial creative tests",
      "Weekly reporting",
    ],
    href: "/contact-us/",
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
    href: "/contact-us/",
  },
  {
    name: "Performance",
    price: "₹2L+",
    period: "/month",
    features: [
      "Creative pipeline & concept matrix",
      "Advanced measurement (CAPI/SS)",
      "Experimentation cadence",
      "ROAS dashboards",
    ],
    href: "/contact-us/",
  },
  {
    name: "Custom",
    price: "Let's talk",
    features: [
      "Multi-brand / markets",
      "Custom automations & agents",
      "Deep analytics",
      "Ad hoc R&D",
    ],
    href: "/contact-us/",
  },
];

const TEAM: Person[] = [
  {
    name: "Bhupendra Kumar",
    role: "Founder, Growth & Performance",
    img: "/bhupendra.jpg",
    bio: "Leads acquisition strategy across Google/Meta, analytics, and CRO.",
    href: "mailto:bhupendra@digipants.com",
  },
  {
    name: "Creative Partner",
    role: "Ad Concepts & UGC",
    img: "/anju.JPG",
    bio: "Concepts, hooks, and editing to fuel creative testing.",
  },
  {
    name: "Automation Partner",
    role: "AI Agents & Data",
    img: "/ajit.jpg",
    bio: "WhatsApp/CRM flows, lead routing, and reporting integrations.",
  },
];

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-12 md:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm">
      {children}
    </div>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <Section id="home">
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1 text-xs">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />{" "}
              Open for select projects
            </div>
            <h1 className="mt-4 text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Better, faster websites. <br className="hidden sm:block" />
              Growth that compounds.
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
              We design growth systems—performance marketing, CRO, analytics,
              and AI automations—so revenue lifts in weeks, not months.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                <div className="text-2xl font-extrabold">30–90d</div>
                <div>to first lift</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold">2–4</div>
                <div>tests / month</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold">0→1</div>
                <div>to scale, fast</div>
              </div>
            </div>
          </div>
          <Card>
            <img
              src="https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop"
              alt="Growth dashboard"
              className="w-full h-full object-cover"
            />
          </Card>
        </div>
      </Section>

      <Section id="services">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Services
          </h2>
          <Link
            href="/services/"
            className="text-sm font-medium hover:opacity-80"
          >
            Explore all →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.title} href={s.href} className="group">
              <Card>
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={s.img}
                    alt={s.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold group-hover:underline">
                      {s.title}
                    </h3>
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
                      Core
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {s.blurb}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="work">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Selected Work
          </h2>
          <Link href="/work/" className="text-sm font-medium hover:opacity-80">
            View all →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {WORK.map((w) => (
            <Link key={w.title} href={w.href} className="group">
              <Card>
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={w.img}
                    alt={w.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold group-hover:underline">
                      {w.title}
                    </h3>
                    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
                      {w.tag}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm opacity-80">
                    Read case study
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="approach">
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
          How we work
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            [
              "Discovery",
              "Goals, constraints, data access. Quick win alignment.",
            ],
            ["Plan", "90-day roadmap with measurable milestones."],
            ["Build & test", "Ship weekly. 2–4 experiments per month."],
            ["Scale", "Roll winning patterns across funnels and channels."],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5"
            >
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Step
              </div>
              <div className="mt-1 font-semibold">{title}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pricing">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Pricing
          </h2>
          <Link
            href="/pricing/"
            className="text-sm font-medium hover:opacity-80"
          >
            Full details →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {PLANS.map((p) => (
            <Card key={p.name}>
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
                  href={p.href}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                    p.highlight
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
                  }`}
                >
                  Get started
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="team">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Team
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
                </div>
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {m.bio}
                </p>
                {m.href && (
                  <Link
                    href={m.href}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium hover:opacity-80"
                  >
                    Get in touch →
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="cta">
        <Card>
          <div className="p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Let’s move
              </div>
              <h3 className="mt-1 text-2xl font-extrabold">
                Ship within weeks, measure ruthlessly, scale what works.
              </h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
                Send your goals and constraints. We’ll suggest a plan and start
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
