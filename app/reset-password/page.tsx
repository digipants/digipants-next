"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

const submit = async () => {
  if (!token) {
    toast.error("Invalid or missing reset token");
    return;
  }

  if (password !== confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }

  const res = await fetch("/api/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      password,
      confirmPassword, // ✅ ADD THIS
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    toast.error(data?.error || "Reset link expired or invalid");
    return;
  }

  toast.success("Password reset successfully");
  router.push("/login");
};


  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-6 border rounded-xl space-y-4">
        <h1 className="text-xl font-bold">Reset password</h1>

        {/* New password */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className="bg-slate-100 w-full border p-2 rounded pr-10"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-700"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* Confirm password */}
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            className="bg-slate-100 w-full border p-2 rounded pr-10"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-700"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
        </div>

<button
  onClick={submit}
  disabled={!password || !confirmPassword}
  className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
>
  Reset password
</button>

      </div>
    </div>
  );
}
