# Analytics measurement integrity (no new events)

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
