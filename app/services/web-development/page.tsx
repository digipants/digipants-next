import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Blocks, Code2, Gauge, Layers3, PlugZap, Search } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { projects, type Project } from "@/lib/data";

export const metadata: Metadata = {
  title: "Web Development & Engineering | DigiPants",
  description:
    "DigiPants designs and builds responsive websites, web applications, e-commerce experiences, and integrations with a focus on performance and maintainability.",
  alternates: { canonical: "https://digipants.com/services/web-development/" },
  openGraph: {
    title: "Web Development & Engineering | DigiPants",
    description:
      "Responsive websites, web applications, commerce, and integrations built around real product needs.",
    url: "https://digipants.com/services/web-development/",
    siteName: "DigiPants",
    type: "website",
    images: [{ url: "https://digipants.com/aegisprotection.webp", width: 1920, height: 1038, alt: "AegisProtection web application" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Development & Engineering | DigiPants",
    description: "Websites, applications, e-commerce, and integrations shaped around your product.",
    images: ["https://digipants.com/aegisprotection.webp"],
  },
  keywords: ["web development", "web application development", "e-commerce development", "Next.js", "React", "technical SEO"],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://digipants.com/" },
    { "@type": "ListItem", position: 2, name: "Services", item: "https://digipants.com/services/" },
    { "@type": "ListItem", position: 3, name: "Web Development", item: "https://digipants.com/services/web-development/" },
  ],
} as const;

const CAPABILITIES = [
  { icon: Layers3, title: "Websites & content experiences", copy: "Responsive marketing and content websites that make information and next steps clear across devices." },
  { icon: Blocks, title: "Web applications", copy: "Purpose-built product interfaces, dashboards, and workflows designed around the people who use them." },
  { icon: PlugZap, title: "Commerce & integrations", copy: "Catalogues, ordering journeys, and connections to the services a business already relies on." },
  { icon: Gauge, title: "Performance & accessibility", copy: "A considered technical foundation for fast, accessible experiences that are easier to maintain." },
  { icon: Search, title: "Search foundations", copy: "Semantic structure, metadata, and technical SEO considered as part of the build." },
];

const PROCESS = [
  { title: "Understand", copy: "Align on users, goals, existing systems, constraints, and the work that matters most." },
  { title: "Plan", copy: "Shape the experience, technical approach, integrations, and a practical delivery sequence." },
  { title: "Build & review", copy: "Develop in focused increments, checking core journeys, responsiveness, and accessibility along the way." },
  { title: "Release & support", copy: "Prepare the launch, document the work, and identify useful next improvements." },
];

function selectProjects(slugs: string[]) {
  return slugs.map((slug) => projects.find((project) => project.slug === slug)).filter((project): project is Project => Boolean(project));
}

const FEATURED_WORK = selectProjects(["aegisprotection", "vidyanju", "nectarkitchen"]);

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">{title}</h2>
      <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">{description}</p>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/work/${project.slug}/`} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <Image src={project.img} alt={`${project.title} project`} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className="p-5">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{project.tag}</span>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{project.title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{project.summary}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">View project <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

export default function WebDevelopmentPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <JsonLd data={BREADCRUMB_SCHEMA} />
      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Web development & engineering</p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">Digital experiences, engineered with care.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">We design and build websites, web applications, e-commerce experiences, and integrations around the needs of your users and product—with performance and maintainability considered from the start.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact-us/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">Discuss a project <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/work/" className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">Explore our work</Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl"><Image src="/aegisprotection.webp" alt="AegisProtection digital safety platform interface" fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover" /></div>
            <div className="flex items-center justify-between gap-4 px-3 py-3"><span className="text-sm font-semibold text-zinc-900 dark:text-white">Selected product interface</span><span className="text-xs text-zinc-500 dark:text-zinc-400">AegisProtection</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <SectionHeading eyebrow="What we build" title="From clear websites to connected products" description="Choose the right level of engineering for the job, with thoughtful experience design and a foundation that can evolve." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-2xl border border-zinc-200 p-6 transition hover:border-emerald-700/30 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-emerald-400/30 dark:hover:bg-zinc-900"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"><Icon className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy}</p></article>)}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <SectionHeading eyebrow="How we work" title="A focused path from idea to release" description="A collaborative process keeps decisions visible and delivery grounded in your goals, constraints, and feedback." />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{PROCESS.map((step, index) => <li key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"><span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">0{index + 1}</span><h3 className="mt-3 font-semibold text-zinc-950 dark:text-white">{step.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.copy}</p></li>)}</ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <SectionHeading eyebrow="Selected work" title="Engineering for real use cases" description="A few examples of digital experiences and products built for different needs." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{FEATURED_WORK.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
        <Link href="/work/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white dark:hover:text-emerald-300">View all work <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-20 lg:px-8">
        <div className="flex flex-col gap-6 rounded-3xl bg-zinc-950 p-7 text-white sm:p-10 md:flex-row md:items-center md:justify-between dark:bg-zinc-900">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Have a project in mind?</p><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Let’s make the next step clear.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Tell us what you are building, what needs to work, and where you need support.</p></div>
          <Link href="/contact-us/" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950">Start a conversation <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
