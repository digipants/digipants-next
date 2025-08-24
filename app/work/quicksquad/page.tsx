// file: app/work/quicksquad/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "quicksquad — AI Support to Cut CAC | Bhupendra Kumar",
  description:
    "Built an AI triage bot and revamped landing UX for clarity and faster resolution; improved trust and lead quality.",
  openGraph: {
    title: "quicksquad — AI Support to Cut CAC",
    description:
      "AI triage bot + landing UX revamp to improve trust, lead quality, and lower acquisition cost.",
    url: "/work/quicksquad/",
    siteName: "DigiPants",
    images: [{ url: "/work/quicksquad/og.jpg", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "quicksquad — AI Support to Cut CAC",
    description:
      "AI triage bot + landing UX revamp; higher trust, better lead quality, lower CAC.",
    images: ["/work/quicksquad/og.jpg"],
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
              <li className="text-zinc-900 dark:text-zinc-100">quicksquad</li>
            </ol>
          </nav>

          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
            quicksquad — AI Support to Cut CAC
          </h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300">
            Built an AI triage bot and revamped landing UX for clarity and
            faster resolution; improved trust and lead quality.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>AI Support</Badge>
            <Badge>Chatbot</Badge>
            <Badge>Landing UX</Badge>
            <Badge>Lead Quality</Badge>
            <Badge>Automation</Badge>
            <Badge>Analytics</Badge>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="rounded-2xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="/work/quicksquad/hero.jpg"
              alt="quicksquad AI support bot and landing UX overview"
              className="w-full object-cover"
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
                  Support-heavy inbound funnel with slow response times and
                  unclear value messaging. Goal: reduce time to first response,
                  filter and route leads, and lower CAC.
                </p>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Approach</h2>
                <ul className="mt-2 space-y-2 text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>
                    Designed AI triage bot to capture intent, collect
                    essentials, and route to human with context.
                  </li>
                  <li>
                    Landing page rewrite to sharpen value props, social proof,
                    and FAQs; simplified CTA.
                  </li>
                  <li>
                    Integrated analytics and events for drop-off analysis across
                    steps.
                  </li>
                  <li>Set up CRM automations for follow-ups and tasking.</li>
                </ul>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Results</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">−X%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      time to first response
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">+Y%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      qualified lead rate
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                    <div className="text-3xl font-extrabold">−Z%</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      CAC
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Stack</h2>
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                  Custom AI bot (OpenAI/RAG), webhook router, CRM automation,
                  GA4/GTM events, dashboarding.
                </p>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Highlights</h3>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                  <li>Faster triage with context passed to agents.</li>
                  <li>Clearer offer & social proof reduced bounce.</li>
                  <li>Better qualification improved downstream ROAS.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
                <h3 className="font-semibold">Assets</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/quicksquad/bot-flow.jpg"
                    >
                      Bot flow
                    </a>
                  </li>
                  <li>
                    <a
                      className="hover:underline"
                      href="/work/quicksquad/landing-before-after.jpg"
                    >
                      Landing before/after
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

// Place these images in the personal site repo under public/work/quicksquad/
// - og.jpg (1200x630)
// - hero.jpg
// - bot-flow.jpg
// - landing-before-after.jpg
