// file: app/work/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Selected Work | Bhupendra Kumar",
  description:
    "Case studies across hotels, D2C, AI support, and print‑on‑demand.",
  openGraph: {
    title: "Selected Work | Bhupendra Kumar",
    description:
      "Case studies across hotels, D2C, AI support, and print‑on‑demand.",
    url: "https://digipants.com/work/",
    siteName: "DigiPants",
    images: [{ url: "/work/og.jpg", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Selected Work | Bhupendra Kumar",
    description:
      "Case studies across hotels, D2C, AI support, and print‑on‑demand.",
    images: ["/work/og.jpg"],
  },
};

const projects = [
  {
    slug: "pearlytots",
    title: "PearlyTots — D2C Launch & Scale",
    summary:
      "Shopify launch with Syncee/Zendrop, creative testing, UGC ads, and post‑purchase upsells to improve AOV & LTV.",
    tag: "D2C",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "upscale-hotel",
    title: "Upscale Hotel — More Direct, Less OTA",
    summary:
      "PMax + Meta remarketing, parity landing pages, and automations to lift direct bookings.",
    tag: "Hotels",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "quicksquad",
    title: "quicksquad — AI Support to Cut CAC",
    summary:
      "AI triage bot + landing UX revamp to improve trust, lead quality, and lower CAC.",
    tag: "AI",
    img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "zescher",
    title: "Zescher — POD Launch & Growth",
    summary:
      "Sanskrit‑inspired POD brand with automated design‑to‑print workflow and a conversion‑optimized storefront.",
    tag: "POD",
    img: "https://images.unsplash.com/photo-1628071711153-d0204a351a6e?q=80&w=2120&auto=format&fit=crop&w=1600&q=80",
  },
];

function Card({ p }: { p: (typeof projects)[number] }) {
  return (
    <Link href={`/work/${p.slug}/`} className="group">
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
              <Card key={p.slug} p={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Place a social preview at public/work/og.jpg (1200x630)
