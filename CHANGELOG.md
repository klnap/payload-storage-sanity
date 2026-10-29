# Changelog

## Unreleased

### Changed

- **`dedupeUploads` defaults to `false`**. Set **`dedupeUploads: true`** on `sanityStorage()` to enable SHA-1 duplicate-upload protection (409 on create).

## 1.0.0 (2026-10-08)

Initial release of `@klnap/payload-storage-sanity`.

### Features

- Payload plugin storing media on **Sanity** with **`sanity.asset`** JSON persistence.
- Admin edit view: **Asset | Metadata | References** tabs; optional sync in the sidebar.
- Optional webhooks and batch **reconcile** for upstream drift.
- SHA-1 upload deduplication (opt-in), reference integrity on delete, upload rollback on failed Payload saves.
- Populate presets **`default`** and **`full`**; optional `@klnap/payload-storage-sanity/next` for storefront images.
- Plugin-managed upload collections use **`upload.imageSizes: []`** — resized delivery via Sanity CDN.
