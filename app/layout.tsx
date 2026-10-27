// app/layout.tsx
import "./../styles/globals.css";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnalyticsConsent from "@/components/analytics/AnalyticsConsent";
import { Poppins, Inter } from "next/font/google";

export const metadata: Metadata = {
  title: "DigiPants — AI Engineering & Software Partner from India",
  description:
    "India-based AI engineering and software for established businesses and digital agencies worldwide: web applications, APIs, integrations, and practical automation.",
  keywords: [
    "AI engineering",
    "custom software development",
    "web application development",
    "web development",
    "e-commerce development",
    "digital growth",
    "SEO",
    "performance marketing",
  ],
  authors: [{ name: "DigiPants Team" }],
  creator: "DigiPants",
  publisher: "DigiPants Network Pvt. Ltd.",
  metadataBase: new URL("https://digipants.com"),
  openGraph: {
    title: "DigiPants — AI Engineering & Software Partner from India",
    description:
      "India-based AI engineering and software for established businesses and digital agencies worldwide.",
    siteName: "DigiPants",
    images: [
      {
        url: "/aegisprotection.webp",
        width: 1920,
        height: 1038,
        alt: "AegisProtection web application, a DigiPants software project",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DigiPants — AI Engineering & Software Partner from India",
    description:
      "AI engineering and software for established businesses and digital agencies worldwide.",
    images: ["/aegisprotection.webp"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-96x96.png",
    apple: "/apple-touch-icon.png",
  },
};

// ThemeInit.tsx (server component is fine, no "use client")
function ThemeInit() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function() {
          try {
            var stored = localStorage.getItem('theme');
            var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var theme = stored || (systemDark ? 'dark' : 'light');
            if (theme === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          } catch (e) {}
        })();`
      }}
    />
  );
}

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"], // headings
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
        <ThemeInit />
        <Header />
        <main>{children}</main>
        <Footer />
        <AnalyticsConsent />
      </body>
    </html>
  );
}
