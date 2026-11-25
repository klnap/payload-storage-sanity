# @klnap/payload-storage-sanity

Sanity-powered media storage, image transformations, and CDN delivery for Payload CMS.

Payload keeps your media collection: documents, access control, hooks, and the admin UI. Sanity stores each original file and serves it from its global Asset CDN. Sanity Studio is not required.

## Why Sanity?

Store the original once. Your application asks for the width it needs, and Sanity creates and caches that variant on the first request. No pre-generated sizes to store or keep in sync.

The [Sanity Free plan](https://www.sanity.io/pricing) includes:

- **100 GB** of asset storage.
- **100 GB** of bandwidth per month.
- Image transformations, which are included on every plan.

Asset storage is the total size of stored originals. Bandwidth is the data delivered each month. Asset CDN delivery has its own quota, separate from API requests. Sanity does not cache image responses larger than 10 MB at the CDN; they are served from its backend. Check the pricing page before you plan production usage.

## Features

- **Uploads to Sanity** from Payload's native upload UI, with Payload as the source of truth for each media document.
- **On-demand image transformations** with `buildSanityImageUrl` and `resolvePublicUrl`. Resize, crop, and let Sanity negotiate the format.
- **Frontend-ready media** with a flat response shape, dimensions, focal points, localized alt text, and LQIP placeholders.
- **Next.js components** with `SanityImage` and a custom loader for `next/image`.
- **Automatic media fields** for `title`, `alt`, and Sanity metadata. The plugin adds only what the collection lacks.
- **Localized alt text** that adds one field per locale when Payload localization is enabled.
- **Media management** with justified, grid, and list layouts, per-user preferences, previews, metadata, and logical folders.
- **Reference-aware deletion** that stops you from deleting media still used by Payload content.
- **Optional deduplication** for identical uploads.
- **Optional sync** with Sanity webhooks and reconcile routes.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

or

```bash
npm install @klnap/payload-storage-sanity
```

Required peers: `payload`, `@payloadcms/ui`, and `@payloadcms/translations` (`>=3.94.1 <4`), `@sanity/client` (`>=6 <9`), and React and React DOM (`^19.3.1`). Install `next` (`>=16.4.5 <17`) only if you use the Next.js entries.

Node `^24.22.3 || >=26.13.1`. The published ESM build expects a bundler to resolve extensionless imports. Raw Node.js ESM is not supported.

## Quick start

Add the plugin to your existing Payload configuration:

```ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  collections: [{ slug: 'media', upload: true, fields: [] }],
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
    }),
  ],
})
```

The plugin applies Sanity storage to every upload collection that has no other storage adapter. The admin styles load automatically. Regenerate the import map after you add or upgrade the plugin:

```sh
bun payload generate:importmap
```

Keep `token` on the server. It is a Sanity write token and must never reach client code.

Plugin order and adapter conflicts are covered in [docs/configuration.md](./docs/configuration.md).

To choose collections explicitly, pass a slug-keyed map. Each entry can set a [folder](#media-management). `collections: {}` selects none. Selecting a collection that has another adapter, an unknown slug, or no uploads throws a configuration error.

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: true,
    documents: { folder: 'website/documents' },
  },
})
```

## Image transformations

Sanity transforms images from URL parameters. Build the URL in your frontend and Sanity serves the result from the CDN.

Build a URL from a stored media document:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity'

const url = buildSanityImageUrl({ client, value: media, width: 800 })
```

`client` is a `SanityClient`, for example from `createSanityClient` in `@klnap/payload-storage-sanity/client`. The function returns `null` when the value has no image asset and no URL.

For crops and fit modes, use `resolvePublicUrl`:

```ts
import { resolvePublicUrl } from '@klnap/payload-storage-sanity'

const card = resolvePublicUrl(media, {
  transform: { width: 640, height: 480, fit: 'crop' },
})

const banner = resolvePublicUrl(media, {
  transform: { width: 1600, fit: 'max' },
})
```

`resolvePublicUrl` adds transform parameters only to image assets and returns `null` when the media is unavailable. When you pass `transform`, the URL includes `auto=format` by default, so Sanity serves the best format the browser accepts. Set `transform.autoFormat: false` to turn it off.

Sanity supports more parameters, such as `fm`, `dpr`, and `fp-x`/`fp-y`. This package does not type them. Sanity's [image URL reference](https://www.sanity.io/docs/apis-and-sdks/image-urls) lists them.

### Reusable transform configurations

To reuse one crop across a site, define a plain object and pass it wherever you need it:

```ts
export const cardImage = { width: 640, height: 480, fit: 'crop' } as const

resolvePublicUrl(media, { transform: cardImage })
```

This is application code, not a package feature.

Do not confuse transform configurations with [populate presets](#frontend-ready-media). Populate presets control what Payload returns for media relations. Transform configurations control the size and crop of a URL.

## Frontend-ready media

Payload can return media relations as full documents. The plugin can also return a smaller, flat shape that your frontend can use directly. It is controlled by `populate.preset`:

- `'default'` (default): each media relation returns a `DefaultPopulateAsset`. Media without a resolvable CDN URL returns the full document instead, and authenticated requests always receive the full document.
- `'full'`: each media relation returns the full media document.

```ts
sanityStorage({
  // ...
  populate: { preset: 'default' },
})
```

A `DefaultPopulateAsset` has these fields:

| Field | Type | Use |
| --- | --- | --- |
| `id` | `string \| number` | Payload document id. |
| `url` | `string` | Public CDN URL of the original. |
| `width`, `height` | `number` | Original dimensions, from Sanity metadata. |
| `aspectRatio` | `number` | Aspect ratio of the original. |
| `focalX`, `focalY` | `number` | Focal point as percentages, from `0` to `100`. Used for `object-position`. |
| `alt` | `string \| null` | Alt text for the request locale, with fallback. |
| `lqip` | `string` | Low-quality placeholder, when present. |

Compare that with a full document. A full document includes the Sanity asset record, sync diagnostics, and upload internals. The flat shape keeps only what a page needs to render an image.

Fetch with `depth: 1` or higher, and pass `locale` to the Payload request. Use the Local API in server code:

```ts
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const home = await payload.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 1,
  select: { image: true },
})

// home.image is a DefaultPopulateAsset
```

Over REST or `@payloadcms/sdk`, the same request works through the HTTP API. Create the SDK once in your app and pass `locale` and `depth` on each call.

Globals with nested groups need `depth: 2` so the media inside the group is populated:

```ts
const home = await payload.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 2,
  select: {
    image: true,
    socialMedia: { image: { alt: true, url: true } },
  },
})
```

Set `populate.localPopulate: false` to return the flat shape over REST only; the Local API then returns the full document. Direct `GET /api/media/:id` always returns the full document for the admin editor.

## Next.js

Import from `@klnap/payload-storage-sanity/next`. Framework-independent code does not need this entry.

### Rendering a `DefaultPopulateAsset`

`SanityImage` renders a `DefaultPopulateAsset` with `next/image`. It sets the source, alt text, placeholder, and object position from the asset:

```tsx
import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity'
import { SanityImage } from '@klnap/payload-storage-sanity/next'

export function Hero({ image }: { image: DefaultPopulateAsset | null }) {
  return (
    <div className="relative aspect-[16/9] w-full">
      <SanityImage
        asset={image}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        className="object-cover"
      />
    </div>
  )
}
```

With `fill`, the parent must have a size and `position: relative`. The example uses an aspect ratio for that. Without `fill`, the component uses the asset's `width` and `height`. If either dimension is missing, it switches to `fill` and the parent sizing rule applies.

`alt` comes from the populated asset. Pass `alt` to override it, or `fallbackAlt` when the asset has none.

### Using Sanity as the image loader

Next.js normally optimizes images through its own route. Use the Sanity loader instead, and Sanity generates each width on request:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './sanity-image-loader.ts',
  },
}

export default nextConfig
```

```ts
// sanity-image-loader.ts
export { default } from '@klnap/payload-storage-sanity/next/loader'
```

Each `next/image` request becomes a Sanity URL with `w`, `q`, and `auto=format`. The browser loads the variant from Sanity's CDN. Non-Sanity URLs pass through unchanged. For a custom CDN host, create the loader with `createSanityImageLoader({ cdnBaseUrl })` from `@klnap/payload-storage-sanity/next`. The default loader only recognizes `cdn.sanity.io`.

## Media fields

The plugin adds these fields to each configured upload collection. It does not replace fields you already declare.

| Field | Type | Visibility | Purpose |
| --- | --- | --- | --- |
| `title` | text | Hidden in the field list, shown in the upload area | Optional asset title. Added only if the collection has none. |
| `alt` | text, or a group with one text field per locale | Visible | Alt text. Added only if the collection has none. |
| `sanity` | group with `asset` (JSON) | Hidden, read-only | The Sanity asset record. Client requests cannot write it. |
| `sync` | group with `status`, `checkedAt`, `errorAt` | Hidden, read-only | Sync diagnostics. |

Payload's upload support provides `filename`, `mimeType`, `filesize`, `width`, and `height`.

### Alt text

With Payload localization enabled, the plugin adds an `alt` group with one field per locale. Editors fill in each language. The frontend receives a single string for the current locale, and `DefaultPopulateAsset.alt` falls back to the configured fallback locale when the current locale is empty.

Set alt options per collection. Plain `collections: { media: true }` and auto-discovery use the defaults:

```ts
sanityStorage({
  // ...
  collections: {
    media: { alt: { required: true, fallbackLocale: 'en' } },
  },
})
```

The plugin creates the fields. Editors write alt text. The plugin neither generates nor reads it from Sanity. Set `alt.required` to require every locale.

## Uploads, replacements, and deletion

With `mode: 'full'` (the default), Payload sends the file to Sanity. The media document stores the asset reference under `sanity.asset`. If Sanity metadata is missing, the plugin fills it in when possible.

- **Replacing a file** uploads the new bytes and keeps the previous Sanity asset.
- **Direct SQL and external writes** bypass Payload hooks, so the reference guard does not see them. Database-specific limits are in [docs/configuration.md](./docs/configuration.md).
- **Deleting a media row** removes only the Payload record. The Sanity asset and its CDN URL remain.
- **Failed uploads** can leave orphaned Sanity assets.

With `preventDeleteWhenReferenced: true` (the default), Payload refuses to delete a media row that Payload content still references. On PostgreSQL, transaction locks serialize reference writes and deletes. On other adapters without those locks, a guarded delete returns `503`.

`dedupeUploads: true` rejects a create whose bytes match an existing asset. Replacements are not affected. A rejected duplicate removes its temporary row and leaves the shared Sanity asset in place.

Sanity deduplicates assets by content, so one asset can serve several documents. Payload's reference check does not see external Sanity documents, weak references, or other datasets. Deleting a Sanity asset is an operator decision. Check every Sanity reference first.

### Public CDN files

Sanity CDN URLs are public. Anyone with the URL can download the file, whether or not Payload still lists it. Payload access control protects Payload API operations, not CDN URLs. Do not store private media with this package.

Sanity caches CDN responses indefinitely, keyed by a hash of the file contents. Replacing a file creates a new URL. The old URL keeps serving until its asset is removed, and neither this package nor revalidation purges the Sanity CDN.

## Media management

The admin media list supports three layouts:

- **Justified** (default): rows sized from each asset's aspect ratio, so mixed orientations keep their proportions.
- **Grid**: equal tiles for quick scanning.
- **List**: Payload's native table, with date sorting through the column headers.

The chosen layout is saved per user and collection.

The edit view shows a large preview, a file card with the CDN URL and a copy button, and a metadata inspector with dimensions, aspect ratio, asset ID, SHA-1, and file type.

Use `admin.gallery: false` to keep Payload's list view everywhere.

### Folders

Folders group uploads in [`sanity-plugin-media`](https://www.sanity.io/plugins/sanity-plugin-media) inside Sanity Studio. Each collection defaults to the `Payload` folder. Set a different one with `collections.<slug>.folder`.

Folders are a logical grouping, not a file path. They do not change URLs. Assets that already exist keep their folder, so a duplicate shared across collections is not moved by a later upload. Folder rules are in [docs/configuration.md](./docs/configuration.md).

## Integration with @klnap/revalidation

When a shared image changes, every page that shows it should refresh. [`@klnap/revalidation`](https://github.com/klnap/revalidation) finds the documents that reference the media and sends update events, so your Next.js consumer can expire the matching cache tags and paths without anyone republishing each page.

This package does not call revalidation. Configure the producer in your Payload app:

```ts
import { http } from '@klnap/revalidation/dispatchers/http'
import { revalidation } from '@klnap/revalidation/producers/payload'

revalidation({
  target: { url: process.env.REVALIDATION_URL!, secret: process.env.REVALIDATION_SECRET! },
  dispatcher: http(),
  // Needed when several upload collections exist and none is named `media`:
  // media: mediaCollection,
})
```

Add `custom: { revalidation: true }` to each content collection or global that should refresh when the media changes.

Media tracking covers:

- **Updates and deletes** of a media document. Creates do not trigger it.
- **Direct references** through `upload` and `relationship` fields to the media collection, inside groups, rows, collapsibles, tabs, and arrays. For globals, arrays and `hasMany` fields are not matched.
- **Locales.** A change to a shared field, such as the file or focal point, revalidates every locale. A change to `alt` revalidates only the locale whose alt text changed.
- **Published documents only**, for updates and deletes alike.

Limits to plan around:

- **One hop only.** A page that reaches the media through another document, such as a parent that links to the page, is not revalidated. Add a direct upload field to that document type or revalidate it explicitly.
- **Not matched:** blocks, rich text, JSON and join fields, and relations that accept several collections. These are skipped without a log entry.
- **Failures** while reading dependents are logged and do not fail the Payload save. A failure in the locale-change check can stop dispatch for that save, so check logs after media edits.
- **Delivery** runs in memory with a short delay and no retry. Delete events fire before the row is removed, so a rolled-back delete can still send events.

Read the producer guides in the [revalidation repository](https://github.com/klnap/revalidation) (`docs/producers/payload.md` and `docs/producers/payload-media-dependencies.md`) before you rely on this.

Frontend cache invalidation and Sanity Asset CDN caching are separate. Revalidation expires Next.js cache entries. Neither this package nor revalidation purges the Sanity CDN. A replaced file gets a new hashed URL, so the old URL stays cached until its asset is removed.

## Sync

With `sync.enabled: true`, a Sanity webhook marks or deletes media rows when assets change, and reconcile routes check batches of rows. Sync needs `token` and `sync.webhook.secret`. The webhook verifies an HMAC over the raw request body. Body limits, status codes, and retry behavior are in [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md).

## Documentation

- [Configuration and public API](./docs/configuration.md): every option, default, and export.
- [Consumer guide](./docs/consumers.md): populate shapes, Next.js components, and manual `populate`.
- [Failure behavior](./docs/FAILURE_SEMANTICS.md): sync, webhooks, and error handling.
- [Troubleshooting](./docs/TROUBLESHOOTING.md): common setup and runtime issues.
- [Contributing](./CONTRIBUTING.md): development setup and releases.

## License

MIT
