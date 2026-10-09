// file: app/work/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { projects, breadcrumbWork } from "@/lib/data";

const coverStyles = {
  "aegis-protection": ["bg-slate-950 text-white", "bg-cyan-400/20", "border-cyan-300/50 text-cyan-100", "AP", "Security / protection"],
  "aegis-trade": ["bg-emerald-950 text-emerald-50", "bg-lime-300/20", "border-lime-200/50 text-lime-100", "AT", "Trading / research"],
  "nectar-kitchen": ["bg-amber-950 text-amber-50", "bg-orange-300/25", "border-amber-200/50 text-amber-100", "NK", "Food / ordering"],
  educatia: ["bg-indigo-950 text-indigo-50", "bg-fuchsia-300/20", "border-violet-200/50 text-violet-100", "ED", "Education / impact"],
  vidyanju: ["bg-sky-950 text-sky-50", "bg-cyan-300/20", "border-sky-200/50 text-sky-100", "VI", "Gifting / commerce"],
  "reputation-desk": ["bg-zinc-950 text-zinc-50", "bg-rose-300/20", "border-rose-200/50 text-rose-100", "RD", "Intelligence / monitoring"],
  "ai-kitchen": ["bg-violet-950 text-violet-50", "bg-cyan-300/20", "border-cyan-200/50 text-cyan-100", "AI", "Food / innovation"],
  pearlytots: ["bg-rose-950 text-rose-50", "bg-pink-300/20", "border-rose-200/50 text-rose-100", "PT", "D2C / growth"],
  "upscale-hotel": ["bg-blue-950 text-blue-50", "bg-sky-300/20", "border-blue-200/50 text-blue-100", "UH", "Hotels / direct"],
  quicksquad: ["bg-cyan-950 text-cyan-50", "bg-violet-300/20", "border-cyan-200/50 text-cyan-100", "QS", "AI / support"],
  zescher: ["bg-orange-950 text-orange-50", "bg-yellow-300/20", "border-orange-200/50 text-orange-100", "ZE", "POD / culture"],
} as const;

export const metadata: Metadata = {
  title: "Work — DigiPants",
  description:
    "Selected projects and case studies across hotels, D2C, and AI—showing the experiments, results, and playbooks behind growth.",
  alternates: { canonical: "https://digipants.com/work/" },
  openGraph: {
    title: "Work — DigiPants",
    description:
      "Case studies that detail the strategy, experiments, and measurable lift.",
    url: "https://digipants.com/work/",
    siteName: "DigiPants",
    type: "website",
    images: [
      {
        url: "https://digipants.com/og/work-cover.jpg",
        width: 1200,
        height: 630,
        alt: "DigiPants Case Studies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Work — DigiPants",
    description:
      "Real results: direct bookings, lower CAC, higher CVR, faster revenue.",
    images: ["https://digipants.com/og/work-cover.jpg"],
  },
  keywords: [
    "marketing case studies",
    "growth case studies",
    "hotel direct bookings",
    "D2C growth",
    "AI chatbot case study",
    "conversion lift",
  ],
};

function ProjectCover({
  p,
  priority = false,
}: {
  p: (typeof projects)[number];
  priority?: boolean;
}) {
  if (p.img) {
    const isLocalImage = p.img.startsWith("/");

    if (isLocalImage) {
      return (
        <Image
          src={p.img}
          alt={p.title}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"
          style={{ objectPosition: p.imagePosition }}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      );
    }

    return (
      <img
        src={p.img}
        alt={p.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
    );
  }

  const cover = coverStyles[p.cover ?? "aegis-protection"];
  return (
    <div className={`relative h-full overflow-hidden ${cover[0]}`} aria-label={`${p.title} visual cover`}>
      <div className={`absolute -right-10 -top-16 h-44 w-44 rounded-full blur-3xl ${cover[1]}`} />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative flex h-full flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${cover[2]}`}>
            {cover[4]}
          </span>
          <span className="text-4xl font-black tracking-[-0.08em] text-white/90">{cover[3]}</span>
        </div>
        <div>
          <div className="mb-4 h-px w-16 bg-current opacity-50" />
          <p className="max-w-[15rem] text-xl font-semibold tracking-tight text-white/95">{p.title}</p>
        </div>
      </div>
    </div>
  );
}

function WorkCard({
  p,
  priority = false,
}: {
  p: (typeof projects)[number];
  priority?: boolean;
}) {
  const content = (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-zinc-900/10 dark:border-zinc-800/70 dark:bg-zinc-900/70 dark:group-hover:shadow-black/30">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <ProjectCover p={p} priority={priority} />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">{p.title}</h3>
          <span className="shrink-0 rounded-full border border-zinc-200/80 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {p.tag}
          </span>
        </div>
        <p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-zinc-600 dark:text-zinc-400">{p.summary}</p>
        {p.caseStudy && (
          <div className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Read case study
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  return p.caseStudy ? (
    <Link href={`/work/${p.slug}`} className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-100">
      {content}
    </Link>
  ) : (
    <div className="group">{content}</div>
  );
}

export default function WorkIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <JsonLd data={breadcrumbWork} />
      <section className="scroll-mt-24 py-10 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li className="text-zinc-900 dark:text-zinc-100">
                Selected Work
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Selected Work
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl">
            Projects across hotels, D2C, AI, education, food, and more. Case
            studies are available where a dedicated route exists.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, index) => (
              <WorkCard key={p.slug} p={p} priority={index === 0} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Place a social preview at public/work/og.jpg (1200x630)
