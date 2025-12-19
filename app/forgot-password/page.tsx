"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email) {
      toast.warning("Please enter your email");
      return;
    }

    setLoading(true);

    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    toast.success("If the email exists, a reset link has been sent.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Forgot password
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            We’ll send you a reset link if your email exists
          </p>
        </div>

        {/* Email Input */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          disabled={loading}
          onClick={submit}
          className="w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500">
          Remembered your password?{" "}
          <a href="/login" className="underline">
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
}
