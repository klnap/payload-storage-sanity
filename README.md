# @klnap/payload-storage-sanity

**Payload CMS ↔ Sanity** storage adapter: uploads live on Sanity’s CDN, metadata and sync state live in Payload, and your frontends consume safe, predictable URLs.

The plugin wraps [`@payloadcms/plugin-cloud-storage`](https://github.com/payloadcms/payload/tree/main/packages/plugin-cloud-storage) with a Sanity-specific adapter, admin tooling, reference-integrity guards, optional webhook reconciliation, and an optional **`/next` entry** with image helpers for storefront apps.

[![npm version](https://img.shields.io/npm/v/@klnap/payload-storage-sanity)](https://www.npmjs.com/package/@klnap/payload-storage-sanity)
[![license](https://img.shields.io/npm/l/@klnap/payload-storage-sanity)](./LICENSE)

---

## Table of contents

- [What you get](#what-you-get)
- [Installation](#installation)
- [Quick start](#quick-start)
- [What the plugin adds to Payload](#what-the-plugin-adds-to-payload)
- [Configuration](#configuration)
- [Document IDs](#document-ids)
- [Prevention, safety, and data integrity](#prevention-safety-and-data-integrity)
- [Populate presets and REST shape](#populate-presets-and-rest-shape)
- [Upstream sync (webhooks and reconcile)](#upstream-sync-webhooks-and-reconcile)
- [Admin UI (`/admin`)](#admin-ui-admin)
- [Security model](#security-model)
- [Package exports and tree-shaking](#package-exports-and-tree-shaking)
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
| **Document IDs** | Works with Payload **numeric** ids and **`idType: 'uuid'`** (PostgreSQL and others) — retention, sync, reconcile, dedupe, and populate gates all use the same id shape. See [Document IDs](#document-ids). |
| **Consumers** | Optional [`@klnap/payload-storage-sanity/next`](https://github.com/klnap/payload-storage-sanity/blob/main/docs/consumers.md) — `SanityImage`, `createSanityImage`, **`DefaultPopulateAsset`** from REST populate. |

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
      token: process.env.SANITY_API_TOKEN!,
      // nested REST populate uses preset `default` (flat DTO) — see Populate presets
      collections: {
        media: true,
      },
      sync: {
        enabled: true,
        webhook: { secret: process.env.SANITY_WEBHOOK_SECRET! },
      },
    }),
  ],
})
```

**Required:** `projectId`, `dataset`, and a **write** `token` when **`mode: 'full'`** (default) or **`sync.enabled`**. With **`sync.enabled`**, also **`sync.webhook.secret`**.

Invalid plugin options throw at config time: missing **`projectId`** / **`dataset`**, **`mode: 'full'`** or **`sync.enabled`** without **`token`**, or **`sync.enabled`** without **`sync.webhook.secret`**.

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
| `disablePayloadAccessControl` | `true` | Admin and APIs use **direct Sanity CDN URLs** (no Payload file proxy). See [Security model](#security-model). |
| `hideRemoveFile` | `true` | “Remove file” hidden — lifecycle is tied to Sanity + hooks. |
| `displayPreview` | `true` | Preview in admin. |
| `adminThumbnail` | Sanity CDN thumbnail | List view uses `sanityAdminThumbnail` + `resolvePublicUrl`. |
| `crop` / `focalPoint` | `false` | Opt in on your `Media` collection `upload: { crop, focalPoint }`. |

### Hooks (lifecycle)

| Hook | When | What it does |
| :--- | :--- | :--- |
| **`beforeChange`** (sync metadata) | Create / update | Normalizes `sync`, slugifies `originalFilename`. |
| **`beforeChange`** (persist upstream) | Update | **Metadata-only saves** (alt, name, focal): merges hidden `sanity.*` and file fields from `originalDoc`; clears stale cloud-storage upload context; sets **`skipCloudStorage`** so alt-only saves never call Sanity `assets.upload`. |
| **`beforeChange`** (max size) | Create / update with bytes | Per-kind limits when `uploadMaxSize` is set. The plugin raises Payload **`upload.limits.fileSize`** to the **maximum** across all configured limits (global multipart cap for the whole app, not only Sanity media). |
| **`beforeChange`** (dedupe) | Create | SHA-1 hash; reuses existing row / skips duplicate upload when `dedupeUploads` is on. |
| **`afterOperation`** (dedupe) | Create | If dedupe matched an existing row: deletes the **new** duplicate DB row and **returns the existing document** (use the `id` from the create response). |
| **`afterRead`** | Read | `sanitizeMediaDocument` + hydrate root **`url`** / **`thumbnailURL`** (not persisted); optional populate preset shaping. |
| **`afterChange`** (replace) | Update | When `sanity.id` changes after re-upload, deletes **previous** Sanity asset if no other Payload rows reference it. |
| **`beforeDelete`** (reference guard) | Delete | **First** in chain: `findMediaUsage` on live published + draft; throws `400` if still referenced. |
| **`beforeDelete`** (Sanity cleanup) | Delete | Deletes upstream asset only when **no** remaining Payload media rows reference that `sanity.id`. |

Cloud-storage’s own `beforeChange` / `afterChange` still run for real file uploads.

### Collection endpoints

| Route | Description |
| :--- | :--- |
| `GET /api/{media}/:id/usage` | JSON list of references (Usage Inspector). Requires a logged-in user with **read** access to that media document. |

### Global endpoints (when sync is enabled)

| Route | Default path | Description |
| :--- | :--- | :--- |
| Webhook | `POST /api/sanity-storage/webhook` | Sanity dataset events; HMAC verified. |
| Reconcile | `POST /api/sanity-storage/reconcile` | Batch drift repair (`dryRun`, `limit`). **`sync.access`** (default: Payload **admin** auth collection only, usually `users`). |

Default routes use **`sync.basePath`** (`'/sanity-storage'`). Override a single route with `sync.webhook.path` / `sync.reconcile.path`, or change both via `sync.basePath`. Set `sync.reconcile: false` to disable batch reconcile.

### Query behaviour

- For preset **`default`**, **`defaultPopulate`** on media collections selects fields needed for **`DefaultPopulateAsset`** when parents use sparse selects (`image: true`). **`forceSelect`** still merges hidden `sanity` fields for hooks.
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
| `token` | `string` | — | Write token for uploads, fetch, reconcile (server-only). **Required** when `mode: 'full'` or `sync.enabled`. |
| `apiVersion` | `string` | `'2026-01-01'` | Sanity API version. |
| `cdnBaseUrl` | `string` | `'https://cdn.sanity.io'` | CDN origin for `resolvePublicUrl` and Next loaders. |
| `mode` | `'full' \| 'fields-only' \| 'off'` | `'full'` | See [Storage mode](#storage-mode) below. |
| `collections` | `Record<string, true \| SanityStorageCollectionOptions>` | — | **Required.** Upload collection slugs. |
| `populate` | `SanityStoragePopulateConfig` | `{ preset: 'default' }` | Preset for nested relations (REST + Local API by default). `localPopulate: false` keeps full media on server `find`. Use `full` for entire media documents on relations. |
| `sync` | `SanityStorageSyncConfig` | — | Webhooks + reconcile. |
| `dedupeUploads` | `boolean` | `true` | SHA-1 deduplication on create. |
| `preventDeleteWhenReferenced` | `boolean` | `true` | Reference integrity guard. |
| `uploadMaxSize` | `number \| SanityStorageUploadMaxSizeConfig` | — | Max upload size in **bytes** (`default` + optional `byType`). A bare number sets `default` only. |
| `extraFields` | `Field[]` | `[]` | Extra fields appended to each configured upload collection. |
| `admin` | `SanityStorageAdminOptions` | — | Default admin UX for configured upload collections (overridable per collection). |

### `SanityStorageAdminOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `uploadBusyShield` | `boolean` | `true` | While a media Save/upload request is in flight: neutral **“Uploading…”** toast, field area non-interactive (preview stays visible). Success uses Payload’s normal admin toast only — no extra success toast from the plugin. |
| `usageInspector` | `boolean` | `true` | Inject the Usage Inspector UI field on media edit views. |

### `SanityStorageCollectionOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `SanityStorageAdminOptions` | inherits plugin | Per-collection admin UX overrides. |
| `alt` | `{ enabled?, required?, fallbackLocale? }` | `enabled: true`, `required: false` | Localized **group** when `localization.locales` exist; plain **`alt` text** field otherwise. `fallbackLocale` drives populate when the request locale has no value. |
| `disableLocalStorage` | `boolean` | `true` | Keep files off local disk. |
| `prefix` | `string` | — | Cloud-storage path prefix segment. |
| `disablePayloadAccessControl` | `boolean` | `true` | Direct CDN URLs in admin/API (not a confidentiality control — see Security). |
| `preventDeleteWhenReferenced` | `boolean` | inherits global | Per-collection delete guard. |
| `populate` | `SanityStoragePopulateConfig` | inherits global | Per-collection populate preset. |
| `uploadMaxSize` | `number \| SanityStorageUploadMaxSizeConfig` | — | Overrides plugin `uploadMaxSize` for this collection (deep-merge `byType`). |

### `SanityStorageUploadMaxSizeConfig`

All values are **bytes**. You may pass a **number** shorthand (equivalent to `{ default: number }`).

| Field | Role |
| :--- | :--- |
| **`default`** | Limit for every upload kind that has no entry in `byType`. |
| **`byType`** | Optional map: **`image`**, **`video`**, **`file`**. Each entry **overrides** `default` for that kind (stricter or looser). Classification: image MIME/extensions, video MIME/common extensions, else **`file`**. |

Import **`MB`** from the main entry (`25 * MB`). Plugin and collection configs are merged: collection **`default`** wins over the plugin; **`byType`** is **deep-merged** (collection `byType.file` does not remove plugin `byType.image`). The plugin raises **`upload.limits.fileSize`** to the **largest** limit across all merged configs and never lowers a larger limit already set on **`upload`** or **`bodyParser.limits.fileSize`** (Payload merges both into busboy; the plugin only writes **`upload`**). `beforeChange` still enforces the **per-kind** cap when bytes are present.

```typescript
import { MB, sanityStorage } from '@klnap/payload-storage-sanity'

sanityStorage({
  // ...
  uploadMaxSize: {
    default: 25 * MB,
    byType: {
      image: 10 * MB,
      video: 100 * MB,
      file: 5 * MB,
    },
  },
  collections: {
    media: {
      uploadMaxSize: {
        byType: { file: 2 * MB }, // overrides plugin `byType.file` (5 * MB); plugin `byType.image` (10 * MB) still applies
      },
    },
  },
})
```

Validation runs in `beforeChange` when a new file is present (create or replace); metadata-only saves are unchanged.

### Storage mode

| Mode | Cloud-storage plugin | Sanity adapter / uploads | Dedupe + Sanity delete / replace hooks | Plugin fields, `afterRead`, usage endpoint, `uploadMaxSize`, sync routes |
| :--- | :--- | :--- | :--- | :--- |
| **`full`** (default) | enabled | yes | yes | yes |
| **`fields-only`** | enabled with **`alwaysInsertFields`** (injects cloud-storage field layout; **no** Sanity adapter / no uploads via Payload) | no | no | yes |
| **`off`** | disabled | no | no | yes (your collection must define any `sanity` / upload fields you still need) |

Use **`fields-only`** when another process uploads to Sanity but you want Payload metadata, populate, and sync. Use **`off`** only when cloud-storage must not register on those collections at all. In **`fields-only`** and **`full`**, **`afterRead`** still runs **`sanitizeMediaDocument`** (unavailable upstream assets get **`url`** / **`thumbnailURL`** cleared in API responses, same as in **`full`**).

### `SanityStorageSyncConfig`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `enabled` | `boolean` | `false` | Master switch for sync features. |
| `basePath` | `string` | `'/sanity-storage'` | Prefix for webhook + reconcile routes under `/api`. |
| `webhook` | `{ secret, path?, collection? }` | — | Registers webhook route when `secret` is set. |
| `reconcile` | `{ path?, collection? } \| false` | reconcile on | Batch reconcile endpoint; `false` disables it. |
| `onDeleted` | `'mark' \| 'delete'` | `'mark'` | Upstream delete → soft mark vs hard delete Payload row. |
| `access` | `({ req }) => boolean` | admin auth collection | Who may call **`POST /api/sanity-storage/reconcile`** (default path). |

```typescript
sync: {
  enabled: true,
  basePath: '/sanity-storage',
  webhook: {
    secret: process.env.SANITY_WEBHOOK_SECRET!,
    collection: 'media',
  },
  reconcile: { collection: 'media' },
  // reconcile: false,
  onDeleted: 'mark',
}
```

### `alt` field injection

When `collections.*.alt.enabled` (default **true**):

- With **`localization.locales`**: injects a localized **group** (`alt.pl`, `alt.en`, …).
- Without localization: injects a single **`alt`** text field.

Optional **`alt.fallbackLocale`** applies during populate when the request locale has no value in the group.

Localized API shape:

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

Editing **alt**, **name**, focal point, etc. without re-uploading no longer strips hidden **`sanity.path`** / **`url`** or triggers a spurious re-upload from stale request context. **Alt-only saves never upload to Sanity** (no new bytes → cloud-storage is skipped).

### Crop / focal (admin)

Enable Payload’s native **`upload.crop`** and **`upload.focalPoint`** on your media collection (see harness `Media.ts`). Crop and focal saves send **`uploadEdits`** and re-process the image (fetch → Sharp → new bytes). The plugin treats that as a real re-upload: it does **not** set `skipCloudStorage`, does **not** merge stale `sanity.*` / `width` / `height` from `originalDoc`, and passes through the cloud-storage metadata patch after Sanity `assets.upload`. Top-level **`url`** and dimensions are persisted on upload so Payload can fetch the correct CDN file for the next crop (no thumbnail transforms). An **`afterChange`** hook re-hydrates **`url`** / **`thumbnailURL`** on the PATCH response (Payload runs `afterRead` before cloud-storage finishes, which would otherwise leave a stale admin preview until refresh).

### Shared media row vs new upload

Many articles can point at the **same** Payload media document. **Replacing the file on that row** keeps the same document `id`, so every article with that relation gets the new CDN URL after the next read or populate (watch front-end cache / ISR). **Metadata-only edits** stay in Payload only; Sanity asset bytes are unchanged. **New media row** or changing which media an article references only affects documents you wire up manually.

### Admin list and edit preview

Upload collections use Payload’s **native** upload preview and **filename** list column. The plugin only sets **`adminThumbnail`** (CDN URL from `url` / `sanity.path`) and leaves **`displayPreview`** enabled unless you override it in collection `upload`.

### `afterRead` sanitization

- Unavailable sync (`deleted`, `missing`, `error`) → **`url`** and **`thumbnailURL`** cleared in the response so broken CDN links do not leak to the storefront.
- Available assets → URLs hydrated via **`resolvePublicUrl`** (path-first, optional transforms).

### Sanity asset retention

- **Delete Payload row** → upstream Sanity asset removed only when **no other** media documents share the same `sanity.id`.
- **Replace file on update** → previous Sanity asset deleted after successful upload, with the same reference counting.
- Adapter **`handleDelete`** from cloud-storage is intentionally a no-op; retention runs in **`beforeDelete`** hooks.
- **Failed upload persist** (`mode: 'full'` only) → when Sanity `assets.upload` succeeds but Payload fails before the request finishes (metadata patch, replace cleanup, or response hydrate), the plugin deletes **only** the Sanity asset ids uploaded on that same request (`req.context`). This is not a global Sanity janitor — assets created outside Payload or in other requests are never touched.

### Upload deduplication

When `dedupeUploads: true` (default), identical file bytes on **create**:

1. **`beforeChange`** finds an existing row with the same SHA-1, sets **`skipCloudStorage`**, and records the existing document id in request context.
2. Payload may still insert a short-lived duplicate row for the duration of the operation.
3. **`afterOperation`** deletes that duplicate row and **returns the existing media document** from the create API (same **`id`** as the canonical asset). Treat the response body as the source of truth for `id`; no second Sanity upload runs.

If the process crashes **after** Payload inserts the duplicate row but **before** `afterOperation` runs, an extra media row can remain (same **`sanity.id`** and **`sanity.sha1hash`** as the canonical row). Batch reconcile reports these as **`duplicates`**; remove them manually when you are sure which row is canonical.

---

## Document IDs

Payload **numeric** ids and **`idType: 'uuid'`** (database adapter option) both work — dedupe, usage, sync, reconcile, and **`DefaultPopulateAsset.id`** follow the same id shape. Turning on **`idType: 'uuid'`** on a database that already has numeric ids requires a **migration** (PostgreSQL will reject in-place `ALTER COLUMN … TYPE uuid` until you backfill or recreate tables).

```typescript
// payload.config.ts — Postgres + UUID example
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  db: postgresAdapter({
    idType: 'uuid',
    pool: { connectionString: process.env.DATABASE_URL },
  }),
  collections: [{ slug: 'media', upload: true }],
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
      collections: { media: true },
    }),
  ],
})
```

---

## Populate presets and REST shape

Built-in presets: **`default`** (flat **`DefaultPopulateAsset`** on nested relations — **plugin default**) and **`full`** (entire media document, explicit opt-in).

| Context | Preset applied? |
| :--- | :--- |
| REST **relation** populate (nested media on a post/page/global) | Yes — **`preset: 'default'`** (or custom preset) |
| Local API **`find` / `findGlobal`** with `depth` (Next.js `getPayload`, SDK) | Yes — same DTO when **`populate.localPopulate`** is not disabled (default **on**) |
| Direct `GET /api/media/:id` (REST or local — admin editor) | No — full media document |
| Authenticated REST/Local reads (logged-in admin editing any doc with upload relations) | No — full media document |
| `GET /api/media` collection list | No |
| Preset **`full`** or **`populate.localPopulate: false`** on Local API | No — full document |

`DefaultPopulateAsset` fields: `id`, `url`, `width`, `height`, `aspectRatio`, `focalX`, `focalY`, **`alt`** (`string | null` when empty for the request locale), `lqip`.

Use the **same `locale`** on REST/SDK requests as in your UI when resolving alt — not on **`SanityImage`** (`asset.alt` is already a string). Optional **`collections.media.alt.fallbackLocale`** applies when the request locale has no value in the localized group.

Nested groups (e.g. `socialMedia.image.asset`) need **`depth ≥ 2`**. Top-level upload relations usually need **`depth ≥ 1`** and `select: { image: true }` (Payload uses the media collection **`defaultPopulate`** select automatically).

### Storefront query cookbook (SDK / REST)

Use **`@payloadcms/sdk`** (or Local API) with **`populate`** on the **upload collection slug** (e.g. `media`). Do **not** rely on `context` for storefront — the official SDK does not serialize `context` on REST.

**Flat default** — shallow relation; plugin morphs to `DefaultPopulateAsset` for `SanityImage`:

```typescript
const page = await sdk.findGlobal({
  slug: 'home-page',
  depth: 1,
  locale: 'pl',
  select: { image: true },
})
```

**Manual field select** — native Payload `populate`; plugin hydrates but **does not** morph:

```typescript
const page = await sdk.find({
  collection: 'posts',
  depth: 1,
  select: { heroImage: true },
  populate: {
    media: {
      filename: true,
      focalX: true,
      sanity: { path: true, metadata: { dimensions: true } },
    },
  },
})
```

**Full media (helper)** — same mechanism as manual select; baseline fields stay aligned with plugin hooks:

```typescript
import { fullPopulate, createPopulate } from '@klnap/payload-storage-sanity'

const page = await sdk.findGlobal({
  slug: 'home-page',
  depth: 1,
  locale: 'pl',
  select: { image: true },
  populate: { media: fullPopulate() },
})

// Project aliases (partial, card, …)
export const partialPopulate = createPopulate({ exclude: ['sync', 'mimeType', 'sizes'] })
populate: { media: partialPopulate({ extend: { credit: true } }) }
```

**Why `fullPopulate`?** Shallow `select: { image: true }` triggers morph to `DefaultPopulateAsset`. A richer shape requires an explicit `populate[mediaCollectionSlug]` object — Payload has no separate “full mode” flag. The helper keeps that field tree in sync with `defaultPopulate` / `forceSelect` inside the plugin.

**Always full on every relation** — config only: `sanityStorage({ populate: { preset: 'full' } })`.

### Request context (`sanityStorage`, Local API)

Per-request flags under **`context.sanityStorage`** apply to **Local API** (`getPayload`, server components calling `payload.find`). They are not sent by `@payloadcms/sdk` over REST.

| Flag | Effect |
| :--- | :--- |
| `skipPopulate` | Skip morph; return hydrated full media document. |
| `forcePopulate` | Force morph on nested reads; **does not** bypass authenticated admin (`req.user`). |

---

## Upstream sync (webhooks and reconcile)

### Webhooks

Point Sanity at `POST https://your-cms.example.com/api/sanity-storage/webhook` (or your `sync.basePath` + `/webhook`).  
Signature: **`verifySanityWebhookSignature`** (HMAC-SHA256, timestamp tolerance).

Respond with **2xx quickly** and treat handlers as **idempotent** — Sanity retries webhook delivery on failure or slow responses.

On **create/update** upstream: matching Payload rows get metadata patches and `sync.status = 'available'`.  
On **delete** upstream: `onDeleted: 'mark'` (default) sets `deleted` and clears URLs, or `'delete'` removes Payload rows.

### Batch reconcile

`POST /api/sanity-storage/reconcile`. Body optional: `{ "dryRun": true, "limit": 500 }`.  
HTTP JSON summary: `{ dryRun, scanned, updated, duplicates }` or, when `dryRun: true`, `{ dryRun, scanned, wouldUpdate, duplicates }` (`duplicates` = dedupe orphan rows sharing **`sanity.id`** + **`sanity.sha1hash`** with an older row; reported only, not auto-deleted).  
Default **`sync.access`**: only users from Payload’s admin auth collection (`config.admin.user`, usually **`users`**). Not every logged-in collection (e.g. `customers`) unless you allow it explicitly.  
Programmatic: **`reconcileSanityMedia`** returns the full **`ReconcileReport`** (pass your own access rules in scripts).

---

## Admin UI (`/admin`)

Import **`@klnap/payload-storage-sanity/admin`** only from admin bundles / `importMap` — keeps React and `@payloadcms/ui` out of pure server imports.

| Export | Role |
| :--- | :--- |
| **`MediaUsageInspector`** | Table of inbound references (auto-placed via injected UI field). |
| **`MediaUploadBusyShield`** | Client hook for `admin.uploadBusyShield` — “Uploading…” toast during Save/upload (on by default). |
| **`UnavailableAssetRecovery`** | Client banner when sync status is broken; guides replace / unlink. |
| **`MEDIA_USAGE_INSPECTOR_IMPORT`** | String token for custom `admin.components` placement. |
| **`MEDIA_UPLOAD_BUSY_SHIELD_IMPORT`** | Import map path for the busy shield (registered automatically when `uploadBusyShield` is on). |

### Upload busy shield

On by default for configured upload collections. Disable per plugin or collection:

```typescript
sanityStorage({
  // ...
  admin: { uploadBusyShield: false },
  collections: { media: true },
})
```

Before Save you can pick a file, edit **alt**, and save once. During the request the plugin shows a single neutral **“Uploading…”** toast (no banner). When the request finishes, that toast is dismissed and Payload shows its usual success message. User-facing copy does not name the storage provider.

Regenerate the admin **import map** after upgrading if you use `uploadBusyShield` (`payload generate:importmap` or your project’s equivalent).

---

## Security model

- **`token`** lives in server config / env — never in collection fields or REST JSON.
- All Sanity writes and fetches run **on the Payload server**.
- Admin UI calls **Payload REST** only; it never receives the Sanity token.
- **`disablePayloadAccessControl`** defaults to **`true`**: admin and APIs expose **direct Sanity CDN URLs**. Anyone with the URL can fetch the bytes; Payload collection **read** rules do **not** gate CDN access. That is appropriate for most storefronts (public product images) but not for confidential files — use private storage, signed URLs, or keep files behind Payload’s proxy (`disablePayloadAccessControl: false`) and understand the trade-offs.
- Public **CDN URLs** are read-only and asset-scoped when using the default CDN model.

---

## Package exports and tree-shaking

The package is **ESM-only** (`"type": "module"`) with **`"sideEffects": false`**. Bundlers (Webpack, Turbopack, Rollup) can drop unused exports when you use **static imports** and subpath entry points.

### Entry points

| Import path | Load when | Typical use |
| :--- | :--- | :--- |
| `@klnap/payload-storage-sanity` | Payload config, jobs, scripts | `sanityStorage`, hooks, `resolvePublicUrl`, sync helpers, types |
| `@klnap/payload-storage-sanity/admin` | Admin `importMap` / React admin | Usage Inspector, recovery UI |
| `@klnap/payload-storage-sanity/client` | Server utilities | `createSanityClient`, metadata extract constants |
| `@klnap/payload-storage-sanity/next` | Storefront / Next.js app | `SanityImage`, loaders, `toSanityImageProps` |
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

`dist/`, `docs/`, `README.md`, `CHANGELOG.md`, and `LICENSE` ship on npm — no raw `src/`. Storefront integration is in **[docs/consumers.md](https://github.com/klnap/payload-storage-sanity/blob/main/docs/consumers.md)**.

---

## Programmatic APIs

Selected exports from the main entry (see `src/index.ts` for the full list):

| API | Use |
| :--- | :--- |
| `sanityStorage` | Payload plugin factory. |
| `resolvePublicUrl` | CDN URL + optional image transforms. |
| `resolveLocalizedAlt` | Plain or localized `alt`; optional `fallbackLocale`. |
| `MB`, `uploadMaxSize` helpers | `mergeUploadMaxSizeConfig`, `computeMaxUploadByteLimit`, … |
| `defaultSanitySyncAccess` | Default `sync.access` for reconcile. |
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
