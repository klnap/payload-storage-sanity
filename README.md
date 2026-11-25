# @klnap/payload-storage-sanity

Sanity-powered media storage for Payload CMS.

Manage media in Payload while using Sanity for asset storage, on-demand image transformations, and global CDN delivery.

Store originals once, manage localized alt text and focal points directly in Payload, and render frontend-ready assets without manually transforming media documents.

Includes an enhanced media management experience and optional Next.js integration. No Sanity Studio required.

## Why Sanity

Sanity stores original assets and serves requested image variants from its global Asset CDN. Frontends can request widths, crops, and formats through URL parameters instead of maintaining Payload-generated image sizes.

Sanity assets are content-addressed, and each requested variant is cached by its URL. See [Sanity pricing](https://www.sanity.io/pricing) for current plan limits.

## Architecture

```text
Editors                         Frontend applications
   │                                      │
   ▼                                      ▼
Payload CMS ── upload original ──► Sanity Asset API
   │                                  │
   ├─ media documents                 ├─ original assets
   ├─ relationships and access        ├─ global Asset CDN
   ├─ localized editorial metadata    └─ on-demand image variants
   └─ native admin experience                  ▲
                                               │
                                  normalized media response
```

Payload owns media documents, relationships, access control, alt text, focal points, and editorial workflows. Sanity stores the uploaded assets and serves CDN URLs and transformed image variants. Frontends consume populated Payload media and request the variants they need.

Payload does not store Sanity's transformed variants. Sanity does not manage Payload's content relationships.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

Required peers: Payload, `@payloadcms/ui`, and `@payloadcms/translations` `>=3.94.1 <4`; `@sanity/client >=6 <9`; and React and React DOM `^19.3.1`. Install Next.js `>=16.4.5 <17` only when using the optional `./consumers/next` entry. Node.js must match `^24.22.3 || >=26.13.1`.

The published package is ESM and expects a bundler to resolve its extensionless imports. Raw Node.js ESM imports are not supported.

## Payload configuration

Add `sanityStorage()` to the Payload config that already declares your upload collections:

```ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  collections: [Media, Documents, Pages],
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
    }),
  ],
})
```

The plugin integrates with Payload's native cloud-storage adapter. Keep each collection's existing `upload` configuration; the plugin supplies the adapter and preserves supported Payload collection options.

Choose collections and folders explicitly when needed:

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,

  collections: {
    media: {
      folder: 'website/images',
      alt: {
        required: true,
      },
    },

    documents: {
      folder: 'website/documents',
    },
  },
})
```

## Reading the configuration

Each entry in `collections` defines how an existing Payload upload collection uses Sanity.

- `media` uses Sanity storage, puts new assets in `website/images`, and requires alternative text.
- `documents` puts new assets in `website/documents`.
- Unlisted collections stay outside the integration when you provide an explicit map.

When `collections` is omitted, the plugin discovers upload collections that do not already have a storage adapter. An empty map selects none. Set an entry to `false` or `{ enabled: false }` to exclude it; `true`, `{}`, and options without `enabled: false` enable it.

Explicit entries must name existing upload collections. An explicit collection that already has another adapter fails configuration. Automatic discovery skips collections with another adapter. Collection slugs use Payload's generated `UploadCollectionSlug` type when generated types are configured.

## Consumers

### Framework-independent usage

Import frontend contracts and utilities from `@klnap/payload-storage-sanity/consumers`. This entry does not import Next.js or Payload server modules.

#### Asset types

`DefaultPopulateAsset`, `SanityAssetReference`, `SanityImageSource`, and `SanityImageAssetMapping` describe the supported consumer-side asset shapes. Import these types from `@klnap/payload-storage-sanity/consumers`.

```ts
import type {
  DefaultPopulateAsset,
  SanityAssetReference,
  SanityImageAssetMapping,
  SanityImageSource,
} from '@klnap/payload-storage-sanity/consumers'
```

#### Populated media

The default populate preset converts eligible, populated media relationships into a compact `DefaultPopulateAsset`. It includes a resolved CDN URL, image dimensions and aspect ratio when available, focal point, localized alt text, and LQIP when Sanity provides one.

Fetch the `website` page with depth `1`. Check the relationship at runtime because Payload's generated types describe the configured media document, not the plugin's populated response transformation:

```ts
import { isDefaultPopulateAsset } from '@klnap/payload-storage-sanity/consumers'

const { docs } = await payload.find({
  collection: 'pages',
  depth: 1,
  locale: 'en',
})

const page = docs[0]
const image = page?.heroImage

if (isDefaultPopulateAsset(image)) {
  // `image` is now a DefaultPopulateAsset.
}
```

The same populated shape is available from the remote REST API:

```ts
import { isDefaultPopulateAsset } from '@klnap/payload-storage-sanity/consumers'

const response = await fetch('/api/pages?depth=1&locale=en')
const { docs } = await response.json()
const image = docs[0]?.heroImage

if (isDefaultPopulateAsset(image)) {
  // `image` is now a DefaultPopulateAsset.
}
```

A successful normalized relation resembles:

```json
{
  "id": "media-42",
  "url": "https://cdn.sanity.io/images/project/production/hero-1600x900.jpg",
  "width": 1600,
  "height": 900,
  "aspectRatio": 1.7778,
  "focalX": 50,
  "focalY": 43,
  "alt": "The website team at work",
  "lqip": "data:image/jpeg;base64,..."
}
```

The guard narrows only normalized assets. Unpopulated IDs, full media documents, and unavailable assets do not pass it.

`DefaultPopulateAsset` describes only successfully normalized image relationships. Depth `0` returns relationship IDs. Direct media reads, authenticated requests, explicit populate selections, and the `full` preset return full media documents. If an eligible relation has no resolvable CDN URL, the plugin also keeps the full document. Set `populate.localPopulate: false` to keep Local API reads full.

Dimensions, aspect ratio, and LQIP are image metadata and remain optional. General file metadata such as filename, MIME type, and size stays on the full Payload media document.

#### Image URL builder

Use the framework-independent URL builder for normalized assets, media documents, URLs, and Sanity asset references:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const card = buildSanityImageUrl(image, { width: 640, height: 480, fit: 'crop' })
const thumbnail = buildSanityImageUrl(image, { width: 160, height: 160, fit: 'max', quality: 70 })
const originalFormat = buildSanityImageUrl(image, { width: 1200, autoFormat: false })
```

The builder supports `width`, `height`, `fit` (`max`, `min`, `crop`, or `clip`), `quality`, a pixel `rect`, and `autoFormat` (enabled by default). It returns `null` when no URL can be resolved. Stored URLs need no client or network request. A bare asset reference without a URL needs a Sanity client.

For custom responsive markup, request only the widths the layout needs:

```ts
const srcSet = [480, 960, 1440]
  .flatMap((width) => {
    const url = buildSanityImageUrl(image, { width })
    return url ? [`${url} ${width}w`] : []
  })
  .join(', ')
```

### Next.js

The Next.js integration is optional and isolated at `@klnap/payload-storage-sanity/consumers/next`.

#### SanityImage

```tsx
import { isDefaultPopulateAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

if (isDefaultPopulateAsset(image)) {
  return <SanityImage asset={image} sizes="100vw" />
}
```

`SanityImage` supports `DefaultPopulateAsset` by default. Pass `assetMapping` for custom populated shapes. It handles dimensions, focal positioning, placeholders, alt overrides, and missing-image fallbacks.

#### Image loader

For a global loader, re-export the default loader from the dedicated entry:

```ts
// sanity-image-loader.ts
export { default } from '@klnap/payload-storage-sanity/consumers/next/loader'
```

```ts
// next.config.ts
export default {
  images: {
    loader: 'custom',
    loaderFile: './sanity-image-loader.ts',
  },
}
```

A global custom loader affects every `next/image`. It adds width, quality, and format negotiation to compatible Sanity URLs. Other URLs pass through unchanged and do not use Next.js's built-in optimizer.

For mixed image providers, use the scoped loader:

```tsx
import { SanityImage, sanityImageLoader } from '@klnap/payload-storage-sanity/consumers/next'

return <SanityImage asset={image} loader={sanityImageLoader} sizes="100vw" />
```

#### Responsive images

`SanityImage` requests responsive widths through `next/image`, using its configured loader. Other `next/image` instances retain Next.js's normal loader and optimization.

## Media management

The plugin adds a media workflow to the native Payload admin:

- Justified and grid gallery layouts.
- File cards for non-image uploads.
- A media detail view with an asset preview and metadata inspector.
- Crop and focal-point editing, following the collection's native Payload upload settings.
- Folder organization, upload progress feedback, and unavailable-asset recovery.

The gallery replaces Payload's list view by default. Set `admin.gallery: false` for a collection to keep Payload's native table view. Payload remains the editing surface; uploads and delivery do not require Sanity Studio. This repository does not include documentation screenshots of the working admin UI.

## Localized alt text

Define alternative text once per media document, translate it for each supported locale, and reuse it wherever the asset appears.

The plugin adds an `alt` group with one text field per Payload locale, or one `alt` text field when localization is off. Existing `alt` fields are left unchanged. It follows Payload's locale configuration but remains a regular group, so Payload's localized-field fallback does not fill missing translations. The default is optional; `alt.required: true` requires a non-empty value for every configured locale.

The default populate preset returns only the requested locale's text. A missing translation returns `null`; it never substitutes another locale. An explicitly empty string is preserved for decorative images. Whitespace-only values are treated as missing. Keep `required` off when editors need intentionally empty decorative alt text. `SanityImage` keeps an explicit `alt=""` override; `fallbackAlt` applies only when stored alt text is missing, not when it is intentionally empty.

Asset-level alt text gives every reference a useful default. It does not replace context-specific descriptions when an image's meaning changes by placement.

## Folders

Set a logical Sanity folder per Payload upload collection with `collections.<slug>.folder`. New assets use `Payload` when no folder is set. Folder paths do not change CDN URLs.

The plugin writes `media.folder` documents and `opt.media.folder` asset metadata for the `sanity-plugin-media` model. Sanity Studio and `sanity-plugin-media` are optional; install `sanity-plugin-media` `>=6.1.0` only when editors need to browse these folders in Studio. Sanity Media Library uses a separate folder system, which this plugin does not write.

For assets uploaded by another service, `@klnap/payload-storage-sanity/folders` exports `assignSanityAssetFolder(client, assetId, folderPath)` to create this same browseable hierarchy.

## Asset lifecycle

The plugin uploads image and file assets through Sanity's Content Lake Asset API. Replacing a file uploads a new asset and keeps the old one. Deleting a Payload media document does not delete its Sanity asset. Failed uploads or replacements can leave unreferenced assets.

The plugin never performs remote asset cleanup. Sanity asset IDs identify content; they do not prove exclusive ownership. This avoids deleting assets shared by other media documents or Sanity content, but operators must manage orphan retention separately.

`preventDeleteWhenReferenced` defaults to `true` and blocks deletion of a Payload media document still referenced by supported Payload relationships. PostgreSQL uses transaction-scoped locks for plugin-managed reference writes and deletes. Other database adapters fail guarded deletes with `503`. Direct SQL and external writes bypass the guard. None of these operations is transactional across Payload and Sanity.

## Integration with @klnap/revalidation

[`@klnap/revalidation`](https://www.npmjs.com/package/@klnap/revalidation) is optional. Its Payload producer can find pages that directly reference a changed media document; its consumer invalidates the cache targets configured by your frontend.

Opt pages into revalidation and configure the producer separately from storage:

```ts
import { buildConfig, type CollectionConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'
import { http } from '@klnap/revalidation/dispatchers/http'
import { revalidation } from '@klnap/revalidation/producers/payload'

const Pages: CollectionConfig = {
  slug: 'pages',
  custom: { revalidation: true },
  fields: [{ name: 'heroImage', type: 'upload', relationTo: 'media' }],
}

export default buildConfig({
  collections: [Media, Pages],
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
    }),
    revalidation({
      target: {
        url: process.env.REVALIDATION_URL!,
        secret: process.env.REVALIDATION_SECRET!,
      },
      dispatcher: http(),
    }),
  ],
})
```

When an editor replaces an image or changes its alt text, the producer discovers supported direct references to that media document. The frontend consumer invalidates the configured cache targets for those pages. The storage plugin uploads and manages media; it does not send revalidation events.

Media updates and deletes trigger discovery; creates do not. Discovery is limited to opted-in published collections and supported direct upload or relationship fields. It does not traverse through another document, blocks, rich text, JSON, or joins. Dependency-discovery failures are logged and are not retried. Dispatch is scheduled in memory about one second after the Payload hook returns; it is not durable and can outlive a rolled-back write. The built-in HTTP dispatcher retries retryable transport errors, timeouts, `429`, and `5xx` responses within its deadline. Its default is two retries after the first attempt. These retries do not provide durable delivery.

Frontend cache invalidation is separate from Sanity CDN caching. Neither package purges the Sanity CDN.

See the [Payload producer guide](https://github.com/klnap/revalidation/blob/v0.2.2/docs/producers/payload.md) and [media dependency guide](https://github.com/klnap/revalidation/blob/v0.2.2/docs/producers/payload-media-dependencies.md) for supported references and delivery behavior.

## Synchronization

Optional `sync` settings add a Sanity webhook endpoint and a reconcile endpoint. The webhook authenticates the raw request body with an HMAC secret. Sync can mark unavailable media or remove Payload media rows; it does not delete Sanity assets.

## Security

Keep `token` on the server. It is a Sanity write token used by the integration; never expose it in browser code or public environment variables.

Dataset visibility does not make uploaded Content Lake assets private. Sanity dataset assets are accessible through the Asset CDN to anyone with the URL, even when the dataset is private. Payload access control protects Payload API reads, not an already exposed CDN URL. Private Media Library assets and signed delivery URLs are not supported.

The storage adapter defaults to direct CDN file URLs, bypassing Payload's file-delivery access-control proxy. Set `disablePayloadAccessControl: false` to route generated file URLs through Payload, but do not treat that as protection for an exposed Sanity CDN URL.

## Compatibility

See [Installation](#installation) for the verified Payload, React, Next.js, Node.js, and ESM ranges. Existing Payload upload settings remain in place unless this integration documents otherwise; Payload `imageSizes` are disabled for configured collections because resized delivery uses Sanity's CDN.

## Documentation

- [Configuration and options](./docs/configuration.md)
- [Frontend consumers and type behavior](./docs/consumers.md)
- [Failure semantics and operational limits](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

## License

MIT
