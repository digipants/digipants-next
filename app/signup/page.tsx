"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Eye, EyeOff, Upload } from "lucide-react";

export default function SignupPage() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  /* ---------------- Image Upload ---------------- */
  const handleImageChange = (file: File) => {
    if (file.size > 1024 * 1024) {
      toast.error("Profile image must be under 1MB");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  /* ---------------- Form Change ---------------- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ---------------- Submit ---------------- */
  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.warning("Please fill all required fields");
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      if (image) formData.append("image", image);

      Object.entries(form).forEach(([key, value]) =>
        formData.append(key, value)
      );

      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "EMAIL_EXISTS") {
          toast.error("Email already exists. Please login.");
        } else {
          toast.error(data?.message || "Signup failed");
        }
        setLoading(false);
        return;
      }

      toast.success("Account created successfully");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      toast.error("Something went wrong");
      setLoading(false);
    }
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
          <label className="cursor-pointer relative">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files && handleImageChange(e.target.files[0])
              }
            />
            <div className="h-24 w-24 rounded-full border flex items-center justify-center overflow-hidden relative">
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Upload className="h-6 w-6 text-zinc-400" />
              )}
            </div>
          </label>
          <p className="text-xs text-zinc-400">Max size: 1MB</p>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" name="name" onChange={handleChange} />
          <Input label="Email" name="email" type="email" onChange={handleChange} />

          <PasswordInput
            label="Password"
            name="password"
            show={showPassword}
            toggle={() => setShowPassword(!showPassword)}
            onChange={handleChange}
          />

          <PasswordInput
            label="Confirm Password"
            name="confirmPassword"
            show={showConfirm}
            toggle={() => setShowConfirm(!showConfirm)}
            onChange={handleChange}
          />
        </div>

        {/* Submit */}
        <button
          disabled={loading}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2.5 font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
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

/* ---------------- Inputs ---------------- */

function Input({
  label,
  name,
  type = "text",
  onChange,
}: any) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input
      title="Name"
        type={type}
        name={name}
        onChange={onChange}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
      />
    </div>
  );
}

function PasswordInput({
  label,
  name,
  show,
  toggle,
  onChange,
}: any) {
  return (
    <div className="space-y-1 relative">
      <label className="text-sm font-medium">{label}</label>
      <input
      title="Password"
        type={show ? "text" : "password"}
        name={name}
        onChange={onChange}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-8 text-zinc-400"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
