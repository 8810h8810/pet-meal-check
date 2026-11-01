# QA PREVIEW ONLY — NEVER MERGE INTO MAIN

This branch is an isolated public test fixture, not a production release. Google Analytics, Firebase/family sharing, product fetching, external images and affiliate navigation are disabled. Only synthetic local records may be entered. The original production analytics host gate remains unchanged.

Release A uses the previous v1 analytics consent code; release B uses the v2 re-consent draft. The same QA origin can exercise an explicit service-worker update and retain synthetic local records. The separate measurement fixture uses mock dependencies, not Google Analytics.

The record/save/reset and update-button code is retained behind a fail-closed QA sharing adapter. SW cache names, static asset allowlists and manifest identity are QA-specific. No real PWA/browser test is claimed until separately performed.

Legacy duplicate HTML/manifest files and the production sitemap are absent from this QA branch. Existing `rakuten-worker/` source/configuration is preserved byte-for-byte solely as repository history; it must not be deployed or modified. No account configuration changes are part of this branch.
