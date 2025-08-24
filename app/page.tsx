export default function Page() {
  return (
    <div className="min-h-[70vh]">
      <section className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1 text-xs mb-5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Open for select projects
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Better, faster websites.<br/>Growth that compounds.
          </h1>
          <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl">
            Performance marketing, CRO/UX, analytics, and AI automations that lift revenue. Built simple.
          </p>
          <div className="mt-8 flex gap-3">
            <a href="/pricing/" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
              See pricing
            </a>
            <a href="/services/" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5">
              Explore services
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
