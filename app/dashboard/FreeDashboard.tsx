"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Lock, ChevronDown } from "lucide-react";
import UpgradeButton from "@/components/UpgradeButton";

/* ---------- FAQ ITEM ---------- */
function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-sm font-medium">{question}</span>
        <ChevronDown
          size={18}
          className={`transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <p className="pb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {answer}
        </p>
      )}
    </div>
  );
}

/* ---------- FREE DASHBOARD ---------- */
export default function FreeDashboard() {
  const { data: session } = useSession();

  return (
    <div className="space-y-10">

      {/* ================= LOCKED PDF ================= */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">

        {/* Blurred Preview */}
        <div className="h-[260px] bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900 blur-sm" />

        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/40 backdrop-blur-sm p-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">
            <Lock size={22} />
          </div>

          <h3 className="text-lg font-semibold">
            Premium E-Book Locked
          </h3>

          <p className="mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Unlock high-value strategies, frameworks, and real execution
            insights inside the premium PDF.
          </p>

          {session?.user?.subscription === "free" && (
            <div className="mt-5">
              <UpgradeButton />
            </div>
          )}
        </div>
      </div>

      {/* ================= BENEFITS ================= */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-6">
        <h4 className="text-base font-semibold mb-4">
          What you’ll get
        </h4>

        <ul className="grid gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <li>• Practical growth systems (step-by-step)</li>
          <li>• No fluff — real execution examples</li>
          <li>• Plug-and-play checklists & templates</li>
          <li>• Lifetime access (one-time payment)</li>
          <li>• Future updates included</li>
        </ul>
      </div>

      {/* ================= FAQ ================= */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-6">
        <h4 className="text-base font-semibold mb-2">
          Frequently Asked Questions
        </h4>

        <FAQItem
          question="Is this a one-time payment?"
          answer="Yes. You pay once and get lifetime access to the premium PDF and all future updates."
        />

        <FAQItem
          question="How do I access the PDF after payment?"
          answer="Your account is upgraded instantly and the PDF unlocks automatically in your dashboard."
        />

        <FAQItem
          question="Can I download or share the PDF?"
          answer="No. The PDF is securely accessible only inside your dashboard to protect premium content."
        />

        <FAQItem
          question="Is this useful for beginners?"
          answer="Yes. The content is beginner-friendly but powerful enough for experienced founders and marketers."
        />
      </div>

    </div>
  );
}