"use client";

import { useState } from "react";

export default function SignupPage() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    pincode: "",
    password: "",
    confirmPassword: "",
  });

  const handleImageChange = (file: File) => {
    if (file.size > 1024 * 1024) {
      alert("Profile image must be under 1mb");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const formData = new FormData();
    if (image) formData.append("image", image);

    Object.entries(form).forEach(([key, value]) =>
      formData.append(key, value)
    );

    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      alert("Signup failed");
      return;
    }

    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black px-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Join DigiPants today
          </p>
        </div>

        {/* Profile Image */}
        <div className="flex flex-col items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files && handleImageChange(e.target.files[0])}
            />
            <div className="h-24 w-24 rounded-full border flex items-center justify-center overflow-hidden">
              {preview ? (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-zinc-500">Upload</span>
              )}
            </div>
          </label>
          <p className="text-xs text-zinc-400">Max size: 1MB</p>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" name="name" onChange={handleChange} />
          <Input label="Phone Number" name="phone" onChange={handleChange} />
          <Input label="Email" name="email" type="email" onChange={handleChange} />
          <Input label="Pincode" name="pincode" onChange={handleChange} />
          <div className="md:col-span-2">
            <Textarea label="Address" name="address" onChange={handleChange} />
          </div>
          <Input label="Password" name="password" type="password" onChange={handleChange} />
          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            onChange={handleChange}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 font-semibold hover:opacity-90 transition"
        >
          Create Account
        </button>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}

/* ---------- Reusable Inputs ---------- */

function Input({
  label,
  name,
  type = "text",
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  onChange: any;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
      title="name"
        type={type}
        name={name}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        onChange={onChange}
      />
    </div>
  );
}

function Textarea({
  label,
  name,
  onChange,
}: {
  label: string;
  name: string;
  onChange: any;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <textarea
      title="change"
        name={name}
        rows={3}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        onChange={onChange}
      />
    </div>
  );
}
