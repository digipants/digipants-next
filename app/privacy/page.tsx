// app/privacy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — DigiPants",
  description:
    "How DigiPants collects, uses, and safeguards your information across our website, services, and communications.",
  alternates: { canonical: "https://digipants.com/privacy/" },
};

export default function PrivacyPage() {
  return (
    <main className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Last updated: August 28, 2025
          </p>
        </header>

        <nav aria-label="Table of contents" className="mb-8">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>
              <a href="#scope" className="hover:underline">
                Scope
              </a>
            </li>
            <li>
              <a href="#data-we-collect" className="hover:underline">
                Information we collect
              </a>
            </li>
            <li>
              <a href="#use" className="hover:underline">
                How we use information
              </a>
            </li>
            <li>
              <a href="#cookies" className="hover:underline">
                Cookies & tracking
              </a>
            </li>
            <li>
              <a href="#ads" className="hover:underline">
                Advertising & analytics
              </a>
            </li>
            <li>
              <a href="#sharing" className="hover:underline">
                Sharing & processors
              </a>
            </li>
            <li>
              <a href="#retention" className="hover:underline">
                Data retention
              </a>
            </li>
            <li>
              <a href="#rights" className="hover:underline">
                Your rights
              </a>
            </li>
            <li>
              <a href="#security" className="hover:underline">
                Security
              </a>
            </li>
            <li>
              <a href="#children" className="hover:underline">
                Children’s privacy
              </a>
            </li>
            <li>
              <a href="#changes" className="hover:underline">
                Changes to this policy
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:underline">
                Contact
              </a>
            </li>
          </ul>
        </nav>

        <article className="prose prose-zinc dark:prose-invert max-w-none">
          <h2 id="scope" className="scroll-mt-24">
            Scope
          </h2>
          <p>
            This Privacy Policy explains how <strong>DigiPants</strong> (“we”,
            “us”, “our”) collects, uses, and safeguards information when you
            visit our website, engage our services, or communicate with us.
          </p>

          <h2 id="data-we-collect" className="scroll-mt-24">
            Information we collect
          </h2>
          <ul>
            <li>
              <strong>Contact & business info:</strong> name, email, company,
              role, project details you submit via forms or email.
            </li>
            <li>
              <strong>Usage data:</strong> pages viewed, referrers, device and
              browser info, approximate location.
            </li>
            <li>
              <strong>Cookies/identifiers:</strong> to remember preferences and
              measure performance.
            </li>
          </ul>

          <h2 id="use" className="scroll-mt-24">
            How we use information
          </h2>
          <ul>
            <li>
              To respond to inquiries and provide proposals or services you
              request.
            </li>
            <li>To operate, secure, and improve our website and offerings.</li>
            <li>
              To perform analytics, advertising measurement, and prevent abuse.
            </li>
          </ul>

          <h2 id="cookies" className="scroll-mt-24">
            Cookies & tracking
          </h2>
          <p>
            We use cookies and similar technologies for essential operations,
            performance measurement, and (where enabled) advertising. You can
            control cookies in your browser settings. Blocking some cookies may
            impact site functionality.
          </p>

          <h2 id="ads" className="scroll-mt-24">
            Advertising & analytics
          </h2>
          <p>
            We may use analytics and ad platforms (e.g., Google, Meta) to
            understand website performance and the effectiveness of our
            marketing. These platforms may set their own cookies and receive
            limited pseudonymous data per their policies.
          </p>

          <h2 id="sharing" className="scroll-mt-24">
            Sharing & processors
          </h2>
          <p>
            We do not sell personal information. We may share information with
            service providers who process data on our behalf (hosting,
            analytics, CRM, communications). We require them to safeguard data
            and use it only per our instructions. We may disclose information to
            comply with law, protect our rights, or complete a business
            transfer.
          </p>

          <h2 id="retention" className="scroll-mt-24">
            Data retention
          </h2>
          <p>
            We keep information only as long as necessary for the purposes
            above, and to meet legal or contractual obligations. We then delete
            or de-identify data.
          </p>

          <h2 id="rights" className="scroll-mt-24">
            Your rights
          </h2>
          <p>
            Depending on your region, you may have rights to access, correct,
            delete, or export your data, or object to certain processing. To
            exercise these rights, contact us at{" "}
            <a href="mailto:bhupendra@digipants.com">bhupendra@digipants.com</a>
            . We may need to verify your identity before fulfilling a request.
          </p>

          <h2 id="security" className="scroll-mt-24">
            Security
          </h2>
          <p>
            We use reasonable technical and organizational safeguards
            appropriate to the nature of the data we handle. No method of
            transmission or storage is 100% secure.
          </p>

          <h2 id="children" className="scroll-mt-24">
            Children’s privacy
          </h2>
          <p>
            Our website and services are not directed to children under 13. We
            do not knowingly collect personal information from children.
          </p>

          <h2 id="changes" className="scroll-mt-24">
            Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. We’ll post the revised
            version here and adjust the “Last updated” date.
          </p>

          <h2 id="contact" className="scroll-mt-24">
            Contact
          </h2>
          <p>
            Questions? Email{" "}
            <a href="mailto:bhupendra@digipants.com">bhupendra@digipants.com</a>
            . You may also use our{" "}
            <Link href="/contact-us/" className="underline">
              contact form
            </Link>
            .
          </p>
        </article>
      </div>
    </main>
  );
}
