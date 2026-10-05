# @klnap/payload-storage-sanity

**Payload CMS ↔ Sanity** storage adapter: uploads live on Sanity’s CDN, metadata and sync state live in Payload, and your frontends consume safe, predictable URLs.

The plugin wraps [`@payloadcms/plugin-cloud-storage`](https://github.com/payloadcms/payload/tree/main/packages/plugin-cloud-storage) with a Sanity-specific adapter, admin tooling, reference-integrity guards, optional webhook reconciliation, and an optional **Next.js** entry point for images.

[![npm version](https://img.shields.io/npm/v/@klnap/payload-storage-sanity)](https://www.npmjs.com/package/@klnap/payload-storage-sanity)
[![license](https://img.shields.io/npm/l/@klnap/payload-storage-sanity)](./LICENSE)

---

## Table of contents

- [What you get](#what-you-get)
- [Installation](#installation)
- [Quick start](#quick-start)
- [What the plugin adds to Payload](#what-the-plugin-adds-to-payload)
- [Configuration](#configuration)
- [Prevention, safety, and data integrity](#prevention-safety-and-data-integrity)
- [Populate presets and REST shape](#populate-presets-and-rest-shape)
- [Upstream sync (webhooks and reconcile)](#upstream-sync-webhooks-and-reconcile)
- [Admin UI (`/admin`)](#admin-ui-admin)
- [Security model](#security-model)
- [Package exports and tree-shaking](#package-exports-and-tree-shaking)
- [Next.js (`/next`)](#nextjs-next)
- [Programmatic APIs](#programmatic-apis)
- [License](#license)

---

## What you get

| Area | Summary |
| :--- | :--- |
| **Storage** | Files upload to Sanity (`image` / `file` assets). Payload stores locators and rich metadata, not binary blobs on disk (local storage disabled by default). |
| **CDN URLs** | Public URLs built from `sanity.path` / `sanity.url` via `resolvePublicUrl` — no “guess the CDN URL from `_id`” fallback. |
| **Admin** | Sidebar sync status, hidden `sanity` upstream group, list thumbnails from CDN, **Usage Inspector**, optional localized **alt** group. |
| **Guards** | Block media delete when content still references the row; scan **current** published + draft state (not stale version history). |
| **Sync** | Optional HMAC webhooks + batch reconcile when Sanity changes upstream. |
| **Dedupe** | Optional SHA-1 deduplication reuses an existing Sanity asset for identical bytes. |
| **Document IDs** | Works with Payload **numeric** ids and **`idType: 'uuid'`** (PostgreSQL and others) — retention, sync, reconcile, dedupe, and populate gates all use the same id shape. |
| **Frontend** | Optional `@klnap/payload-storage-sanity/next` — `SanityImage` (RSC-friendly), loaders, flat `DefaultPopulateAsset` for REST. |

---

## Installation

```bash
npm install @klnap/payload-storage-sanity @sanity/client
# or
bun add @klnap/payload-storage-sanity @sanity/client
```

### Peer dependencies

| Package | Version | Required when |
| :--- | :--- | :--- |
| `payload` | `>=3.0.0` | Always |
| `@payloadcms/ui` | `>=3.0.0` | Admin UI features |
| `@sanity/client` | `>=6.0.0` | Always |
| `next` | `>=15.0.0` | Optional — only if you import `@klnap/payload-storage-sanity/next` |
| `react` / `react-dom` | `>=19.0.0` | Admin + Next entry points |

`next` is marked **optional** in `package.json` (`peerDependenciesMeta`). A Payload-only backend never needs to install Next.

---

## Quick start

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
      populate: { preset: 'default' }, // flat assets on REST relations (see below)
      collections: {
        media: true,
      },
      sync: {
        enabled: true,
        webhookSecret: process.env.SANITY_WEBHOOK_SECRET!,
      },
    }),
  ],
})
```

Set `SANITY_PROJECT_ID`, `SANITY_DATASET`, and a **write** token for uploads. Webhook secret is only required when `sync.enabled` is on.

---

## What the plugin adds to Payload

For every slug listed under `collections` that is an **upload** collection, `sanityStorage()` composes cloud storage with extra fields, hooks, endpoints, and admin behaviour.

### Schema and fields (injected)

| Field / group | Purpose |
| :--- | :--- |
| **`name`** | Sidebar label for editors (internal title). |
| **`originalFilename`** | Read-only slugified original name from upload. |
| **`sync`** | Sidebar group: `status`, `checkedAt`, `errorAt` — mirrors upstream health (`available`, `missing`, `deleted`, `error`, …). |
| **`sanity`** | Hidden read-only group: `id`, `rev`, `path`, `url`, `sha1hash`, dimensions metadata, palette, LQIP, EXIF, etc. |
| **`alt`** *(optional)* | Localized **group** (`alt.pl`, `alt.en`, …) when `collections.*.alt.enabled` and Payload `localization` is configured. Skipped if the collection already defines `alt`. |
| **`mediaUsageInspector`** | UI field — auto-injected Usage Inspector panel on the media edit view. |

The adapter also sets **`filename`** to the Sanity asset `_id` after upload (cloud-storage contract).

### Upload collection defaults

Unless you override them on the collection’s `upload` config:

| Setting | Default | Effect |
| :--- | :--- | :--- |
| `disableLocalStorage` | `true` | No duplicate copy on the Payload server disk. |
| `disablePayloadAccessControl` | `true` | Admin and APIs use **direct Sanity CDN URLs** (no Payload file proxy). |
| `hideRemoveFile` | `true` | “Remove file” hidden — lifecycle is tied to Sanity + hooks. |
| `displayPreview` | `true` | Preview in admin. |
| `adminThumbnail` | Sanity CDN thumbnail | List view uses `sanityAdminThumbnail` + `resolvePublicUrl`. |
| `crop` / `focalPoint` | `false` | Opt in on your `Media` collection `upload: { crop, focalPoint }`. |

### Hooks (lifecycle)

| Hook | When | What it does |
| :--- | :--- | :--- |
| **`beforeChange`** (sync metadata) | Create / update | Normalizes `sync`, slugifies `originalFilename`. |
| **`beforeChange`** (persist upstream) | Update | **Metadata-only saves** (alt, name, focal): merges hidden `sanity.*` and file fields from `originalDoc`; clears stale cloud-storage upload context so assets do not “disappear” after save. |
| **`beforeChange`** (dedupe) | Create | SHA-1 hash; reuses existing row / skips duplicate upload when `dedupeUploads` is on. |
| **`afterOperation`** (dedupe) | Create | Deletes duplicate row if dedupe matched an existing asset. |
| **`afterRead`** | Read | `sanitizeMediaDocument` + hydrate root **`url`** / **`thumbnailURL`** (not persisted); optional populate preset shaping. |
| **`afterChange`** (replace) | Update | When `sanity.id` changes after re-upload, deletes **previous** Sanity asset if no other Payload rows reference it. |
| **`beforeDelete`** (reference guard) | Delete | **First** in chain: `findMediaUsage` on live published + draft; throws `400` if still referenced. |
| **`beforeDelete`** (Sanity cleanup) | Delete | Deletes upstream asset only when **no** remaining Payload media rows reference that `sanity.id`. |

Cloud-storage’s own `beforeChange` / `afterChange` still run for real file uploads.

### Collection endpoints

| Route | Description |
| :--- | :--- |
| `GET /api/{media}/:id/usage` | JSON list of documents/globals referencing this media (powers Usage Inspector). |

### Global endpoints (when sync is enabled)

| Route | Default path | Description |
| :--- | :--- | :--- |
| Webhook | `POST /api/sanity/webhook` | Sanity dataset events; HMAC verified. |
| Reconcile | `POST /api/sanity/reconcile` | Authenticated batch drift repair (`dryRun`, `limit`). |

Paths overridable via `sync.webhookPath` / `sync.reconcilePath`.

### Query behaviour

- **`defaultPopulate`** on configured media collections is cleared; the plugin sets **`forceSelect`** so hidden `sanity` fields remain available to hooks even when clients use sparse selects.
- **`afterRead`** is the single place that exposes computed `url` / `thumbnailURL` to admin and API consumers.

---

## Configuration

```typescript
import type { SanityStorageOptions } from '@klnap/payload-storage-sanity'
```

### `SanityStorageOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `projectId` | `string` | — | **Required.** Sanity project ID. |
| `dataset` | `string` | — | **Required.** Target dataset. |
| `token` | `string` | — | Write token for uploads, fetch, reconcile (server-only). |
| `apiVersion` | `string` | `'2024-01-01'` | Sanity API version. |
| `cdnBaseUrl` | `string` | `'https://cdn.sanity.io'` | CDN origin for `resolvePublicUrl` and Next loaders. |
| `enabled` | `boolean` | `true` | `false` disables adapter (fields-only mode with `alwaysInsertFields`). |
| `alwaysInsertFields` | `boolean` | `false` | Inject Sanity fields without full storage adapter. |
| `collections` | `Record<string, true \| SanityStorageCollectionOptions>` | — | **Required.** Upload collection slugs. |
| `populate` | `SanityStoragePopulateConfig` | `{ preset: 'full' }` | Global preset; overridable per collection. |
| `sync` | `SanityStorageSyncConfig` | — | Webhooks + reconcile. |
| `dedupeUploads` | `boolean` | `true` | SHA-1 deduplication on create. |
| `preventDeleteWhenReferenced` | `boolean` | `true` | Reference integrity guard. |
| `extraFields` | `Field[]` | `[]` | Extra fields appended to each configured upload collection. |

### `SanityStorageCollectionOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `alt` | `{ enabled?, required? }` | `enabled: true`, `required: false` | Localized alt group injection. |
| `disableLocalStorage` | `boolean` | `true` | Keep files off local disk. |
| `prefix` | `string` | — | Cloud-storage path prefix segment. |
| `disablePayloadAccessControl` | `boolean` | `true` | Serve from CDN directly in admin. |
| `preventDeleteWhenReferenced` | `boolean` | inherits global | Per-collection delete guard. |
| `populate` | `SanityStoragePopulateConfig` | inherits global | Per-collection populate preset. |

### `SanityStorageSyncConfig`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `false` | Master switch for sync features. |
| `webhookSecret` | `string` | — | HMAC secret (required to register webhook route). |
| `webhookPath` | `string` | `'/sanity/webhook'` | Mounted under `/api`. |
| `webhookCollection` | `string` | first configured slug | Media collection for webhook updates. |
| `onDeleted` | `'mark' \| 'delete'` | `'mark'` | Upstream delete → soft mark vs hard delete Payload row. |
| `reconcile` | `boolean` | `true` | Expose reconcile endpoint when sync enabled. |
| `reconcilePath` | `string` | `'/sanity/reconcile'` | Mounted under `/api`. |
| `reconcileCollection` | `string` | first configured slug | Collection scanned in reconcile. |

### Localized `alt` group

Requires `localization.locales` in Payload config. API shape:

```json
"alt": { "pl": "Opis", "en": "Caption" }
```

```typescript
sanityStorage({
  collections: {
    media: { alt: { enabled: true, required: false } },
  },
})
```

Custom field instead of injection:

```typescript
import { getLocalizationLocales, localizedAltGroupField } from '@klnap/payload-storage-sanity'

localizedAltGroupField(getLocalizationLocales(config), { required: true })
```

---

## Prevention, safety, and data integrity

### Reference integrity (delete guard)

Before a media row is deleted:

1. **`findMediaUsage`** scans **current** documents — published (`draft: false`) and draft (`draft: true`), with `locale: 'all'` when localized — **not** old rows in version history.
2. If anything still references the asset, Payload throws **`400 APIError`** with a human-readable list (collection, title, id).
3. **Published vs draft:** you cannot delete while **live published** content still references the file, even if the draft cleared the field.

Disable globally or per collection with `preventDeleteWhenReferenced: false`.

### Usage Inspector (admin)

Auto-injected on every configured media document:

- **Status** column: Published / Draft.
- **One row** per document + field (published wins over draft when both reference the same asset).
- Links open the **document editor**, not version URLs.

### Metadata-only saves (admin)

Editing **alt**, **name**, focal point, etc. without re-uploading no longer strips hidden **`sanity.path`** / **`url`** or triggers a spurious re-upload from stale request context.

### `afterRead` sanitization

- Unavailable sync (`deleted`, `missing`, `error`) → **`url`** and **`thumbnailURL`** cleared in the response so broken CDN links do not leak to the storefront.
- Available assets → URLs hydrated via **`resolvePublicUrl`** (path-first, optional transforms).

### Sanity asset retention

- **Delete Payload row** → upstream Sanity asset removed only when **no other** media documents share the same `sanity.id`.
- **Replace file on update** → previous Sanity asset deleted after successful upload, with the same reference counting.
- Adapter **`handleDelete`** from cloud-storage is intentionally a no-op; retention runs in **`beforeDelete`** hooks.

### Upload deduplication

When `dedupeUploads: true` (default), identical file bytes reuse an existing media row and skip a second Sanity upload.

---

## Populate presets and REST shape

Built-in presets: **`full`** (entire media document) and **`default`** (flat **`DefaultPopulateAsset`**).

| Context | Preset applied? |
| :--- | :--- |
| REST **relation** populate (nested media on a post/page) | Yes — when `preset: 'default'` |
| Admin (`payloadAPI: 'local'`) | No — always full document for editing |
| Direct `GET /api/media` or `GET /api/media/:id` (numeric, UUID, …) | No — full media API |
| Collection `find` in server code | No |

`DefaultPopulateAsset` fields: `id`, `url`, `width`, `height`, `aspectRatio`, `focalX`, `focalY`, `alt`, `lqip`.

Custom presets:

```typescript
import { defineSanityMediaPopulatePreset } from '@klnap/payload-storage-sanity'

const myPreset = defineSanityMediaPopulatePreset('storefront', ({ doc, locale }) => ({
  id: doc.id,
  url: doc.url,
  alt: resolveLocalizedAlt(doc, locale),
}))
```

Register via `populate.presets` and set `populate.preset` on the plugin or collection.

---

## Upstream sync (webhooks and reconcile)

### Webhooks

Point Sanity at `POST https://your-cms.example.com/api/sanity/webhook`.  
Signature: **`verifySanityWebhookSignature`** (HMAC-SHA256, timestamp tolerance).

On **create/update** upstream: matching Payload rows get metadata patches and `sync.status = 'available'`.  
On **delete** upstream: `onDeleted: 'mark'` (default) sets `deleted` and clears URLs, or `'delete'` removes Payload rows.

### Batch reconcile

`POST /api/sanity/reconcile` (logged-in user required). Body optional: `{ "dryRun": true, "limit": 500 }`.  
Programmatic: **`reconcileSanityMedia`** from the main entry.

---

## Admin UI (`/admin`)

Import **`@klnap/payload-storage-sanity/admin`** only from admin bundles / `importMap` — keeps React and `@payloadcms/ui` out of pure server imports.

| Export | Role |
| :--- | :--- |
| **`MediaUsageInspector`** | Table of inbound references (auto-placed via injected UI field). |
| **`UnavailableAssetRecovery`** | Client banner when sync status is broken; guides replace / unlink. |
| **`MEDIA_USAGE_INSPECTOR_IMPORT`** | String token for custom `admin.components` placement. |

---

## Security model

- **`token`** lives in server config / env — never in collection fields or REST JSON.
- All Sanity writes and fetches run **on the Payload server**.
- Admin UI calls **Payload REST** only; it never receives the Sanity token.
- Public **CDN URLs** are read-only and asset-scoped.

---

## Package exports and tree-shaking

The package is **ESM-only** (`"type": "module"`) with **`"sideEffects": false`**. Bundlers (Webpack, Turbopack, Rollup) can drop unused exports when you use **static imports** and subpath entry points.

### Entry points

| Import path | Load when | Typical use |
| :--- | :--- | :--- |
| `@klnap/payload-storage-sanity` | Payload config, jobs, scripts | `sanityStorage`, hooks, `resolvePublicUrl`, sync helpers, types |
| `@klnap/payload-storage-sanity/admin` | Admin `importMap` / React admin | Usage Inspector, recovery UI |
| `@klnap/payload-storage-sanity/client` | Server utilities | `createSanityClient`, metadata extract constants |
| `@klnap/payload-storage-sanity/next` | Next.js app | `SanityImage`, loaders, `toSanityImageProps` |
| `@klnap/payload-storage-sanity/next/loader` | `next.config` only | Default export for `images.loaderFile` |

### What not to import where

| Mistake | Consequence |
| :--- | :--- |
| `import { MediaUsageInspector } from '@klnap/payload-storage-sanity'` | Won’t work — use `/admin`. |
| `import { SanityImage } from '@klnap/payload-storage-sanity'` | Won’t work — use `/next`. |
| Import `/admin` in a non-React serverless function | Pulls React into a bundle you did not need — use main entry only. |

### Tree-shaking tips

1. **Prefer subpaths** — `import { sanityStorage } from '@klnap/payload-storage-sanity'` does not include Next or admin UI code; those live in separate `dist/` chunks behind `package.json` `exports`.
2. **`next` is optional** — CI that only runs Payload does not need `next` installed if nothing imports `/next`.
3. **`/next/loader`** — Import only from `next.config.ts` (`loaderFile`). Your app pages should import `/next`, not `/next/loader`, so the loader is not duplicated in page bundles.
4. **Types** — `import type { DefaultPopulateAsset } from '…'` erases at compile time and adds zero runtime.
5. **No global side effects** — registering the plugin happens only when you call `sanityStorage()` inside `buildConfig`; importing a utility does not mutate globals.

### Published files

Only `dist/`, `README.md`, `CHANGELOG.md`, and `LICENSE` ship on npm — no raw `src/`.

---

## Next.js (`/next`)

Optional helpers for App Router sites that consume **`DefaultPopulateAsset`** from the Payload REST API (SDK or `fetch` with `depth` + populate).

### `SanityImage` (Server Component)

- **No `'use client'`** on the main export.
- Runs **`toSanityImageProps`** on the server (alt, focal `object-position`, LQIP blur placeholder).
- If the asset/url is missing → renders optional **`fallback`** (server).
- If the image loads → renders a **small client child** (`SanityImageClient`) only for **`next/image` `onError`** (CDN failure).

| Prop | Description |
| :--- | :--- |
| `asset` | `DefaultPopulateAsset \| null` from populated relations. |
| `fallback` | React node when missing or failed load. `fallback={null}` disables fallback for that instance. |
| `locale` / `alt` / `fallbackAlt` | Passed to `resolveAssetAlt`. |
| `fill`, `disableFocal`, `disablePlaceholder` | Layout and LQIP behaviour. |
| … | Other props forwarded to `next/image` (except derived `src`, `width`, etc.). |

**App-wide default (recommended):** thin wrapper — no Provider in the plugin.

```tsx
// lib/sanity-image.tsx
import type { ComponentProps } from 'react'
import { SanityImage as Base } from '@klnap/payload-storage-sanity/next'

const defaultFallback = (
  <div
    className="absolute inset-0 bg-zinc-200/70 backdrop-blur-sm dark:bg-zinc-800/70"
    aria-hidden
  />
)

export function SanityImage({
  fallback = defaultFallback,
  ...props
}: ComponentProps<typeof Base>) {
  return <Base {...props} fallback={fallback} />
}
```

```tsx
<SanityImage asset={hero} sizes="100vw" fill />
<SanityImage asset={hero} fallback={<div className="bg-red-100" />} />
<SanityImage asset={hero} fallback={null} />
```

Use **`className="absolute inset-0 …"`** on fallback when the image uses **`fill`**.

### `SanityImageInteractive` (`'use client'`)

Same as `SanityImage` but supports **`renderFallback={({ reason, asset }) => …}`** when you need different UI for **`missing`** vs **`error`**. Import only from a client module.

### `toSanityImageProps`

Pure function — use in RSC or tests without rendering:

```typescript
import { toSanityImageProps } from '@klnap/payload-storage-sanity/next'

const props = toSanityImageProps(asset, { locale: 'pl', fill: true })
```

### Image loader (`/next` and `/next/loader`)

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './node_modules/@klnap/payload-storage-sanity/dist/next/loader.js',
    // or copy the one-liner from docs into your repo
  },
}
```

- **`createSanityImageLoader({ cdnBaseUrl })`** — custom loader with your CDN host rules.
- **`sanityCdnUrl`**, **`appendSanityCdnParams`** — append `w` / `q` for compatible Sanity CDN hosts.

### Fallback helpers

Exported for custom UI: **`resolveSanityImageFallback`**, **`shouldUseSanityImageFallback`**, types **`SanityImageFallbackReason`**, **`SanityImageFallbackProps`**.

### Next.js tree-shaking

- Import **`@klnap/payload-storage-sanity/next`** only in app code.
- **`SanityImageClient`** is a separate module; pages that never render images do not need to import `/next` at all.
- Keep **`payload.config.ts`** on the main entry — never import `/next` there.

---

## Programmatic APIs

Selected exports from the main entry (see `src/index.ts` for the full list):

| API | Use |
| :--- | :--- |
| `sanityStorage` | Payload plugin factory. |
| `resolvePublicUrl` | CDN URL + optional image transforms. |
| `resolveLocalizedAlt` | `alt[locale]` without cross-locale fallback. |
| `buildSanityImageUrl` | Build URL from ref or populated doc (non-React). |
| `reconcileSanityMedia` | Batch sync in scripts. |
| `verifySanityWebhookSignature` | Custom webhook routes. |
| `handleSanityWebhookEvent` | Reuse webhook logic. |
| `findMediaUsage` *(via endpoint)* | Usage JSON for custom tools. |
| `sanitizeMediaDocument` | Same rules as `afterRead` in custom pipelines. |
| Field helpers | `sanityUpstreamGroup`, `localizedAltGroupField`, … |

Types: **`SanityMediaDocument`**, **`SanityUpstreamFields`**, **`DefaultPopulateAsset`**, **`SanitySyncStatus`**, etc.

---

## License

MIT © [klnap](https://github.com/klnap)
