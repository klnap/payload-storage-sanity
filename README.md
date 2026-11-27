# @klnap/payload-storage-sanity

Sanity-powered storage for Payload CMS with an enhanced media admin UI.

Add the plugin to the `plugins` array in your existing Payload `buildConfig`:

```ts
import { sanityStorage } from '@klnap/payload-storage-sanity'

plugins: [
  sanityStorage({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET!,
    token: process.env.SANITY_API_TOKEN!,
  }),
]
```

## Why Sanity?

Payload manages content, relationships, media records, and editorial workflows. Sanity provides
managed asset storage and a global Asset CDN that serves files and on-demand image transformations.

This plugin connects the two systems: Payload remains the media workspace, while Sanity stores and
delivers the uploaded assets. The plugin does not provide a CDN or image transformation engine.

Sanity's [Image API](https://www.sanity.io/docs/apis-and-sdks/image-urls) supports URL-based resizing,
cropping, and format negotiation with `auto=format`. Its [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn)
delivers assets and caches requested variants. These managed capabilities reduce the need to generate
and store predefined image sizes in Payload.

## Features

### Storage

- Integrate Payload uploads with Sanity asset storage and keep Payload media documents and relationships.
- Discover eligible upload collections automatically or configure several collections explicitly.
- Store Sanity asset references and metadata on Payload media documents; disable local copies and
  Payload image-size generation by default.
- Upload replacements as new Sanity assets; keep remote assets when media records are deleted.

### Enhanced Media Admin UI

- Browse assets in visual gallery layouts and supported selection drawers.
- Review and edit individual media documents with larger previews, crop and focal-point tools,
  replacement controls, and asset details.

### Media Population

- Normalize eligible populated media relationships to a compact `MediaAsset` response.

### Consumers

- Optionally use `SanityImage` with Next.js or build image URLs in any frontend.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

```bash
npm install @klnap/payload-storage-sanity
```

## Usage

### Storage configuration

When `collections` is omitted, the plugin discovers upload collections that do not already use a
storage adapter.

Select multiple collections and set their Sanity folders explicitly:

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: {
      folder: 'website/images',
    },
    documents: {
      folder: 'website/documents',
    },
  },
})
```

Explicit configuration selects only the listed enabled collections. The plugin does not replace an
existing storage adapter.

The plugin keeps Payload's upload editor and native metadata. For selected collections it disables
local file copies, forces `imageSizes: []` instead of generating Payload image derivatives, and
enables crop and focal-point editing by default.
Collections can keep their own explicit crop and focal-point settings.

Unless a collection already defines them, the plugin adds an editable title and an alt field. Alt text
uses one field without Payload localization and a locale group when localization is configured.

Set `collections.<slug>.folder` to a path such as `website/images`. The plugin creates missing
logical folder records and assigns new assets; changing the path does not move existing assets.
Install `sanity-plugin-media` only if editors also need to browse those folders in Sanity Studio.
Folder assignment and asset uploads do not require Sanity Studio.

### Enhanced Media Admin UI

#### Media Gallery

When enabled, the gallery replaces Payload's standard media list with large image previews and
image-focused browsing. A collection's own list component takes precedence. If custom document links
require Payload's default list, the gallery remains available in supported selection drawers.

- **Justified:** rows preserve each image's original aspect ratio.
- **Grid:** consistent tiles show image previews with `object-fit: cover`.
- **List:** returns to Payload's native table.
- **Other files:** use file-type artwork and keep their filenames visible.
- **Selection:** keeps Payload's row selection and bulk actions; list drawers support selection when
  Payload provides the corresponding callbacks.
- **Native controls:** Payload's list controls remain available around the gallery.

The gallery does not add a separate bulk-file uploader; uploads use Payload's native upload input.
It is enabled by default where applicable. Set `admin.gallery: false` to keep the native media list.
The enhanced list also appears in supported media selection drawers, not upload or create drawers.

#### Media Detail View

Opening a media document shows a larger image preview with a blur placeholder when available. Other
files use Payload's native file card with a file-type icon, filename, URL, size, and MIME type. Image
details include dimensions and aspect ratio when available.

The plugin adds an editable title and alt text unless the collection already defines those fields.
Alt text uses a locale group when Payload localization is enabled. Payload's native upload editor
continues to own file replacement and image-edit controls; the plugin adds the larger preview and
replacement presentation. Sanity asset references and metadata remain in the hidden, read-only
`sanity.asset` field.

#### Crop

Sanity's standard image crop stores crop metadata beside a reference to the original asset; it does
not change the underlying image. See Sanity's [image field](https://www.sanity.io/docs/studio/image-type)
and [image presentation](https://www.sanity.io/docs/apis-and-sdks/presenting-images) documentation.

This plugin applies Payload's crop to the image bytes, uploads the cropped result as a new Sanity
asset, and points the Payload media record to it. The record no longer references the uncropped
asset, so the original is lost from that media record. The old asset remains in Sanity, but may be
unreferenced; its old CDN URL may still work. Later CDN transformations start from the cropped
asset, so removing URL parameters cannot restore removed pixels. Physical cropping is not secure
redaction and does not revoke previously shared URLs.

#### Focal Point

Editors set the focal point in Payload. Coordinates stay in Payload's native `focalX` and `focalY`
fields; changing only the focal point does not re-upload the image. Eligible populated relationships
include these coordinates, defaulting to `50` when absent.

Next.js `SanityImage` applies focal coordinates with CSS `object-position` and `object-fit: cover`.
They do not become Sanity CDN crop parameters, and `buildSanityImageUrl()` does not infer them.
Payload crop and focal-point controls default to enabled; collection-level Payload settings override
those defaults:

```ts
{
  slug: 'media',
  upload: {
    crop: false,
    focalPoint: false,
  },
}
```

### Media Population

The default `populate.preset: 'default'` normalizes eligible populated image and file relationships
to `MediaAsset`. It includes the Payload media ID, Sanity URL, alt text, and focal coordinates;
image dimensions, aspect ratio, and LQIP are optional. Direct media reads and full population keep
the Payload document. See [Media Population](./docs/media-population.md) for the verified response
shape, depth rules, and configuration.

### Consumers

#### Next.js

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function ArticleCover({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='(max-width: 768px) 100vw, 50vw' />
}
```

Next.js supplies responsive widths to the component's scoped loader. The loader adds width,
quality, and `auto=format` to supported Sanity image URLs; Sanity performs the transformations.
`SanityImage` uses available intrinsic dimensions, forwards alt text, applies CSS focal positioning,
and uses LQIP when available. Missing dimensions use `fill`; non-images and invalid assets use the
fallback. Next.js remains optional.

For one `SanityImage`, set a custom compatible CDN host directly:

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function ArticleCover({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} cdnBaseUrl='https://images.example.com' sizes='100vw' />
}
```

For app-wide configuration, create `sanity-image-loader.ts` with the public
`createSanityImageLoader` export:

```ts
import { createSanityImageLoader } from '@klnap/payload-storage-sanity/consumers/next'

export default createSanityImageLoader({ cdnBaseUrl: 'https://images.example.com' })
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

A global loader affects every `next/image`. Keep it scoped to `SanityImage` when the app uses mixed
image providers. See [Next.js consumers](./docs/consumers.md#nextjs) for loader details.

#### Framework-independent Image URLs

Use `buildSanityImageUrl()` when you need a transformed CDN URL without Next.js:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const url = buildSanityImageUrl(heroImage, {
  width: 960,
  height: 640,
  fit: 'crop',
  quality: 80,
})
```

It accepts a populated `MediaAsset`, a full media document, an image URL, or a Sanity asset reference.
For supported Sanity image URLs it accepts width, height, fit, quality, pixel `rect`, and format
negotiation options. It returns file URLs unchanged and `null` when no URL can be resolved. A bare
asset reference without a stored URL requires a client from `@sanity/client` or
`createSanityClient()` from this package's `/client` entry. Focal coordinates are not inferred.

## Configuration

| Option                                           | Default             | Purpose                                                            |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------ |
| `collections`                                    | Automatic discovery | Select upload collections without another storage adapter.         |
| `mode`                                           | `'full'`            | Upload to Sanity and register the storage adapter.                 |
| `admin.gallery`                                  | `true`              | Use the gallery where native/custom list behavior allows it.       |
| `collections.<slug>.admin.gallery`               | Inherits `admin`    | Override gallery behavior for one collection.                      |
| `collections.<slug>.folder`                      | `'Payload'`         | Set the logical Sanity folder for new uploads.                     |
| `collections.<slug>.alt.enabled`                 | `true`              | Add alt text unless the collection already defines `alt`.          |
| `collections.<slug>.alt.required`                | `false`             | Require alt text in each locale.                                   |
| Payload `upload.crop`                            | `true`              | Keep or disable Payload's physical crop editor.                    |
| Payload `upload.focalPoint`                      | `true`              | Keep or disable Payload's focal-point editor.                      |
| `collections.<slug>.populate.preset`             | `'default'`         | Normalize eligible populated relationships or keep full documents. |
| `collections.<slug>.populate.localPopulate`      | `true` for default  | Apply the default preset to Local API reads.                       |
| `collections.<slug>.disableLocalStorage`         | `true`              | Do not keep local file copies.                                     |
| `dedupeUploads`                                  | `false`             | Reject duplicate media creates by content hash.                    |
| `preventDeleteWhenReferenced`                    | `true`              | Protect supported Payload media relationships.                     |
| `collections.<slug>.disablePayloadAccessControl` | `true`              | Generate direct CDN URLs instead of Payload proxy URLs.            |

See [configuration and public API](./docs/configuration.md) for collection selection, option
precedence, advanced modes, and synchronization endpoints.

## Asset access and lifecycle

This plugin stores ordinary Sanity Content Lake dataset assets. Their CDN URLs are publicly
accessible, even when the dataset is private. Sanity Media Library's private assets and signed
delivery URLs are a separate visibility system and are not used by this plugin.

Payload document access control protects Payload API records. By default, generated file URLs point
directly to Sanity and bypass Payload's file-delivery proxy. Setting
`collections.<slug>.disablePayloadAccessControl: false` routes generated URLs through Payload, but
does not make an exposed Sanity CDN URL private.

Replacing or deleting a Payload media record does not delete its Sanity asset. Cropping uploads a
new asset and replaces the media record's reference; the original is no longer linked from that
record, but remains in Sanity and its old CDN URL may still work. Content-addressed Sanity assets
may be shared; check other references before external cleanup. The deletion guard protects
supported Payload relationships only. See
[failure semantics](./docs/FAILURE_SEMANTICS.md) and the [security policy](./SECURITY.md).

## Compatibility

| Requirement                                               | Supported versions                      |
| --------------------------------------------------------- | --------------------------------------- |
| Payload, `@payloadcms/ui`, and `@payloadcms/translations` | `>=3.94.1 <4`                           |
| React and React DOM                                       | `^19.3.1`                               |
| `@sanity/client`                                          | `>=6 <9`                                |
| Next.js consumer (optional)                               | `>=16.4.5 <17`                          |
| Node.js                                                   | `^22.23.5 \|\| ^24.22.3 \|\| >=26.13.1` |

## Documentation

- [Configuration and public API](./docs/configuration.md)
- [Media Population](./docs/media-population.md)
- [Consumers](./docs/consumers.md)
- [Failure semantics and asset lifecycle](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security policy](./SECURITY.md)
- Sanity [image URLs](https://www.sanity.io/docs/apis-and-sdks/image-urls)
- Sanity [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn)
- Sanity [presenting images](https://www.sanity.io/docs/apis-and-sdks/presenting-images)

## License

[MIT](./LICENSE)
