// components/forms/ContactForm.tsx
"use client";

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
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <input
          name="name"
          placeholder="Name"
          required
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
      </div>
      <input
        name="project"
        placeholder="Project (e.g., Shopify growth, hotel direct bookings, AI bot)"
        className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
      />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <input
          name="budget"
          placeholder="Budget (e.g., ₹1–5L)"
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
        <input
          name="timeline"
          placeholder="Timeline (e.g., 4–8 weeks)"
          className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
      </div>
      <textarea
        name="message"
        rows={6}
        placeholder="Message"
        className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
      ></textarea>
      <button className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
        Send
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Prefer a hosted form? Set <code>NEXT_PUBLIC_FORMSPREE_ENDPOINT</code>{" "}
        and we’ll wire Formspree.
      </p>
    </form>
  );
}
