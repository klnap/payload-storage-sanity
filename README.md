# @klnap/payload-storage-sanity

Payload CMS plugin that stores **media files on Sanity** (assets and CDN) while keeping editorial metadata, references, and sync state in Payload. Uploads go through Payload media collections; bytes live on Sanity; public URLs come from persisted asset metadata (`resolvePublicUrl`, populate DTOs). Replacing a file creates a new Sanity asset, so **URLs change** — plan caching and front-end refreshes accordingly.

Sanity **Studio** is optional. You need a Sanity **project**, **dataset**, and API **token** with write access when uploading (`mode: 'full'`).

## Requirements

| Requirement | Version |
| :--- | :--- |
| Node | `^24.0.0` |
| Bun | `>=1.4.0` (package scripts; Payload apps may use Node only) |
| Payload | `3.90.2` (exact peer) |
| `@sanity/client` | `>=6.0.0` |
| React | `^19.0.0` (admin and `/next`) |
| Next.js | `>=15.0.0` (optional — `@klnap/payload-storage-sanity/next` only) |

Package `exports` target `dist/*.js` with matching `.d.ts`. Supported runtimes: Payload server, Next.js, Bun, and other bundlers that resolve extensionless relative imports in dependencies. Raw Node ESM without a bundler is not supported.

Host dependencies:

| Package | When |
| :--- | :--- |
| `payload`, `@payloadcms/ui`, `@payloadcms/translations` | Always for admin features |
| `next` | Only if you import `@klnap/payload-storage-sanity/next` |
| `react`, `react-dom` | Admin UI and `/next` |

## Quick start

```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
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

Required: `projectId`, `dataset`, and a **write** `token` when `mode: 'full'` (default). Invalid options throw when you call `sanityStorage()`.

Optional upstream sync (webhooks + reconcile):

```typescript
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: { media: true },
  sync: {
    enabled: true,
    webhook: { secret: process.env.SANITY_WEBHOOK_SECRET! },
  },
})
```

When `sync.enabled` is true, `sync.webhook.secret` is required.

**Admin styling:** import `@klnap/payload-storage-sanity/styles/admin-tailwind.css` once in your Payload admin stylesheet entry.

## How it works

```text
Payload media collection (upload, alt, references)
        ↓
@klnap/payload-storage-sanity (adapter, hooks, fields, sync, populate)
        ↓
Sanity asset (image/file) + API metadata
        ↓
Sanity CDN (public delivery URL)
        ↓
Storefront / Next.js (resolvePublicUrl, optional /next components)
```

For each upload collection slug in `collections`, the plugin composes cloud storage, extra fields, hooks, endpoints, and admin UI. Local Payload disk storage is disabled by default.

## Configuration

| Option | Purpose |
| :--- | :--- |
| `projectId`, `dataset` | Sanity project targeting |
| `token` | Write API token (`mode: 'full'` and sync) |
| `collections` | Map of upload collection slugs → `true` or per-collection overrides |
| `mode` | `'full'` (upload to Sanity) or `'metadata'` (read-only / external assets) |
| `sync` | Webhook + batch reconcile when Sanity changes upstream |
| `dedupeUploads` | Default `false`; set `true` to block duplicate SHA-1 creates with `409` |
| `populate` | REST populate presets (`default`, `full`) for nested media |
| `uploadMaxSize` | Byte limits per media kind (see `MB` helper) |

Upload max size merges with Payload’s global upload limits via `applyPayloadUploadFileSizeLimit`.

## Package exports

| Subpath | Use |
| :--- | :--- |
| `@klnap/payload-storage-sanity` | `sanityStorage`, CDN helpers, sync, types |
| `@klnap/payload-storage-sanity/client` | `createSanityClient` |
| `@klnap/payload-storage-sanity/admin` | Admin UI entry |
| `@klnap/payload-storage-sanity/next` | `SanityImage`, loaders, `assetMapping` |
| `@klnap/payload-storage-sanity/next/loader` | Default export for `next.config` `loaderFile` |
| `@klnap/payload-storage-sanity/styles/admin-tailwind.css` | Admin Tailwind bundle |

Prefer subpath imports so Next and admin chunks stay tree-shakeable.

## Programmatic API (main entry)

Common exports from the root entry:

- **Plugin:** `sanityStorage`
- **URLs:** `resolvePublicUrl`, `buildSanityImageUrl`, `hasResolvableMediaUrl`, `resolveAssetDocumentUrl`
- **Asset shape:** `getSanityAssetFromMedia`, `getSanityAssetId`, `getSanityAssetUrl`, `toPersistedSanityAssetDocument`
- **Fields:** `sanityMediaAdminFields`, `sanityAssetJsonGroup`, `localizedAltGroupField`, `plainAltTextField`
- **Sync:** `createSanityWebhookEndpoint`, `createSanityReconcileEndpoint`, `reconcileSanityMedia`, `verifySanityWebhookSignature`
- **Populate:** `SANITY_ASSET_DEFAULT_POPULATE_FIELDS`, `readSanityStorageContext`, context helpers under `context.sanityStorage` for Local API
- **Config helpers:** `MB`, `mergeUploadMaxSizeConfig`, `resolveSanityStorageMode`

See TypeScript definitions in `dist/index.d.ts` for the full surface.

## Admin UI

Plugin-managed collections use **Asset | Metadata | References** tabs; sync controls live in the sidebar. Metadata shows read-only `sanity.asset` JSON. CDN preview supports crop/focal from Sanity metadata.

## Security

- Webhook HMAC verification via `verifySanityWebhookSignature` and configured `sync.webhook.secret`
- Media delete blocked when published or draft content still references the row
- `afterRead` sanitization strips internal sync fields from REST responses where configured

## Next.js

See [docs/consumers.md](./docs/consumers.md) for `SanityImage`, `createSanityImage`, populate DTOs, and `assetMapping`.

## Failure behavior and troubleshooting

- [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md) — hook and sync outcomes
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — common integration issues

## License

MIT — see [LICENSE](./LICENSE).
