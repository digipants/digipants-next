// file: app/work/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { projects } from "@/lib/data";

const breadcrumbWork = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://digipants.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Work",
      item: "https://digipants.com/work/",
    },
  ],
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

function WorkCard({ p }: { p: (typeof projects)[number] }) {
  return (
    <Link href={`/work/${p.slug}`} className="group">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm h-full">
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={p.img}
            alt={p.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold group-hover:underline">{p.title}</h3>
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
              {p.tag}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {p.summary}
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm opacity-80">
            Read case study
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
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
            A few projects I’ve led across hotels, D2C, AI support, and POD.
            Each case study covers context, approach, and measurable outcomes.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <WorkCard key={p.slug} p={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Place a social preview at public/work/og.jpg (1200x630)
