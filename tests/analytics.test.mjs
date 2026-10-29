import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const analyticsSource = await readFile(new URL("../lib/analytics.ts", import.meta.url), "utf8");
const analyticsModuleSource = ts.transpileModule(analyticsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const analyticsModuleUrl = `data:text/javascript;base64,${Buffer.from(analyticsModuleSource).toString("base64")}`;
const analytics = await import(analyticsModuleUrl);
const contactSource = await readFile(new URL("../lib/contact-enquiry.ts", import.meta.url), "utf8");
const contactModuleSource = ts.transpileModule(
  contactSource.replace('"@/lib/analytics"', JSON.stringify(analyticsModuleUrl)),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } },
).outputText;
const contactModuleUrl = `data:text/javascript;base64,${Buffer.from(contactModuleSource).toString("base64")}`;
const { submitContactEnquiry } = await import(contactModuleUrl);

const storage = new Map();
const tabStorage = new Map();
const scripts = [];
const cookieWrites = [];
const makeSessionStorage = () => ({
  getItem: (key) => tabStorage.get(key) ?? null,
  setItem: (key, value) => tabStorage.set(key, value),
  removeItem: (key) => tabStorage.delete(key),
});

globalThis.window = {
  location: {
    hostname: "digipants.com",
    origin: "https://digipants.com",
    protocol: "https:",
    pathname: "/",
    href: "https://digipants.com/",
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  sessionStorage: makeSessionStorage(),
};

globalThis.document = {
  head: { appendChild: (script) => scripts.push(script) },
  createElement: () => ({ dataset: {}, src: "" }),
  querySelector: (selector) =>
    selector === "script[data-digipants-ga4]" ? scripts[0] ?? null : null,
  set cookie(value) {
    cookieWrites.push(value);
  },
};

function resetBrowser() {
  analytics.clearAnalyticsConsent();
  storage.clear();
  tabStorage.clear();
  window.sessionStorage = makeSessionStorage();
  scripts.length = 0;
  cookieWrites.length = 0;
  window.dataLayer = undefined;
  window.gtag = undefined;
  window.location.pathname = "/";
  window.location.href = "https://digipants.com/";
  document.referrer = "";
}

function setPage(url, referrer = "") {
  const parsed = new URL(url);
  window.location.href = url;
  window.location.pathname = parsed.pathname;
  window.location.origin = parsed.origin;
  document.referrer = referrer;
}

function storedAttribution() {
  return JSON.parse(tabStorage.get("digipants.analytics-attribution"));
}

function queuedCommands() {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry));
}

test("does not initialize GA4 before consent", () => {
  resetBrowser();

  analytics.trackPageView("/services/");
  analytics.trackContactIntent("main");
  analytics.trackConfirmedLead();

  assert.equal(window.dataLayer, undefined);
  assert.equal(scripts.length, 0);
  assert.equal(window["ga-disable-" + analytics.ANALYTICS_MEASUREMENT_ID], true);
  assert.equal(tabStorage.size, 0);
});

test("queues documented gtag arguments and emits one clean page view after acceptance", () => {
  resetBrowser();

  setPage("https://digipants.com/engineering-partners/?utm_source=linkedin&utm_campaign=private%40example.test&market=uk&email=private%40example.test");
  analytics.setAnalyticsConsent("accepted");
  analytics.trackPageView("/services/?campaign=private#section");
  analytics.trackPageView("/services/");

  const entries = window.dataLayer;
  assert.ok(entries);
  assert.equal(Array.isArray(entries[0]), false);
  assert.equal(Object.prototype.toString.call(entries[0]), "[object Arguments]");
  assert.deepEqual(queuedCommands().map((entry) => entry[0]), ["js", "config", "event"]);
  assert.equal(queuedCommands()[1][1], analytics.ANALYTICS_MEASUREMENT_ID);
  assert.equal(queuedCommands()[2][1], "page_view");
  assert.deepEqual(queuedCommands()[2][2], {
    page_location: "https://digipants.com/services/",
    page_referrer: "",
  });
  assert.deepEqual(queuedCommands()[1][2], {
    send_page_view: false,
    page_location: "https://digipants.com/engineering-partners/",
    page_referrer: "",
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  setPage("https://digipants.com/contact-us/?email=private%40example.test");
  analytics.trackContactIntent("main");
  assert.deepEqual(queuedCommands()[3][2], {
    cta_location: "main",
    channel: "campaign",
    targeted_campaign_market: "uk",
    landing_path: "/engineering-partners/",
  });
  assert.deepEqual(storedAttribution(), {
    channel: "campaign",
    targeted_campaign_market: "uk",
    landing_path: "/engineering-partners/",
  });
  assert.equal(storage.has("digipants.analytics-attribution"), false);
  assert.doesNotMatch(JSON.stringify([...tabStorage]), /utm_|linkedin|private|example\.test/);
  assert.doesNotMatch(JSON.stringify(queuedCommands()), /utm_|linkedin|private|example\.test/);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${analytics.ANALYTICS_MEASUREMENT_ID}`);
});

test("rejecting or clearing consent prevents later events and clears only scoped GA cookies", () => {
  resetBrowser();
  setPage("https://digipants.com/engineering-partners/?market=us");
  analytics.setAnalyticsConsent("accepted");
  analytics.trackPageView("/");
  const eventCount = queuedCommands().filter((entry) => entry[0] === "event").length;

  analytics.setAnalyticsConsent("rejected");
  assert.equal(tabStorage.has("digipants.analytics-attribution"), false);
  analytics.trackPageView("/work/");
  analytics.clearAnalyticsConsent(); // Same action used by the cross-tab storage-clear handler.
  analytics.trackPageView("/contact-us/");

  assert.equal(queuedCommands().filter((entry) => entry[0] === "event").length, eventCount);
  assert.equal(window["ga-disable-" + analytics.ANALYTICS_MEASUREMENT_ID], true);
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga=")));
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga_RGELLSWQWR=")));
  assert.ok(cookieWrites.every((value) => /^_(?:ga|ga_RGELLSWQWR)=/.test(value)));
});

test("classifies campaign, organic, referral, direct, and ambiguous traffic into safe values", () => {
  const cases = [
    ["https://digipants.com/engineering-partners/?utm_medium=outreach&market=us", "", {
      channel: "campaign", targeted_campaign_market: "us", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/services/?market=uk", "https://www.google.co.uk/search?q=private", {
      channel: "campaign", targeted_campaign_market: "uk", landing_path: "/services/",
    }],
    ["https://digipants.com/engineering-partners/", "https://www.google.co.uk/search?q=private", {
      channel: "organic", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/engineering-partners/", "https://agency.example/private/path?email=private%40example.test", {
      channel: "referral", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/engineering-partners/", "", {
      channel: "direct", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/engineering-partners/?utm_source=private-name", "", {
      channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/engineering-partners/?market=uk&market=us", "", {
      channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/engineering-partners/?market=ca", "", {
      channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/engineering-partners/",
    }],
    ["https://digipants.com/private-customer@example.test/", "", {
      channel: "direct", targeted_campaign_market: "unknown", landing_path: "/other",
    }],
  ];

  for (const [url, referrer, expected] of cases) {
    resetBrowser();
    setPage(url, referrer);
    analytics.setAnalyticsConsent("accepted");
    analytics.trackPageView(new URL(url).pathname);
    assert.deepEqual(storedAttribution(), expected);
    assert.doesNotMatch(JSON.stringify([...tabStorage]), /private|example\.test|google\.co\.uk|utm_/);
    assert.doesNotMatch(JSON.stringify(queuedCommands()), /private|example\.test|google\.co\.uk|utm_/);
  }
});

test("late consent and unavailable tab storage use unknown attribution", () => {
  resetBrowser();
  setPage("https://digipants.com/engineering-partners/?utm_source=linkedin&market=uk");
  analytics.setAnalyticsConsent("accepted", false);
  assert.deepEqual(storedAttribution(), {
    channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/other",
  });

  resetBrowser();
  setPage("https://digipants.com/engineering-partners/?utm_source=linkedin&market=uk");
  window.sessionStorage = {
    getItem: () => { throw new Error("storage unavailable"); },
    setItem: () => { throw new Error("storage unavailable"); },
    removeItem: () => { throw new Error("storage unavailable"); },
  };
  analytics.setAnalyticsConsent("accepted");
  analytics.trackContactIntent("main");
  const intent = queuedCommands().find((entry) => entry[0] === "event" && entry[1] === "contact_intent");
  assert.deepEqual(intent[2], {
    cta_location: "main", channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/other",
  });
  resetBrowser();
});

test("attribution stays in the current tab and is not shared through consent storage", () => {
  resetBrowser();
  setPage("https://digipants.com/engineering-partners/?utm_source=linkedin&market=uk");
  analytics.setAnalyticsConsent("accepted");
  const firstTabAttribution = storedAttribution();

  const secondTabStorage = new Map();
  window.sessionStorage = {
    getItem: (key) => secondTabStorage.get(key) ?? null,
    setItem: (key, value) => secondTabStorage.set(key, value),
    removeItem: (key) => secondTabStorage.delete(key),
  };
  setPage("https://digipants.com/contact-us/", "https://digipants.com/engineering-partners/");
  analytics.setAnalyticsConsent("accepted");

  assert.deepEqual(firstTabAttribution, {
    channel: "campaign", targeted_campaign_market: "uk", landing_path: "/engineering-partners/",
  });
  assert.deepEqual(JSON.parse(secondTabStorage.get("digipants.analytics-attribution")), {
    channel: "unknown", targeted_campaign_market: "unknown", landing_path: "/contact-us/",
  });
  assert.equal(storage.has("digipants.analytics-attribution"), false);
});

test("queues one attributed lead only after confirmed API success", async () => {
  resetBrowser();
  analytics.setAnalyticsConsent("accepted");
  const fields = { name: "Private Name", email: "private@example.test", message: "Private message" };

  const success = await submitContactEnquiry(fields, async () =>
    Response.json({ message: "Your enquiry has been submitted." }),
  );
  assert.deepEqual(success, { success: true });
  const lead = queuedCommands().find((entry) => entry[0] === "event" && entry[1] === "generate_lead");
  assert.ok(lead);
  assert.equal(lead.length, 3);
  assert.equal(queuedCommands().filter((entry) => entry[0] === "event" && entry[1] === "generate_lead").length, 1);
  assert.deepEqual(lead[2], {
    channel: "direct", targeted_campaign_market: "unknown", landing_path: "/",
  });
  assert.doesNotMatch(JSON.stringify(queuedCommands()), /Private Name|private@example\.test|Private message/);

  const eventCount = queuedCommands().filter((entry) => entry[0] === "event").length;
  const failure = await submitContactEnquiry(fields, async () =>
    Response.json({ error: "Unable to send." }, { status: 502 }),
  );
  assert.equal(failure.success, false);
  assert.equal(queuedCommands().filter((entry) => entry[0] === "event").length, eventCount);
});
