# Configuration and public API

Reference for `sanityStorage()` options, defaults, and package exports. The [README](../README.md) covers the common setup.

## Options

| Option | Default | Behavior |
| --- | --- | --- |
| `projectId`, `dataset` | Required | Sanity project and dataset. |
| `token` | Required for `full` mode or sync | Sanity write token. Server-side only. |
| `apiVersion` | Package default | Sanity API version for the client. |
| `cdnBaseUrl` | `https://cdn.sanity.io` | Base URL for public asset URLs. |
| `mode` | `'full'` | `'full'` uploads to Sanity. `'fields-only'` adds fields without the storage adapter. `'off'` skips storage registration. |
| `collections` | Auto-discovered | See [Collections](#collections). Omit to discover, `{}` selects none, a slug map selects explicitly. |
| `collections.<slug>.enabled` | `true` | `false` excludes the collection. See [Collections](#collections). |
| `crop`, `focalPoint` (Payload `upload` config) | `true` | Crop and focal point controls for an enabled collection. Set them in the collection's own Payload `upload` config to turn either off. Not plugin options. |
| `collections.<slug>.folder` | `'Payload'` | Logical `sanity-plugin-media` folder for new uploads. |
| `collections.<slug>.disablePayloadAccessControl` | `true` | Allows file delivery without Payload access checks. CDN URLs stay public either way. |
| `collections.<slug>.disableLocalStorage` | `true` | Disables Payload's local file storage for the collection. |
| `collections.<slug>.prefix` | None | Path prefix passed to the storage adapter. |
| `collections.<slug>.preventDeleteWhenReferenced` | Plugin value | Overrides the plugin-level reference guard for one collection. |
| `collections.<slug>.uploadMaxSize` | Plugin value | Byte limit for one collection. |
| `populate.preset` | `'default'` | `'default'` returns a `DefaultPopulateAsset` per relation. `'full'` returns the full document. |
| `populate.localPopulate` | `true` with `'default'` | Applies the flat shape to Local API reads. `false` keeps it on REST only. |
| `uploadMaxSize` | None | Byte limit, globally or per collection, on top of Payload's upload limit. |
| `preventDeleteWhenReferenced` | `true` | Refuses deletion of a media row that Payload content references. |
| `dedupeUploads` | `false` | Rejects identical-byte creates. |
| `collections.<slug>.alt.enabled` | `true` | Adds an alt field when the collection has none. Per collection only. |
| `collections.<slug>.alt.required` | `false` | Requires every configured locale (or the plain `alt` field). Empty values fail validation. Per collection only. |
| `admin.gallery` | `true` | Justified, grid, and list media list. `false` keeps Payload's list view. |
| `admin.uploadBusyShield` | `true` | "Uploading…" state during Save. The preview stays visible. |
| `sync.enabled` | `false` | Adds webhook and reconcile routes. Requires `token` and `sync.webhook.secret`. |
| `sync.basePath` | `'/sanity-storage'` | Route base under Payload's `/api`. |
| `sync.onDeleted` | `'mark'` | `'mark'` marks rows unavailable. `'delete'` removes them. |
| `sync.reconcile` | `true` when sync is on | Batch reconcile route. `false` disables it. |
| `sync.access` | Admin users only | Who may call reconcile. |

Admin options can be set plugin-wide under `admin` and overridden per collection under `collections.<slug>.admin`.

Plugins apply in order. The plugin does not replace an existing storage adapter silently. An explicit conflict fails during config build. A later cloud-storage plugin that replaces Sanity is detected at initialization when it keeps Payload's `onInit` chain.

## Collections

Each key in `collections` is a Payload collection slug. The value decides whether the collection joins the integration:

| Value | Result |
| --- | --- |
| omitted (`collections` not set) | Every upload collection without another storage adapter is enabled (discovery, `full` mode). |
| `{}` (`collections: {}`) | No collections are enabled. |
| `true` or `{}` | Enabled with defaults. |
| object without `enabled` | Enabled with the given options. |
| `false` or `enabled: false` | Excluded. |

Rules:

- An explicit map never adds unlisted collections.
- Every key must name an existing Payload collection, including excluded ones. Typos in slugs fail at config build. Unknown option keys inside a collection object are not checked.
- Enabled collections must have `upload` set and must not already have a storage adapter. Excluded collections are not checked for either, and they keep their native Payload upload config and adapter.
- Excluded collections receive no Sanity storage registration, fields, endpoints, populate changes, or admin overrides.
- Two plugin-wide effects still apply to excluded collections. Rich-text reference checks run on every collection with rich-text fields, because they guard the enabled media collections. Upload size limits raised by `uploadMaxSize` apply to the global Payload upload limit, so they reach excluded collections too.
- Consumers do not repeat the Payload collection config. The plugin merges its options into the existing collection.

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: true,
    documents: { folder: 'website/documents' },
    privateFiles: false,
  },
})
```

## Folders

- Nested paths such as `website/documents` create missing ancestors in one atomic write.
- Outer slashes and whitespace around segments are trimmed.
- Empty interior segments, `.`, `..`, backslashes, and control characters are rejected.
- Folder names are case-insensitive.
- Folder writes need dataset write access. A failed folder write fails the upload.
- Existing assets keep their folder. A later upload does not move a shared asset.

Folders use `media.folder` documents and `opt.media.folder` asset metadata. They are not Content Lake file paths and not Sanity Media Library folders. The package uses the dataset asset API and does not need Media Library credentials.

## Uploads and deduplication

- With `dedupeUploads: true`, a create with identical bytes is rejected with `409`. The temporary row is removed. The shared Sanity asset stays.
- Replacements and re-uploads are not checked for duplicates.
- On PostgreSQL, concurrent creates are serialized across processes. Other adapters serialize only within one process.

## Reference guard and databases

- On PostgreSQL, transaction-scoped locks serialize reference writes and media deletes.
- On SQLite and other adapters without those locks, a guarded delete returns `503`. Uploads, replacements, and local deduplication still work, without cross-process guarantees.
- Direct SQL and external writes bypass Payload hooks, so the reference guard does not see them.
- `preventDeleteWhenReferenced: false` disables the guard. It never deletes Sanity assets.

## Sync

- The webhook verifies an HMAC over the raw request body.
- Body limits, status codes, and retry semantics are in [FAILURE_SEMANTICS.md](./FAILURE_SEMANTICS.md).
- Reconcile checks media rows against Sanity in batches.

## Public exports

| Import | Contents |
| --- | --- |
| `@klnap/payload-storage-sanity` | `sanityStorage`, `buildSanityImageUrl`, `resolvePublicUrl`, `resolveLocalizedAlt`, `DefaultPopulateAsset`, populate and sync helpers, types |
| `@klnap/payload-storage-sanity/client` | `createSanityClient`, `fetchSanityImageAsset` |
| `@klnap/payload-storage-sanity/folders` | `assignSanityAssetFolder`, `parseSanityAssetFolderPath` |
| `@klnap/payload-storage-sanity/admin` | Admin components |
| `@klnap/payload-storage-sanity/next` | `SanityImage`, `createSanityImage`, `toSanityImageProps`, `sanityCdnUrl`, `focalObjectPosition`, loaders |
| `@klnap/payload-storage-sanity/next/loader` | Default export for `images.loaderFile` |
| `@klnap/payload-storage-sanity/styles/admin-tailwind.css` | Admin stylesheet |
