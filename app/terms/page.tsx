// app/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — DigiPants",
  description:
    "The terms that govern your access to and use of DigiPants’ website and services.",
  alternates: { canonical: "https://digipants.com/terms/" },
};

export default function TermsPage() {
  return (
    <main className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Last updated: August 28, 2025
          </p>
        </header>

        <nav aria-label="Table of contents" className="mb-8">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>
              <a href="#agreement" className="hover:underline">
                Agreement & changes
              </a>
            </li>
            <li>
              <a href="#use" className="hover:underline">
                Acceptable use
              </a>
            </li>
            <li>
              <a href="#proposals" className="hover:underline">
                Proposals & engagements
              </a>
            </li>
            <li>
              <a href="#ip" className="hover:underline">
                Intellectual property
              </a>
            </li>
            <li>
              <a href="#confidentiality" className="hover:underline">
                Confidentiality
              </a>
            </li>
            <li>
              <a href="#third-party" className="hover:underline">
                Third-party services
              </a>
            </li>
            <li>
              <a href="#disclaimers" className="hover:underline">
                Disclaimers
              </a>
            </li>
            <li>
              <a href="#liability" className="hover:underline">
                Limitation of liability
              </a>
            </li>
            <li>
              <a href="#indemnity" className="hover:underline">
                Indemnification
              </a>
            </li>
            <li>
              <a href="#termination" className="hover:underline">
                Termination
              </a>
            </li>
            <li>
              <a href="#law" className="hover:underline">
                Governing law
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
          <h2 id="agreement" className="scroll-mt-24">
            Agreement & changes
          </h2>
          <p>
            These Terms of Service (“Terms”) govern your access to and use of
            the website operated by <strong>DigiPants</strong> and any services
            we provide. By using our site or engaging our services, you agree to
            these Terms. We may update these Terms from time to time; continued
            use constitutes acceptance of changes.
          </p>

          <h2 id="use" className="scroll-mt-24">
            Acceptable use
          </h2>
          <p>
            You agree not to misuse our website or services, including without
            limitation: attempting to access non-public areas, interfering with
            normal operation, or infringing intellectual property or privacy
            rights.
          </p>

          <h2 id="proposals" className="scroll-mt-24">
            Proposals & engagements
          </h2>
          <p>
            Specific engagements are governed by mutually agreed proposals,
            SOWs, or service agreements. Those documents control in the event of
            a conflict with these Terms. Invoices are due per the terms
            specified. Late payments may incur fees or suspension of work.
          </p>

          <h2 id="ip" className="scroll-mt-24">
            Intellectual property
          </h2>
          <p>
            We retain all rights to our pre-existing IP, methods, templates, and
            tools. Upon full payment, you receive the rights expressly granted
            in the applicable proposal or agreement to deliverables created for
            you.
          </p>

          <h2 id="confidentiality" className="scroll-mt-24">
            Confidentiality
          </h2>
          <p>
            Each party may access the other’s confidential information. Both
            agree to protect such information and use it only as necessary to
            perform the engagement.
          </p>

          <h2 id="third-party" className="scroll-mt-24">
            Third-party services
          </h2>
          <p>
            We may integrate or rely on third-party platforms (e.g., ad
            networks, analytics, hosting). Your use of those services may be
            subject to their terms, and we are not responsible for their acts or
            omissions.
          </p>

          <h2 id="disclaimers" className="scroll-mt-24">
            Disclaimers
          </h2>
          <p>
            To the fullest extent permitted by law, our website and services are
            provided “as is” without warranties of any kind, whether express or
            implied, including merchantability, fitness for a particular
            purpose, or non-infringement. Marketing results are influenced by
            many external factors and cannot be guaranteed.
          </p>

          <h2 id="liability" className="scroll-mt-24">
            Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, in no event will DigiPants
            be liable for consequential, incidental, special, punitive, or
            indirect damages. Our aggregate liability arising out of or related
            to the services will not exceed the amounts paid to us for the
            services giving rise to the claim during the 3 months preceding the
            event.
          </p>

          <h2 id="indemnity" className="scroll-mt-24">
            Indemnification
          </h2>
          <p>
            You agree to indemnify and hold DigiPants harmless from claims,
            damages, losses, and expenses (including reasonable legal fees)
            arising from your misuse of the website or breach of these Terms.
          </p>

          <h2 id="termination" className="scroll-mt-24">
            Termination
          </h2>
          <p>
            We may suspend or terminate access to the website or services for
            any violation of these Terms or applicable law. Provisions which by
            their nature should survive termination will survive (e.g., IP,
            confidentiality, limitations of liability).
          </p>

          <h2 id="law" className="scroll-mt-24">
            Governing law
          </h2>
          <p>
            These Terms are governed by the laws of India. Venue for disputes
            will be the competent courts in Lucknow, Uttar Pradesh, India,
            unless otherwise agreed in a written services agreement.
          </p>

          <h2 id="contact" className="scroll-mt-24">
            Contact
          </h2>
          <p>
            Questions about these Terms? Email{" "}
            <a href="mailto:bhupendra@digipants.com">bhupendra@digipants.com</a>{" "}
            or use our{" "}
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
