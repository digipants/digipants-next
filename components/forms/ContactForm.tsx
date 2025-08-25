// components/forms/ContactForm.tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";

const FORM_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID || "your-form-id";

function Button({
  children,
  href,
  onClick,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  type?: "button" | "submit" | "reset";
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
    <button className={cls} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    // simple honeypot; bots fill hidden "company"
    if ((data.get("company") as string)?.length) {
      setStatus("ok");
      form.reset();
      return;
    }

    try {
      const res = await fetch(`https://formspree.io/f/${FORM_ID}`, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        setStatus("ok");
        form.reset();
      } else {
        const j = await res.json().catch(() => null);
        setErrMsg(j?.errors?.[0]?.message || "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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

      {/* honeypot (hidden) */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
      />

      <Button type="submit">
        {status === "sending" ? "Sending…" : "Send"}{" "}
        <Send className="w-4 h-4" />
      </Button>

      {status === "ok" && (
        <p className="text-sm text-emerald-500">
          Thanks! We’ll reply within 24 hours.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-rose-500">{errMsg || "Please try again."}</p>
      )}
    </form>
  );
}
