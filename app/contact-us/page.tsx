// app/contact-us/page.tsx
import type { Metadata } from "next";
import ContactForm from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact | DigiPants",
  description: "Tell us about your project. We reply within 24 hours.",
  openGraph: { title: "Contact | DigiPants", url: "/contact-us/" },
};

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24 py-12 md:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100">
      <Section>
        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
              Start a project
            </h1>
            <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
              Share your goals, constraints, and timeline. We’ll propose a plan
              that starts delivering in weeks.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                ✉️{" "}
                <a
                  className="underline-offset-4 hover:underline"
                  href="mailto:bhupendra@digipants.com"
                >
                  bhupendra@digipants.com
                </a>
              </li>
              <li>🌍 Lucknow, India</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60">
            <img
              src="https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop"
              alt="Workspace and call"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <ContactForm />
          <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-6">
            <h3 className="font-semibold">What to include</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Goals & KPIs (e.g., ROAS, CAC)</li>
              <li>• Constraints (budget, timeline, tech)</li>
              <li>• Current stack (ads, analytics, CRM)</li>
              <li>• Examples of offers/creatives</li>
            </ul>
            <div className="mt-6">
              <h4 className="font-semibold">Or book a call</h4>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Send two time slots and we’ll confirm by email.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
