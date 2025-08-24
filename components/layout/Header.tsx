"use client";
import { useEffect, useState } from "react";

const NAV = [
  { id: "home", label: "Home", href: "/" },
  { id: "services", label: "Services", href: "/services/" },
  { id: "pricing", label: "Pricing", href: "/pricing/" },
  { id: "blog", label: "Blog", href: "/blog/" },
  { id: "contact", label: "Contact", href: "/contact-us/" },
];

export default function Header() {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    setTheme(t || "dark");
    document.documentElement.classList.toggle("dark", (t || "dark") === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/40 border-b border-zinc-200/60 dark:border-zinc-800/60">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href="/" className="font-extrabold tracking-tight text-lg flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            DigiPants
          </a>
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(n => (
              <a key={n.id} href={n.href} className="text-sm font-medium hover:opacity-70">{n.label}</a>
            ))}
            <button onClick={toggleTheme} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
              {mounted ? (theme === "dark" ? "Light" : "Dark") : <span className="inline-block w-8" aria-hidden />}
            </button>
          </nav>
          <button className="md:hidden p-2" onClick={() => setOpen(s => !s)} aria-label="Toggle menu">☰</button>
        </div>
        {open && (
          <div className="md:hidden pb-4 flex flex-col gap-2">
            {NAV.map(n => (
              <a key={n.id} href={n.href} className="py-2" onClick={() => setOpen(false)}>{n.label}</a>
            ))}
            <button onClick={toggleTheme} className="self-start inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
              {mounted ? (theme === "dark" ? "Light" : "Dark") : <span className="inline-block w-8" aria-hidden />}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
