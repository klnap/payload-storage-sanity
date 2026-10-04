# Changelog

All notable changes to `@klnap/payload-storage-sanity` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.2] — 2026-10-05

npm releases **2.0.0** and **2.0.1** were unpublished (those version numbers cannot be reused on the registry). Use **`@klnap/payload-storage-sanity@2.0.2`** as the current 2.x line.

### Breaking

- Sanity upstream fields live under the **`sanity` group** only (`sanity.id`, `sanity.path`, `sanity.url`, …). Flat `sanity_id` and duplicate root metadata fields are removed.
- Public URLs are built with **`resolvePublicUrl`** from `sanity.path` / `sanity.url` (no `_id`-based CDN fallback). Custom **`cdnBaseUrl`** must mirror Sanity path prefixes (`images/…`, `files/…`).
- **`defaultPopulate`** on configured media collections is cleared; the plugin sets **`forceSelect`** so hidden `sanity` fields remain available to hooks.

### Added

- Populate presets **`full`** and **`default`** with **`DefaultPopulateAsset`** on REST populated relations; admin and direct `GET /api/media` stay full. Custom presets via **`defineSanityMediaPopulatePreset`** and **`shouldApplyDefaultPopulate`**.
- Localized **`alt`** group opt-in on upload collections (`collections.media.alt`). **`resolveLocalizedAlt`** uses `alt[locale]` only (no cross-locale fallback).
- **`@klnap/payload-storage-sanity/next`** — `SanityImage` (RSC + `fallback` JSX prop), `SanityImageInteractive` (`renderFallback`), `toSanityImageProps`, `sanityImageLoader`, and default `./next/loader`.
- README: full Payload plugin behaviour, prevention guards, tree-shaking, and `/next` usage.
- **`resolvePublicUrl`**, **`classifySanityAssetType`**, **`defaultPopulateMediaDoc`**, **`resolveAdminLabel`**.
- Root **`url`** / **`thumbnailURL`** hydrated on read (not persisted from hooks).

### Fixed

- **Media delete guard** and **Usage Inspector** use current published + draft document reads (`locale: 'all'` when localized), not stale version-history rows—so publishing without the asset no longer leaves a false “Published” reference.
- Draft-only reference removal no longer allows delete while **live published** still references the media.
- **Metadata-only media saves** (alt, name, focal, etc.) preserve hidden `sanity` upstream fields and file metadata; prevents cloud-storage from re-uploading on stale request context so assets no longer “disappear” in admin after save.
- **`sync` status** is not reset to `available` on partial admin updates when the asset was marked deleted or unavailable.

### Changed

- Usage table: **Status** column (Published/Draft), one row per document+field, links go to the document editor (not version URLs).

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
