"use client";

import { SOCIAL, SocialKey } from "@/lib/social";
import {
  Linkedin,
  Instagram,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

const ICONS: Record<SocialKey, LucideIcon> = {
  linkedin: Linkedin,
  instagram: Instagram,
  x: Twitter,
  youtube: Youtube,
};

const DEFAULT_KEYS: SocialKey[] = ["linkedin", "instagram", "x", "youtube"];

type Props = {
  keys?: SocialKey[]; // which to show (default: all)
  size?: number; // icon size in px (default: 18)
  className?: string; // wrapper class
  itemClassName?: string; // each button class
  gap?: string; // tailwind gap (default: gap-3)
  variant?: "header" | "footer" | "menu" | "card";
};

export default function SocialLinks({
  keys = DEFAULT_KEYS,
  size = 18,
  className,
  itemClassName,
  gap = "gap-3",
  variant = "header",
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600";

  const variants: Record<NonNullable<Props["variant"]>, string> = {
    header:
      "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white",
    footer:
      "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
    menu: "text-zinc-900 hover:opacity-80 dark:text-zinc-100",
    card: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white",
  };

  return (
    <div className={clsx("flex", gap, className)}>
      {keys.map((k) => {
        const Icon = ICONS[k]; // k is SocialKey now ✅
        const href = SOCIAL[k];
        if (!href) return null;
        return (
          <a
            key={k}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={k}
            className={clsx(base, variants[variant], itemClassName)}
            title={k}
          >
            {/* Use size prop instead of style ✅ */}
            <Icon className="shrink-0" size={size} />
          </a>
        );
      })}
    </div>
  );
}
