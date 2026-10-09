type Project = {
  slug: string;
  title: string;
  summary: string;
  tag: string;
  img: string;
  caseStudy: boolean;
  cover?:
    | "aegis-protection"
    | "aegis-trade"
    | "nectar-kitchen"
    | "educatia"
    | "vidyanju"
    | "reputation-desk"
    | "ai-kitchen"
    | "pearlytots"
    | "upscale-hotel"
    | "quicksquad"
    | "zescher";
};

const projects: Project[] = [
  {
    slug: "aegisprotection",
    title: "AegisProtection — AI-Powered Digital Safety",
    summary: "AI-assisted web protection platform with URL analysis, a browser extension, and mobile applications.",
    tag: "Cybersecurity",
    img: "/Screenshot 2026-10-09 at 5.08.01 PM.png",
    caseStudy: true,
    cover: "aegis-protection",
  },
  {
    slug: "aegistrade",
    title: "AegisTrade — Algorithmic Trading Intelligence",
    summary: "Algorithmic trading research platform for strategy evaluation, risk controls, and live-shadow monitoring.",
    tag: "FinTech",
    img: "/Screenshot 2026-10-09 at 5.05.42 PM.png",
    caseStudy: true,
    cover: "aegis-trade",
  },
  {
    slug: "nectarkitchen",
    title: "NectarKitchen — Digital-First Food Ordering",
    summary: "Food ordering website for a Lucknow-based kitchen offering pickup and delivery.",
    tag: "FoodTech",
    img: "/Screenshot 2026-10-09 at 5.08.26 PM.png",
    caseStudy: true,
    cover: "nectar-kitchen",
  },
  {
    slug: "educatia",
    title: "Educatia — Empowering Education",
    summary:
      "A digital presence for Educatia Welfare Trust, designed to communicate its mission and connect communities with opportunities in education and social development.",
    tag: "Social Impact",
    img: "/Screenshot 2026-10-09 at 5.06.12 PM.png",
    caseStudy: true,
    cover: "educatia",
  },
  {
    slug: "vidyanju",
    title: "Vidyanju — Premium Gifting & E-commerce",
    summary: "Premium gifting e-commerce platform with curated hampers, bespoke requests, and local Lucknow fulfilment.",
    tag: "E-commerce",
    img: "/Screenshot 2026-10-09 at 5.06.23 PM.png",
    caseStudy: true,
    cover: "vidyanju",
  },
  {
    slug: "reputationdesk",
    title: "ReputationDesk — AI-Powered Reputation Intelligence",
    summary: "AI-assisted intelligence and online reputation monitoring platform with source collection, narrative analysis, and human review workflows.",
    tag: "AI Intelligence",
    img: "/Screenshot 2026-10-09 at 5.08.48 PM.png",
    caseStudy: true,
    cover: "reputation-desk",
  },
  {
    slug: "aikitchen",
    title: "AIKitchen — Exploring the Future of FoodTech",
    summary:
      "Smart cloud kitchen in Lucknow offering meal plans, one-off meals, delivery, dine-in, and WhatsApp-first ordering.",
    tag: "FoodTech",
    img: "/Screenshot 2026-10-09 at 5.06.34 PM.png",
    caseStudy: true,
    cover: "ai-kitchen",
  },
  {
    slug: "pearlytots",
    title: "PearlyTots — D2C Launch & Scale",
    summary:
      "Shopify launch with Syncee/Zendrop, creative testing, UGC ads, and post‑purchase upsells to improve AOV & LTV.",
    tag: "D2C",
    img: "https://images.unsplash.com/photo-1649937365218-1316528fe149?q=80&w=2083&auto=format&fit=crop&w=1600&q=80",
    caseStudy: true,
    cover: "pearlytots",
  },
  {
    slug: "upscale-hotel",
    title: "Upscale Hotel — More Direct, Less OTA",
    summary:
      "PMax + Meta remarketing, parity landing pages, and automations to lift direct bookings.",
    tag: "Hotels",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
    caseStudy: true,
    cover: "upscale-hotel",
  },
  {
    slug: "quicksquad",
    title: "quicksquad — AI Support to Cut CAC",
    summary:
      "AI triage bot + landing UX revamp to improve trust, lead quality, and lower CAC.",
    tag: "AI",
    img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
    caseStudy: true,
    cover: "quicksquad",
  },
  {
    slug: "zescher",
    title: "Zescher — POD Launch & Growth",
    summary:
      "Sanskrit‑inspired POD brand with automated design‑to‑print workflow and a conversion‑optimized storefront.",
    tag: "POD",
    img: "https://images.unsplash.com/photo-1628071711153-d0204a351a6e?q=80&w=2120&auto=format&fit=crop&w=1600&q=80",
    caseStudy: true,
    cover: "zescher",
  },
];
export { projects };
export type { Project };

export const breadcrumbWork = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://digipants.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Work",
      item: "https://digipants.com/work",
    },
  ],
};

export const breadcrumbCase = (proj: (typeof projects)[number]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://digipants.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Work",
      item: "https://digipants.com/work/",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: proj.title,
      item: `https://digipants.com/work/${proj.slug}/`,
    },
  ],
} as const);
