"use client";

import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { useSession } from "next-auth/react";
import { User } from "lucide-react";
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
];

function ProfileIcon() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  const avatar = session?.user?.image;

  const handleClick = () => {
    if (!session) {
      window.location.href = "/login";
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <button
      onClick={handleClick}
      className="h-9 w-9 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      aria-label="Profile"
    >
      {avatar ? (
        <img
          src={avatar}
          alt="Profile"
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <User className="h-4 w-4" />
      )}
    </button>
  );
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const darkNow = document.documentElement.classList.contains("dark");
    setTheme(darkNow ? "dark" : "light");
    setReady(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return { theme, toggle, ready };
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

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle, ready } = useTheme();

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

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={n.href}
                className="text-sm font-medium hover:opacity-70"
              >
                {n.label}
              </a>
            ))}

            <Button variant="ghost" onClick={toggle}>
              {ready ? (
                theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )
              ) : (
                <span className="w-4 h-4" />
              )}
            </Button>

            {/* Profile */}
            <ProfileIcon />

            <Button href="/contact-us">
              <Mail className="w-4 h-4" />
              Contact
            </Button>
          </nav>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-2">
            <Button variant="ghost" onClick={toggle}>
              {ready ? (
                theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )
              ) : (
                <span className="w-4 h-4" />
              )}
            </Button>

            <ProfileIcon />

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
                href={n.href}
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
