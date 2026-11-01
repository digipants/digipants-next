export const ANALYTICS_MEASUREMENT_ID = "G-RGELLSWQWR";
export const ANALYTICS_CONSENT_KEY = "digipants.analytics-consent";
const GA_COOKIE_NAMES = [
  "_ga",
  `_ga_${ANALYTICS_MEASUREMENT_ID.slice(2)}`,
];
const SITE_COOKIE_DOMAIN = "digipants.com";

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

function safePathname(pathname: string) {
  const withoutQueryOrFragment = pathname.split(/[?#]/, 1)[0];
  return withoutQueryOrFragment.startsWith("/") ? withoutQueryOrFragment : "/";
}

/**
 * Private workspace URLs (including synthetic preview and invitation landing)
 * are never analytics page locations. In particular, avoid disclosing
 * tenant/project UUIDs, invitation fragments or recipient onboarding paths.
 */
export function isPrivateWorkspacePath(pathname: string): boolean {
  const path = safePathname(pathname).replace(/\/+$/, "") || "/";
  return path === "/workspace" || path.startsWith("/workspace/") ||
    path === "/workspace-preview" || path.startsWith("/workspace-preview/");
}

function safePageLocation(pathname: string) {
  return `${window.location.origin}${safePathname(pathname)}`;
}

function initializeAnalytics() {
  if (typeof window === "undefined" || !hasAnalyticsConsent() ||
      isPrivateWorkspacePath(window.location.pathname)) return;

  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = false;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ANALYTICS_MEASUREMENT_ID, {
      send_page_view: false,
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

export function setAnalyticsConsent(consent: AnalyticsConsent) {
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
    return;
  }

  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
  clearAnalyticsCookies();
}

export function clearAnalyticsConsent() {
  sessionConsent = null;
  lastTrackedPath = null;
  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
  clearAnalyticsCookies();
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Analytics remains disabled for this page session.
  }
}

export function trackPageView(pathname: string) {
  if (!hasAnalyticsConsent()) return;
  const path = safePathname(pathname);
  if (isPrivateWorkspacePath(path) || isPrivateWorkspacePath(window.location.pathname)) {
    window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
    lastTrackedPath = null;
    return;
  }
  if (lastTrackedPath === path) return;
  initializeAnalytics();
  window.gtag?.("event", "page_view", {
    page_location: safePageLocation(path),
    page_referrer: "",
  });
  lastTrackedPath = path;
}

export function trackContactIntent(location: "header" | "footer" | "main" | "other") {
  if (!hasAnalyticsConsent() || isPrivateWorkspacePath(window.location.pathname)) return;
  initializeAnalytics();
  window.gtag?.("event", "contact_intent", { cta_location: location });
}

export function trackConfirmedLead() {
  if (!hasAnalyticsConsent() || isPrivateWorkspacePath(window.location.pathname)) return;
  initializeAnalytics();
  window.gtag?.("event", "generate_lead");
}
