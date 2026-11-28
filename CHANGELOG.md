# Changelog

## 0.4.0

### Minor Changes

- bdebe74: Add media-type classification, per-type upload limits, and Sanity folder routing.
- 66e6595: Add the versioned HTTP upload transport protocol with durable claims and core-owned finalization.

## 0.3.4

### Patch Changes

- 25fbdc9: Release workflow only: remove an unused PostgreSQL service container. The integration check provisions the same pinned image as CI. No runtime change.

## 0.3.3

### Patch Changes

- 0827568: Test infrastructure only: integration tests fail when PostgreSQL is unavailable, refuse production-looking database hosts, and remove their test container on success, failure, and interruption. No runtime change.

## 0.3.2

### Patch Changes

- f1fc660: Shorten the README and move storage, media admin, reference, and asset lifecycle details into dedicated documentation with verified screenshots. Documentation only; no runtime change.

## 0.3.1

### Patch Changes

- 8fb595b: Harden populate and path handling flagged by CodeQL. Populate `extend` ignores `__proto__` keys and reads only own properties, so it can no longer change the returned object's prototype. Populate `exclude` traverses only own properties, so it cannot delete members of `Object.prototype`. Slash trimming for CDN origins, sync base paths, and media folder paths now runs in linear time instead of using quadratic regular expressions. No public API changes.

## 0.3.0

### Minor Changes

- 7fc83a4: Breaking (pre-1.0): rename `DefaultPopulateAsset` to `MediaAsset` without a compatibility alias. Replace the image-specific media type with `MediaAsset`, and remove the public narrowing guards. Re-export the canonical type from the Next.js consumer entry; `SanityImage` accepts `MediaAsset` directly and validates runtime values.

  Fix `cdnBaseUrl` handling: it is now the origin that serves Sanity assets in place of `https://cdn.sanity.io`. `buildSanityImageUrl()`, `createSanityImageLoader()`, and `SanityImage` move Sanity URLs to that origin, and they apply image transformations to URLs already on that origin.

  Fix the media detail preview so the replace and edit controls sit in their own row and never overlap the image, including very wide panoramas. The image keeps its aspect ratio inside the padded area.

## 0.2.2

### Patch Changes

- 4302f7b: Derive blurred Sanity thumbnails when image records have no stored LQIP.

## 0.2.1

### Fixed

- Export all admin components referenced by Payload's import map from `/admin`.
- Check admin import-map paths against public exports during `bun run build`.

## 0.2.0

### Breaking

- Move frontend consumer utilities to `/consumers` and Next.js integrations to `/consumers/next`; remove the superseded root and `/next` exports.

### Added

- Add framework-independent asset contracts and image URL utilities, with tree-shaking and dependency-isolation checks.

## 0.1.0

Initial release of `@klnap/payload-storage-sanity`.

### Features

- Payload plugin storing media on **Sanity** with **`sanity.asset`** JSON persistence.
- Admin edit view: **Asset | Metadata | References** tabs; optional sync in the sidebar.
- Optional webhooks and batch **reconcile** for upstream drift.
- SHA-1 upload deduplication (opt-in), reference integrity on delete, upload rollback on failed Payload saves.
- Populate presets **`default`** and **`full`**; optional `@klnap/payload-storage-sanity/consumers/next` for storefront images.
- Plugin-managed upload collections use **`upload.imageSizes: []`** — resized delivery via Sanity CDN.

### Changed

- Automatically discover upload collections without another storage adapter; `collections` now optionally selects explicit slugs.
- Configure logical `sanity-plugin-media` folder paths per collection with `collections.<slug>.folder` (default `Payload`). Existing shared assets keep their folder. Export folder helpers from `/folders` for standalone uploaders.
- **`dedupeUploads` defaults to `false`**. Set **`dedupeUploads: true`** on `sanityStorage()` to enable SHA-1 duplicate-upload protection (409 on create).
