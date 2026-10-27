import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, Bot, Code2, Eye, Layers3, Workflow } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { projects, type Project } from "@/lib/data";

const pageTitle = "AI Engineering & Custom Software Partner | DigiPants";
const pageDescription =
  "India-based AI engineering for established businesses and agencies worldwide: production web apps, APIs, integrations, and practical automation.";
const canonicalUrl = "https://digipants.com/services/ai-software/";
const socialImage = "https://digipants.com/aegisprotection.webp";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1920,
        height: 1038,
        alt: "AegisProtection digital safety platform interface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [socialImage],
  },
  keywords: [
    "AI engineering",
    "AI automation",
    "custom software development",
    "web applications",
    "workflow software",
  ],
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: "AI Engineering & Custom Software",
      url: canonicalUrl,
      description: pageDescription,
      serviceType: ["AI & Automation", "Custom Software Engineering"],
      provider: {
        "@type": "Organization",
        name: "DigiPants",
        url: "https://digipants.com/",
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://digipants.com/" },
        { "@type": "ListItem", position: 2, name: "Services", item: "https://digipants.com/services/" },
        { "@type": "ListItem", position: 3, name: "AI Engineering & Custom Software", item: canonicalUrl },
      ],
    },
  ],
} as const;

const SERVICES = [
  {
    icon: Bot,
    eyebrow: "AI & Automation",
    title: "AI that supports a clear workflow.",
    description:
      "Apply AI to analysis and monitoring where it can assist people, with outputs that remain understandable and reviewable.",
    capabilities: [
      "AI-assisted analysis and scoring",
      "Source collection, monitoring, and alerts",
      "Narrative analysis with human review",
      "Research workflows with risk controls",
    ],
  },
  {
    icon: Code2,
    eyebrow: "Custom Software Engineering",
    title: "Software shaped around your operation.",
    description:
      "Build purpose-specific product interfaces and workflow applications around actual users, data, and operating requirements.",
    capabilities: [
      "Product architecture and application foundations",
      "Dashboards and workflow interfaces",
      "API, data, and exchange integrations",
      "Responsive web, browser, and mobile surfaces",
    ],
  },
];

const PROJECT_SLUGS = ["aegisprotection", "aegistrade", "reputationdesk"];

const PROCESS = [
  {
    icon: Eye,
    title: "Understand the workflow",
    description:
      "Clarify the users, decisions, constraints, and evidence that shape the problem.",
  },
  {
    icon: Layers3,
    title: "Shape the system",
    description:
      "Define the product experience, technical boundaries, and appropriate role for automation.",
  },
  {
    icon: Workflow,
    title: "Build and review",
    description:
      "Develop the application and integrations in reviewable steps around the workflows that matter.",
  },
  {
    icon: Activity,
    title: "Evaluate in context",
    description:
      "Check system behavior against agreed requirements and keep human judgment in the right places.",
  },
];

function selectProjects(slugs: string[]) {
  return slugs
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter((project): project is Project => Boolean(project));
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}/`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 motion-reduce:transform-none dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
        <Image
          src={project.img}
          alt={`${project.title} interface`}
          fill
          sizes="(min-width: 1024px) 29vw, (min-width: 640px) 50vw, 100vw"
          style={{ objectPosition: project.imagePosition }}
          className="object-cover transition duration-500 group-hover:scale-[1.025] motion-reduce:transition-none"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <span className="w-fit rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {project.tag}
        </span>
        <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-zinc-950 dark:text-white">
          {project.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {project.summary}
        </p>
        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          View case study
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  );
}

export default function AiSoftwarePage() {
  const featuredProjects = selectProjects(PROJECT_SLUGS);

  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <JsonLd data={STRUCTURED_DATA} />

      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              AI engineering & custom software
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">
              AI systems and software, shaped around real work.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              For established businesses and digital agencies worldwide, we
              build production web applications, APIs, integrations, and
              practical AI automation from India. Our email-first process
              documents requirements, milestone updates, and approvals by
              email; an introductory call is optional.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact-us/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Discuss an AI or software project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#selected-work"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Explore selected projects
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
              <Image
                src="/aegisprotection.webp"
                alt="AegisProtection AI-assisted digital safety interface"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 55vw"
                className="object-cover"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-3">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                Selected product interface
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                AegisProtection
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Connected disciplines
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
            From applied AI to custom product foundations.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
            Choose a focused capability or bring both together when the product
            needs a complete workflow, interface, and supporting system.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {SERVICES.map(({ icon: Icon, eyebrow, title, description, capabilities }) => (
            <article
              key={eyebrow}
              className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                {eyebrow}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
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
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Examples from verified work
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
              Practical systems for specific workflows.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              Each project has a distinct purpose. These examples describe work
              delivered for those contexts, not guaranteed outcomes for another
              organization.
            </p>
          </div>
          <div id="selected-work" className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            A considered process
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
            Keep the problem, system, and people connected.
          </h2>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  0{index + 1}
                </span>
                <Icon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-semibold text-zinc-950 dark:text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-20 lg:px-8">
        <div className="flex flex-col gap-6 rounded-3xl bg-zinc-950 p-7 text-white sm:p-10 md:flex-row md:items-center md:justify-between dark:bg-zinc-900">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Start with the problem
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Tell us what your team needs to understand or build.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
              Share the workflow, users, and constraints. We can discuss the
              scope and a suitable next step.
            </p>
          </div>
          <Link
            href="/contact-us/"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950"
          >
            Discuss a project <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
