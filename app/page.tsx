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
import { projects, type Project } from "@/lib/data";

export const metadata: Metadata = {
  title: "DigiPants — AI Engineering, Software & Digital Growth",
  description:
    "DigiPants builds AI-powered platforms, custom software, high-performance websites, e-commerce experiences, and digital growth systems.",
  alternates: { canonical: "https://digipants.com/" },
};

const FEATURED_ENGINEERING = selectProjects([
  "aegisprotection",
  "aegistrade",
  "reputationdesk",
]);

const SELECTED_WORK = selectProjects([
  "vidyanju",
  "nectarkitchen",
  "educatia",
  "aikitchen",
]);

const CAPABILITIES = [
  {
    title: "AI & Automation",
    description:
      "Applied AI, intelligent workflows, monitoring systems, and practical automation designed around real operating needs.",
    icon: Bot,
  },
  {
    title: "Custom Software Engineering",
    description:
      "Purpose-built web platforms and product foundations shaped for clear workflows, maintainability, and responsible growth.",
    icon: Code2,
  },
  {
    title: "Web & E-commerce",
    description:
      "Fast, accessible websites and commerce experiences that make discovery, ordering, and engagement feel effortless.",
    icon: ShoppingBag,
  },
  {
    title: "Digital Growth & Performance",
    description:
      "Search, paid media, conversion strategy, and measurement systems connected to meaningful business priorities.",
    icon: ChartNoAxesCombined,
  },
];

const PROCESS = [
  {
    title: "Discover",
    description:
      "Understand the opportunity, users, constraints, and evidence before defining the work.",
    icon: Compass,
  },
  {
    title: "Architect",
    description:
      "Shape the product, technical approach, and delivery plan around the decisions that matter most.",
    icon: Layers3,
  },
  {
    title: "Build",
    description:
      "Turn the plan into a focused, testable experience with close attention to quality and clarity.",
    icon: Blocks,
  },
  {
    title: "Launch & Improve",
    description:
      "Release responsibly, learn from real use, and improve the product where evidence supports it.",
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

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}/`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition duration-300 hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-xl hover:shadow-zinc-900/5 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 motion-reduce:transform-none motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:hover:shadow-black/20 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
    >
      <div className="aspect-[16/10] overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
        <img
          src={projectImage(project)}
          alt={`${project.title} interface`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] motion-reduce:transition-none"
          loading="lazy"
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

export default function Page() {
  const [aegisProtection, aegisTrade, reputationDesk] = FEATURED_ENGINEERING;

  return (
    <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16 lg:px-8 lg:py-12">
          <div className="max-w-2xl lg:pt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              AI, software, web & growth
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white">
              We Build What&apos;s Next.
            </h1>
            <p className="mt-6 text-lg font-semibold tracking-tight text-zinc-800 sm:text-xl dark:text-zinc-200">
              Intelligent Technology. Real Business Growth.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              From AI-powered platforms and custom software to high-performance
              websites and digital growth systems, we turn ambitious ideas into
              products that work.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/work/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Explore Our Work <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact-us/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Start a Project
              </Link>
            </div>
          </div>

          {aegisProtection && aegisTrade && reputationDesk && (
            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div className="absolute -left-8 top-12 h-40 w-2 rounded-full bg-emerald-600/70 dark:bg-emerald-400/70" />
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-3 shadow-2xl shadow-zinc-900/10 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 dark:border-zinc-700">
                  <img
                    src={projectImage(aegisProtection)}
                    alt={`${aegisProtection.title} interface`}
                    className="aspect-[16/9] w-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 px-1 pb-1">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                      AegisProtection
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      AI-assisted digital safety
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Engineering
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[aegisTrade, reputationDesk].map((project) => (
                  <div
                    key={project.slug}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
                  >
                    <img
                      src={projectImage(project)}
                      alt={`${project.title} interface`}
                      className="aspect-[16/10] w-full rounded-xl object-cover"
                      loading="eager"
                    />
                    <p className="px-2 pb-1 pt-3 text-xs font-semibold text-zinc-800 sm:text-sm dark:text-zinc-200">
                      {project.title.split(" — ")[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50 py-16 sm:py-20 lg:py-24 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Featured engineering"
            title="Complex products, made clear and useful."
            description="Selected platforms that combine thoughtful product design with responsible AI and software engineering."
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {FEATURED_ENGINEERING.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Capabilities"
            title="Engineering and growth, connected."
            description="A focused mix of technical delivery, digital experience, and growth expertise for products that need more than a single discipline."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
            {CAPABILITIES.map(({ title, description, icon: Icon }) => (
              <article key={title} className="bg-white p-6 sm:p-7 dark:bg-zinc-950">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 py-16 sm:py-20 lg:py-24 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Selected work"
              title="Digital experiences built for real use."
              description="Commerce, food, education, and service platforms designed around clear customer journeys and practical business needs."
            />
            <Link
              href="/work/"
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-900 outline-none hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:text-zinc-100 dark:hover:text-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
            >
              View complete portfolio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SELECTED_WORK.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Our process"
            title="From open question to working product."
            description="A practical delivery rhythm that creates clarity early and keeps attention on the product throughout the engagement."
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
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-8 overflow-hidden rounded-3xl bg-zinc-950 px-6 py-10 text-white sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:px-14 lg:py-16 dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Build with DigiPants
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Have a serious idea worth building well?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              Tell us what you&apos;re trying to create, improve, or grow. We&apos;ll
              help turn the opportunity into a focused next step.
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
