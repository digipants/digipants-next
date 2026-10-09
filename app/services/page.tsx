import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Bot,
  ChartNoAxesCombined,
  Code2,
  Compass,
  Layers3,
  Rocket,
  ShoppingBag,
} from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { projects, type Project } from "@/lib/data";

export const metadata: Metadata = {
  title: "Services — AI Engineering, Software & Digital Growth | DigiPants",
  description:
    "AI and automation, custom software engineering, web and e-commerce development, and digital growth services from DigiPants.",
  alternates: { canonical: "https://digipants.com/services/" },
  openGraph: {
    title: "Services — AI Engineering, Software & Digital Growth | DigiPants",
    description:
      "Focused engineering and growth services for AI products, custom software, websites, e-commerce, and digital performance.",
    url: "https://digipants.com/services/",
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: "https://digipants.com/Screenshot%202026-10-09%20at%205.08.01%E2%80%AFPM.png",
        width: 1200,
        height: 630,
        alt: "AegisProtection interface by DigiPants",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Services — AI Engineering, Software & Digital Growth | DigiPants",
    description:
      "AI, custom software, web and e-commerce, and digital growth services.",
    images: [
      "https://digipants.com/Screenshot%202026-10-09%20at%205.08.01%E2%80%AFPM.png",
    ],
  },
  keywords: [
    "AI engineering services",
    "custom software development",
    "web development",
    "e-commerce development",
    "digital growth",
    "performance marketing",
    "automation",
  ],
};

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "DigiPants services",
  url: "https://digipants.com/services/",
  itemListElement: [
    "AI & Automation",
    "Custom Software Engineering",
    "Web Development & E-commerce",
    "Digital Growth & Performance",
  ].map((name, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name,
  })),
} as const;

const HERO_PROJECTS = selectProjects([
  "aegisprotection",
  "vidyanju",
  "reputationdesk",
]);

const SERVICE_PILLARS = [
  {
    title: "AI & Automation",
    description:
      "Practical AI systems that support analysis, decision-making, and repeatable workflows without hiding important judgment behind automation.",
    capabilities: [
      "AI-assisted analysis and scoring",
      "Human-review workflows",
      "Monitoring, alerts, and reporting",
      "Web, browser, and mobile product surfaces",
    ],
    icon: Bot,
  },
  {
    title: "Custom Software Engineering",
    description:
      "Purpose-built platforms shaped around the product, users, and operating model instead of forcing the work into a generic template.",
    capabilities: [
      "Product and technical architecture",
      "Dashboards and workflow applications",
      "API and data integrations",
      "Responsive web application delivery",
    ],
    icon: Code2,
  },
  {
    title: "Web Development & E-commerce",
    description:
      "Accessible websites and commerce experiences that make discovery, enquiry, ordering, and fulfilment clear across devices.",
    capabilities: [
      "Marketing and content websites",
      "Product catalogues, carts, and checkout",
      "Bespoke enquiry and ordering flows",
      "Technical SEO and performance foundations",
    ],
    icon: ShoppingBag,
  },
  {
    title: "Digital Growth & Performance",
    description:
      "Acquisition and measurement systems that connect campaign activity with landing experiences and useful business signals.",
    capabilities: [
      "Google Ads and Meta Ads",
      "SEO and content systems",
      "Conversion rate optimization",
      "Analytics, measurement, and reporting",
    ],
    icon: ChartNoAxesCombined,
  },
];

const PROCESS = [
  {
    title: "Discover",
    description:
      "Clarify the opportunity, users, current systems, constraints, and evidence available.",
    icon: Compass,
  },
  {
    title: "Architect",
    description:
      "Define the product direction, technical approach, priorities, and a focused delivery plan.",
    icon: Layers3,
  },
  {
    title: "Build",
    description:
      "Design and develop the experience in reviewable increments, testing the important workflows as they take shape.",
    icon: Blocks,
  },
  {
    title: "Launch & Improve",
    description:
      "Release responsibly, observe real use, and improve the product or growth system where evidence supports it.",
    icon: Rocket,
  },
];

function selectProjects(slugs: string[]) {
  return slugs
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter((project): project is Project => Boolean(project));
}

function projectImage(project: Project) {
  return encodeURI(project.img);
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

export default function ServicesPage() {
  const [aegisProtection, vidyanju, reputationDesk] = HERO_PROJECTS;

  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <JsonLd data={SERVICE_SCHEMA} />

      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Engineering + growth services
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">
              Build the right product. Grow it with intent.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              DigiPants brings product thinking, software engineering, digital
              experience, and growth expertise together around one clear
              objective: creating useful technology for real business needs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact-us/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Start a Project <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/work/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Explore Our Work
              </Link>
            </div>
          </div>

          {aegisProtection && vidyanju && reputationDesk && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[aegisProtection, vidyanju, reputationDesk].map(
                (project, index) => (
                  <Link
                    key={project.slug}
                    href={`/work/${project.slug}/`}
                    className={`group overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2 outline-none transition hover:border-emerald-700/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950 ${
                      index === 0 ? "sm:col-span-2" : ""
                    }`}
                  >
                    <img
                      src={projectImage(project)}
                      alt={`${project.title} interface`}
                      className={`w-full rounded-xl object-cover ${
                        index === 0 ? "aspect-[16/8]" : "aspect-[16/10]"
                      }`}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                    />
                    <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {project.title.split(" — ")[0]}
                      </p>
                      <ArrowRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </div>
                  </Link>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50 py-16 sm:py-20 lg:py-24 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="What we do"
            title="Four disciplines, one connected delivery team."
            description="Engage DigiPants for a focused service or combine disciplines where the product and growth challenge genuinely requires it."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {SERVICE_PILLARS.map(
              ({ title, description, capabilities, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {description}
                  </p>
                  <ul className="mt-6 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2 dark:text-zinc-300">
                    {capabilities.map((capability) => (
                      <li key={capability} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        {capability}
                      </li>
                    ))}
                  </ul>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Focused services"
            title="Explore the established service practices."
            description="Go deeper into the two dedicated service areas already documented on the DigiPants site."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Link
              href="/services/web-development/"
              className="group rounded-2xl border border-zinc-200 p-6 outline-none transition hover:border-emerald-700/30 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 sm:p-8 dark:border-zinc-800 dark:hover:border-emerald-400/30 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
            >
              <Code2 className="h-6 w-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h3 className="mt-6 text-xl font-semibold tracking-tight">
                Web Development
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Websites and web applications built around responsive UX,
                accessibility, integrations, and maintainable delivery.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                Explore web development
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
              </span>
            </Link>
            <Link
              href="/services/digital-marketing/"
              className="group rounded-2xl border border-zinc-200 p-6 outline-none transition hover:border-emerald-700/30 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 sm:p-8 dark:border-zinc-800 dark:hover:border-emerald-400/30 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
            >
              <ChartNoAxesCombined className="h-6 w-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h3 className="mt-6 text-xl font-semibold tracking-tight">
                Digital Marketing
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Google Ads, Meta Ads, SEO, CRO, analytics, and reporting shaped
                into a practical digital growth system.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                Explore digital marketing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-16 sm:py-20 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Growth remains connected
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Engineering is stronger when distribution and measurement are considered early.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {["Google Ads", "Meta Ads", "SEO", "CRO", "GA4 & GTM", "Measurement", "Reporting"].map(
              (capability) => (
                <span
                  key={capability}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  {capability}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Delivery process"
            title="A clear path from problem to progress."
            description="The exact engagement changes with the work, but the underlying rhythm stays focused and reviewable."
          />
          <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map(({ title, description, icon: Icon }, index) => (
              <li key={title} className="border-t border-zinc-300 pt-6 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    0{index + 1}
                  </span>
                  <Icon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                </div>
                <h3 className="mt-8 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-8 rounded-3xl bg-zinc-950 px-6 py-10 text-white sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:px-14 lg:py-16 dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Start with the real problem
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Tell us what you need to build, improve, or grow.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              Share the opportunity, current constraints, and what a useful
              outcome looks like. We&apos;ll help identify a focused next step.
            </p>
          </div>
          <Link
            href="/contact-us/"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
          >
            Start a Project <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
