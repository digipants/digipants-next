"use client";

import { useState } from "react";
import { Crown, X, Expand } from "lucide-react";

export default function PremiumDashboard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="space-y-8">

        {/* ================= HERO ================= */}
        <div className="relative overflow-hidden rounded-3xl border border-yellow-400/30 dark:border-yellow-500/20 bg-gradient-to-br from-yellow-50 via-white to-yellow-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-yellow-900/20 p-8 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,128,0.25),transparent_60%)] pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg">
              <Crown size={28} />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold">
                Premium Member
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Lifetime access unlocked
              </p>
            </div>
          </div>
        </div>

        {/* ================= PDF PREVIEW ================= */}
        <div className="rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-6 shadow-lg space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Premium PDF
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Click to open full A4 view
              </p>
            </div>

            <span className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 text-xs font-semibold text-white">
              PREMIUM
            </span>
          </div>

          {/* SMALL PREVIEW */}
          <button
            onClick={() => setOpen(true)}
            className="group relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition"
          >
            <div className="relative h-[220px] bg-zinc-100 dark:bg-zinc-800">
              <iframe
                title="PDF preview"
                src="https://drive.google.com/file/d/1fL2QJk6pTlSr13-zEEWF7EG6C_-tQjpd/preview"
                className="h-full w-full pointer-events-none"
              />
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
              <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow">
                <Expand size={16} />
                View Full PDF
              </div>
            </div>
          </button>

          <p className="text-xs text-zinc-500">
            Optimized for A4 reading • Premium only
          </p>
        </div>
      </div>

      {/* ================= FULLSCREEN MODAL ================= */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">

          <div className="relative w-[80vw] h-[90vh] max-w-5xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <h4 className="font-semibold text-sm">
                Premium PDF — Full View
              </h4>

              <button
              title="open"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* A4 PDF VIEW */}
            <iframe
              title="Full PDF"
              src="https://drive.google.com/file/d/1fL2QJk6pTlSr13-zEEWF7EG6C_-tQjpd/preview"
              className="h-full w-full"
            />
          </div>
        </div>
      )}
            {/* ================= FUTURE PERKS ================= */}
      <div className="grid gap-4 md:grid-cols-3">

        {[
          "Lifetime Access",
          "Exclusive PDFs",
          "Priority Support",
        ].map((perk) => (
          <div
            key={perk}
            className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-4 text-center shadow-sm hover:shadow-md transition"
          >
            <p className="text-sm font-semibold">{perk}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Included in your premium plan
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
