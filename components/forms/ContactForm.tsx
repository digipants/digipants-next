// components/forms/ContactForm.tsx
"use client";

import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";

const FORM_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID?.trim();
const FORM_ENDPOINT =
  FORM_ID && FORM_ID !== "your-form-id" && /^[A-Za-z0-9]+$/.test(FORM_ID)
    ? `https://formspree.io/f/${FORM_ID}`
    : null;

const inputClassName =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus-visible:ring-emerald-400/30";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );
  const [errMsg, setErrMsg] = useState("");

  if (!FORM_ENDPOINT) {
    return (
      <div
        className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
        role="status"
      >
        <p className="font-semibold">The online enquiry form is unavailable.</p>
        <p className="mt-1">
          Please email your project details to{" "}
          <a
            href="mailto:support@digipants.com"
            className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:focus-visible:ring-amber-300"
          >
            support@digipants.com
          </a>
          .
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!FORM_ENDPOINT) {
      setErrMsg(
        "The online form is not configured. Please email support@digipants.com."
      );
      setStatus("error");
      return;
    }
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
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        setStatus("ok");
        form.reset();
      } else {
        setErrMsg(
          "We couldn’t send your enquiry. Please try again or email support@digipants.com."
        );
        setStatus("error");
      }
    } catch {
      setErrMsg(
        "A network issue prevented sending. Please try again or email support@digipants.com."
      );
      setStatus("error");
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Name <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-400">*</span><span className="sr-only"> (required)</span></span>
          <input
            name="name"
            required
            autoComplete="name"
            className={inputClassName}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Email <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-400">*</span><span className="sr-only"> (required)</span></span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={inputClassName}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span>Project or service</span>
        <input
          name="project"
          placeholder="AI, software, web, commerce, or growth"
          className={inputClassName}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Budget (optional)</span>
          <input
            name="budget"
            placeholder="₹1–5L"
            className={inputClassName}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Timeline (optional)</span>
          <input
            name="timeline"
            placeholder="4–8 weeks"
            className={inputClassName}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span>Message <span aria-hidden="true" className="text-emerald-700 dark:text-emerald-400">*</span><span className="sr-only"> (required)</span></span>
        <textarea
          name="message"
          rows={4}
          required
          className={inputClassName}
        />
      </label>

      {/* honeypot (hidden) */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
      >
        {status === "sending" ? "Sending…" : "Send enquiry"}
        {status === "sending" ? <Send className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>

      {status === "ok" && (
        <p className="text-sm text-emerald-800 dark:text-emerald-300" role="status" aria-live="polite">
          Thanks—your enquiry was submitted successfully.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-rose-700 dark:text-rose-300" role="alert" aria-live="assertive">{errMsg || "Please try again."}</p>
      )}
    </form>
  );
}
