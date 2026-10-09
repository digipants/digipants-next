import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, MousePointerClick, Search, Target } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { projects, type Project } from "@/lib/data";

export const metadata: Metadata = {
  title: "Digital Marketing & Growth | DigiPants",
  description:
    "DigiPants connects paid acquisition, technical SEO, landing-page optimization, and analytics to create a clearer, measurable growth program.",
  alternates: { canonical: "https://digipants.com/services/digital-marketing/" },
  openGraph: {
    title: "Digital Marketing & Growth | DigiPants",
    description:
      "Paid acquisition, search visibility, conversion optimization, and analytics built around meaningful measurement.",
    url: "https://digipants.com/services/digital-marketing/",
    siteName: "DigiPants",
    type: "website",
    images: [{ url: "https://digipants.com/vidyanju.webp", width: 1920, height: 1038, alt: "Vidyanju e-commerce experience" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Marketing & Growth | DigiPants",
    description: "Paid acquisition, SEO, conversion optimization, and analytics from DigiPants.",
    images: ["https://digipants.com/vidyanju.webp"],
  },
  keywords: ["digital marketing", "Google Ads", "Meta Ads", "technical SEO", "conversion rate optimization", "GA4", "Google Tag Manager"],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://digipants.com/" },
    { "@type": "ListItem", position: 2, name: "Services", item: "https://digipants.com/services/" },
    { "@type": "ListItem", position: 3, name: "Digital Marketing", item: "https://digipants.com/services/digital-marketing/" },
  ],
} as const;

const GROWTH_AREAS = [
  { icon: Target, title: "Paid acquisition", copy: "Plan and manage Google and Meta campaigns around defined audiences, offers, and business priorities." },
  { icon: Search, title: "Search visibility", copy: "Strengthen technical SEO and on-page foundations so useful content is easier for people and search engines to navigate." },
  { icon: MousePointerClick, title: "Landing experience & CRO", copy: "Review the journey from ad or search result to action, then prioritize evidence-led improvements to page clarity and conversion paths." },
  { icon: BarChart3, title: "Analytics & reporting", copy: "Use GA4 and Google Tag Manager to structure measurement, check key events, and communicate what the available data can—and cannot—tell us." },
];

const PROCESS = [
  { title: "Understand", copy: "Review goals, audiences, current channels, landing pages, tracking, and available evidence." },
  { title: "Set direction", copy: "Agree on channel priorities, measurement needs, and a focused set of tests and improvements." },
  { title: "Launch & learn", copy: "Implement campaigns and site changes in reviewable steps, checking tracking and user journeys." },
  { title: "Review & refine", copy: "Report on observed signals, surface uncertainty, and adjust priorities based on what the data supports." },
];

function selectProjects(slugs: string[]) {
  return slugs.map((slug) => projects.find((project) => project.slug === slug)).filter((project): project is Project => Boolean(project));
}

const FEATURED_WORK = selectProjects(["pearlytots", "upscale-hotel", "zescher"]);

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
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-800"><Image src={project.img} alt={`${project.title} project`} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /></div>
      <div className="p-5"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">{project.tag}</span><h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">{project.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{project.summary}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">View project <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div>
    </Link>
  );
}

export default function DigitalMarketingPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <JsonLd data={BREADCRUMB_SCHEMA} />
      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Digital marketing & growth</p>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-zinc-950 sm:text-6xl dark:text-white">Make growth easier to understand.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">Bring paid acquisition, search visibility, landing-page experience, and analytics into one considered program. We help teams decide what to measure, what to improve, and what to test next—without promising outcomes the evidence cannot support.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact-us/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">Discuss your growth goals <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/services/" className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">Explore all services</Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl"><Image src="/vidyanju.webp" alt="Vidyanju e-commerce storefront" fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover" /></div>
            <div className="flex items-center justify-between gap-4 px-3 py-3"><span className="text-sm font-semibold text-zinc-900 dark:text-white">Selected commerce experience</span><span className="text-xs text-zinc-500 dark:text-zinc-400">Vidyanju</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <SectionHeading eyebrow="Connected growth disciplines" title="A joined-up view of the customer journey" description="Campaigns work best when the destination, measurement, and learning loop receive the same attention as the channel itself." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{GROWTH_AREAS.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-2xl border border-zinc-200 p-6 transition hover:border-emerald-700/30 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-emerald-400/30 dark:hover:bg-zinc-900"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300"><Icon className="h-5 w-5" aria-hidden="true" /></div><h3 className="mt-5 text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy}</p></article>)}</div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <SectionHeading eyebrow="Working approach" title="Measure carefully. Improve deliberately." description="The right plan depends on your starting point. We make assumptions visible, validate the measurement, and prioritize the work that can be assessed." />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{PROCESS.map((step, index) => <li key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"><span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">0{index + 1}</span><h3 className="mt-3 font-semibold text-zinc-950 dark:text-white">{step.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.copy}</p></li>)}</ol>
          <div className="mt-8 flex flex-wrap gap-2" aria-label="Measurement and channel areas"><span className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Google Ads</span><span className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Meta Ads</span><span className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Technical SEO</span><span className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">GA4</span><span className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700">Google Tag Manager</span></div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <SectionHeading eyebrow="Selected work" title="Growth work shaped around the business" description="Explore examples from commerce and hospitality. Each project has its own context; these links are not a promise of a particular result for another business." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{FEATURED_WORK.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
        <Link href="/work/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-white dark:hover:text-emerald-300">View all work <ArrowRight className="h-4 w-4" /></Link>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 md:pb-20 lg:px-8">
        <div className="flex flex-col gap-6 rounded-3xl bg-zinc-950 p-7 text-white sm:p-10 md:flex-row md:items-center md:justify-between dark:bg-zinc-900">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Start with a useful conversation</p><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Clear goals. Honest measurement. Better decisions.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Share your current channels, questions, and constraints. We can help you identify a sensible next step.</p></div>
          <Link href="/contact-us/" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950">Talk to DigiPants <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
