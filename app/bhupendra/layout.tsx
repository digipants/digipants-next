// app/bhupendra/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://digipants.com"),
  title: "Bhupendra Kumar — Founder, DigiPants",
  description:
    "Meet Bhupendra Kumar, founder of DigiPants, building software, digital products, and growth-focused web experiences.",
  openGraph: {
    title: "Bhupendra Kumar — Founder, DigiPants",
    description:
      "Meet Bhupendra Kumar, founder of DigiPants, building software, digital products, and growth-focused web experiences.",
    url: "/bhupendra/",
    siteName: "DigiPants",
    images: [
      {
        url: "/bhupendra-og.jpg",
        width: 1200,
        height: 630,
        alt: "Bhupendra Kumar, founder of DigiPants",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bhupendra Kumar — Founder, DigiPants",
    description:
      "Meet Bhupendra Kumar, founder of DigiPants, building software, digital products, and growth-focused web experiences.",
    images: [
      {
        url: "/bhupendra-og.jpg",
        width: 1200,
        height: 630,
        alt: "Bhupendra Kumar, founder of DigiPants",
      },
    ],
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
