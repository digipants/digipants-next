const projects = [
  {
    slug: "pearlytots",
    title: "PearlyTots — D2C Launch & Scale",
    summary:
      "Shopify launch with Syncee/Zendrop, creative testing, UGC ads, and post‑purchase upsells to improve AOV & LTV.",
    tag: "D2C",
    img: "https://images.unsplash.com/photo-1649937365218-1316528fe149?q=80&w=2083&auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "upscale-hotel",
    title: "Upscale Hotel — More Direct, Less OTA",
    summary:
      "PMax + Meta remarketing, parity landing pages, and automations to lift direct bookings.",
    tag: "Hotels",
    img: "https://images.unsplash.com/photo-1641911545942-953fb22eab8a?q=80&w=987&auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "quicksquad",
    title: "quicksquad — AI Support to Cut CAC",
    summary:
      "AI triage bot + landing UX revamp to improve trust, lead quality, and lower CAC.",
    tag: "AI",
    img: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    slug: "zescher",
    title: "Zescher — POD Launch & Growth",
    summary:
      "Sanskrit‑inspired POD brand with automated design‑to‑print workflow and a conversion‑optimized storefront.",
    tag: "POD",
    img: "https://images.unsplash.com/photo-1628071711153-d0204a351a6e?q=80&w=2120&auto=format&fit=crop&w=1600&q=80",
  },
];
export { projects };

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