"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-6">
        
        {/* Header */}
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
            <h1 className="text-xl font-bold">
              Welcome, {session?.user?.name}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {session?.user?.email}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Content */}
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You are logged in successfully. From here you can manage your
            account, profile, and settings.
          </p>
        </div>

        {/* Logout */}
        <div className="pt-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
