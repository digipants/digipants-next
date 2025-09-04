// file: app/work/zescher/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zescher — POD Launch & Growth | Bhupendra Kumar",
  description:
    "Developed a print‑on‑demand brand (Zescher) with unique Sanskrit‑inspired identity, streamlined design‑to‑print workflow, and conversion‑optimized storefront.",
  openGraph: {
    title: "Zescher — POD Launch & Growth",
    description:
      "Print‑on‑demand brand launch with Sanskrit‑inspired identity, design automation, and Shopify growth tactics.",
    url: "/work/zescher/",
    siteName: "DigiPants",
    images: [{ url: "/work/zescher/og.jpg", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zescher — POD Launch & Growth",
    description:
      "POD launch project with brand identity, automated workflow, and Shopify growth.",
    images: ["/work/zescher/og.jpg"],
  },
};

export default function Page() {
  const Section = ({ children }: { children: React.ReactNode }) => (
    <section className="scroll-mt-24 py-10 md:py-16">{children}</section>
  );
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
  const Badge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
      {children}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <Section>
        <Container>
          <nav className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/work" className="hover:underline">
                  Selected Work
                </Link>
              </li>
              <li>/</li>
              <li className="text-zinc-900 dark:text-zinc-100">Zescher</li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Zescher — POD Launch & Growth
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
            Developed a print‑on‑demand brand (Zescher) with unique
            Sanskrit‑inspired identity, streamlined design‑to‑print workflow,
            and conversion‑optimized storefront.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>POD</Badge>
            <Badge>Brand Identity</Badge>
            <Badge>Shopify</Badge>
            <Badge>Automation</Badge>
            <Badge>Creative Design</Badge>
            <Badge>Marketing</Badge>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="https://images.unsplash.com/photo-1628071711153-d0204a351a6e?q=80&w=2120&auto=format&fit=crop&w=1600&q=80"
              alt="Zescher POD storefront and product samples"
              className="w-full h-48 object-cover md:h-64 lg:h-72"
            />
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Context</h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                  Zescher was envisioned as a POD brand that merges
                  Sanskrit‑inspired naming with modern apparel and lifestyle
                  products. Objective: launch with minimal overhead, validate
                  demand, and scale through automation.
                </p>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Approach</h2>
                <ul className="mt-2 space-y-2 text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>
                    Designed a brand system: logo, palette, typography, and
                    iconography.
                  </li>
                  <li>
                    Implemented Shopify with Teeinblue/Printful for POD
                    automation.
                  </li>
                  <li>Created design templates for rapid SKU expansion.</li>
                  <li>
                    Optimized storefront for conversions: clear product pages,
                    trust badges, upsell prompts.
                  </li>
                  <li>
                    Ran test campaigns on Meta + Instagram influencers for
                    validation.
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Results</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">
                      Launch +30 SKUs
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      within first month
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+62%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      add‑to‑cart rate vs baseline
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">Zero</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      inventory risk (POD model)
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Stack</h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                  Shopify, Teeinblue, Printful, Canva/Illustrator, Meta Ads,
                  Influencer campaigns.
                </p>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Highlights</h3>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>Unique Sanskrit‑inspired brand positioning.</li>
                  <li>Design‑to‑print workflow allowed fast iteration.</li>
                  <li>Low‑risk launch with POD automation stack.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Assets</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/zescher/brand-kit.pdf"
                    >
                      Brand kit
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/zescher/storefront.jpg"
                    >
                      Storefront screenshot
                    </a>
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          <div className="mt-12 flex items-center gap-4">
            <Link
              href="/work"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5"
            >
              ← Back to Selected Work
            </Link>
            <Link
              href="/contact-us"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            >
              Start a project
            </Link>
          </div>
        </Container>
      </Section>
    </div>
  );
}

// Place these assets in the repo under public/work/zescher/
// - og.jpg (1200x630)
// - hero.jpg
// - brand-kit.pdf
// - storefront.jpg
