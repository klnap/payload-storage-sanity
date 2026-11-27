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

Storage is the primary product. The plugin uploads files to Sanity, keeps Payload media documents
and relationships, and adds an admin UI for browsing and editing media. Sanity Studio is not required.

## Why Sanity?

Payload manages content, relationships, media records, and editorial workflows. Sanity provides
managed asset storage and a global Asset CDN that serves files and on-demand image transformations.

This plugin connects the two systems: Payload remains the media workspace, while Sanity stores and
delivers the uploaded assets. Sanity provides the CDN and image transformation infrastructure; this
plugin does not run either.

Sanity's [Image API](https://www.sanity.io/docs/apis-and-sdks/image-urls) supports URL-based resizing,
cropping, and format negotiation with `auto=format`. Its [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn)
delivers assets and caches requested variants. These managed capabilities reduce the need to generate
and store predefined image sizes in Payload.

## Features

**Storage**

- Native Payload cloud-storage integration for image, video, and file uploads.
- Automatic discovery of eligible upload collections, or explicit selection of several collections.
- Sanity asset references and metadata stored on Payload media documents.
- Logical folders using the `sanity-plugin-media` model.
- Optional SHA-1 duplicate-upload protection and configurable upload-size limits.

**Enhanced Media Admin UI**

- Media gallery with justified, grid, and native list layouts, plus file cards for non-image assets.
- Media detail view with large previews, dimensions, Asset and References tabs, and editable title and alt text.
- Physical crop, focal point, and upload feedback during saves.

**Media References and Integrity**

- Deletion protection for media still used by supported Payload collections, globals, and rich text.
- A References tab that shows where an asset is used, limited to content the editor can read.

**Media Population**

- Compact, normalized `MediaAsset` responses for populated media relationships.

**Synchronization**

- Optional signed Sanity webhooks and batch reconciliation for assets changed or removed in Sanity.

**Consumers**

- `SanityImage` for Next.js, plus framework-independent image URLs with `buildSanityImageUrl()`.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

```bash
npm install @klnap/payload-storage-sanity
```

## Usage

### Storage

#### Collection configuration

When `collections` is omitted, the plugin discovers upload collections that do not already use a
storage adapter. Pass `collections` to choose collections explicitly and set a folder for each:

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

Explicit configuration selects only the listed enabled collections. Use `enabled: false` to exclude
one. The plugin does not replace an existing storage adapter on a collection.

For selected collections, the plugin:

- Disables local file copies (`disableLocalStorage: true`).
- Sets `upload.imageSizes` to `[]`, so Payload does not generate image-size derivatives.
- Enables Payload's crop and focal-point editors by default. A collection can set its own
  `upload.crop` or `upload.focalPoint` values.
- Keeps Payload's upload editor, MIME-type handling, and native metadata.

Sanity Studio is not a prerequisite. Folder assignment and uploads work without it.

#### Folder organization

Set `collections.<slug>.folder` to a path such as `website/images`. The plugin creates missing
logical folder records and assigns new assets to them. Changing the path does not move existing assets.

These folders use the `sanity-plugin-media` model, not Sanity Media Library folders. Install
`sanity-plugin-media` only if editors also need to browse those folders in Sanity Studio.

For assets uploaded outside the Payload adapter, use `assignSanityAssetFolder` from
`@klnap/payload-storage-sanity/folders`.

#### Local storage and image sizes

Local file copies stay off for selected collections, and Payload does not generate image-size
derivatives for them. Use Sanity CDN parameters, through `buildSanityImageUrl()` or `SanityImage`,
for resized variants. Existing `sizes` data on old media documents is not rewritten or deleted.

#### Replacement and asset lifecycle

Uploading a replacement creates a new Sanity asset. Deleting or replacing a Payload media record does
not delete its Sanity asset; see [Asset access and lifecycle](#asset-access-and-lifecycle).

#### Upload deduplication

Duplicate protection is opt-in:

```ts
sanityStorage({
  // ...
  dedupeUploads: true,
})
```

When enabled, a media create whose file bytes match an existing media document's SHA-1 hash is
rejected with HTTP `409`. The response identifies the existing media document when the editor can read it.
The check covers creating Payload media documents. It does not replace Sanity's own asset
deduplication: Sanity stores content-addressed assets, so identical bytes can map to the same Sanity
asset, while the plugin decides whether a second Payload media document may be created.

Concurrency depends on the database adapter:

- **PostgreSQL:** a transaction-scoped advisory lock keyed by the file hash serializes matching creates
  across processes until the upload completes.
- **Other adapters:** the plugin serializes only the lookup within one process. Concurrent processes can
  still create duplicate Payload documents.

#### Upload size limits

`uploadMaxSize` limits upload size in bytes. A number sets the default for all media kinds. An object sets
a `default` and optional `byType` overrides for `image`, `video`, and `file`:

```ts
sanityStorage({
  // ...
  uploadMaxSize: {
    default: 10 * 1024 * 1024,
    byType: {
      image: 20 * 1024 * 1024,
      video: 500 * 1024 * 1024,
      file: 50 * 1024 * 1024,
    },
  },
  collections: {
    media: {
      uploadMaxSize: { byType: { image: 5 * 1024 * 1024 } },
    },
  },
})
```

Collection values override plugin values key by key. The plugin raises Payload's global multipart limit to the
largest configured value, then validates each selected collection separately. Hosting infrastructure can still
reject larger requests before they reach Payload, for example through a reverse-proxy body limit.

### Enhanced Media Admin UI

#### Media Gallery

The gallery replaces Payload's media list with image-focused browsing. A collection with its own
list view keeps that view.

- **Justified:** rows preserve each image's aspect ratio up to 2.5:1. Wider panoramas use a 2.5:1 tile and show the image letterboxed within it.
- **Grid:** equal tiles show image previews with `object-fit: cover`.
- **List:** Payload's native table.
- **Other files:** file-type artwork with the filename visible.
- **Selection and bulk actions:** Payload's row selection and bulk actions remain available. List drawers
  support selection when Payload provides the callbacks.
- **Native controls:** Payload's search, filter, and column controls stay around the gallery.

The gallery does not add a separate uploader. Uploads use Payload's native upload input. The gallery
is enabled by default where it applies. Set `admin.gallery: false` to keep the native list, or set it
per collection with `collections.<slug>.admin.gallery`. The gallery also appears in supported media
selection drawers, but not in upload or create drawers.

#### Media Detail View

Opening a media document shows:

- A larger preview. Images show a blur placeholder when one is available.
- Image dimensions and aspect ratio when available.
- For other files, Payload's file card with a file-type icon, filename, URL, size, and MIME type.
- An **Asset** tab with the editable title and alt text, the native upload and replacement controls,
  and the Sanity asset details.
- A **References** tab that lists where the asset is used. See
  [Media References and Integrity](#media-references-and-integrity).

The plugin does not add a separate Metadata tab. Sanity asset references and metadata remain in the
hidden, read-only `sanity.asset` field.

#### Upload feedback

While a save sends bytes to storage, the plugin shows a neutral progress state for the document. The
main content area becomes `inert` and `aria-busy`, so editors cannot change fields during the upload.
The plugin also shows an upload toast. Payload's native save and error handling remain in place. Set
`admin.uploadBusyShield: false` to turn this off for a collection.

#### Crop

Sanity's standard image crop is non-destructive. It stores crop metadata beside a reference to the original
asset, so the same source image can be reused with different crops. See Sanity's
[image field](https://www.sanity.io/docs/studio/image-type) and
[image presentation](https://www.sanity.io/docs/apis-and-sdks/presenting-images) documentation.

The plugin uses a different model. It applies Payload's crop to the image bytes, uploads the cropped
result to Sanity as a new asset, and updates the existing Payload media document to reference it.

> Unlike Sanity's non-destructive, metadata-based cropping, the plugin applies Payload's crop directly to the image and uploads the cropped result as its new source asset.
>
> This is an intentional design choice: when an editor crops an image, the cropped version becomes the canonical image associated with the Payload media document. Subsequent CDN transformations cannot recover pixels removed from that source.

The practical benefit: consumers do not need to apply crop metadata correctly. Payload's media document
points to the image that should be shown.

Physical cropping needs Payload's `sharp` dependency. Pass it to `buildConfig`:

```ts
import sharp from 'sharp'

export default buildConfig({
  sharp,
  // ...
})
```

Cropping does not delete the uncropped asset or revoke its URL. See
[Asset access and lifecycle](#asset-access-and-lifecycle).

#### Focal Point

Focal point is a separate, non-destructive workflow. Editors set it in Payload's native focal-point
control, and it is stored in `focalX` and `focalY` on the media document. Changing only the focal point does
not upload the image again.

Supported consumers use these coordinates during rendering. `SanityImage` applies them as CSS
`object-position` with `object-fit: cover`. They are not Sanity CDN crop parameters, and
`buildSanityImageUrl()` does not infer them. Use focal point for composition; use crop when the
pixels outside the frame should be removed.

Crop and focal-point controls are enabled by default. Override them per collection through Payload's
upload options:

```ts
{
  slug: 'media',
  upload: {
    crop: false,
    focalPoint: false,
  },
}
```

#### Editorial metadata

Unless the collection already defines them, the plugin adds:

- An editable **title** field.
- An **alt** field. Without Payload localization, it is a single field. With localization, it is a
  locale group.

```ts
collections: {
  media: {
    alt: { required: true },
  },
}
```

`alt.required` requires non-empty alt text in each locale. Set `alt.enabled: false` to skip the plugin's
alt field. An existing `alt` field in the collection takes precedence.

Populated responses include the alt text for the request locale. Consumers use it for `<img alt>`,
and `alt=""` marks an image as decorative.

### Media References and Integrity

This is the package's deletion guard. Its job is to prevent accidental deletion of media that is still
used across your content:

> Prevent accidental deletion of media that is still used across your content. The plugin checks supported relationships and embedded media references before allowing a media document to be deleted. Editors can inspect where an asset is used directly from its References tab.

**Deletion protection** is enabled by default (`preventDeleteWhenReferenced: true`). If an editor deletes a
product image still used by an article, a landing page, or a global such as site settings, the delete is
blocked until those references are removed.

The guard checks:

- Upload and relationship fields in the supported structures, in collections and globals.
- Uploads embedded in rich text.
- Published and draft content. A reference from either layer blocks the delete.

**The References tab** shows where an asset is used. It uses the requester's access rights. Editors see only
documents they may read, and documents they cannot read are not listed.

The integrity check and the References tab are separate. The check decides whether a delete proceeds, and
runs for the whole database. The References tab is a read-only listing for the current user.

Turn the guard off globally, or per collection, when needed:

```ts
sanityStorage({
  // ...
  preventDeleteWhenReferenced: false,
  collections: {
    media: {
      preventDeleteWhenReferenced: true,
    },
  },
})
```

The guard does not cover:

- Historical document versions.
- Arbitrary URL references in text or external systems.
- Direct SQL writes that bypass Payload hooks.
- Sanity documents or other Sanity datasets.
- Rich-text structures that the plugin does not scan.

On PostgreSQL, the plugin uses transaction-scoped locks to serialize guarded deletes and supported
reference writes. Other adapters without those locks fail guarded deletes with `503`, rather than
guessing. The guard deletes nothing in Sanity. Deleting a Payload media record never deletes the remote
Sanity asset. See [failure semantics](./docs/FAILURE_SEMANTICS.md) for the full locking and error behavior.

### Media Population

The default `populate.preset: 'default'` normalizes eligible populated image and file relationships to a
compact `MediaAsset`. The response contains the Payload media ID, Sanity URL, alt text, and focal coordinates.
Image dimensions, aspect ratio, and LQIP are optional.

A populated `hero` field from an article, shaped by the populate integration test:

```ts
{
  id: 7,
  url: 'https://cdn.sanity.io/images/project/production/hero-1200x800.jpg',
  alt: 'Wide',
  width: 1200,
  height: 800,
  aspectRatio: 1.5,
  focalX: 20,
  focalY: 80,
}
```

Direct media reads, authenticated requests, explicit populate selections, and depth-zero relationships keep
the full Payload document. See [Media Population](./docs/media-population.md) for eligibility, depth,
locale handling, and the full response contract.

### Synchronization

Synchronization is optional and disabled by default. It keeps Payload media status in step with assets
changed or removed in Sanity:

```ts
sanityStorage({
  // ...
  sync: {
    enabled: true,
    webhook: {
      secret: process.env.SANITY_WEBHOOK_SECRET!,
    },
    onDeleted: 'mark',
  },
})
```

When `sync.enabled` is true, the plugin registers:

- A **webhook** at `/api/sanity-storage/webhook`. It verifies an HMAC over the raw request body, rejects
  invalid signatures and oversized bodies, and processes events idempotently, so Sanity retries are safe.
- A **batch reconcile** endpoint at `/api/sanity-storage/reconcile`, protected by `sync.access`. It checks
  media rows against Sanity in batches and reports duplicates. It does not delete rows or remote assets.

`onDeleted` decides what happens when Sanity reports an asset deleted:

- `'mark'` (default): marks the media document unavailable and clears its hydrated URLs.
- `'delete'`: deletes the matching Payload media row, subject to the reference guard.

Neither setting deletes the Sanity asset. Webhook delivery is not guaranteed in real time. Use
reconcile to recover from missed events. Sync status is stored on each media document.
Endpoint and failure details are in [failure semantics](./docs/FAILURE_SEMANTICS.md) and
[configuration](./docs/configuration.md#synchronization).

### Consumers

Consumers are optional. Use them to render or link to media outside Payload.

#### Next.js

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function ArticleCover({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='(max-width: 768px) 100vw, 50vw' />
}
```

`SanityImage` renders `next/image` with a scoped Sanity loader. Next.js supplies responsive widths, and the
loader adds `w`, `q`, and `auto=format` to Sanity image URLs. Sanity performs the transformations.

- It uses intrinsic `width` and `height` when present. Missing dimensions use `fill`.
- It forwards `alt`, applies focal positioning, and uses the LQIP as a blur placeholder when available.
- Non-image files and invalid values use the `fallback` prop, and missing images render nothing unless
  you provide one.
- A custom `assetMapping` maps an application-owned shape to `MediaAsset`.

Next.js is optional: the package does not require it outside `consumers/next`.

For app-wide Sanity loading, create a loader with the public `createSanityImageLoader` export:

```ts
import { createSanityImageLoader } from '@klnap/payload-storage-sanity/consumers/next'

export default createSanityImageLoader()
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

A global loader affects every `next/image`. Keep the loader scoped to `SanityImage` when the app mixes image
providers. See [Next.js consumers](./docs/consumers.md#nextjs) for loader details.

#### Custom CDN origin

`cdnBaseUrl` names the origin that serves Sanity assets in place of `https://cdn.sanity.io`, for example a proxy
you operate. Set it on the plugin, on `SanityImage`, on `createSanityImageLoader`, or on `buildSanityImageUrl`:

```tsx
;<SanityImage asset={image} cdnBaseUrl='https://images.example.com' sizes='100vw' />
```

Each consumer then does the following for Sanity URLs (`cdn.sanity.io` or the configured origin):

- Moves them to the configured origin.
- Adds image transformations to image paths. File paths keep their paths and get no image parameters.

Unrelated URLs pass through unchanged.

#### Framework-independent image URLs

Use `buildSanityImageUrl()` for a transformed Sanity image URL outside Next.js:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const url = buildSanityImageUrl(heroImage, {
  width: 960,
  height: 640,
  fit: 'crop',
  quality: 80,
})
```

It accepts a populated `MediaAsset`, a full media document, a stored image URL, or a Sanity asset reference.
For Sanity image URLs it applies width, height, fit, quality, pixel `rect`, and `auto=format` (unless
`autoFormat: false`). File URLs are returned without image parameters. The function returns `null` when no URL
can be resolved.

A bare asset reference without a stored URL needs a `@sanity/client` instance passed as `client`, or a client from
`createSanityClient()` in `@klnap/payload-storage-sanity/client`. Focal coordinates are not inferred.

## Configuration

| Option                                           | Default             | Purpose                                                             |
| ------------------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| `collections`                                    | Automatic discovery | Select upload collections without another storage adapter.          |
| `mode`                                           | `'full'`            | Upload to Sanity and register the storage adapter.                  |
| `admin.gallery`                                  | `true`              | Use the gallery where native/custom list behavior allows it.        |
| `admin.uploadBusyShield`                         | `true`              | Show upload progress and block edits during a byte upload.          |
| `collections.<slug>.admin.gallery`               | Inherits `admin`    | Override gallery behavior for one collection.                       |
| `collections.<slug>.folder`                      | `'Payload'`         | Set the logical Sanity folder for new uploads.                      |
| `collections.<slug>.alt.enabled`                 | `true`              | Add alt text unless the collection already defines `alt`.           |
| `collections.<slug>.alt.required`                | `false`             | Require alt text in each locale.                                    |
| Payload `upload.crop`                            | `true`              | Keep or disable Payload's physical crop editor.                     |
| Payload `upload.focalPoint`                      | `true`              | Keep or disable Payload's focal-point editor.                       |
| `collections.<slug>.populate.preset`             | `'default'`         | Normalize eligible populated relationships or keep full documents.  |
| `collections.<slug>.populate.localPopulate`      | `true` for default  | Apply the default preset to Local API reads.                        |
| `collections.<slug>.disableLocalStorage`         | `true`              | Do not keep local file copies.                                      |
| `dedupeUploads`                                  | `false`             | Reject duplicate media creates by SHA-1 content hash.               |
| `uploadMaxSize`                                  | Payload default     | Maximum upload size in bytes, optionally by media kind.             |
| `preventDeleteWhenReferenced`                    | `true`              | Block deleting media still referenced by supported Payload content. |
| `sync.enabled`                                   | `false`             | Enable the Sanity webhook and batch reconcile endpoints.            |
| `cdnBaseUrl`                                     | `cdn.sanity.io`     | Origin that serves Sanity assets in place of `cdn.sanity.io`.       |
| `collections.<slug>.disablePayloadAccessControl` | `true`              | Generate direct CDN URLs instead of Payload proxy URLs.             |

See [configuration and public API](./docs/configuration.md) for collection selection, option
precedence, advanced modes, and the full synchronization options.

## Asset access and lifecycle

This plugin stores ordinary Sanity Content Lake dataset assets. Their CDN URLs are publicly
accessible, even when the dataset is private. Sanity Media Library's private assets and signed
delivery URLs are a separate visibility system and are not used by this plugin.

Payload document access control protects Payload API records. By default, generated file URLs point
directly to Sanity and bypass Payload's file-delivery proxy. Setting
`collections.<slug>.disablePayloadAccessControl: false` routes generated URLs through Payload, but
does not make an exposed Sanity CDN URL private.

Asset lifecycle:

- **Upload:** uploads a Sanity asset, then creates the Payload media document. If Payload persistence fails
  after the Sanity upload succeeds, the Sanity asset is left unreferenced.
- **Replacement:** uploads a new asset and updates the media document. The previous asset is not deleted.
- **Crop:** uploads the cropped bytes as a new asset and updates the media document to reference it. The
  uncropped asset remains in Sanity, and its CDN URL may still work.
- **Deletion:** deletes the Payload row only. Sanity assets are content-addressed and may be shared, so check other references
  before any external cleanup.
- **Sync:** `onDeleted` marks or deletes Payload rows. Neither setting deletes a Sanity asset.

Cropping and replacement do not revoke previously shared URLs or clear copies in caches, logs, or other
systems. The package does not run destructive cleanup of Sanity assets. If you need that guarantee,
plan a separate, operator-managed cleanup process.

The deletion guard protects supported Payload relationships only. See
[failure semantics](./docs/FAILURE_SEMANTICS.md) and the [security policy](https://github.com/klnap/payload-storage-sanity/blob/main/SECURITY.md).

## Compatibility

| Requirement                                               | Supported versions                      |
| --------------------------------------------------------- | --------------------------------------- |
| Payload, `@payloadcms/ui`, and `@payloadcms/translations` | `>=3.94.1 <4`                           |
| React and React DOM                                       | `^19.3.1`                               |
| `@sanity/client`                                          | `>=6 <9`                                |
| Next.js consumer (optional)                               | `>=16.4.5 <17`                          |
| Node.js                                                   | `^22.23.5 \|\| ^24.22.3 \|\| >=26.13.1` |

### Module format

The package is ESM only. These entries import in plain Node.js ESM, without a bundler:

- `@klnap/payload-storage-sanity` (plugin)
- `@klnap/payload-storage-sanity/consumers`
- `@klnap/payload-storage-sanity/client`
- `@klnap/payload-storage-sanity/folders`

These entries need a framework or bundler:

- `@klnap/payload-storage-sanity/consumers/next` and `/consumers/next/loader` import `next/image`, so Next.js must be
  installed. Their modules are not usable from a standalone Node.js script.
- `@klnap/payload-storage-sanity/admin` imports a stylesheet, so Node.js cannot load it directly. Payload's import map and bundler consume it.

Verified with a local build: plain `node` ESM imports succeed for the root, `/consumers`, `/client`, and `/folders`
entries. Import `/consumers/next` in a Next.js app, and `/admin` through Payload's build.

## Documentation

- [Configuration and public API](./docs/configuration.md)
- [Media Population](./docs/media-population.md)
- [Consumers](./docs/consumers.md)
- [Failure semantics and asset lifecycle](./docs/FAILURE_SEMANTICS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security policy](https://github.com/klnap/payload-storage-sanity/blob/main/SECURITY.md)
- Sanity [image URLs](https://www.sanity.io/docs/apis-and-sdks/image-urls)
- Sanity [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn)
- Sanity [presenting images](https://www.sanity.io/docs/apis-and-sdks/presenting-images)

## License

[MIT](./LICENSE)
