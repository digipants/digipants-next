"use client";
import React, { useMemo, useRef } from "react";
import type { PropsWithChildren } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Github,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  Award,
  Rocket,
  Briefcase,
  Sparkles,
  BookOpen,
  Send,
  ExternalLink,
  Globe,
} from "lucide-react";

const PROFILE = {
  name: "Bhupendra Kumar",
  role: "Founder, DigiPants — Growth & Performance Marketing",
  tagline:
    "Driving revenue with Google/Meta Ads, CRO, and AI automations for hotels, D2C brands, and service businesses.",
  location: "Lucknow, India",
  email: "bhupendra@digipants.com",
  phone: "+91-9511-11-7747",
  socials: {
    linkedin: "https://www.linkedin.com/in/bhupendraprofile/",
    github: "https://github.com/digipants",
    website: "https://digipants.com/bhupendra",
  },
  ctaPrimary: "Book a Strategy Call",
  ctaSecondary: "View Case Studies",
};

const SERVICES = [
  {
    title: "Performance Marketing",
    desc: "Google Ads (Search, PMax), Meta Ads, and landing pages engineered for ROI.",
    icon: <Rocket className="w-5 h-5" />,
    tags: ["google ads", "pmax", "meta", "cro"],
  },
  {
    title: "AI Agents & Automations",
    desc: "WhatsApp flows, on‑site assistants, lead routing, CRM workflows, and reporting.",
    icon: <Sparkles className="w-5 h-5" />,
    tags: ["whatsapp", "chatbots", "zapier", "make"],
  },
  {
    title: "E‑commerce Growth (Shopify)",
    desc: "Store setup, product strategy, Klaviyo flows, upsells, subscriptions, LTV.",
    icon: <Briefcase className="w-5 h-5" />,
    tags: ["shopify", "klaviyo", "ux", "ltv"],
  },
  {
    title: "Hotel Booking Funnels",
    desc: "Direct booking strategy: parity pages, PMax+Meta mix, OTA sync, analytics.",
    icon: <Award className="w-5 h-5" />,
    tags: ["hotels", "pms", "ota", "meta"],
  },
  {
    title: "SEO & Content Systems",
    desc: "Compound traffic via content clusters, internal linking, and intent mapping.",
    icon: <BookOpen className="w-5 h-5" />,
    tags: ["seo", "content", "clusters", "schema"],
  },
  {
    title: "Analytics & Measurement",
    desc: "GA4, GTM, server‑side events, conversion APIs, dashboards, and audits.",
    icon: <Globe className="w-5 h-5" />,
    tags: ["ga4", "gtm", "ssr", "capi"],
  },
];

const CASE_STUDIES = [
  {
    title: "Upscale Hotel — More Direct, Less OTA",
    metric: "Direct bookings up",
    summary:
      "Rebuilt the funnel with PMax + Meta remarketing, added parity landing pages, and automated cart‑abandon flows.",
    link: "/work/upscale-hotel",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "PearlyTots — D2C Launch & Scale",
    metric: "CVR trending ↑",
    summary:
      "Shopify launch with Syncee/Zendrop, creative testing, UGC ads, and post‑purchase upsells to improve AOV & LTV.",
    link: "/work/pearlytots",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "quicksquad — AI Support to Cut CAC",
    metric: "Lower acquisition cost",
    summary:
      "Built an AI triage bot and revamped landing UX for clarity and faster resolution; improved trust and lead quality.",
    link: "/work/quicksquad",
    img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Zescher — POD Launch & Growth",
    metric: "360° brand launch",
    summary:
      "Sanskrit‑inspired POD brand with automated design‑to‑print workflow and a conversion‑optimized storefront.",
    link: "/work/zescher",
    img: "https://images.unsplash.com/photo-1628071711153-d0204a351a6e?q=80&w=2120&auto=format&fit=crop&w=1600&q=80",
  },
];

const SKILLS = [
  "Google Ads (Search, PMax)",
  "Meta Ads",
  "SEO & Content Systems",
  "Shopify & CRO",
  "AI Agents (WhatsApp, Web)",
  "Analytics (GA4/GTM/CAPI)",
];

function Section({ id, children }: PropsWithChildren<{ id: string }>) {
  return (
    <section id={id} className="scroll-mt-24 py-20 md:py-28">
      {children}
    </section>
  );
}

function Container({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium border-zinc-200/70 dark:border-zinc-700/60">
      {children}
    </span>
  );
}

function Button({
  children,
  href,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[.98]";
  const variants: Record<string, string> = {
    primary:
      "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm hover:opacity-90",
    ghost:
      "bg-transparent text-zinc-900 dark:text-white border border-zinc-200/60 dark:border-zinc-700/60 hover:bg-zinc-50/60 dark:hover:bg-white/5",
  };
  const cls = `${base} ${variants[variant]}`;
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

export default function bhupendraPage() {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.98]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.5]);
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black text-zinc-900 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-400/30 via-fuchsia-400/30 to-emerald-400/30 blur-3xl dark:from-indigo-500/10 dark:via-fuchsia-500/10 dark:to-emerald-500/10" />
      </div>
      <Section id="home">
        <Container>
          <motion.div
            ref={heroRef}
            style={{ scale, opacity }}
            className="grid items-center gap-10 md:grid-cols-2"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1 text-xs mb-5">
                <Award className="w-4 h-4" /> Available for select consulting in{" "}
                {year}
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
                {PROFILE.name}
              </h1>
              <p className="mt-3 text-lg md:text-xl text-zinc-700 dark:text-zinc-300">
                {PROFILE.role}
              </p>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-prose">
                {PROFILE.tagline}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button href="/contact-us">
                  {PROFILE.ctaPrimary} <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/work" variant="ghost">
                  {PROFILE.ctaSecondary} <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {PROFILE.location}
                </span>
                <a
                  className="inline-flex items-center gap-1 hover:underline"
                  href={`mailto:${PROFILE.email}`}
                >
                  <Mail className="w-4 h-4" />
                  {PROFILE.email}
                </a>
                <a
                  className="inline-flex items-center gap-1 hover:underline"
                  href={`tel:${PROFILE.phone}`}
                >
                  <Phone className="w-4 h-4" />
                  {PROFILE.phone}
                </a>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <a
                  className="hover:opacity-70"
                  aria-label="LinkedIn"
                  href={PROFILE.socials.linkedin}
                >
                  <Linkedin />
                </a>
                <a
                  className="hover:opacity-70"
                  aria-label="GitHub"
                  href={PROFILE.socials.github}
                >
                  <Github />
                </a>
                <a
                  className="hover:opacity-70"
                  aria-label="Website"
                  href={PROFILE.socials.website}
                >
                  <Globe />
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 -z-10 blur-3xl rounded-full bg-gradient-to-tr from-emerald-400/30 via-indigo-400/30 to-fuchsia-400/30" />
              <Card className="p-4 md:p-6">
                <div
                  className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-[url('https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center"
                  aria-label="Profile visual placeholder"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {SKILLS.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </Card>
            </div>
          </motion.div>
        </Container>
      </Section>

      <Section id="services">
        <Container>
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Services
            </h2>
            <a
              href="/contact-us"
              className="text-sm inline-flex items-center gap-1 hover:underline"
            >
              Get a custom plan <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {SERVICES.map((srv) => (
              <motion.div
                key={srv.title}
                initial={{ y: 12, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Card className="p-6 h-full">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      {srv.icon}
                    </span>
                    <h3 className="font-semibold">{srv.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {srv.desc}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {srv.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="work">
        <Container>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">
            Selected Work
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {CASE_STUDIES.map((cs) => (
              <motion.a
                key={cs.title}
                href={cs.link}
                className="group"
                initial={{ y: 12, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Card className="overflow-hidden h-full group">
                  <div
                    className="aspect-video bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.03]"
                    style={{ backgroundImage: `url(${cs.img})` }}
                  />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold group-hover:underline">
                        {cs.title}
                      </h3>
                      <Badge>{cs.metric}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {cs.summary}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1 text-sm opacity-80">
                      Read more <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              </motion.a>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="about">
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                About
              </h2>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                I’m a growth‑focused marketer and builder. Over the last few
                years I’ve helped hotels, D2C brands, and SaaS teams find
                traction with performance marketing + solid UX. I love turning
                messy funnels into clean, scalable systems — backed by
                analytics, automation, and creative testing.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {SKILLS.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </div>
            <Card className="p-6">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Highlights
              </h3>
              <ul className="mt-3 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <li>
                  • Built omni‑channel strategy frameworks for hotels and
                  e‑commerce brands.
                </li>
                <li>
                  • Prototyped AI support agents and WhatsApp journeys that
                  shorten TAT.
                </li>
                <li>
                  • Set up full analytics pipelines: GTM, GA4, events,
                  conversions, LTV.
                </li>
              </ul>
            </Card>
          </div>
        </Container>
      </Section>

      <Section id="contact">
        <Container>
          <Card className="p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Let’s build something great
                </h2>
                <p className="mt-3 text-zinc-600 dark:text-zinc-400">
                  Tell me about your project. I’ll reply within 24 hours.
                </p>
                <div className="mt-6 space-y-3 text-sm">
                  <div className="inline-flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {PROFILE.email}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {PROFILE.phone}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {PROFILE.location}
                  </div>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  const subject = encodeURIComponent(
                    `New inquiry from ${fd.get("name")}`
                  );
                  const body = encodeURIComponent(`Project: ${fd.get("project")}
Budget: ${fd.get("budget")}
Timeline: ${fd.get("timeline")}

Message:
${fd.get("message")}

— ${fd.get("name")} (${fd.get("email")})`);
                  window.location.href = `mailto:${PROFILE.email}?subject=${subject}&body=${body}`;
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span>Name</span>
                    <input
                      name="name"
                      required
                      className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      required
                      className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  <span>Project</span>
                  <input
                    name="project"
                    placeholder="e.g. Shopify growth, hotel bookings, AI support bot"
                    className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span>Budget</span>
                    <input
                      name="budget"
                      placeholder="₹1–5L"
                      className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span>Timeline</span>
                    <input
                      name="timeline"
                      placeholder="4–8 weeks"
                      className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  <span>Message</span>
                  <textarea
                    name="message"
                    rows={4}
                    className="rounded-xl border border-zinc-300/70 dark:border-zinc-700/60 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                </label>
                <Button>
                  Send <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </Card>
        </Container>
      </Section>
    </div>
  );
}
