"use client";

import { toast } from "react-toastify";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function UpgradeButton() {
  const loadRazorpay = () =>
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      document.body.appendChild(script);
    });

  const pay = async () => {
    await loadRazorpay();

    const orderRes = await fetch("/api/payment/order", { method: "POST" });
    const order = await orderRes.json();

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: "DigiPants Premium",
      description: "Lifetime Premium Access",
      handler: async (response: any) => {
        const verifyRes = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });

        if (verifyRes.ok) {
          toast.success("Premium unlocked");
          window.location.reload();
        } else {
          toast.error("Payment verification failed");
        }
      },
      theme: { color: "#0f172a" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <button
      onClick={pay}
      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
    >
      Upgrade to Premium
    </button>
  );
}
