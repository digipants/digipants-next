// file: app/work/pearlytots/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { projects } from "@/lib/data";
import { notFound } from "next/navigation";

type Params = { slug: string };

export async function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params; // ✅ await first
  const proj = projects.find((p) => p.slug === slug);
  if (!proj) return { title: "Case Study — DigiPants" };

  const url = `https://digipants.com/work/${proj.slug}/`;
  return {
    title: `${proj.title} — DigiPants`,
    description: proj.summary,
    alternates: { canonical: url },
    openGraph: {
      title: proj.title,
      description: proj.summary,
      url,
      siteName: "DigiPants",
      type: "article",
      images: [{ url: proj.img, width: 1200, height: 630, alt: proj.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: proj.title,
      description: proj.summary,
      images: [proj.img],
    },
  };
}

export default async function Page(
  { params }: { params: Promise<{ slug: string }> } // ⬅️ Promise
) {
  const { slug } = await params; // ✅ await first

  const proj = projects.find((p) => p.slug === slug);
  if (!proj) return notFound();

  const breadcrumbCase = (proj: (typeof projects)[number]) =>
    ({
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
        {
          "@type": "ListItem",
          position: 3,
          name: proj.title,
          item: `https://digipants.com/work/${proj.slug}/`,
        },
      ],
    } as const);
  const Badge = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
      {children}
    </span>
  );

  const Section = ({ children }: { children: React.ReactNode }) => (
    <section className="scroll-mt-24 py-10 md:py-16">{children}</section>
  );
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <JsonLd data={breadcrumbCase(proj)} />
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
              <li className="text-zinc-900 dark:text-zinc-100">PearlyTots</li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            PearlyTots — D2C Launch & Scale
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
            Shopify launch with Syncee/Zendrop, creative testing, UGC ads, and
            post‑purchase upsells to improve AOV & LTV.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>Shopify</Badge>
            <Badge>UGC Ads</Badge>
            <Badge>Meta Ads</Badge>
            <Badge>Creative Testing</Badge>
            <Badge>Upsells</Badge>
            <Badge>Klaviyo</Badge>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="https://images.unsplash.com/photo-1649937365218-1316528fe149?q=80&w=2083&auto=format&fit=crop&w=1600&q=80"
              alt="PearlyTots storefront and campaign overview"
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
                  New D2C brand in the kids category. Goal: validate
                  positioning, reach first 100 orders, and build a repeatable
                  paid media engine.
                </p>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Approach</h2>
                <ul className="mt-2 space-y-2 text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>
                    Shopify setup with conversion‑oriented theme and essential
                    apps (reviews, upsells, support).
                  </li>
                  <li>
                    Catalog integration via Syncee/Zendrop and clean product
                    taxonomy.
                  </li>
                  <li>
                    UGC pipeline for creatives; systematic concept × angle ×
                    format testing.
                  </li>
                  <li>
                    Meta Ads for cold and warm; Google Search + PMax for branded
                    and bottom‑funnel capture.
                  </li>
                  <li>
                    Klaviyo flows (browse/cart/post‑purchase) and one‑click
                    post‑purchase offers to lift AOV/LTV.
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Results</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+21%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      CVR vs baseline
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+64%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      AOV with post‑purchase upsell
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">First 100</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      orders within launch window
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Stack</h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                  Shopify, Meta Ads, Google Ads (Search/PMax), Klaviyo,
                  Syncee/Zendrop, GA4, GTM.
                </p>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Highlights</h3>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>UGC ad pipeline cut CPA variability.</li>
                  <li>Content/offer matrix sped up learnings.</li>
                  <li>Post‑purchase upsell lifted AOV.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Assets</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/pearlytots/creative-grid.jpg"
                    >
                      Creative grid
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/pearlytots/funnel.jpg"
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

// Place these images in the personal site repo under public/work/pearlytots/
// - og.jpg (1200x630)
// - hero.jpg
// - creative-grid.jpg
// - funnel.jpg
