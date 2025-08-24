// components/forms/ContactForm.tsx
"use client";

import {Send} from "lucide-react";

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

export default function ContactForm() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subject = encodeURIComponent(`New inquiry from ${fd.get("name")}`);
    const body = encodeURIComponent(
      `Project: ${fd.get("project")}\nBudget: ${fd.get(
        "budget"
      )}\nTimeline: ${fd.get("timeline")}\n\nMessage:\n${fd.get(
        "message"
      )}\n\n— ${fd.get("name")} (${fd.get("email")})`
    );
    window.location.href = `mailto:bhupendra@digipants.com?subject=${subject}&body=${body}`;
  }

  return (
    <form className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Name</span>
          <input
            name="name"
            required
            className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            name="email"
            required
            className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span>Project</span>
        <input
          name="project"
          placeholder="e.g. Shopify growth, hotel bookings, AI support bot"
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Budget</span>
          <input
            name="budget"
            placeholder="₹1–5L"
            className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Timeline</span>
          <input
            name="timeline"
            placeholder="4–8 weeks"
            className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span>Message</span>
        <textarea
          name="message"
          rows={4}
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
      </label>
      <Button>
        Send <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}
