export const ANALYTICS_MEASUREMENT_ID = "G-RGELLSWQWR";
export const ANALYTICS_CONSENT_KEY = "digipants.analytics-consent";
const ATTRIBUTION_STORAGE_KEY = "digipants.analytics-attribution";
const GA_COOKIE_NAMES = [
  "_ga",
  `_ga_${ANALYTICS_MEASUREMENT_ID.slice(2)}`,
];
const SITE_COOKIE_DOMAIN = "digipants.com";
const ATTRIBUTION_CHANNELS = ["campaign", "organic", "referral", "direct", "unknown"] as const;
const TARGETED_MARKETS = ["uk", "us", "other", "unknown"] as const;
const CAMPAIGN_MARKETS = ["uk", "us", "other"] as const;
const CAMPAIGN_SOURCES = new Set(["email", "linkedin", "partner"]);
const CAMPAIGN_MEDIUMS = new Set(["email", "outreach", "partner"]);
const SEARCH_DOMAINS = [
  "google.com",
  "google.co.uk",
  "google.ca",
  "google.in",
  "google.com.au",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "ecosia.org",
  "brave.com",
];
const ATTRIBUTION_LANDING_PATHS = new Set([
  "/",
  "/services/",
  "/services/ai-software/",
  "/services/web-development/",
  "/services/digital-marketing/",
  "/engineering-partners/",
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
  "/other",
]);

export type AcquisitionChannel = (typeof ATTRIBUTION_CHANNELS)[number];
// This is campaign targeting supplied by a link, never a visitor-location estimate.
export type TargetedCampaignMarket = (typeof TARGETED_MARKETS)[number];
type FirstTouchAttribution = {
  channel: AcquisitionChannel;
  targeted_campaign_market: TargetedCampaignMarket;
  landing_path: string;
};

const UNKNOWN_ATTRIBUTION: FirstTouchAttribution = {
  channel: "unknown",
  targeted_campaign_market: "unknown",
  landing_path: "/other",
};

export type AnalyticsConsent = "accepted" | "rejected";
let sessionConsent: AnalyticsConsent | null = null;
let lastTrackedPath: string | null = null;

declare global {
  interface Window {
    dataLayer?: Array<IArguments | Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export function hasAnalyticsConsent() {
  if (sessionConsent !== null) return sessionConsent === "accepted";
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function safeLandingPath(pathname: string) {
  const normalized = safePathname(pathname);
  const withTrailingSlash = normalized === "/" ? "/" : `${normalized.replace(/\/+$/, "")}/`;
  return ATTRIBUTION_LANDING_PATHS.has(withTrailingSlash) ? withTrailingSlash : "/other";
}

function isSearchDomain(hostname: string) {
  return (
    /(?:^|\.)google\.(?:[a-z]{2,3}|(?:co|com)\.[a-z]{2})$/.test(hostname) ||
    SEARCH_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );
}

function classifyFirstTouch(pageUrl: string, referrerUrl: string): FirstTouchAttribution {
  try {
    const page = new URL(pageUrl);
    if (page.protocol !== "https:" && page.protocol !== "http:") return UNKNOWN_ATTRIBUTION;

    const marketValues = page.searchParams.getAll("market");
    const market = marketValues.length === 1 ? marketValues[0] : undefined;
    const targetedMarket = isOneOf(market, CAMPAIGN_MARKETS) ? market : "unknown";
    const hasInvalidMarket = marketValues.length > 1 || (marketValues.length === 1 && targetedMarket === "unknown");

    const hasUtm = Array.from(page.searchParams.keys()).some((key) => key.toLowerCase().startsWith("utm_"));
    const sourceValues = page.searchParams.getAll("utm_source");
    const mediumValues = page.searchParams.getAll("utm_medium");
    const sourceIsValid = sourceValues.length === 1 && CAMPAIGN_SOURCES.has(sourceValues[0]);
    const mediumIsValid = mediumValues.length === 1 && CAMPAIGN_MEDIUMS.has(mediumValues[0]);
    const hasInvalidSource = sourceValues.length > 0 && !sourceIsValid;
    const hasInvalidMedium = mediumValues.length > 0 && !mediumIsValid;
    const hasCampaignIndicator = targetedMarket !== "unknown" || sourceIsValid || mediumIsValid;

    let channel: AcquisitionChannel;
    if (hasInvalidMarket || hasInvalidSource || hasInvalidMedium) {
      channel = "unknown";
    } else if (hasCampaignIndicator) {
      channel = "campaign";
    } else if (hasUtm) {
      channel = "unknown";
    } else if (!referrerUrl) {
      channel = "direct";
    } else {
      const referrer = new URL(referrerUrl);
      if (referrer.protocol !== "https:" && referrer.protocol !== "http:") {
        channel = "unknown";
      } else {
        const hostname = referrer.hostname.toLowerCase();
        if (hostname === page.hostname.toLowerCase()) channel = "unknown";
        else channel = isSearchDomain(hostname) ? "organic" : "referral";
      }
    }

    return {
      channel,
      targeted_campaign_market: channel === "campaign" ? targetedMarket : "unknown",
      landing_path: safeLandingPath(page.pathname),
    };
  } catch {
    return UNKNOWN_ATTRIBUTION;
  }
}

function readStoredAttribution(): FirstTouchAttribution | null {
  try {
    const value = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      !isOneOf(record.channel, ATTRIBUTION_CHANNELS) ||
      !isOneOf(record.targeted_campaign_market, TARGETED_MARKETS) ||
      typeof record.landing_path !== "string" ||
      !ATTRIBUTION_LANDING_PATHS.has(record.landing_path)
    ) return null;
    return {
      channel: record.channel,
      targeted_campaign_market: record.targeted_campaign_market,
      landing_path: record.landing_path,
    };
  } catch {
    return null;
  }
}

function getAttribution(): FirstTouchAttribution {
  if (!hasAnalyticsConsent()) return UNKNOWN_ATTRIBUTION;
  return readStoredAttribution() ?? UNKNOWN_ATTRIBUTION;
}

export function initializeFirstTouchAttribution(canCaptureFirstTouch = true) {
  if (!hasAnalyticsConsent()) return UNKNOWN_ATTRIBUTION;

  const stored = readStoredAttribution();
  if (stored) return stored;

  const attribution = canCaptureFirstTouch
    ? classifyFirstTouch(window.location.href, document.referrer)
    : UNKNOWN_ATTRIBUTION;
  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return UNKNOWN_ATTRIBUTION;
  }
}

function clearStoredAttribution() {
  try {
    window.sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    // Missing storage leaves attribution unavailable and events use the unknown fallback.
  }
}

function safePathname(pathname: string) {
  const withoutQueryOrFragment = pathname.split(/[?#]/, 1)[0];
  return withoutQueryOrFragment.startsWith("/") ? withoutQueryOrFragment : "/";
}

function safePageLocation(pathname: string) {
  return `${window.location.origin}${safeLandingPath(pathname)}`;
}

function initializeAnalytics() {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = false;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ANALYTICS_MEASUREMENT_ID, {
      send_page_view: false,
      page_location: safePageLocation(window.location.pathname),
      page_referrer: "",
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }

  if (!document.querySelector("script[data-digipants-ga4]")) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.digipantsGa4 = "true";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
}

function clearAnalyticsCookies() {
  if (typeof document === "undefined") return;

  const hostname = window.location.hostname.toLowerCase();
  const isDigiPantsDomain =
    hostname === SITE_COOKIE_DOMAIN || hostname.endsWith(`.${SITE_COOKIE_DOMAIN}`);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  for (const name of GA_COOKIE_NAMES) {
    const cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${secure}`;
    document.cookie = cookie;

    if (isDigiPantsDomain) {
      document.cookie = `${cookie}; Domain=${SITE_COOKIE_DOMAIN}`;
      document.cookie = `${cookie}; Domain=.${SITE_COOKIE_DOMAIN}`;
    }
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent, canCaptureFirstTouch = true) {
  const wasAccepted = hasAnalyticsConsent();
  sessionConsent = consent;
  if (consent !== "accepted" || !wasAccepted) lastTrackedPath = null;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // Consent is session-scoped if browser storage is unavailable.
  }

  if (consent === "accepted") {
    initializeAnalytics();
    initializeFirstTouchAttribution(canCaptureFirstTouch);
    return;
  }

  clearStoredAttribution();
  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
  clearAnalyticsCookies();
}

export function clearAnalyticsConsent() {
  sessionConsent = null;
  lastTrackedPath = null;
  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
  clearAnalyticsCookies();
  clearStoredAttribution();
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Analytics remains disabled for this page session.
  }
}

export function trackPageView(pathname: string) {
  if (!hasAnalyticsConsent()) return;
  const path = safeLandingPath(pathname);
  if (lastTrackedPath === path) return;
  initializeAnalytics();
  window.gtag?.("event", "page_view", {
    page_location: safePageLocation(path),
    page_referrer: "",
  });
  lastTrackedPath = path;
}

export function trackContactIntent(location: "header" | "footer" | "main" | "other") {
  if (!hasAnalyticsConsent()) return;
  initializeAnalytics();
  window.gtag?.("event", "contact_intent", {
    cta_location: location,
    ...getAttribution(),
  });
}

export function trackConfirmedLead() {
  if (!hasAnalyticsConsent()) return;
  initializeAnalytics();
  window.gtag?.("event", "generate_lead", getAttribution());
}
