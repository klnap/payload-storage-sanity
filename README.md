# `@klnap/payload-storage-sanity`

Store Payload uploads in Sanity and deliver transformed images from Sanity’s CDN while keeping media records and editorial workflows in Payload.

```tsx
import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: DefaultPopulateAsset | null }) {
  return image ? <SanityImage asset={image} sizes='100vw' /> : null
}
```

`image` is a populated Payload media relationship normalized by the plugin. `SanityImage` uses the asset URL, dimensions, focal point, localized alt text, and placeholder when available.

## Why?

Payload’s upload collections provide media records, relationships, access rules, and editorial workflows. Sanity stores the original files and its Asset CDN creates and serves requested image variants on demand. This package connects the two: editors keep working in Payload, while frontends request the image sizes they need without storing Payload-generated derivatives.

Payload remains the source of media metadata and relationships. Sanity stores the files and serves their CDN URLs. The package uses Payload’s cloud-storage adapter rather than replacing Payload’s media model.

## Features

- Store image and file uploads in Sanity while keeping media documents and relationships in Payload.
- Serve transformed image variants from Sanity’s CDN instead of maintaining Payload image-size copies.
- Use a Payload admin gallery with image previews, metadata, focal-point editing, and upload feedback.
- Normalize populated media relationships for framework-independent consumers or the optional Next.js image component.
- Add localized alt text, Sanity Studio folder grouping, duplicate-upload checks, and webhook synchronization when needed.

## Installation

Install the package and its required peer dependencies:

```bash
bun add @klnap/payload-storage-sanity payload @payloadcms/ui @payloadcms/translations @sanity/client react react-dom
```

```bash
npm install @klnap/payload-storage-sanity payload @payloadcms/ui @payloadcms/translations @sanity/client react react-dom
```

The Next.js consumer also requires Next.js. See [Compatibility](#compatibility) for supported versions.

If you use the optional Next.js consumer, install its peer dependency too:

```bash
bun add next
```

```bash
npm install next
```

## Usage

### Basic Payload setup

Add `sanityStorage()` to the `plugins` array in the Payload config that contains your upload collections. Keep your existing collection definitions and upload settings.

```ts
import { sanityStorage } from '@klnap/payload-storage-sanity'

export const plugins = [
  sanityStorage({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET!,
    token: process.env.SANITY_API_TOKEN!,
  }),
]
```

Use `plugins` in your existing `buildConfig()`. The collection must already exist and have Payload uploads enabled. Set a server-side Sanity token for the dataset; never expose it to browser code. By default, the plugin discovers upload collections without an existing storage adapter. See [Configuration](#configuration) to select collections explicitly.

### Render populated media in Next.js

The default populate preset normalizes eligible populated media relationships. Fetch the containing document with depth at least `1`, then narrow the relationship with `isDefaultPopulateAsset()` before rendering it.

```tsx
import { isDefaultPopulateAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

// `page` was fetched from Payload with depth: 1.
const image = page.heroImage

if (isDefaultPopulateAsset(image)) {
  return <SanityImage asset={image} sizes="(max-width: 768px) 100vw, 50vw" />
}

return null
```

`SanityImage` uses Next.js `Image` and the Sanity CDN. The Next.js entry is optional; framework-independent consumers can use the normalized asset directly.

### Build image URLs without Next.js

Use the framework-independent consumer entry to transform a stored Sanity URL:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const cardUrl = buildSanityImageUrl(image, {
  width: 640,
  height: 480,
  fit: 'crop',
})
```

The builder returns `null` when it cannot resolve an image URL. It supports populated assets, media documents, URLs, and Sanity asset references. A bare asset reference needs a Sanity client; stored URLs do not.

### Organize assets into Sanity Studio folders

Set `collections.<slug>.folder` to group new uploads, or call `assignSanityAssetFolder()` for assets uploaded elsewhere. Folder grouping uses the `sanity-plugin-media` model; it does not create Sanity Media Library folders or change CDN URLs. Install `sanity-plugin-media >=6.1.0` and use Sanity Studio only if editors need to browse these folders.

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: { folder: 'website/images' },
  },
})
```

See [Configuration and public API](./docs/configuration.md) for standalone folder assignment and optional synchronization.

## Configuration

`sanityStorage()` requires a Sanity project ID and dataset. In the default `full` mode, it also requires a server-side write token.

| Option                                                               | Default             | Behavior                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`                                                        | Automatic discovery | Select upload collections without another storage adapter. An explicit map selects only its enabled entries.                                            |
| `mode`                                                               | `'full'`            | `'full'` uploads to Sanity and registers the adapter; `'fields-only'` adds Sanity fields and hooks without storage; `'off'` skips adapter registration. |
| `collections.<slug>.folder`                                          | `'Payload'`         | Assign new assets to a logical `sanity-plugin-media` folder. Does not move existing assets.                                                             |
| `populate.preset`                                                    | `'default'`         | Normalize eligible populated media relationships; use `'full'` to return full media documents.                                                          |
| `admin.gallery`                                                      | `true`              | Use the media gallery instead of the collection list view when no custom list view exists.                                                              |
| `collections.<slug>.alt.enabled` / `collections.<slug>.alt.required` | `true` / `false`    | Add localized alt text unless the collection already defines `alt`; optionally require non-empty text for each locale.                                  |
| `dedupeUploads`                                                      | `false`             | Reject duplicate media creates by SHA-1 when using `full` mode.                                                                                         |
| `preventDeleteWhenReferenced`                                        | `true`              | Block deletion of media documents referenced by supported Payload relationships.                                                                        |
| `sync.enabled`                                                       | `false`             | Add authenticated webhook and reconcile endpoints for Sanity asset changes.                                                                             |

For configured collections, the adapter sets Payload `imageSizes` to `[]`; Sanity supplies transformed image variants. It keeps other supported Payload upload settings. Replacing a Payload media record does not delete its previous Sanity asset, and deleting a Payload record does not delete the Sanity asset.

**Asset URLs are public.** Sanity CDN URLs are accessible to anyone who has the URL, even when the dataset is private. By default, generated file URLs use the CDN directly and bypass Payload’s file-delivery access-control proxy. Setting `disablePayloadAccessControl: false` routes generated URLs through Payload, but does not make an exposed CDN URL private. See the [security policy](./SECURITY.md) and [failure semantics](./docs/FAILURE_SEMANTICS.md).

For all options, precedence rules, and endpoint behavior, see [Configuration and public API](./docs/configuration.md).

## Compatibility

Published version: **0.2.2**.

| Requirement                                               | Supported versions |
| --------------------------------------------------------- | ------------------ |
| Payload, `@payloadcms/ui`, and `@payloadcms/translations` | `>=3.94.1 <4`      |
| React and React DOM                                       | `^19.3.1`          |
| `@sanity/client`                                          | `>=6 <9`           |
| Next.js consumer                                          | `>=16.4.5 <17`     |

Node.js must be `^22.23.5`, `^24.22.3`, or `>=26.13.1`.

The package publishes ESM with extensionless internal imports and expects a bundler to resolve them. Raw Node.js ESM imports are not supported. Next.js is needed only for the `./consumers/next` entry.

## Documentation

- [Configuration and public API](./docs/configuration.md)
- [Frontend consumers and type behavior](./docs/consumers.md)
- [Failure semantics and asset lifecycle](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security policy](./SECURITY.md)

## License

[MIT](./LICENSE)
