// app/blog/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | DigiPants",
  description: "Articles on performance, UX, SEO, and growth.",
};

function Card({ title, summary, href, tag, cover, date }:{title:string; summary?:string; href:string; tag?:string; cover?:string; date?:string;}){
  return (
    <Link href={href} className="group">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 shadow-sm h-full">
        <div className="aspect-video w-full overflow-hidden">
          <img src={cover ?? "/blog/cover-fallback.jpg"} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold group-hover:underline">{title}</h3>
            {tag && <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">{tag}</span>}
          </div>
          {date && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{new Date(date).toLocaleDateString()}</div>}
          {summary && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{summary}</p>}
          <div className="mt-3 inline-flex items-center gap-1 text-sm opacity-80">Read article
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M7 17L17 7M7 7h10v10"/></svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function BlogIndexPage(){
  const posts = getAllPosts();
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <section className="scroll-mt-24 py-10 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">Blog</h1>
          <p className="mt-3 text-lg text-zinc-700 dark:text-zinc-300 max-w-2xl">Notes on performance, UX, SEO, and growth.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(p => (
              <Card key={p.slug} title={p.data?.title ?? p.slug} summary={p.data?.description} date={p.data?.date} tag={p.data?.tags?.[0]} cover={p.data?.cover} href={`/blog/${p.slug}/`} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
