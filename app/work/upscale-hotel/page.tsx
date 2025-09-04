// file: app/work/upscale-hotel/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Upscale Hotel — More Direct, Less OTA | Bhupendra Kumar",
  description:
    "Rebuilt the funnel with PMax + Meta remarketing, added parity landing pages, and automated cart‑abandon flows.",
  openGraph: {
    title: "Upscale Hotel — More Direct, Less OTA",
    description:
      "Rebuilt the funnel with PMax + Meta remarketing, added parity landing pages, and automated cart‑abandon flows.",
    url: "/work/upscale-hotel/",
    siteName: "DigiPants",
    images: [{ url: "/work/upscale-hotel/og.jpg", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Upscale Hotel — More Direct, Less OTA",
    description:
      "Direct bookings up with PMax + Meta mix, OTA parity landing pages, and automation.",
    images: ["/work/upscale-hotel/og.jpg"],
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
              <li className="text-zinc-900 dark:text-zinc-100">
                Upscale Hotel
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            Upscale Hotel — More Direct, Less OTA
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
            Rebuilt the funnel with PMax + Meta remarketing, added parity
            landing pages, and automated cart‑abandon flows.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>Hotels</Badge>
            <Badge>Performance Max</Badge>
            <Badge>Meta Ads</Badge>
            <Badge>Parity Pages</Badge>
            <Badge>Direct Bookings</Badge>
            <Badge>Automation</Badge>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80"
              alt="Upscale Hotel booking funnel and campaign overview"
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
                  4‑star hotel struggling with OTA dependency and low direct
                  bookings. Goal: lift direct share while maintaining occupancy.
                </p>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Approach</h2>
                <ul className="mt-2 space-y-2 text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>
                    Audited OTA listings and created parity landing pages with
                    matching offers.
                  </li>
                  <li>
                    Implemented Google PMax campaigns for direct and branded
                    searches.
                  </li>
                  <li>
                    Meta remarketing to OTA visitors with direct booking
                    incentive.
                  </li>
                  <li>
                    Email/SMS automation for cart‑abandon and upsell flows.
                  </li>
                  <li>Tracking pipeline: GA4, GTM, server‑side conversions.</li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Results</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+46%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      direct bookings vs prior period
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">−46%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      OTA share
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+27%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      ROAS from PMax
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Stack</h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                  Google PMax, Meta Ads, OTA parity pages, GA4, GTM, automation
                  flows.
                </p>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Highlights</h3>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>Direct bookings up by double digits.</li>
                  <li>Reduced OTA reliance with parity pages.</li>
                  <li>Remarketing ROI positive within weeks.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Assets</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/upscale-hotel/parity-page.jpg"
                    >
                      Parity page sample
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/upscale-hotel/funnel.jpg"
                    >
                      Funnel map
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
              href="/bhupendra/contact"
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

// Place these images in the personal site repo under public/work/upscale-hotel/
// - og.jpg (1200x630)
// - hero.jpg
// - parity-page.jpg
// - funnel.jpg
