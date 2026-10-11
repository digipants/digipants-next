import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Github, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { projects } from "@/lib/data";

export const metadata: Metadata = {
  title: "Bhupendra Kumar — Founder, DigiPants",
  description:
    "Meet Bhupendra Kumar, founder of DigiPants, building software, digital products, and growth-focused web experiences.",
  alternates: { canonical: "https://digipants.com/bhupendra/" },
};

const recentProjects = projects.slice(0, 7);

export default function FounderPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Founder, DigiPants
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-zinc-950 sm:text-6xl lg:text-7xl dark:text-white">
              Bhupendra Kumar
            </h1>
            <p className="mt-6 text-xl font-semibold tracking-tight text-zinc-800 sm:text-2xl dark:text-zinc-200">
              Engineering, product building, and digital growth.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              My path into product building grew from hands-on work in outdoor
              advertising, digital marketing, and web development. Today, I
              bring that mix of communication and technology to practical
              software and AI products—starting with the problem, building
              thoughtfully, and keeping people in the loop.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/work/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Explore selected work <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact-us/"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 text-sm font-semibold transition hover:border-zinc-950 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:border-zinc-700 dark:hover:border-zinc-300 dark:hover:bg-zinc-900 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
              >
                Get in touch
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />Lucknow, India</span>
              <a className="inline-flex items-center gap-2 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:text-emerald-300" href="mailto:support@digipants.com"><Mail className="h-4 w-4" />support@digipants.com</a>
              <a className="inline-flex items-center gap-2 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:text-emerald-300" href="tel:+917317275160"><Phone className="h-4 w-4" />+91 73172 75160</a>
            </div>
            <div className="mt-6 flex gap-4">
              <a className="rounded-md text-zinc-600 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-300" aria-label="LinkedIn profile" href="https://www.linkedin.com/in/bhupendraprofile/"><Linkedin className="h-5 w-5" /></a>
              <a className="rounded-md text-zinc-600 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-300" aria-label="DigiPants on GitHub" href="https://github.com/digipants"><Github className="h-5 w-5" /></a>
              <a className="rounded-md text-zinc-600 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-300" aria-label="DigiPants website" href="https://digipants.com/"><ArrowUpRight className="h-5 w-5" /></a>
            </div>
          </div>

          <div className="relative mx-auto aspect-[5/6] w-full max-w-[480px] overflow-hidden rounded-3xl bg-zinc-100 shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10 lg:ml-auto">
            <Image
              src="/founder-bhupendra.webp"
              alt="Portrait of Bhupendra Kumar, founder of DigiPants"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 100vw"
              style={{ objectPosition: "center 32%" }}
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Selected work</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">A cross-section of DigiPants projects.</h2>
              <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">Product and web work across digital safety, research, food, education, commerce, and intelligence.</p>
            </div>
            <Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-300" href="/work/">View complete portfolio <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => {
              const card = (
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-xl hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/30 dark:hover:shadow-black/20">
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                    <Image src={project.img} alt={`${project.title} project`} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" style={{ objectPosition: project.imagePosition }} className="object-cover transition duration-500 group-hover:scale-[1.025] motion-reduce:transition-none" />
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <span className="w-fit rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">{project.tag}</span>
                    <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-zinc-950 dark:text-white">{project.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{project.summary}</p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{project.caseStudy ? "View case study" : "Portfolio project"}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
                  </div>
                </article>
              );

              return project.caseStudy ? (
                <Link key={project.slug} href={`/work/${project.slug}/`} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">{card}</Link>
              ) : <div key={project.slug}>{card}</div>;
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 py-14 dark:border-zinc-800 sm:py-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Connect</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Have a product or digital project in mind?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Contact DigiPants to start a conversation.</p>
          </div>
          <Link href="/contact-us/" className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950">Start a project <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
