// file: app/work/zescher/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { projects } from "@/lib/data";
import { notFound } from "next/navigation";

const slug = "zescher";
const proj = projects.find((p) => p.slug === slug);

export const metadata: Metadata = proj
  ? {
      title: `${proj.title} — DigiPants`,
      description: proj.summary,
      alternates: { canonical: `https://digipants.com/work/${slug}/` },
      openGraph: {
        title: proj.title,
        description: proj.summary,
        url: `https://digipants.com/work/${slug}/`,
        siteName: "DigiPants",
        type: "article",
        images: [
          {
            url: proj.img,
            width: 1200,
            height: 630,
            alt: "Folded T-shirts with printed graphic designs",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: proj.title,
        description: proj.summary,
        images: [
          { url: proj.img, alt: "Folded T-shirts with printed graphic designs" },
        ],
      },
    }
  : { title: "Case Study — DigiPants" };

export default function Page() {
  if (!proj) return notFound();

  const breadcrumbCase = {
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
        item: `https://digipants.com/work/${slug}/`,
      },
    ],
  } as const;
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
      <JsonLd data={breadcrumbCase} />
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
            Zescher — Print-on-Demand Brand & Storefront
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
            Developed the Zescher print-on-demand brand identity, Shopify
            storefront, and design-to-print workflow.
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
              alt="Folded T-shirts with printed graphic designs"
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
                  Project scope covered a Sanskrit-inspired identity for a
                  print-on-demand apparel and lifestyle brand, alongside its
                  product and fulfilment workflow.
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
                  <li>Created reusable design templates for product listings.</li>
                  <li>
                    Configured product pages with product details, trust
                    badges, and upsell prompts.
                  </li>
                  <li>
                    Set up test campaigns on Meta and Instagram influencer
                    placements.
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Key Deliverables</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    Brand identity system: logo, palette, typography, and icons
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    Shopify storefront with Teeinblue and Printful integration
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    Reusable design templates for print-on-demand products
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
                  <li>Sanskrit-inspired brand identity.</li>
                  <li>Shopify print-on-demand workflow using Teeinblue and Printful.</li>
                  <li>Product-page details, trust badges, and upsell prompts.</li>
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
