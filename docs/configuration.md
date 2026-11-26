# Configuration and public API

`sanityStorage()` registers Sanity through Payload's native cloud-storage plugin. It expects existing Payload upload collections; it does not create media collections or replace their relationships.

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: {
      folder: 'website/images',
      alt: { required: true },
    },
    documents: {
      folder: 'website/documents',
    },
  },
})
```

## Plugin options

| Option | Default | Purpose |
| --- | --- | --- |
| `projectId` | required | Sanity project ID. |
| `dataset` | required | Sanity dataset for uploaded assets. |
| `token` | required in `full` mode | Server-side Sanity write token. |
| `apiVersion` | package default | Sanity API version for client requests. |
| `cdnBaseUrl` | Sanity CDN | Compatible CDN or proxy base URL. |
| `resolveFetch` | — | Custom Sanity client transport. |
| `collections` | automatic discovery | Explicit upload collections to configure. |
| `admin` | gallery enabled | Default admin options for configured collections. |
| `populate` | `preset: 'default'` | Default or full media relationship response. |
| `mode` | `'full'` | Cloud storage and field registration mode. |
| `dedupeUploads` | `false` | Reject duplicate media creates by SHA-1. |
| `preventDeleteWhenReferenced` | `true` | Protect referenced Payload media rows. |
| `uploadMaxSize` | Payload default | Global maximum and optional media-type upload limits. |
| `sync` | disabled | Sanity webhook and reconcile routes. |

`mode: 'full'` uploads files to Sanity and registers the cloud-storage adapter. `fields-only` disables cloud storage and keeps Sanity fields and hooks. `off` disables cloud-storage registration; selected collections may still receive Sanity fields, hooks, and routes.

`token` is optional in the TypeScript contract for modes that do not upload. In the default `full` mode, startup validation requires a non-empty token. Keep it server-only.

## Collection selection

Omit `collections` to discover all upload collections that have no existing storage adapter. Automatic discovery skips collections that already use another adapter.

When you pass `collections`, only its enabled entries are selected. `true`, `{}`, and an options object without `enabled: false` enable a collection. `false` and `{ enabled: false }` exclude it. An empty map selects no collections. Every key must name an existing Payload collection, including disabled entries.

An explicitly enabled collection must have `upload` enabled. In `full` mode, an enabled collection with an existing adapter fails configuration rather than replacing it. A later plugin that replaces Sanity's adapter also fails during Payload initialization. Preserve the order and avoid configuring multiple storage plugins for the same collection.

`collections` is typed as `Partial<Record<UploadCollectionSlug, ...>>`. Payload's generated type augmentation narrows valid keys to upload collection slugs. Generate Payload types after changing collection configuration.

## Collection options

| Option | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Disable this collection's Sanity storage, fields, hooks, and admin changes. |
| `folder` | `'Payload'` | Logical `sanity-plugin-media` folder path for new assets. |
| `alt.enabled` | `true` | Add an alt field/group unless the collection already has `alt`. |
| `alt.required` | `false` | Require non-empty text for each locale. |
| `populate.preset` | `'default'` | Normalize eligible populated relations or return full media documents. |
| `populate.localPopulate` | `true` for default preset | Apply the default preset to Local API reads. |
| `admin.gallery` | `true` | Replace Payload's list view with the plugin gallery unless the collection already has its own list view. Set `false` to keep the native table. |
| `admin.uploadBusyShield` | `true` | Show the neutral upload progress state during save. |
| `uploadMaxSize` | plugin-level setting | Override upload-size limits for this collection. |
| `preventDeleteWhenReferenced` | plugin-level setting | Override the Payload relationship delete guard. |
| `prefix` | Payload adapter default | Native cloud-storage object prefix, not a Sanity folder. |
| `disableLocalStorage` | `true` | Payload cloud-storage option; the plugin disables local file copies. |
| `disablePayloadAccessControl` | `true` | Payload cloud-storage option; direct CDN URLs bypass Payload's file-delivery access-control proxy. |

The plugin keeps native Payload upload settings such as crop, focal-point, MIME-type, and upload-limit options. It sets `upload.imageSizes` to `[]`: Payload does not generate derivative files for configured collections. Sanity's CDN supplies transformed image variants.

Set `disablePayloadAccessControl: false` when generated file URLs must pass through Payload's delivery route. This does not make the underlying Sanity CDN URL private; any exposed direct CDN URL remains publicly accessible.

## Folders

`folder` accepts a non-empty path of folder names, such as `website/images`. The plugin creates missing `media.folder` documents and assigns new assets through `opt.media.folder`. It does not move existing assets when the option changes.

These folders use the `sanity-plugin-media` model, not Sanity Media Library folders. Install `sanity-plugin-media >=6.1.0` only if users need to browse the hierarchy in Sanity Studio. Uploads and CDN delivery do not require Studio.

For assets uploaded outside this Payload adapter, `@klnap/payload-storage-sanity/folders` exports `assignSanityAssetFolder(client, assetId, folderPath)`. It creates missing folders and assigns the asset without changing an existing folder assignment.

## Populate behavior

The default preset normalizes eligible populated media relationships to `MediaAsset`. It does not transform direct media document reads, authenticated requests, explicit populate selections, or depth-zero IDs. Missing CDN URLs stay full media documents. Set `preset: 'full'` to always keep full media documents.

For Local API reads, `localPopulate: false` disables normalization. Direct `/api/{collection}/:id` media reads keep the full document for the admin editor. The consumer guide documents runtime narrowing and typed consumption.

## Upload size limits

Use Payload's native upload limits unless you need a plugin-level per-media-kind cap. `uploadMaxSize` has a `default` byte limit and optional `byType` overrides. Collection values override plugin values per key. The plugin raises Payload's global multipart cap to the largest configured limit, then validates each selected media collection separately.

## Synchronization

`sync` is optional. Enabling it adds webhook and reconcile endpoints under `/api/sanity-storage` by default.

| Option | Default | Purpose |
| --- | --- | --- |
| `enabled` | `false` | Register sync endpoints and media status fields. |
| `basePath` | `'/sanity-storage'` | Base route under Payload's `/api`. |
| `webhook.secret` | required when enabled | HMAC secret for raw Sanity webhook bodies. |
| `webhook.path` | derived | Override webhook route. |
| `webhook.collection` | selected media collection | Override the collection used for sync updates. |
| `webhook.maxBodySizeBytes` | `262144` | Maximum raw webhook body size. |
| `reconcile` | enabled | Register a protected batch reconcile endpoint; set `false` to disable. |
| `reconcile.path` | derived | Override reconcile route. |
| `reconcile.collection` | selected media collection | Override collection used by reconcile. |
| `onDeleted` | `'mark'` | Mark media unavailable or delete the Payload row after a Sanity deletion event. |
| `access` | admin auth collection | Authorize reconcile requests. |

The webhook verifies an HMAC over the raw request body. Sanity may retry webhooks; handlers must remain idempotent. Sync never deletes remote assets.

## Public package entries

- `@klnap/payload-storage-sanity`: Payload storage plugin, configuration types, and populate helpers.
- `@klnap/payload-storage-sanity/consumers`: framework-independent asset contracts, guard, and image URL builder.
- `@klnap/payload-storage-sanity/consumers/next`: `SanityImage`, its props, component factory, and scoped image-loader helpers.
- `@klnap/payload-storage-sanity/consumers/next/loader`: default loader required by Next.js `images.loaderFile`.
- `@klnap/payload-storage-sanity/client`: `createSanityClient` for callers building URLs from bare Sanity asset references.
- `@klnap/payload-storage-sanity/folders`: folder assignment for assets uploaded outside the Payload adapter.
- `@klnap/payload-storage-sanity/admin`: admin stylesheet import-map entry.
- `@klnap/payload-storage-sanity/styles/admin-tailwind.css`: admin styles.

Internal lifecycle, metadata, folder-assignment, and synchronization functions are not public APIs.
