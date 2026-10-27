"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsConsent,
  hasAnalyticsConsent,
  initializeFirstTouchAttribution,
  setAnalyticsConsent,
  trackContactIntent,
  trackPageView,
  type AnalyticsConsent as ConsentChoice,
} from "@/lib/analytics";

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const initialPathname = useRef<string | null>(null);
  const navigatedBeforeConsent = useRef(false);

  useEffect(() => {
    if (initialPathname.current === null) initialPathname.current = pathname || "/";
    else if (initialPathname.current !== (pathname || "/")) navigatedBeforeConsent.current = true;
  }, [pathname]);

  useEffect(() => {
    if (initialPathname.current === null) initialPathname.current = window.location.pathname || "/";
    let storedChoice: ConsentChoice | null = null;
    try {
      const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (stored === "accepted" || stored === "rejected") storedChoice = stored;
    } catch {
      // Show the choice on every visit when browser storage is unavailable.
    }

    setChoice(storedChoice);
    setReady(true);

    if (storedChoice === "accepted") {
      initializeFirstTouchAttribution();
      trackPageView(window.location.pathname);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
      if (event.newValue === "accepted" || event.newValue === "rejected") {
        setChoice(event.newValue);
        setAnalyticsConsent(event.newValue, !navigatedBeforeConsent.current);
        if (event.newValue === "accepted") trackPageView(window.location.pathname);
      } else {
        setChoice(null);
        clearAnalyticsConsent();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (ready && choice === "accepted") trackPageView(pathname || "/");
  }, [choice, pathname, ready]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;

      let path: string;
      try {
        const destination = new URL(link.href, window.location.href);
        if (!hasAnalyticsConsent()) {
          if (
            destination.origin === window.location.origin &&
            (destination.pathname !== window.location.pathname ||
              destination.search !== window.location.search ||
              destination.hash !== window.location.hash)
          ) navigatedBeforeConsent.current = true;
          return;
        }
        path = destination.pathname.replace(/\/+$/, "") || "/";
      } catch {
        return;
      }
      if (path !== "/contact-us") return;

      const location = link.closest("header")
        ? "header"
        : link.closest("footer")
          ? "footer"
          : link.closest("main")
            ? "main"
            : "other";
      trackContactIntent(location);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const choose = useCallback((nextChoice: ConsentChoice) => {
    setAnalyticsConsent(nextChoice, !navigatedBeforeConsent.current);
    setChoice(nextChoice);
    setSettingsOpen(false);
    if (nextChoice === "accepted") trackPageView(window.location.pathname);
  }, []);

  if (!ready) return null;

  return (
    <>
      {choice && !settingsOpen ? (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="fixed bottom-4 left-4 z-[60] min-h-11 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-950"
          aria-label={`Privacy settings. Analytics currently ${choice}.`}
        >
          Privacy settings
        </button>
      ) : (
        <section
          role="region"
          aria-live="polite"
          aria-labelledby="analytics-consent-title"
          aria-describedby="analytics-consent-description"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-6 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h2 id="analytics-consent-title" className="text-base font-semibold text-zinc-950 dark:text-white">
                Optional analytics
              </h2>
              <p id="analytics-consent-description" className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Allow Google Analytics to measure page visits and enquiry activity. No form contents are sent. You can change this choice any time in Privacy settings.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-64">
              <button
                type="button"
                onClick={() => choose("rejected")}
                className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-900"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => choose("accepted")}
                className="min-h-11 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-zinc-900"
              >
                Accept
              </button>
              {settingsOpen && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="col-span-2 min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-300 dark:focus-visible:ring-emerald-400"
                >
                  Keep current choice
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
