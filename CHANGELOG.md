# Changelog

## Unreleased


# Changelog

## 3.0.0 (2025-10-05)

### Breaking

- Removed custom populate preset registry: **`populate.presets`**, **`defineSanityMediaPopulatePreset`**, **`resolveEffectivePopulatePreset`**, and per-request **`context.sanityStorage.populatePreset`**. Built-in config presets are only **`default`** and **`full`**.
- Nested reads with an explicit REST/Local **`populate[uploadCollectionSlug]`** field map no longer morph to **`DefaultPopulateAsset`** — the plugin returns the hydrated document after Payload’s select.
- Removed **`locale`** and **`fallbackLocale`** from **`SanityImage`**, **`SanityImageInteractive`**, **`ToSanityImagePropsOptions`**, and **`ResolveAssetAltOptions`** — localized `alt` is resolved at populate time; use **`alt`** / **`fallbackAlt`** props to override.
- Removed **`assetFocalObjectPosition`**, **`populate.defaultPopulateOnRead`**, and exported type **`SanityMediaAsset`**.

### Added

- **`focalObjectPosition`** (`/next` and main entry).
- **`fullPopulate()`** and **`createPopulate({ extend?, exclude? })`** for SDK/REST `populate` on the media collection slug (field tree aligned with plugin `defaultPopulate` / `forceSelect`).
- **`hasExplicitMediaPopulateSelect(req, mediaSlug)`** (advanced / tests).

### Changed

- Populate request flags remain under **`context.sanityStorage`**: **`skipPopulate`**, **`forcePopulate`** (Local API; not serialized by `@payloadcms/sdk` REST).

## 2.0.3

Sanity storage adapter for Payload CMS: cloud uploads, CDN URLs, admin sync UI, reference-integrity guards, SHA-1 upload deduplication, optional webhooks and batch reconcile, populate preset **`default`** (`DefaultPopulateAsset`) for storefront REST, and optional **`/next`** image helpers.
