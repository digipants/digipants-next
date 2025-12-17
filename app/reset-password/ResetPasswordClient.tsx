"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      body: JSON.stringify({ token, password, confirmPassword }),
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

        <input
          type="password"
          placeholder="New password"
          className="w-full border p-2 rounded"
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Confirm password"
          className="w-full border p-2 rounded"
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          onClick={submit}
          className="w-full bg-black text-white py-2 rounded"
        >
          Reset password
        </button>
      </div>
    </div>
  );
}
