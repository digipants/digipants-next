// components/layout/Header.tsx
"use client";

import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  Mail,
  Moon,
  Sun,
  Menu,
  X,
} from "lucide-react";

const NAV = [
  { id: "home", label: "Home", href: "/" },
  { id: "services", label: "Services", href: "/services/" },
  { id: "work", label: "Work", href: "/work/" },
  { id: "pricing", label: "Pricing", href: "/pricing/" },
  { id: "contact", label: "Contact", href: "/contact-us/" },
];

function useTheme() {
  const [theme, setTheme] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("theme") || "dark"
      : "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return { theme, setTheme };
}

function Container({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

function Button({
  children,
  href,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[.98]";
  const variants: Record<string, string> = {
    primary:
      "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm hover:opacity-90",
    ghost:
      "bg-transparent text-zinc-900 dark:text-white border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5",
  };
  const cls = `${base} ${variants[variant]}`;
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
  <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/40 border-b border-zinc-200/60 dark:border-zinc-800/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <a
            href="/"
            className="font-extrabold tracking-tight text-lg flex items-center gap-2"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            DigiPants
          </a>
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map((n) => {
              let href = `/${n.id}`;
              return (
                <a
                  key={n.id}
                  href={n.href}
                  className="text-sm font-medium hover:opacity-70"
                >
                  {n.label}
                </a>
              );
            })}
            <Button
              variant="ghost"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )
              ) : (
                <span className="inline-block w-4 h-4" aria-hidden />
              )}
            </Button>
            <Button href="/contact-us">
              <Mail className="w-4 h-4" /> Contact
            </Button>
          </nav>
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )
              ) : (
                <span className="inline-block w-5 h-5" aria-hidden />
              )}
            </Button>
            <button
              className="p-2"
              onClick={() => setMenuOpen((s) => !s)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-2">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="py-2"
                onClick={() => setMenuOpen(false)}
              >
                {n.label}
              </a>
            ))}
            <a
              href="/contact-us"
              className="py-2"
              onClick={() => setMenuOpen(false)}
            >
              Contact
            </a>
          </div>
        )}
      </Container>
    </header>
  );
}
