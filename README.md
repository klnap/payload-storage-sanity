# @klnap/payload-storage-sanity

Sanity-powered media storage, image transformations, and CDN delivery for Payload CMS.

Payload keeps the media collection: documents, access control, hooks, and the admin UI. Sanity stores the original file as an asset and serves it from its global Asset CDN. Frontend applications build transformed image URLs on demand from that one original. Sanity Studio is not required.

> Status: not yet published to npm. Install from npm only after the first release.

## What lives where

| Layer | Stores | Notes |
| --- | --- | --- |
| Payload | The media document, `title`, `alt`, relations, access control | Standard collection fields plus the fields listed in [Media fields](#media-fields). |
| Sanity | The original file, as a `sanity.asset` reference and metadata | The Content Lake asset. Its public URL is served by the Asset CDN. |
| Sanity Asset CDN | Original and transformed image responses | Image variants are created from URL parameters. |
| Frontend | URLs built with `buildSanityImageUrl` or `resolvePublicUrl`, or rendered with `SanityImage` | Reads Payload documents over REST or the Local API. |

Sanity assets served from CDN URLs are public. Payload access control protects Payload API operations, not CDN URLs. Do not use this package for private media.

## Why Sanity?

Sanity stores each image once and produces delivery variants when a URL is requested. Your application does not keep a set of pre-generated sizes for every image.

- **Managed asset storage** with content-addressed URLs.
- **Global Asset CDN** for original files and transformed images.
- **On-demand image transformations** through URL parameters such as `w`, `h`, `fit`, `q`, and `auto=format`.
- **Edge caching** of transformed responses. Each parameter set is a distinct URL and is cached separately.
- **A Free plan** that includes image storage and bandwidth. As of 2026-11-25, the [Sanity pricing page](https://www.sanity.io/pricing) lists for Free: 100 GB of assets, 100 GB of bandwidth per month, 1 million API CDN requests per month, 250 thousand API requests per month, and 2 public datasets. The page shows no date, so confirm the current values before you rely on them.

Two limits are easy to confuse. **Asset storage** is the total size of stored originals. **Bandwidth** is the monthly volume of delivered data. Asset CDN delivery is separate from API CDN requests, which count against a different quota. Sanity documents that image responses larger than 10 MB are not cached at the CDN and are served by its backend.

This package uses the Sanity dataset asset API. It does not use Sanity Media Library, which is a separate product with its own folder and resource model.

Sanity Asset CDN URLs are cached indefinitely and contain a hash of the file contents. Deleting a media row in Payload does not remove the Sanity asset or its CDN URL. See [Asset lifecycle](#asset-lifecycle).

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

or

```bash
npm install @klnap/payload-storage-sanity
```

Required peers, all `>=3.94.1 <4` for Payload packages: `payload`, `@payloadcms/ui`, `@payloadcms/translations`. Also `@sanity/client` `>=6 <9`, and React and React DOM `^19.3.1` for admin components.

Optional: `next` `>=16.4.5 <17`, only for the `./next` and `./next/loader` entries.

Node `^24.22.3 || >=26.13.1`. The published ESM build expects a bundler to resolve extensionless imports. Raw Node.js ESM is not supported.

## Quick start

Add the plugin to your existing Payload configuration. Keep your database, secret, and other settings.

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

Without `collections`, the plugin applies Sanity storage to every upload collection that has no other storage adapter. The admin styles load automatically. Regenerate the import map after adding or upgrading the plugin:

```sh
bun payload generate:importmap
```

`token` is a Sanity write token. Keep it on the server. Never expose it in client-side code or a `NEXT_PUBLIC_` variable.

### Select collections

Pass `collections` to choose upload collections explicitly. Keys are Payload collection slugs.

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

`collections: {}` selects none. Explicitly selecting a collection that has another adapter, an unknown slug, or no uploads throws a configuration error.

## Image transformations

Sanity transforms images when a URL is requested. The package sets `upload.imageSizes` to an empty array, so Payload does not generate resized derivatives. Existing `sizes` data on old documents is not removed. Request the size you need instead:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity'

const url = buildSanityImageUrl({ client, value: media, width: 800 })
```

`client` is a `SanityClient`, for example from `createSanityClient` in `@klnap/payload-storage-sanity/client`. `buildSanityImageUrl` accepts a media document, a Sanity asset reference, a URL string, or `null`. It returns `null` when no image asset is available.

| Option | Behavior |
| --- | --- |
| `width`, `height` | Integer pixel dimensions, passed as `w` and `h`. |
| `cdnBaseUrl` | Replaces `https://cdn.sanity.io` in the returned URL. |

`buildSanityImageUrl` always adds `auto=format`. Use `resolvePublicUrl` when you need `fit` or `rect`:

```ts
import { resolvePublicUrl } from '@klnap/payload-storage-sanity'

const url = resolvePublicUrl(media, {
  transform: { width: 1200, height: 630, fit: 'crop' },
})
```

`resolvePublicUrl` applies `transform` only to image assets. The transform object accepts:

| Option | Values | Notes |
| --- | --- | --- |
| `width`, `height` | Integers | Sets `w` and `h`. |
| `fit` | `max`, `min`, `crop`, `clip` | Sets `fit`. |
| `rect` | `{ left, top, width, height }` | Sets `rect` to the crop region in pixels. |
| `autoFormat` | `boolean`, default `true` | Adds `auto=format` unless set to `false`. |

It returns `null` when the media is unavailable. Sanity documents more parameters for `crop`, `fp-x`, `fp-y`, `q`, `fm`, and `dpr`. This package does not expose them as typed options. If you add them to a URL yourself, Sanity processes them as documented upstream.

`sanityCdnUrl` in `@klnap/payload-storage-sanity/next` is the helper used by the Next.js loader. It sets `w`, `h`, `q`, and `auto=format`.

### Reusable transform configuration

The package has no named image preset registry. To reuse a transform across the application, define a plain object in your code:

```ts
export const cardImage = {
  width: 640,
  height: 480,
  fit: 'crop',
} as const
```

Pass it wherever the card renders: `resolvePublicUrl(media, { transform: cardImage })`. Because the object is a plain value, TypeScript checks it against the `transform` parameter at the call site.

Sanity documents more parameters, including `fm`, `dpr`, `crop`, and `fp-x`/`fp-y`. This package does not type them. `sanityCdnUrl` adds `q` through its `quality` option.

## Next.js

Install `next` and import from `@klnap/payload-storage-sanity/next`. Framework-independent code can skip this entry.

### Rendering an image

Use `SanityImage` with a `DefaultPopulateAsset`, which is the flat shape the plugin returns by default:

```tsx
import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity'
import { SanityImage } from '@klnap/payload-storage-sanity/next'

export function Hero({ page }: { page: { hero: DefaultPopulateAsset | null } }) {
  return (
    <SanityImage
      asset={page.hero}
      sizes="(max-width: 768px) 100vw, 1200px"
      fill
    />
  )
}
```

`alt` comes from the populated asset. Override it with the `alt` prop, or set `fallbackAlt` for a non-empty default. `createSanityImage` returns a component with a default fallback for broken URLs.

### Using Sanity as the Next.js image loader

Set a custom loader so `next/image` asks Sanity for each width:

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

The loader turns each `next/image` request into a Sanity URL with `w`, `q`, and `auto=format`. The browser then requests the image from Sanity directly, so the transform runs once in Sanity and its result is cached at the CDN. Non-Sanity URLs are returned unchanged.

### Next.js helpers

| Export | Purpose |
| --- | --- |
| `SanityImage`, `createSanityImage` | Render a populated asset with `next/image`. |
| `toSanityImageProps` | Map a `DefaultPopulateAsset` to `next/image` props. |
| `focalObjectPosition` | CSS `object-position` from the focal point. |
| `sanityImageLoader`, `createSanityImageLoader` | Loaders for `next/image`. |

## Reading media on the frontend

Populated media follows the preset you choose in `populate`. The default preset, `'default'`, returns a flat `DefaultPopulateAsset` for each relation:

| Field | Type | Source |
| --- | --- | --- |
| `id` | `string \| number` | Payload document id |
| `url` | `string` | Public CDN URL |
| `width`, `height` | `number \| null` | Sanity metadata |
| `aspectRatio` | `number \| null` | Sanity metadata |
| `focalX`, `focalY` | `number \| null` | Sanity metadata |
| `alt` | `string \| null` | Resolved for the request locale |
| `lqip` | `string \| null` | Low-quality placeholder, when present |

Fetch with a depth of at least 1, and pass `locale` to the Payload request, not to `SanityImage`:

```ts
const page = await sdk.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 1,
  select: { image: true },
})
```

Use `populate: { preset: 'full' }` in the plugin options to return the full media document for every relation. `populate.localPopulate: false` turns off the flat shape for Local API reads only.

Direct `GET /api/media/:id` always returns the full document.

## Media fields

The plugin adds these fields to each configured upload collection. It does not replace fields you already declare.

| Field | Type | Visibility | Purpose |
| --- | --- | --- | --- |
| `sanity` | group containing `asset` (JSON) | Hidden, read-only | The Sanity asset document, persisted for metadata and URLs. Client writes cannot set it. |
| `sync` | group with `status`, `checkedAt`, `errorAt` | Hidden, read-only | Sync diagnostics. |
| `title` | text | Hidden in field list, shown in the upload area | Asset title. Added only if the collection has no `title` field. |
| `alt` | text, or a localized group with one text field per locale | Visible | Alternative text. Added only if the collection has no `alt` field. |

The Payload upload fields, such as `filename`, `mimeType`, `filesize`, `width`, and `height`, come from Payload's upload support, not from this plugin.

### Alt text

`alt.enabled` defaults to `true`. The plugin adds the field, but it does not generate alt text. It does not read alt text from Sanity metadata either.

- `alt.required` defaults to `false`.
- With Payload localization, the plugin adds an `alt` group with one field per locale. `alt.fallbackLocale` applies only to this group. When the request locale is empty, the plugin uses the fallback locale.
- A collection with its own `alt` field keeps it unchanged.

Use `resolveLocalizedAlt` for the localized group, or `assetMapping` for a custom asset shape.

## Uploads, replacements, and deletion

In `mode: 'full'` (the default), Payload sends the bytes to Sanity. The media document stores the asset reference under `sanity.asset`. If Sanity metadata is missing, the adapter fills it in when it can. If that fails, it logs a warning and keeps the upload response.

- **Replacement** uploads the new file and keeps the previous Sanity asset.
- **Deletion** removes the Payload row only. The Sanity asset and its CDN URL remain.
- **Failed uploads** can leave orphaned Sanity assets.

With `preventDeleteWhenReferenced: true` (the default), Payload refuses to delete a media row that Payload content references. On PostgreSQL, transaction locks serialize reference writes and deletes. On other adapters, guarded deletion returns `503`. Direct SQL and external writes bypass Payload hooks.

`dedupeUploads: true` rejects a create whose bytes match an existing asset. It does not reject replacements. A rejected duplicate removes its temporary row and leaves the shared Sanity asset in place. On PostgreSQL, concurrent creates are serialized across processes. Other adapters serialize only within one process.

## Admin

The media list has three layouts, selected with Payload's toggle buttons:

- **Justified** (default): rows sized from each asset's aspect ratio, capped at 8:1 and 1:8.
- **Grid**: equal tiles.
- **List**: Payload's native table, with date sorting through column headers.

The layout is saved per user and collection. Set `admin.gallery: false` to keep Payload's list view.

The edit view shows a large preview, a file card with the CDN URL and a copy button, and a metadata inspector with filename, MIME type, size, asset ID, SHA-1, CDN URL, path, dimensions, and aspect ratio.

`admin.uploadBusyShield` (default `true`) shows an "Uploading…" state and disables controls during Save. The preview stays visible.

## Integration with @klnap/revalidation

This package does not import or call `@klnap/revalidation`. The integration is configured in your Payload application, not in this package.

[`@klnap/revalidation`](https://github.com/klnap/revalidation) has a Payload producer with media dependency tracking. When a media document changes, the producer finds the documents that reference it and dispatches `update` events. Your Next.js consumer then expires the matching cache tags and paths.

What the producer does, according to its documentation:

- **Triggers:** an update of a media document after save, and a delete before the row is removed. Creates do not trigger it.
- **Scope:** only collections and globals that opted in with `custom.revalidation` are searched.
- **Media collection:** detected automatically when it is the only upload collection or is named `media`. Otherwise pass `media: mediaCollection`.
- **Locales:** an edit to one locale revalidates that locale. A shared field change revalidates all locales. A change to `alt` revalidates only the locale whose `alt` changed.
- **Structures:** upload or relationship fields in documents, groups, rows, collapsibles, tabs, and arrays are searched. Blocks, rich text, and JSON are not.
- **Failures:** if a query fails, the producer dispatches the dependents it already found and logs the incomplete scope. The Payload save still succeeds.

Example configuration in the Payload app:

```ts
import { http } from '@klnap/revalidation/dispatchers/http'
import { revalidation } from '@klnap/revalidation/producers/payload'

revalidation({
  target: { url: process.env.REVALIDATION_URL!, secret: process.env.REVALIDATION_SECRET! },
  dispatcher: http(),
})
```

The Payload producer, the consumer, and the dispatcher are configured in the revalidation package. Read the revalidation documentation before you rely on this: its Payload producer guide, and its media dependencies guide in `docs/producers/`. Repository: https://github.com/klnap/revalidation.

Frontend cache invalidation and Sanity Asset CDN caching are separate. Revalidation expires Next.js cache entries. Neither this package nor revalidation purges the Sanity CDN. A replaced file gets a new hashed URL, so the old URL stays cached until its asset is removed.

## Asset lifecycle

- The plugin never deletes Sanity assets automatically.
- Sanity deduplicates assets by content. An upload response does not prove a new asset was created, and one asset can be referenced by several documents.
- Payload's reference scan does not see external Sanity documents, weak references, or other datasets. Deleting a Sanity asset is an operator decision and must account for every Sanity reference.
- Anyone with a public CDN URL can fetch that file, whether or not Payload still lists it.

Sync is optional. With `sync.enabled: true`, a Sanity webhook marks or deletes media rows, and reconcile routes check batches of rows. Sync requires `token` and `sync.webhook.secret`. Webhook bodies are verified with an HMAC over the raw request. The default base path is `/sanity-storage`, under Payload's `/api`. Body limits, status codes, and sync guarantees are in [failure behavior](./docs/FAILURE_SEMANTICS.md).

## Configuration

| Option | Default | Behavior |
| --- | --- | --- |
| `projectId`, `dataset` | Required | Sanity project and dataset. |
| `token` | Required for `full` mode or sync | Sanity write token. Server-side only. |
| `mode` | `'full'` | `'full'` uploads to Sanity. `'fields-only'` adds fields without the storage adapter. `'off'` skips storage registration. |
| `collections` | Auto-discovered | Omit to discover upload collections without another adapter. `{}` selects none. A slug map selects explicitly. |
| `collections.<slug>.folder` | `'Payload'` | Logical `sanity-plugin-media` folder for new uploads. Existing shared assets are not moved. |
| `collections.<slug>.disablePayloadAccessControl` | `true` | Allows file delivery without Payload access checks. CDN URLs stay public either way. |
| `cdnBaseUrl` | `https://cdn.sanity.io` | Base URL for public asset URLs. |
| `populate.preset` | `'default'` | `'default'` returns the flat `DefaultPopulateAsset`. `'full'` returns the full document. |
| `populate.localPopulate` | `true` with `'default'` | Applies the flat shape to Local API reads. |
| `uploadMaxSize` | None | Byte limit, globally or per collection, on top of Payload's upload limit. |
| `preventDeleteWhenReferenced` | `true` | Refuses deletion of a media row that Payload content references. |
| `dedupeUploads` | `false` | Rejects identical-byte creates. See [Asset lifecycle](#asset-lifecycle). |
| `alt.enabled`, `alt.required`, `alt.fallbackLocale` | `true`, `false`, none | Alt text field behavior. |
| `admin.gallery` | `true` | Justified, grid, and list media list. `false` keeps Payload's list view. |
| `admin.uploadBusyShield` | `true` | "Uploading…" state during Save. |
| `sync.enabled` | `false` | Adds webhook and reconcile routes. |
| `sync.onDeleted` | `'mark'` | `'mark'` marks rows unavailable. `'delete'` removes them. |
| `sync.reconcile` | `true` when sync is on | Batch reconcile route. `false` disables it. |
| `sync.access` | Admin users only | Who may call reconcile. |

Admin options can be set plugin-wide under `admin` and overridden per collection under `collections.<slug>.admin`.

Plugins apply in order. The plugin does not replace an existing storage adapter silently. An explicit conflict fails during config build. A later cloud-storage plugin that replaces Sanity is detected at initialization when it keeps Payload's `onInit` chain.

## Public exports

| Import | Contents |
| --- | --- |
| `@klnap/payload-storage-sanity` | `sanityStorage`, `buildSanityImageUrl`, `resolvePublicUrl`, `resolveLocalizedAlt`, populate helpers, sync helpers, types |
| `@klnap/payload-storage-sanity/client` | `createSanityClient`, `fetchSanityImageAsset` |
| `@klnap/payload-storage-sanity/folders` | `assignSanityAssetFolder`, `parseSanityAssetFolderPath` |
| `@klnap/payload-storage-sanity/admin` | Admin components |
| `@klnap/payload-storage-sanity/next` | `SanityImage`, `createSanityImage`, `toSanityImageProps`, loaders |
| `@klnap/payload-storage-sanity/next/loader` | Default export for `images.loaderFile` |
| `@klnap/payload-storage-sanity/styles/admin-tailwind.css` | Admin stylesheet |

Consumer guide: [docs/consumers.md](./docs/consumers.md). Setup and troubleshooting: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md). Contributing and releases: [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
