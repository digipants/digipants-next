// app/bhupendra/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://digipants.com"),
  title: "Bhupendra Kumar — Founder, DigiPants",
  description:
    "Driving revenue with Google/Meta Ads, CRO, and AI automations for hotels, D2C brands, and service businesses.",
  openGraph: {
    title: "Bhupendra Kumar — Founder, DigiPants",
    description:
      "Driving revenue with Google/Meta Ads, CRO, and AI automations for hotels, D2C brands, and service businesses.",
    url: "/",
    siteName: "DigiPants",
    images: [{ url: "/bhupendra/og.jpg", width: 1200, height: 630 }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bhupendra Kumar — Founder, DigiPants",
    description:
      "Driving revenue with Google/Meta Ads, CRO, and AI automations for hotels, D2C brands, and service businesses.",
    images: ["/bhupendra/og.jpg"],
  },
};

// server component wrapper for the /bhupendra segment
export default function BhupendraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
