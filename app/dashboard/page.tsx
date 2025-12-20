"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import PremiumDashboard from "./PremiumDashboard";
import FreeDashboard from "./FreeDashboard";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm">
        Loading dashboard...
      </div>
    );
  }

  const isPremium = session?.user?.subscription === "premium";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black p-6">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-5 shadow-sm">
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
              <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg font-bold">
                {session?.user?.name?.charAt(0)}
              </div>
            )}

            <div>
              <h1 className="text-lg font-semibold">
                {session?.user?.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {session?.user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-xl border border-red-200 dark:border-red-900 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Logout
          </button>
        </div>

        {/* ================= CONTENT ================= */}
        {isPremium ? <PremiumDashboard /> : <FreeDashboard />}

      </div>
    </div>
  );
}
