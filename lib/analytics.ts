export const ANALYTICS_MEASUREMENT_ID = "G-RGELLSWQWR";
export const ANALYTICS_CONSENT_KEY = "digipants.analytics-consent";

export type AnalyticsConsent = "accepted" | "rejected";
let sessionConsent: AnalyticsConsent | null = null;
let lastTrackedPath: string | null = null;

declare global {
  interface Window {
    dataLayer?: unknown[][];
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

function safePageLocation(pathname: string) {
  return `${window.location.origin}${safePathname(pathname)}`;
}

function initializeAnalytics() {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return;

  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = false;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
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
}

export function clearAnalyticsConsent() {
  sessionConsent = null;
  lastTrackedPath = null;
  window[`ga-disable-${ANALYTICS_MEASUREMENT_ID}`] = true;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Analytics remains disabled for this page session.
  }
}

export function trackPageView(pathname: string) {
  if (!hasAnalyticsConsent()) return;
  const path = safePathname(pathname);
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
  window.gtag?.("event", "contact_intent", { cta_location: location });
}

export function trackConfirmedLead() {
  if (!hasAnalyticsConsent()) return;
  initializeAnalytics();
  window.gtag?.("event", "generate_lead");
}
