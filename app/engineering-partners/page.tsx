import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Braces, Code2, FileText, Layers3, Mail, Workflow } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { projects, type Project } from "@/lib/data";

const canonicalUrl = "https://digipants.com/engineering-partners/";
const pageTitle = "AI Engineering Partner for UK & US Teams | DigiPants";
const pageDescription =
  "India-based AI-native engineering for UK and US businesses and agencies: production web applications, APIs, integrations, and practical workflow automation.";

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
        url: "https://digipants.com/aegisprotection.webp",
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
    images: ["https://digipants.com/aegisprotection.webp"],
  },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: "AI-native software engineering and business automation",
      url: canonicalUrl,
      description: pageDescription,
      serviceType: [
        "Production web application engineering",
        "API and integration engineering",
        "AI-enabled workflow automation",
      ],
      areaServed: [
        { "@type": "Country", name: "United Kingdom" },
        { "@type": "Country", name: "United States" },
      ],
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
        { "@type": "ListItem", position: 2, name: "Engineering Partners", item: canonicalUrl },
      ],
    },
  ],
} as const;

const CAPABILITIES = [
  {
    icon: Code2,
    title: "Production web applications",
    description:
      "Customer-facing products and internal tools shaped around real users, workflows, and operating needs.",
  },
  {
    icon: Braces,
    title: "APIs and integrations",
    description:
      "Connect applications, services, and business data through purpose-built API and integration work.",
  },
  {
    icon: Bot,
    title: "AI-enabled workflow automation",
    description:
      "Apply AI to analysis and repeatable workflows while keeping outputs understandable and reviewable.",
  },
];

const PROCESS = [
  { icon: FileText, title: "Share your project brief", description: "Tell us about the product, workflow, goals, and constraints." },
  { icon: Layers3, title: "Review the scope", description: "We assess the requirements and clarify the details needed to shape a proposal." },
  { icon: Mail, title: "Get a tailored proposal", description: "Review a suggested scope and the next steps for your project." },
  { icon: Workflow, title: "Agree on milestones", description: "Set delivery milestones, review progress, and confirm approvals as work moves forward." },
];

const FEATURED_SLUGS = ["aegisprotection", "aegistrade", "reputationdesk"];

function getFeaturedProjects() {
  return FEATURED_SLUGS
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter((project): project is Project => Boolean(project));
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}/`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
        <Image
          src={project.img}
          alt={`${project.title} interface`}
          fill
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"
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
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export default function EngineeringPartnersPage() {
  const featuredProjects = getFeaturedProjects();

  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <JsonLd data={STRUCTURED_DATA} />

      <nav className="mx-auto w-full max-w-7xl px-4 pt-6 text-sm text-zinc-500 sm:px-6 lg:px-8" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="rounded-sm hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:text-white">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-zinc-800 dark:text-zinc-200">Engineering partners</li>
        </ol>
      </nav>

      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_0.8fr] lg:gap-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              India-based · For UK & US businesses and agencies
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-zinc-950 sm:text-5xl lg:text-6xl dark:text-white">
              An AI-native engineering partner for your next build.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              DigiPants builds production web applications, APIs and
              integrations, and practical AI-enabled workflows for established
              businesses and digital agencies. Based in India, we partner with
              teams to shape requirements into clearly scoped engineering work.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact-us/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Send your project brief <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="#selected-work"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                See engineering work
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-zinc-950">
              <Image
                src="/aegisprotection.webp"
                alt="AegisProtection digital safety platform interface"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 42vw"
                className="object-cover"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-3 py-3">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">Selected engineering project</span>
              <Link href="/work/aegisprotection/" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-300">
                AegisProtection <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">What we build</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">Three capabilities. One delivery partner.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="selected-work" className="border-y border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Selected engineering work</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">Real systems, documented case studies.</h2>
              <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">Explore verified product work across digital safety, trading research, and reputation intelligence.</p>
            </div>
            <Link href="/work/" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white">
              All projects <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">How we work</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">A clear path from brief to delivery.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Share your goals and constraints. We review the scope, prepare a tailored proposal, and agree on milestones before work begins.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {PROCESS.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="text-xs font-semibold tabular-nums text-zinc-400">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-zinc-950 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 rounded-3xl bg-zinc-950 px-6 py-8 text-white sm:px-10 sm:py-10 lg:flex-row lg:items-center lg:px-12 dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Next steps</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Have a build in mind?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">Share your goals and we&apos;ll review the scope and suggest next steps.</p>
          </div>
          <Link href="/contact-us/" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950">
            Send your project brief <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
