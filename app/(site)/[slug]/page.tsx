import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPage } from "@/lib/pages";

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { data } = getPage(params.slug);
  return {
    title: data.title ?? "DigiPants",
    description: data.description,
    openGraph: data.ogImage ? {
      title: data.ogTitle ?? data.title,
      description: data.description,
      images: [{ url: data.ogImage, width: 1200, height: 630 }],
      url: `/${params.slug}/`,
      siteName: "DigiPants",
      type: "website",
    } : undefined,
    twitter: data.ogImage ? {
      card: "summary_large_image",
      title: data.ogTitle ?? data.title,
      description: data.description,
      images: [data.ogImage],
    } : undefined,
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  const { content } = getPage(params.slug);
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      <section className="scroll-mt-24 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 prose prose-zinc dark:prose-invert">
          <MDXRemote source={content} />
        </div>
      </section>
    </div>
  );
}
