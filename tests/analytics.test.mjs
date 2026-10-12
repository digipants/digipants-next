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
const scripts = [];
const cookieWrites = [];

globalThis.window = {
  location: {
    hostname: "digipants.com",
    origin: "https://digipants.com",
    protocol: "https:",
    pathname: "/",
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
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
  scripts.length = 0;
  cookieWrites.length = 0;
  window.dataLayer = undefined;
  window.gtag = undefined;
  window.location.pathname = "/";
}

function queuedCommands() {
  return (window.dataLayer ?? []).map((entry) => Array.from(entry));
}

test("does not initialize GA4 before consent", () => {
  resetBrowser();

  analytics.trackPageView("/services/");

  assert.equal(window.dataLayer, undefined);
  assert.equal(scripts.length, 0);
  assert.equal(window["ga-disable-" + analytics.ANALYTICS_MEASUREMENT_ID], true);
});

test("queues documented gtag arguments and emits one clean page view after acceptance", () => {
  resetBrowser();

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
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${analytics.ANALYTICS_MEASUREMENT_ID}`);
});

test("rejecting or clearing consent prevents later events and clears only scoped GA cookies", () => {
  resetBrowser();
  analytics.setAnalyticsConsent("accepted");
  analytics.trackPageView("/");
  const eventCount = queuedCommands().filter((entry) => entry[0] === "event").length;

  analytics.setAnalyticsConsent("rejected");
  analytics.trackPageView("/work/");
  analytics.clearAnalyticsConsent(); // Same action used by the cross-tab storage-clear handler.
  analytics.trackPageView("/contact-us/");

  assert.equal(queuedCommands().filter((entry) => entry[0] === "event").length, eventCount);
  assert.equal(window["ga-disable-" + analytics.ANALYTICS_MEASUREMENT_ID], true);
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga=")));
  assert.ok(cookieWrites.some((value) => value.startsWith("_ga_RGELLSWQWR=")));
  assert.ok(cookieWrites.every((value) => /^_(?:ga|ga_RGELLSWQWR)=/.test(value)));
});

test("queues a parameter-free lead only after confirmed API success", async () => {
  resetBrowser();
  analytics.setAnalyticsConsent("accepted");
  const fields = { name: "Private Name", email: "private@example.test", message: "Private message" };

  const success = await submitContactEnquiry(fields, async () =>
    Response.json({ message: "Your enquiry has been submitted." }),
  );
  assert.deepEqual(success, { success: true });
  const lead = queuedCommands().find((entry) => entry[0] === "event" && entry[1] === "generate_lead");
  assert.ok(lead);
  assert.equal(lead.length, 2);
  assert.doesNotMatch(JSON.stringify(queuedCommands()), /Private Name|private@example\.test|Private message/);

  const eventCount = queuedCommands().filter((entry) => entry[0] === "event").length;
  const failure = await submitContactEnquiry(fields, async () =>
    Response.json({ error: "Unable to send." }, { status: 502 }),
  );
  assert.equal(failure.success, false);
  assert.equal(queuedCommands().filter((entry) => entry[0] === "event").length, eventCount);
});
