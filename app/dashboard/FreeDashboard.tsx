"use client";

export default function FreeDashboard() {

  return (
    <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center space-y-4">
      <h2 className="text-xl font-bold">
        Free Dashboard
      </h2>

      <p className="text-zinc-600 dark:text-zinc-400">
        You don’t have any active subscription.
      </p>

      <div className="mx-auto max-w-md rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upgrade to premium to unlock exclusive PDF resources, insights,
          and downloads.
        </p>
      </div>

      <a
        href="/pricing"
        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition"
      >
        Upgrade to Premium
      </a>
    </div>
  );
}