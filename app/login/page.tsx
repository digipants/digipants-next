"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { toast } from "react-toastify";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------- Google Login ---------------- */
  const handleGoogleLogin = async () => {
    toast.info("Redirecting to Google...");
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  /* ---------------- Email Login ---------------- */
  const handleCredentialsLogin = async () => {
    if (!email || !password) {
      toast.warning("Please enter email and password");
      return;
    }

    setLoading(true);
    toast.info("Signing in...");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setLoading(false);

    if (res?.error) {
      toast.error(
        res.error === "CredentialsSignin"
          ? "Invalid email or password"
          : res.error
      );
      return;
    }

    toast.success("Login successful");
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Login to your DigiPants account
          </p>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          <FcGoogle className="text-xl" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs text-zinc-400">OR</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Email Login */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            disabled={loading}
            onClick={handleCredentialsLogin}
            className="w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Login with Email"}
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500">
          Don't have an account?{" "}
          <a href="/signup" className="underline">
            SignUp
          </a>
        </p>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          By continuing, you agree to DigiPants’ Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
