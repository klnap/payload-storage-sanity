# Changelog

## 0.1.0

Initial release of `@klnap/payload-storage-sanity`.

### Features

- Payload plugin storing media on **Sanity** with **`sanity.asset`** JSON persistence.
- Admin edit view: **Asset | Metadata | References** tabs; optional sync in the sidebar.
- Optional webhooks and batch **reconcile** for upstream drift.
- SHA-1 upload deduplication (opt-in), reference integrity on delete, upload rollback on failed Payload saves.
- Populate presets **`default`** and **`full`**; optional `@klnap/payload-storage-sanity/next` for storefront images.
- Plugin-managed upload collections use **`upload.imageSizes: []`** — resized delivery via Sanity CDN.

### Changed

- Automatically discover upload collections without another storage adapter; `collections` now optionally selects explicit slugs.
- Configure logical `sanity-plugin-media` folder paths per collection with `collections.<slug>.folder` (default `Payload`). Existing shared assets keep their folder. Export folder helpers from `/folders` for standalone uploaders.
- **`dedupeUploads` defaults to `false`**. Set **`dedupeUploads: true`** on `sanityStorage()` to enable SHA-1 duplicate-upload protection (409 on create).
