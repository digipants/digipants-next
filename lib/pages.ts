// lib/pages.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const PAGES_DIR = path.join(process.cwd(), "content/pages");

export function getAllSlugs() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith(".mdx"))
    .map(f => f.replace(/\.mdx$/, ""))
    .filter(s => !["blog"].includes(s));
}

export function getPage(slug: string) {
  const file = fs.readFileSync(path.join(PAGES_DIR, `${slug}.mdx`), "utf8");
  return matter(file);
}
