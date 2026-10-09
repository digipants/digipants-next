import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import type { Project } from "@/lib/data";

type CaseStudyDetails = {
  cover: string;
  glow: string;
  label: string;
  mark: string;
  badges: string[];
  context: string;
  approach: string[];
  deliverables: string[];
  highlights: string[];
  stack: string[];
};

export function CaseStudyPage({
  project,
  details,
}: {
  project: Project;
  details: CaseStudyDetails;
}) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://digipants.com/" },
      { "@type": "ListItem", position: 2, name: "Work", item: "https://digipants.com/work/" },
      { "@type": "ListItem", position: 3, name: project.title, item: `https://digipants.com/work/${project.slug}/` },
    ],
  } as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <JsonLd data={breadcrumb} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 md:py-16 lg:px-8">
        <nav className="mb-6 text-sm text-zinc-600 dark:text-zinc-400" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:underline">Home</Link></li><li>/</li>
            <li><Link href="/work" className="hover:underline">Selected Work</Link></li><li>/</li>
            <li className="text-zinc-900 dark:text-zinc-100">{project.title.split(" — ")[0]}</li>
          </ol>
        </nav>

        <header>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{project.title}</h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">{project.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[project.tag, ...details.badges].map((badge) => (
              <span key={badge} className="inline-flex items-center rounded-full border border-zinc-200/70 px-3 py-1 text-xs font-medium dark:border-zinc-700/60">{badge}</span>
            ))}
          </div>
        </header>

        <div className={`relative mt-10 overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 ${project.img ? "h-48 bg-zinc-950 md:h-64 lg:h-72" : details.cover}`}>
          {project.img ? (
            <Image
              src={project.img}
              alt={`${project.title} project screenshot`}
              fill
              priority
              sizes="(min-width: 1024px) 896px, 100vw"
              style={{ objectPosition: project.imagePosition }}
              className="object-cover"
            />
          ) : (
            <div className="relative h-48 text-white md:h-64 lg:h-72">
              <div className={`absolute -right-8 -top-16 h-52 w-52 rounded-full blur-3xl ${details.glow}`} />
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
              <div className="relative flex h-full items-end p-6 sm:p-8"><p className="text-2xl font-semibold tracking-tight">{project.title.split(" — ")[0]}</p></div>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-10 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <section>
              <h2 className="text-xl font-bold md:text-2xl">Context</h2>
              <p className="mt-2 text-zinc-700 dark:text-zinc-300">{details.context}</p>
            </section>
            <section>
              <h2 className="text-xl font-bold md:text-2xl">Approach</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
                {details.approach.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-bold md:text-2xl">Key Deliverables</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {details.deliverables.map((item) => <li key={item} className="rounded-xl border border-zinc-200/60 p-4 text-sm text-zinc-700 dark:border-zinc-800/60 dark:text-zinc-300">{item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-bold md:text-2xl">Technology Stack</h2>
              <p className="mt-2 text-zinc-700 dark:text-zinc-300">{details.stack.join(", ")}</p>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200/60 p-4 dark:border-zinc-800/60">
              <h3 className="font-semibold">Highlights</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {details.highlights.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {project.img && (
              <div className="rounded-2xl border border-zinc-200/60 p-4 dark:border-zinc-800/60">
                <h3 className="font-semibold">Assets</h3>
                <ul className="mt-2 space-y-2 text-sm"><li><a className="hover:underline" href={project.img}>Project screenshot</a></li></ul>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link href="/work" className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/60 px-4 py-2 text-sm font-semibold hover:bg-zinc-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:border-zinc-700/60 dark:hover:bg-white/5 dark:focus-visible:ring-zinc-100">← Back to Selected Work</Link>
          <Link href="/contact-us" className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:focus-visible:ring-zinc-100">Start a project</Link>
        </div>
      </main>
    </div>
  );
}
