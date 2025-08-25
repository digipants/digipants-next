// app/layout.tsx
import "./../styles/globals.css";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "DigiPants – Growth-Driven Digital Marketing Agency",
  description:
    "DigiPants helps hotels, D2C brands, and service businesses grow faster with performance marketing, CRO, AI automation, and world-class websites.",
  keywords: [
    "digital marketing agency",
    "performance marketing",
    "CRO",
    "conversion optimization",
    "AI automation",
    "hotel marketing",
    "D2C growth",
    "Shopify marketing",
  ],
  authors: [{ name: "DigiPants Team" }],
  creator: "DigiPants",
  publisher: "DigiPants Network Pvt. Ltd.",
  metadataBase: new URL("https://digipants.com"),
  alternates: {
    canonical: "https://digipants.com",
  },
  openGraph: {
    title: "DigiPants – Better, Faster Websites. Growth That Compounds.",
    description:
      "Driving revenue with Google/Meta Ads, CRO, and AI automations for hotels, D2C brands, and service businesses.",
    url: "https://digipants.com",
    siteName: "DigiPants",
    images: [
      {
        url: "/og.jpg", // make sure this exists in your /public folder
        width: 1200,
        height: 630,
        alt: "DigiPants – Digital Marketing Growth Agency",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DigiPants – Growth-Driven Digital Marketing Agency",
    description:
      "Performance marketing, CRO, AI automations, and websites for hotels, D2C, and service businesses.",
    images: ["/og.jpg"], // same as OG image
    creator: "@digipantstweets", // update if you have a Twitter handle
  },
};

// runs in <head> before the page paints
function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (systemDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
        `,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <ThemeInit />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
