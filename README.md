# @klnap/payload-storage-sanity

Payload CMS storage adapter and sync engine that offloads media uploads to Sanity CDN, with real-time upstream webhook reconciliation, deduplication, and reference integrity enforcement.

[![npm version](https://img.shields.io/npm/v/@klnap/payload-storage-sanity)](https://www.npmjs.com/package/@klnap/payload-storage-sanity)
[![license](https://img.shields.io/npm/l/@klnap/payload-storage-sanity)](./LICENSE)

---

## Features

- **Sanity CDN storage** — Every Payload upload is stored in Sanity and served from the global CDN.
- **Rich metadata extraction** — Automatically extracts `dimensions`, `lqip`, `blurHash`, `thumbHash`, `hasAlpha`, `isOpaque`, `location`, EXIF, and colour `palette` on upload.
- **Upload deduplication** — Prevents duplicate assets via `sha1hash` comparison before writing to Sanity.
- **Real-time webhook reconciliation** — HMAC-SHA256 verified `POST /api/sanity/webhook` endpoint keeps Payload records in sync when assets are modified or deleted upstream.
- **Batch reconciliation** — `POST /api/sanity/reconcile` scans all media rows against Sanity's API and heals any drift.
- **Soft-delete safety** — `onDeleted: 'mark'` marks deleted assets as unavailable and clears the URL without dropping Payload rows or breaking relationship fields.
- **Reference integrity guard** — Blocks media deletion when other documents still reference the row; throws a `400 APIError` listing every referencing document.
- **`afterRead` safety filter** — Sanitizes sync state and hydrates root `url` / `thumbnailURL` via `resolvePublicUrl` (dataset path-first; no legacy `_id` CDN URLs).
- **Populate presets** — `full` (unchanged document) and `default` (flat `DefaultPopulateAsset` on **REST** populated relations only; admin uses `payloadAPI: 'local'` and always gets full docs). Plugin sets `defaultPopulate: undefined` and `forceSelect` for the hidden `sanity` group.
- **Next.js helpers** — Optional `@klnap/payload-storage-sanity/next` with `SanityImage` and CDN loader utilities.
- **`MediaUsageInspector`** — Admin UI panel listing every collection document that references a media asset.
- **`UnavailableAssetRecovery`** — Admin UI banner component for recovering or unlinking unavailable assets.

---

## Installation

```bash
npm install @klnap/payload-storage-sanity @sanity/client
# or
bun add @klnap/payload-storage-sanity @sanity/client
```

### Peer Dependencies

| Package | Required version |
| :--- | :--- |
| `payload` | `>=3.0.0` |
| `@payloadcms/ui` | `>=3.0.0` |
| `@sanity/client` | `>=6.0.0` |
| `next` | `>=15.0.0` |
| `react` | `>=19.0.0` |
| `react-dom` | `>=19.0.0` |

---

## Quick Start

```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN,
      collections: {
        media: true,
      },
    }),
  ],
})
```

---

## Full Config Options

```typescript
import type { SanityStorageOptions } from '@klnap/payload-storage-sanity'
```

### `SanityStorageOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `projectId` | `string` | — | **Required.** Sanity project identifier. |
| `dataset` | `string` | — | **Required.** Target dataset (e.g. `'production'`). |
| `token` | `string` | `undefined` | Write-authorised Sanity API token for uploads and sync operations. |
| `apiVersion` | `string` | `'2024-01-01'` | Sanity API version date tag for deterministic request payloads. |
| `cdnBaseUrl` | `string` | `'https://cdn.sanity.io'` | Custom CDN base URL override. |
| `enabled` | `boolean` | `true` | Set to `false` to disable the plugin entirely (useful for local dev without Sanity credentials). |
| `alwaysInsertFields` | `boolean` | `false` | Insert Sanity storage fields even on collections not listed in `collections`. |
| `collections` | `Record<string, true \| SanityStorageCollectionOptions>` | — | **Required.** Collection slugs to enable storage on. |
| `sync` | `SanityStorageSyncConfig` | `undefined` | Webhook and reconciliation configuration. |
| `dedupeUploads` | `boolean` | `false` | Enable `sha1hash` deduplication; re-uses the existing Sanity asset when a duplicate is uploaded. |
| `preventDeleteWhenReferenced` | `boolean` | `true` | Blocks deletion of media rows still referenced by other collections. Set to `false` to allow deletion. |
| `extraFields` | `Field[]` | `[]` | Extra Payload fields appended to every configured upload collection. |
| `populate` | `{ preset?: 'full' \| 'default', presets?: … }` | `{ preset: 'full' }` | **`default`** returns `DefaultPopulateAsset` on REST relation reads; admin + direct `GET /api/{media}` stay full. |

### `SanityStorageCollectionOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `alt` | `{ enabled?: boolean; required?: boolean }` | `enabled: true`, `required: false` | Injects an `alt` **group** with one text field per `config.localization` locale. Set `enabled: false` to disable. Set `required: true` to require every locale subfield. Skipped if the collection already has a field named `alt`. Applies to `collections: { media: true }` shorthand too. |
| `disableLocalStorage` | `boolean` | `true` | Prevents Payload from writing the file to local disk in addition to Sanity. |
| `prefix` | `string` | `undefined` | Path prefix for assets within the Sanity dataset. |
| `disablePayloadAccessControl` | `boolean` | `false` | Bypasses Payload's cookie-based access check for direct public CDN reads. |
| `preventDeleteWhenReferenced` | `boolean` | `true` | Overrides reference integrity blocking for this specific collection. |

### `SanityStorageSyncConfig`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `false` | Activate real-time webhook sync. |
| `webhookSecret` | `string` | `undefined` | Shared secret for HMAC-SHA256 verification of incoming Sanity webhook events. |
| `webhookPath` | `string` | `undefined` | Custom webhook endpoint path override. |
| `webhookCollection` | `string` | `undefined` | Collection slug to listen for webhook events on. |
| `onDeleted` | `'mark' \| 'delete'` | `'mark'` | `'mark'` soft-deletes the Payload row; `'delete'` hard-deletes it. |
| `reconcile` | `boolean` | `true` | Expose the batch reconcile endpoint. |
| `reconcilePath` | `string` | `undefined` | Custom reconcile path override. |
| `reconcileCollection` | `string` | `undefined` | Scope reconciliation to a specific collection. |

### Localized alt group

Enabled by default on every configured upload collection (including `media: true`). Disable or tighten validation:

```typescript
sanityStorage({
  collections: {
    media: {
      alt: { enabled: true, required: false }, // default
    },
    // media: { alt: { enabled: false } },
    // media: { alt: { required: true } },
  },
})
```

Requires `localization.locales` in your Payload config. API shape:

```json
"alt": { "pl": "Opis", "en": "Caption" }
```

To define your own `alt` field instead, set `alt: { enabled: false }` or use the exported helper in the collection:

```typescript
import { getLocalizationLocales, localizedAltGroupField } from '@klnap/payload-storage-sanity'

localizedAltGroupField(getLocalizationLocales(payload.config), { required: true })
```

Custom populate presets receive `locale` on the `shape` context. Built-in `default` uses `doc.url` (after hydrate) and `resolveLocalizedAlt` for `alt[locale]` only — no cross-locale fallback. Use `resolvePublicUrl(doc, { cdnBaseUrl })` when you need transforms or stricter URL rules.

---

## Security Model

### Why the frontend proxy — and why no Sanity credentials in the Payload schema

Sanity API tokens grant write access to your entire dataset. Storing them in Payload collection fields or exposing them via REST responses would:

1. **Leak write credentials** to any client that can read the collection (public APIs, logged-out users with misconfigured access control, GraphQL introspection).
2. **Bypass Payload's access control** — a raw Sanity token is usable directly against the Sanity API without Payload knowing.

Instead, this plugin uses a **server-side proxy model**:

- The `token` option lives only on the server (read from environment variables via `process.env`, never hardcoded in source control).
- All Sanity API calls — uploads, metadata fetches, reconciliation — are made **from the Payload server**, never from browser code.
- The admin UI (`MediaUsageInspector`, `UnavailableAssetRecovery`) communicates with Payload's REST API, which enforces your normal collection access rules. It never receives or forwards the Sanity token.
- Public CDN URLs (`https://cdn.sanity.io/...`) are read-only and asset-scoped — they cannot be used to enumerate the dataset or write assets.

**Summary:** Sanity credentials stay server-side. The browser only ever sees CDN URLs and Payload API responses.

---

## Reference Integrity Guard

The plugin registers a `beforeDelete` hook on every configured upload collection. Before any media row is deleted, the hook:

1. Scans **current** published and draft document state (`draft: false` / `draft: true`, `locale: 'all'` when localized)—not stale rows in version history—so outdated published versions do not block deletion. The **Usage Inspector** shows **one row per document+field** (published wins over draft when both reference the asset).
2. If **any** matching document still references the row, the hook throws a `400 APIError` listing every referencing document by collection and ID.
3. The delete is aborted — Payload rolls back.

This prevents orphaned `upload` relationship fields across your content graph.

### What the error looks like

```
Cannot delete media asset — it is still referenced by:
  • posts › "My Blog Post" (id: 64a1f...)
  • pages › "Home" (id: 7bc3e...)
Remove or replace these references before deleting the asset.
```

### Disabling the guard

The guard runs automatically by default (`preventDeleteWhenReferenced: true`). If you wish to allow deletions even when assets are still referenced, disable it globally or per collection:

```typescript
sanityStorage({
  // Globally disable reference integrity checks:
  preventDeleteWhenReferenced: false,

  // Or configure per collection:
  collections: {
    media: {
      preventDeleteWhenReferenced: false,
    },
  },
})
```

---

## Admin UI Components

### `MediaUsageInspector`

A React Server Component (RSC) that lists every document across all collections that currently references the media asset.

> **Zero configuration required!** The plugin **automatically injects** this panel directly under every configured media asset view in the admin panel. You do not need to add any fields to your collection config.

If you ever need to manually place the inspector in a custom location (such as a specific tab):

```typescript
import { MEDIA_USAGE_INSPECTOR_IMPORT } from '@klnap/payload-storage-sanity/admin'
// Or direct string: '@klnap/payload-storage-sanity/admin#MediaUsageInspector'
```

> **Why `/admin`?** Admin UI components are isolated in the `@klnap/payload-storage-sanity/admin` subpath to ensure React and `@payloadcms/ui` dependencies never leak into backend-only builds or server runtimes.

### `UnavailableAssetRecovery`

A client-side banner component for recovering or removing broken asset references when upstream Sanity assets have been deleted or are otherwise unavailable.

---

## Upstream Synchronisation

### Webhooks

Configure a Sanity webhook pointing at `POST https://your-cms.example.com/api/sanity/webhook`.
Every event is verified via HMAC-SHA256 against `sync.webhookSecret` before processing.

### Batch Reconciliation

Call `POST /api/sanity/reconcile` (authenticated) to scan all media rows against Sanity's API
and repair any drift — useful after bulk Sanity operations or dataset imports.

### Deletion Behaviour

| `onDeleted` | Behaviour |
| :--- | :--- |
| `'mark'` *(default)* | Sets `sync.status = 'deleted'`, clears `url = null`. Row is preserved; relationship fields in other documents remain intact. |
| `'delete'` | Hard-deletes the Payload media row. **Note:** this bypasses the reference integrity guard — use with care. |


---

## Exports

| Entry point | Contents |
| :--- | :--- |
| `@klnap/payload-storage-sanity` | `sanityStorage` plugin, `reconcileSanityMedia`, `verifySanityWebhookSignature`, field helpers, sync utilities, types |
| `@klnap/payload-storage-sanity/admin` | Admin UI components (`MediaUsageInspector`, `UnavailableAssetRecovery`), `MEDIA_USAGE_INSPECTOR_IMPORT` |
| `@klnap/payload-storage-sanity/client` | Client factory utilities (`createSanityClient`, `SANITY_IMAGE_METADATA_EXTRACT`) |

---

## License

MIT © [klnap](https://github.com/klnap)
