"use client";

import { useState } from "react";
import { toast } from "react-toastify";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const submit = async () => {
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    toast.success("If the email exists, a reset link has been sent.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-6 border rounded-xl space-y-4"> 
        <h1 className="text-xl font-bold">Forgot password</h1>
        <input
          className="bg-slate-100 w-full border p-2 rounded"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={submit}
          className="w-full bg-black text-white py-2 rounded"
        >
          Send reset link
        </button>
      </div>
    </div>
  );
}
