# `@klnap/payload-storage-sanity`

Store Payload uploads in Sanity, manage media in Payload, and deliver Sanity CDN images to your frontend.

```tsx
import type { MediaAsset } from '@klnap/payload-storage-sanity/consumers'
import { isMediaImageAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: MediaAsset }) {
  if (!isMediaImageAsset(image)) return null
  return <SanityImage asset={image} sizes='100vw' />
}
```

`MediaAsset` represents normalized image or file relationships. `isMediaAsset()` checks that shape; `isMediaImageAsset()` narrows it for `SanityImage`.

## Why?

Payload keeps media records, relationships, access rules, and editorial workflows. Sanity stores the files and serves transformed image variants. This package connects the two without replacing Payload’s media model or storing new Payload image-size copies.

## Features

### Storage and delivery

- Store image and file uploads in Sanity while keeping media documents and relationships in Payload.
- Serve transformed image variants from Sanity’s CDN on demand.
- Keep Payload’s existing upload settings. By default, the plugin disables local file copies and sets `imageSizes` to `[]` for configured collections.
- Retain replaced and deleted files in Sanity; the plugin does not delete remote assets.

### Media management

- Browse media in a Payload gallery with justified, grid, and list layouts, image previews, file-type cards, and selectable rows.
- Edit crop and focal point with Payload’s upload controls. Cropping uploads the edited bytes as a new Sanity asset; focal-point-only edits update media metadata without re-uploading the file.
- Add alt text (localized when Payload localization is configured) and titles, group new Sanity assets into `sanity-plugin-media` folders, and optionally reject duplicate uploads or deletion of referenced Payload media.

The gallery replaces a collection’s list view by default when no custom list view exists. Set `admin.gallery: false` to keep Payload’s native table.

### Frontend delivery

- Normalize eligible populated media relationships to a flat object with a CDN URL, dimensions, focal point, localized alt text, and optional LQIP.
- Use the framework-independent URL builder or the optional Next.js `SanityImage` component and loader.
- Keep full Payload media documents available for direct media reads and explicit full population.

The default populate preset applies to eligible populated relationships, not every media read. The [consumer guide](./docs/consumers.md) describes when normalization applies and how to narrow runtime responses.

## Installation

Install the package:

```bash
bun add @klnap/payload-storage-sanity
```

```bash
npm install @klnap/payload-storage-sanity
```

Both commands install the package’s required peer dependencies when they are absent. The `next` peer is optional and is needed only for the Next.js consumer.

## Usage

### Configure Payload storage

Add `sanityStorage()` to the `plugins` array in your existing Payload config. The plugin discovers upload collections without another storage adapter by default.

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

Use `plugins` in `buildConfig()`. The upload collections must already exist. Keep the Sanity write token server-side; do not expose it to browser code.

Select collections and configure editorial fields as needed:

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
  },
})
```

Folder grouping uses the `sanity-plugin-media` model. Install `sanity-plugin-media >=6.1.0` only if editors need to browse those folders in Sanity Studio.

### Render a populated image

Fetch the containing document with `depth: 1`, then narrow the relationship before rendering it:

```tsx
import { isMediaImageAsset } from '@klnap/payload-storage-sanity/consumers'
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ page }: { page: { heroImage: unknown } }) {
  if (isMediaImageAsset(page.heroImage)) {
    return <SanityImage asset={page.heroImage} sizes='(max-width: 768px) 100vw, 50vw' />
  }

  return null
}
```

`isMediaImageAsset()` accepts only normalized Sanity image CDN URLs. `isMediaAsset()` also accepts file assets.

Without Next.js, use `buildSanityImageUrl()` from `@klnap/payload-storage-sanity/consumers`. It accepts normalized assets, full media documents, supported image URLs, and Sanity asset references. A bare asset reference without a stored URL requires a Sanity client.

## Configuration

| Option                                         | Default             | Behavior                                                                                                      |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `collections`                                  | Automatic discovery | Select upload collections without another storage adapter. An explicit map selects only its enabled entries.  |
| `mode`                                         | `'full'`            | `'full'` registers storage; `'fields-only'` adds Sanity fields and hooks; `'off'` skips storage registration. |
| `admin.gallery`                                | `true`              | Use the gallery unless the collection already defines a custom list view.                                     |
| `collections.<slug>.folder`                    | `'Payload'`         | Assign new assets to a logical `sanity-plugin-media` folder. Changing it does not move existing assets.       |
| `populate.preset`                              | `'default'`         | Normalize eligible populated media relationships; use `'full'` to return full documents.                      |
| `collections.<slug>.alt.enabled` / `.required` | `true` / `false`    | Add localized alt text unless the collection already defines `alt`; optionally require text for each locale.  |
| `dedupeUploads`                                | `false`             | Reject duplicate media creates by SHA-1.                                                                      |
| `preventDeleteWhenReferenced`                  | `true`              | Block deletion of Payload media referenced by supported Payload relationships.                                |
| `sync.enabled`                                 | `false`             | Add authenticated webhook and reconcile endpoints for Sanity asset changes.                                   |

For all options, precedence, limits, and endpoint behavior, see [Configuration and public API](./docs/configuration.md).

## Asset access and lifecycle

Sanity CDN asset URLs are public, including when the dataset is private. By default, generated file URLs use the CDN directly and bypass Payload’s file-delivery access-control proxy. Setting `disablePayloadAccessControl: false` routes generated URLs through Payload, but does not make an exposed CDN URL private.

Replacing or deleting a Payload media record does not delete its Sanity asset. Cropping creates a replacement asset and retains the previous one. Plan remote asset cleanup separately, accounting for shared assets and references.

See [Failure semantics](./docs/FAILURE_SEMANTICS.md) and the [security policy](./SECURITY.md) before using this package for sensitive media.

## Compatibility

| Requirement                                               | Supported versions                      |
| --------------------------------------------------------- | --------------------------------------- |
| Payload, `@payloadcms/ui`, and `@payloadcms/translations` | `>=3.94.1 <4`                           |
| React and React DOM                                       | `^19.3.1`                               |
| `@sanity/client`                                          | `>=6 <9`                                |
| Next.js consumer                                          | `>=16.4.5 <17`                          |
| Node.js                                                   | `^22.23.5 \|\| ^24.22.3 \|\| >=26.13.1` |

The Next.js consumer is optional and requires an application using Next.js.

## Documentation

- [Configuration and public API](./docs/configuration.md)
- [Frontend consumers and type behavior](./docs/consumers.md)
- [Failure semantics and asset lifecycle](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security policy](./SECURITY.md)

## License

[MIT](./LICENSE)
