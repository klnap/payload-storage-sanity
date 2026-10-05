# Changelog

All notable changes to `@klnap/payload-storage-sanity` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.3] — 2026-10-05

### Fixed

- Default populate no longer applies to REST document routes with non-numeric IDs (e.g. UUID `idType`), which broke the Payload admin media form after saving metadata (empty upload until refresh).
- Retention, webhook sync, reconcile, dedupe, and `findAllMediaBySanityAssetId` now support Payload document IDs as **numbers or strings** (e.g. `idType: 'uuid'`), not only numeric ids.

### Added

- Exported **`isPayloadDocumentId`**, **`payloadDocumentIdsEqual`**, and **`PayloadDocumentId`** for hosts.

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
