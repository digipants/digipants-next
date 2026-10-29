# Validation evidence — Issue #63

Baseline: `main` at `672eef62830a3454d07f0e989dc5d55100772ece`. Synthetic fixtures only. UI simulation with no secure live decisions.

## Results

- `node --test tests/client-workspace.test.mjs`: 16 passed.
- `node --test tests/*.test.mjs`: 38 passed (22 existing + 16 new).
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including Next lint/type checks. Existing Browserslist data-age notice remains; no dependency updates made.
- `git diff --check`: passed.
- Chromium visual review: 320, 375, 768 and 1440 CSS pixels, light/dark, no horizontal overflow. Reviewed all captures; narrow screens stack content, desktop uses two columns.
- Browser interactions passed: explicit confirmation/cancel, native Escape/focus restoration, Tab wrapping, required change reason/error focus, safe text rendering, decline/change results, failure/retry, duplicate confirmation, stale version, accepted → Awaiting kickoff checks, expired/superseded disabled actions, four illustration states. No browser JS errors or external requests observed.
- Production `next start` on loopback returned 404 for `/client-workspace/`, `/prototypes/client-workspace/` and `/app.mjs`; no prototype entry in production route manifests. Preview refuses production NODE_ENV, rejects foreign Host (403), and denies non-allowlisted `/preview.mjs` (404).
- Diff confirmed no changes to existing app/public routes, contact API/form, Resend, analytics, Capability Core, configuration or package manifests/lockfile. Next-generated `next-env.d.ts` changes were restored.

## Reproduce

From repository root, start `node prototypes/client-workspace/preview.mjs`. For the optional browser harness, use a development environment that already supplies Playwright and Chromium; run `node prototypes/client-workspace/browser-check.cjs` (Chromium expected at `/usr/bin/chromium`). Playwright is not added to repository dependencies or production. Harness writes these evidence files; screenshots are static documentation outside public/.

## Screenshot index

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Light](320-light.png) | [Dark](320-dark.png) |
| 375 | [Light](375-light.png) | [Dark](375-dark.png) |
| 768 | [Light](768-light.png) | [Dark](768-dark.png) |
| 1440 | [Light](1440-light.png) | [Dark](1440-dark.png) |

Mobile interaction captures: [accepted](375-accepted.png), [validation modal](375-validation.png), [retry error](375-error.png), [expired](375-expired.png), [superseded](375-superseded.png), [loading](375-loading.png), [empty](375-empty.png), [invalid](375-invalid.png), [access denied](375-access-denied.png).

## Limits

Chromium checks and visual inspection are not a WCAG certification or assistive-technology audit. Safari/Firefox and real-device/screen-reader checks remain. Host/CSP/reducer guards are local demonstration boundaries, not authentication or secure concurrency. No server persistence, tenant authorization, atomic audit, real contracting, payments or live decisions exist. Do not expose the preview server through a public proxy. See the design contract for mandatory controls before any client pilot.
