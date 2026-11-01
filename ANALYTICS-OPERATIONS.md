# Analytics consent v2 and minimal saved-record metrics

Release candidate based on main `335c08b35d69f2afa2ddce42a747c9d5657a530f`, with service-worker cache `pet-meal-pwa-v15-consent-v2`. The user authorized production publication on 2026-11-01. This file documents behavior and verification boundaries; deployment success must be verified separately for the exact merged commit. No QA runtime adapters, fixtures, network-blocking overlays, or QA cache names belong in production.

## Behavior and privacy boundary

- A valid v1 grant is never imported into v2. Its removal notifies already-open v1 tabs through their existing storage listener. A new refusal also writes the v1 denial key. Valid previous refusals remain refused; v2 permission never grants v1.
- No Google tag or consent ping is loaded before valid explicit v2 permission. The exact production-origin/app-route gate and separately persisted operator exclusion remain in place. Preview and privacy pages load no tag.
- Failed refusal writes fall back to deleting only analytics consent keys. Complete storage failure cannot guarantee persistence after reopening; the UI warns accordingly. Read-only consent storage cannot reactivate a stale grant. No feeding/sharing storage keys are cleared.
- `record_saved` follows successful local false-to-true persistence, at most once per document. `record_return_saved` is a subset when the browser previously saved on an earlier local calendar day and opened this document on a later day. These are qualified browser visits, not people, meals or completed family synchronization.
- The only new custom-event parameter is `app_kind: dog|cat`. No check content, weekday/time slot, pet name, text, invitation, sharing/Firebase ID, authentication token, record timestamp, or new user identifier crosses the no-argument hook. GA itself handles pseudonymous cookie IDs and connection/time metadata: this is not fully anonymous.
- Local history stores only `{lastSavedDay}` per dog/cat app, used for at most 180 days while consent is valid. It is deleted on expiry checking, refusal or operator exclusion. The date is not transmitted; old feeding records are not read or backfilled.
- The public campaign tuple registry is **empty**. It must remain empty until specific non-personal tuples are selected. Arbitrary UTM values never become campaign payloads. Known tracking query parameters are removed before Google code loads; unknown application queries or fragments stop measurement rather than breaking those URLs. Referrer is reduced to its origin; the configured page title is fixed.
- Existing page-view configuration is retained; `send_page_view: false` is **not** set. Configured clean page URL/referrer apply to GA, while the two new custom-event calls carry only `app_kind`. Do not describe this as disabling all GA automatic measurement.
- Records, family-sharing transports and identities, PWA update interaction, artwork, manifests, affiliate links, Firebase/Worker code and account settings are unchanged.

## Offline local checks

```sh
node tests/analytics-consent.test.cjs
BASELINE_REF=5322cb49ef8d3187f9edd7f302ed156b9fe2ebbf node tests/i18n.test.cjs
node tests/shared-sync.test.cjs
node tests/pwa-release.test.cjs
node tests/usage-browser.test.cjs --check-routing
git diff --check
```

The original 30 cases remain, with consent-v2 fixture updates. The four unit/model suites total 66 cases before any subsequent regression additions. They use DOM doubles, in-memory caches and simulated Firebase responses, not live Google/Firebase. The browser-routing-only check does not launch a browser. `tests/usage-browser.test.cjs` is an isolated test harness, not a page-loaded production fixture: every request is locally fulfilled/stubbed/aborted, and service workers are disabled for that isolated suite.

## Verification completed separately

An isolated public QA branch, never to be merged into main, exercised the old exact v1 analytics source and the then-current v2 candidate with deliberately disabled external integrations. Real cloud Chromium A-to-B service-worker update retained dummy records, rejected old permission, and populated the new 36-asset QA cache. Refusal/withdrawal, reset cancellation/confirmation and dog/cat separation were checked. A separate browser simulation passed 14 cases. A later review fix keeps the local last-save date current after subsequent successful saves in a long-open document while still emitting at most once; its regression test brings the local total to 67. That small history-maintenance fix was not rerun through the public browser fixture. These findings do not establish real Firebase sharing, live GA delivery or production-cache behavior on iPhone.

## Remaining verification limits and operating rules

- Real network-off reload and installed iPhone/Safari PWA behavior remain unverified. Managed DevTools and local browser socket restrictions were not bypassed. Cache/model passes are not claimed as offline-device tests.
- Current GA enhanced-measurement, auto-tagging and cross-domain settings are not proved by repository code. These settings can cause automatic events beyond the two app-defined events. Review their existing configuration read-only where available; do not silently change it or claim full-request anonymity. GA delivery and a complete network trace remain unverified.
- Keep UTM registration empty and never decorate invitation URLs. Any real GA-delivery test needs its own approved destination/scope; do not manufacture production records, Firebase writes or affiliate engagement.
- Before merging, review the exact production diff, run local checks, verify required CI/mergeability and production main has not moved. Do not approve a PR on the user's behalf or bypass protected-branch rules.
- After merge, verify the exact GitHub Pages deployment, then do read-only smoke in an operator-excluded browser, without enabling analytics or modifying records/sharing. Preserve the distinction between deployment success and untested integration behavior.
- Do not roll back to an old consent implementation that re-enables stale grants. If a release fails, report the observed failure before choosing a safe rollback. Preserve refusal/disable semantics and stored app records; advance the cache version for any later coherent fix.

---

## Previously deployed v14: measurement integrity (no new events in that release)

Google Analytics property and consent behavior are unchanged. This release adds no custom events or fields, and does not send meal contents, sharing identifiers, invitations, or operator preferences to Google.

## Exclude your own browser before checking the app

After this release is deployed, open either:

- Dog: https://8810h8810.github.io/pet-meal-check/?wm_internal=1
- Cat: https://8810h8810.github.io/pet-meal-check/cat/?wm_internal=1

This stores only `pet-meal-analytics-internal-v1=1` in this browser. It excludes all four app routes on this origin, including later visits without the parameter. Analytics remains off even if consent was previously granted. The settings status explains the exclusion. Other open tabs stop analytics when the preference changes. Repeat for each browser/profile/device; this does not retroactively remove old visits. Private browsing, cleared storage, and separate installed-app storage may require setting the preference again. Never append this parameter to public promotional links or invitation links.

To remove only this exclusion, visit the same route with `?wm_internal=0`. This does **not** grant, extend, or change analytics consent. Existing valid consent is still required. Leave operator browsers excluded during normal checks.

Only HTTPS origin `https://8810h8810.github.io` and these exact paths may load the Google tag: `/pet-meal-check/`, `/pet-meal-check/cat/`, `/pet-meal-check/en/dog/`, `/pet-meal-check/en/cat/`, and their `index.html` equivalents. Localhost, previews, other origins, privacy pages, and unrelated paths never load the tag, even with saved consent. Storage failures fail closed. Query strings and fragments remain excluded from GA page URLs; UTM attribution is not introduced by this patch.

## Offline verification

```sh
node tests/analytics-consent.test.cjs
BASELINE_REF=5322cb49ef8d3187f9edd7f302ed156b9fe2ebbf node tests/i18n.test.cjs
node tests/shared-sync.test.cjs
git diff --check
```

These use DOM doubles and simulated Firebase responses, with no live Google/Firebase requests or affiliate interaction. `BASELINE_REF` lets a fresh clone compare unchanged images/manifests/backend files/affiliate URLs against the actual pre-patch main commit; the previous local-only baseline remains the default for existing workflows. Tests do not establish real-browser GA delivery or iPhone behavior.

## Release / rollback (requires release authorization)

Merge the reviewed PR into main only after authorization, then verify the GitHub Pages deployment for that exact commit. The cache advances to `pet-meal-pwa-v14-internal-exclusion` so installed copies can use their existing “new version” update button. Before this new version is active, the old installed copy does not understand the exclusion parameter: keep analytics declined, update/reload, then open the operator URL. No app records or sharing localStorage keys are changed; cache cleanup only affects old `pet-meal-pwa-` caches.

Verification after release should use source/deployment checks and an excluded operator browser, without clicking affiliate links or generating artificial engagement. No paid service, new credentials, or hosting changes are needed. To roll back, revert the PR and advance the cache version again so installed copies receive a coherent release; do not delete meal or sharing storage.
