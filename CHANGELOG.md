# Changelog

All notable changes to `@klnap/payload-storage-sanity` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-09-08

### Added

- Initial public release as `@klnap/payload-storage-sanity`.
- `sanityStorage` — Payload CMS plugin that offloads media uploads to Sanity's global CDN.
- Automatic extraction of `dimensions`, `lqip`, `blurHash`, `thumbHash`, `hasAlpha`, `isOpaque`, `location`, `palette`, and `exif` metadata on upload.
- Upload deduplication via `sha1hash` comparison.
- `buildSanityImageUrl` — CDN URL builder for Sanity image asset references.
- `reconcileSanityMedia` — on-demand drift reconciliation between Payload records and Sanity assets.
- `verifySanityWebhookSignature` — HMAC-SHA256 signature verification for Sanity webhooks.
- `MediaUsageInspector` — admin UI panel showing every Payload document referencing a given media asset (exported via `@klnap/payload-storage-sanity/admin`).
- `UnavailableAssetRecovery` — admin UI panel for recovering or removing broken asset references.
- Webhook endpoint (`POST /api/sanity/webhook`) for real-time upstream reconciliation.
- Reconcile endpoint (`POST /api/sanity/reconcile`) for batch drift repair.
- Soft-delete mode (`onDeleted: 'mark'`) that marks assets as `deleted`, clears `url`, and preserves referential integrity.
- `afterRead` safety filter that prevents broken or deleted asset URLs from leaking to frontend APIs.
- PostgreSQL adapter compatibility.
