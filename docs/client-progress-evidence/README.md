# Issue #66 — validation and visual evidence

Baseline `main`: `690c69c60aa7a0d5dababf352a71f796bbb16fb8`, after prerequisite PR #65 merged. UI simulation only; no secure client actions or real engineering integration.

## Results

- Targeted: `node --test tests/client-progress.test.mjs` — **51 passed**.
- Full suite: `node --test tests/*.test.mjs` — **89 passed**, including the original 70 tests.
- `npx tsc --noEmit` and `npx tsc -p prototypes/client-progress/tsconfig.json` — passed; prototype uses strict TypeScript independently of production's include paths.
- `npm run build` — passed, including Next lint/type validation. Existing Browserslist age notice remains; no dependency changes.
- `git diff --check` — passed.
- Chromium browser harness — all 16 scenarios passed. All scenarios checked for overflow at 320/375/768/1440px; active view captured in light/dark at each width. Seventeen screenshots reviewed visually.
- Keyboard checks: skip link, Enter to open artifact, Tab/Shift+Tab containment, Escape/native focus restoration, close-button focus, polite no-decision feedback. Scenario selector and appearance checkbox have accessible labels. Error alert/retry and no-data views verified.
- Privacy checks: HTML/embedded JSON/client JavaScript contain no internal fixture sentinels; denied/loading/error responses contain only their view kind. No GitHub navigation, JS errors or external browser requests. Raw fixture/model/server requests return 404; foreign Host returns 403. Unknown artifact destinations excluded.
- Production `next start` returned **404** at `/client-progress/`, `/prototypes/client-progress/` and `/client.js`. No prototype paths in `.next/server/app-paths-manifest.json` or `.next/routes-manifest.json`. `NODE_ENV=production node prototypes/client-progress/preview.mjs` refuses startup as expected.
- Diff against baseline confirms no existing production routes, app/components/lib/public, contact/Resend, analytics, Capability Core, proposal prototype, package manifests, lockfile or production config changed. Build-generated `next-env.d.ts` changes restored.

## Publication-integrity correction (PR #67 review)

Approval now binds exact overview/milestone/update/deliverable content and mapping/review metadata. Unapproved overview edits return the existing neutral error view; edited individual records are hidden until explicitly approved again. Nineteen additional regression tests cover post-publication changes, missing/reused tokens, update text/timestamps, dependency/acceptance mutations and explicit approval of exact new revisions. Existing acceptance/reconnect tests now explicitly simulate approval when testing an intentionally changed record; reconnect alone is denied and never republishes drafts.

All 16 valid client fixture projections were compared with the pre-fix PR head and match exactly. The browser harness was rerun, including all responsive/keyboard/privacy checks; UI sources and screenshots are unchanged. Exact-content tokens are fixture-only revision bindings, not signatures, authentication or protection against an actor authorized to modify the fixture's approval metadata.

## Reproduce

Start `node prototypes/client-progress/preview.mjs` from repository root. Optional browser evidence command: `node prototypes/client-progress/browser-check.cjs`, using environment-supplied Playwright and Chromium at `/usr/bin/chromium`. No browser dependency was added to the repository. The loopback server compiles existing TypeScript in memory and serves document projections, client JS and CSS only.

## Screenshots

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Light](320-light.png) | [Dark](320-dark.png) |
| 375 | [Light](375-light.png) | [Dark](375-dark.png) |
| 768 | [Light](768-light.png) | [Dark](768-dark.png) |
| 1440 | [Light](1440-light.png) | [Dark](1440-dark.png) |

Additional mobile views: [artifact dialog](375-artifact.png), [awaiting client](375-awaiting-client.png), [blocked/delayed](375-blocked-delayed.png), [paused](375-paused.png), [no activity](375-no-activity.png), [stale source](375-stale.png), [accepted milestone](375-accepted.png), [error](375-error.png), [access denied](375-access-denied.png).

## Limits and remaining risks

Chromium-only checks; no Safari/Firefox, physical-device or actual screen-reader audit. Semantic/keyboard checks are not WCAG certification. Projection tests model field separation and explicit approval metadata; they do not enforce real staff authority, redact unsafe prose authored in a supposedly safe field, or implement server authorization/tenancy. No real publication, client acceptance, persistence, atomic audit, source sync or payments exist. The local-only server must never be publicly proxied. All times/statuses/approvals are synthetic and cannot be used as commitments.
