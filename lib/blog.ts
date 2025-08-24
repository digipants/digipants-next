// lib/blog.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/pages/blog");

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith(".mdx"))
    .map(f => f.replace(/\.mdx$/, ""));
}

export function getPost(slug: string) {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
  const { content, data } = matter(raw);
  return { slug, content, data };
}

export function getAllPosts() {
  return getAllPostSlugs()
    .map(getPost)
    .sort((a, b) => {
      const da = a.data?.date ? Date.parse(a.data.date) : 0;
      const db = b.data?.date ? Date.parse(b.data.date) : 0;
      return db - da;
    });
}
