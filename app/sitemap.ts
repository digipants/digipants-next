import type { MetadataRoute } from "next";

const siteUrl = "https://digipants.com";

const publicRoutes = [
  "/",
  "/services/",
  "/services/ai-software/",
  "/engineering-partners/",
  "/services/web-development/",
  "/services/digital-marketing/",
  "/pricing/",
  "/bhupendra/",
  "/contact-us/",
  "/work/",
  "/work/aegisprotection/",
  "/work/aegistrade/",
  "/work/nectarkitchen/",
  "/work/educatia/",
  "/work/vidyanju/",
  "/work/reputationdesk/",
  "/work/aikitchen/",
  "/work/pearlytots/",
  "/work/upscale-hotel/",
  "/work/quicksquad/",
  "/work/zescher/",
  "/privacy/",
  "/terms/",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({ url: `${siteUrl}${route}` }));
}
