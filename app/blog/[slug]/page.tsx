// app/blog/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPostSlugs, getPost } from "@/lib/blog";

export async function generateStaticParams(){ return getAllPostSlugs().map(slug => ({ slug })); }

export async function generateMetadata({ params }:{ params:{ slug:string } }): Promise<Metadata> {
  const { data } = getPost(params.slug);
  return {
    title: data?.title ?? "Blog | DigiPants",
    description: data?.description,
    openGraph: data?.ogImage ? {
      title: data.title,
      description: data.description,
      images: [{ url: data.ogImage, width: 1200, height: 630 }],
      url: `/blog/${params.slug}/`,
      siteName: "DigiPants",
      type: "article",
    } : undefined,
  };
}

export default function BlogPost({ params }:{ params:{ slug:string } }){
  const { content, data } = getPost(params.slug);
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <section className="scroll-mt-24 py-10 md:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <article className="prose prose-zinc dark:prose-invert">
            <h1 className="!mb-2">{data?.title ?? params.slug}</h1>
            {data?.date && <p className="!mt-0 text-sm text-zinc-500 dark:text-zinc-400">{new Date(data.date).toLocaleDateString()}</p>}
            {data?.cover && <img src={data.cover} alt={data.title ?? ''} className="w-full rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 my-6" />}
            <MDXRemote source={content} />
          </article>
          <div className="mt-10">
            <Link href="/blog/" className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5">← Back to Blog</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
