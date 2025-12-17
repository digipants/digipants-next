// app/layout.tsx
import "./../styles/globals.css";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Providers from "@/components/Providers";
import { Poppins, Inter } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------------- Metadata ---------------- */

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
        url: "/og.jpg",
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
    images: ["/og.jpg"],
    creator: "@digipantstweets",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-96x96.png",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "aCO75-5PzlX_vlEUYZtpyMPIHYnUbS-1gSe8Fj1qKEY",
  },
};

/* ---------------- Theme Init ---------------- */

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
        })();`,
      }}
    />
  );
}

/* ---------------- Fonts ---------------- */

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/* ---------------- Root Layout ---------------- */

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

        {/* Providers = SessionProvider */}
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>

        {/* ✅ Toasts must be inside body */}
        <ToastContainer
          position="top-center"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="colored"
        />
      </body>
    </html>
  );
}
