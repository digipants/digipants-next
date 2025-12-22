"use client";

import { useState, useEffect } from "react";
import { Crown, X, ExternalLink } from "lucide-react";

export default function PremiumDashboard() {
  const [open, setOpen] = useState(false);

  /* ================= SECURITY BLOCKS ================= */

  useEffect(() => {
    if (!open) return;

    const blockContext = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["s", "p", "u", "c"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [open]);

  return (
    <>
      <div className="space-y-10">
        {/* ================= HERO ================= */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 p-8 shadow-xl">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg">
              <Crown size={30} />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                Premium Access
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Secure streaming • Lifetime access
              </p>
            </div>
          </div>
        </div>

        {/* ================= PDF CARD ================= */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Premium Strategy PDF
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Optimized for A4 • View-only
              </p>
            </div>

            <span className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 text-xs font-semibold text-white">
              PREMIUM
            </span>
          </div>

          {/* Preview */}
          <button
            onClick={() => setOpen(true)}
            className="relative group w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 transition hover:shadow-xl"
          >
            <div className="h-[220px] bg-zinc-100 dark:bg-zinc-800">
              <iframe
                title="PDF preview"
                src="https://drive.google.com/file/d/1fL2QJk6pTlSr13-zEEWF7EG6C_-tQjpd/preview"
                className="h-full w-full pointer-events-none"
              />
            </div>

            {/* Premium Icon Button (matches provided image) */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/80 text-white shadow-lg">
                <ExternalLink size={16} />
              </div>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition" />
          </button>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Streaming only • Download disabled • Access logged
          </p>
        </div>
      </div>
      {/* ================= FULLSCREEN VIEW ================= */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-[92vw] h-[94vh] max-w-6xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Premium PDF Viewer
              </p>

              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* PDF */}
            <iframe
              title="Secure PDF"
              src="https://drive.google.com/file/d/1fL2QJk6pTlSr13-zEEWF7EG6C_-tQjpd/preview"
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
      {/* ================= FUTURE PERKS ================= */}{" "}
      <div className="grid mt-10 gap-4 md:grid-cols-3">
        {" "}
        {["Lifetime Access", "Exclusive PDFs", "Priority Support"].map(
          (perk) => (
            <div
              key={perk}
              className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-4 text-center shadow-sm hover:shadow-md transition"
            >
              {" "}
              <p className="text-sm font-semibold">{perk}</p>{" "}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {" "}
                Included in your premium plan{" "}
              </p>{" "}
            </div>
          )
        )}{" "}
      </div>
    </>
  );
}
