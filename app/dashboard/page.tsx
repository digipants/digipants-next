"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import PremiumDashboard from "./PremiumDashboard";
import FreeDashboard from "./FreeDashboard";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
        Loading dashboard...
      </div>
    );
  }

  const isPremium = session?.user?.subscription === "premium";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-5 shadow-sm">

          {/* User Info */}
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={56}
                height={56}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-lg font-bold text-white">
                {session?.user?.name?.charAt(0)}
              </div>
            )}

            <div className="leading-tight">
              <h1 className="text-lg font-semibold">
                {session?.user?.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {session?.user?.email}
              </p>

              {/* Subscription Badge */}
              <span
                className={`inline-block mt-1 rounded-full px-3 py-0.5 text-xs font-medium ${
                  isPremium
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {isPremium ? "Premium Member" : "Free Member"}
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="self-start sm:self-auto rounded-xl border border-red-200 dark:border-red-900 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Logout
          </button>
        </div>

        {/* ================= CONTENT ================= */}
        <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          {isPremium ? <PremiumDashboard /> : <FreeDashboard />}
        </div>

      </div>
    </div>
  );
}
