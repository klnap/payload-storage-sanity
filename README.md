# @klnap/payload-storage-sanity

Sanity-backed storage, visual media management, and on-demand image delivery for Payload CMS.

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='100vw' />
}
```

## Why?

Payload manages content, media relationships, metadata, and editorial workflows. Sanity provides
asset storage and a global CDN with on-demand image transformations.

This plugin combines both systems while keeping media management inside Payload. Editors get a visual
media library with large image previews and image editing tools, while developers deliver responsive,
optimized images without generating and storing multiple image-size variants in Payload.

Sanity's [image CDN](https://www.sanity.io/docs/apis-and-sdks/image-urls) can resize and transform
images when requested. Its global CDN caches transformed URLs. Sanity's image pipeline can also
negotiate modern output formats with `auto=format`. This separates content management from asset
delivery without adding Sanity's CMS functionality to Payload.

## Features

### Storage and delivery

- Store image and file uploads in Sanity.
- Deliver assets through Sanity's CDN.
- Resize and transform images on demand, including responsive variants.
- Avoid pre-generated Payload image-size copies.
- Configure multiple Payload upload collections.

### Media management

- Replace Payload's standard media list with visual browsing where supported.
- Inspect images in large previews.
- Switch between justified, grid, and list layouts.
- Preserve image proportions in justified view and use file-type cards for other files.
- Select media and use Payload's bulk selection where enabled.
- Edit titles and localized alt text in Payload.
- Organize new Sanity assets into folders.
- Optionally prevent duplicate uploads and deletion of referenced Payload media.

### Frontend integration

- Use a compact normalized `MediaAsset` type for populated media relationships.
- Render it directly with the Next.js `SanityImage` component.
- Generate responsive Sanity CDN variants and preserve intrinsic dimensions.
- Use focal-point-aware composition and LQIP placeholders where available.
- Build transformed image URLs without a frontend framework.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

```bash
npm install @klnap/payload-storage-sanity
```

## Usage

### Payload configuration

Add `sanityStorage()` to your existing Payload configuration:

```ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  // Existing Payload configuration
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
    }),
  ],
})
```

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

The plugin keeps Payload's upload editor and native metadata. For selected collections it disables
local file copies, sets `imageSizes: []`, and enables crop and focal-point editing by default.
Collections can keep their own explicit crop and focal-point settings.

Unless a collection already defines them, the plugin adds an editable title and an alt field. Alt text
uses one field without Payload localization and a locale group when localization is configured.
Sanity asset metadata is stored in a hidden, read-only `sanity.asset` field. Payload's width, height,
and focal-point fields remain available; populated `MediaAsset` values also include dimensions,
localized alt text, focal coordinates, and LQIP when Sanity provides it.

### Visual media browsing

The plugin replaces Payload's standard media collection list with image-focused browsing when the
gallery is enabled and no custom list view takes precedence. Large previews make assets easier to
recognize than small thumbnails or filenames.

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

### Crop and focal point

#### Crop

Sanity's standard image crop is non-destructive: crop metadata is stored alongside a reference to the
original image asset. The original remains unchanged, and its uncropped version can still be accessed
independently of that crop metadata. See Sanity's [image field](https://www.sanity.io/docs/studio/image-type)
and [image presentation](https://www.sanity.io/docs/apis-and-sdks/presenting-images) documentation.

This plugin applies Payload's crop to the image bytes. It uploads the cropped image to Sanity and
updates the Payload media record to reference the resulting asset. Later CDN transformations operate
on that cropped source image, not a separate crop definition.

If an editor removes part of an image, that content is absent from the active source asset. Removing
CDN crop parameters cannot restore those pixels. The previous Sanity asset is retained, however, and
its historical URL may remain accessible. Physical cropping is not deletion or secure redaction.

#### Focal point

Focal-point editing is non-destructive. The point stays in Payload's native upload metadata and does
not require uploading a new Sanity image.

`SanityImage` uses focal coordinates for CSS `object-position` when it composes an image with
`object-fit: cover`. The framework-independent `buildSanityImageUrl()` builder does not infer focal
coordinates; pass explicit transform options when building a URL. Crop and focal-point editing are
enabled by default. Disable either in the Payload collection's native upload configuration:

```ts
{
  slug: 'media',
  upload: {
    crop: false,
    focalPoint: false,
  },
}
```

### Frontend integration

#### Next.js

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function ProjectCard({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='(max-width: 768px) 100vw, 50vw' />
}
```

`SanityImage` uses the package's Sanity loader by default. Next.js supplies responsive widths; the
loader requests corresponding Sanity CDN variants with format negotiation. The component uses
intrinsic dimensions when available, forwards alt text, applies focal positioning, and displays an
LQIP placeholder when one exists. You can pass a custom Next.js `loader` for a compatible CDN host.

`MediaAsset` represents a normalized populated image or file relationship. `SanityImage` renders
supported Sanity image URLs and safely falls back for files or malformed input.

#### Media asset representation

This is the normalized response asserted by the package's populate test:

```ts
{
  id: '550e8400-e29b-41d4-a716-446655440000',
  url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
  width: 800,
  height: 600,
  aspectRatio: 1.333,
  focalX: 50,
  focalY: 50,
  alt: 'Caption',
  lqip: 'data:image/jpeg;base64,/9j/',
}
```

Eligible populated relationships use this compact representation. Direct media reads and full
population keep the full Payload document; see the [consumer guide](./docs/consumers.md) for
population details.

#### Framework-independent URLs

Use `buildSanityImageUrl()` when you need a transformed CDN URL without Next.js:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const url = buildSanityImageUrl(image, {
  width: 960,
  height: 640,
  fit: 'crop',
  quality: 80,
})
```

It transforms supported Sanity image URLs, returns file URLs unchanged, or returns `null` when no
image URL is available. For bare Sanity asset references without a stored URL, pass a client from
`@sanity/client` or `createSanityClient()` from this package's `/client` entry.

### Folder organization

Set `collections.<slug>.folder` to a path such as `website/images`. The plugin assigns new uploads to
that logical folder and creates missing folder records. It does not move existing assets.
Install `sanity-plugin-media` only if editors also need to browse these folders in Sanity Studio.

## Configuration

| Option                               | Default             | Purpose                                                             |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| `collections`                        | Automatic discovery | Select upload collections without another storage adapter.          |
| `admin.gallery`                      | `true`              | Replace the native list where no custom list view takes precedence. |
| `collections.<slug>.folder`          | `'Payload'`         | Set the logical Sanity folder for new uploads.                      |
| `collections.<slug>.alt.enabled`     | `true`              | Add alt text unless the collection already defines `alt`.           |
| `collections.<slug>.alt.required`    | `false`             | Require alt text in each locale.                                    |
| Payload `upload.crop`                | `true`              | Keep or disable Payload's physical crop editor.                     |
| Payload `upload.focalPoint`          | `true`              | Keep or disable Payload's focal-point editor.                       |
| `collections.<slug>.populate.preset` | `'default'`         | Normalize eligible populated relationships or keep full documents.  |
| `dedupeUploads`                      | `false`             | Reject duplicate uploads by content hash.                           |
| `preventDeleteWhenReferenced`        | `true`              | Protect media rows referenced by supported Payload relationships.   |

See [configuration and public API](./docs/configuration.md) for collection selection, option
precedence, advanced modes, and synchronization endpoints.

## Asset access and lifecycle

Ordinary Sanity dataset assets are public through the asset CDN, even when their dataset is private.
Per-asset visibility and signed URLs belong to Sanity Media Library's separate visibility system;
this plugin stores uploads as ordinary dataset assets.

Payload document access control protects Payload API records. By default, generated file URLs point
directly to Sanity and bypass Payload's file-delivery proxy. Setting
`disablePayloadAccessControl: false` routes generated URLs through Payload, but does not make an
exposed Sanity CDN URL private.

Replacing or deleting a Payload media record does not delete its Sanity asset. Physical cropping
changes the active asset reference but retains the previous asset, so its old CDN URL may remain
accessible. Plan external cleanup separately. See [failure semantics](./docs/FAILURE_SEMANTICS.md)
and the [security policy](./SECURITY.md).

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
- [Frontend consumers](./docs/consumers.md)
- [Failure semantics and asset lifecycle](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security policy](./SECURITY.md)
- Sanity [image URLs](https://www.sanity.io/docs/apis-and-sdks/image-urls)
- Sanity [presenting images](https://www.sanity.io/docs/apis-and-sdks/presenting-images)

## License

[MIT](./LICENSE)
