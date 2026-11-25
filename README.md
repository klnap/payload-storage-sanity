# @klnap/payload-storage-sanity

Sanity-powered media storage, image transformations, and CDN delivery for Payload CMS.

Payload keeps the media collection: documents, access control, hooks, and the admin UI. Sanity stores each original file once and serves it from its global Asset CDN. Frontends request the size they need, and Sanity produces that variant on demand. Sanity Studio is not required.

## Why Sanity?

Pre-generated image sizes multiply storage and deployment work. With this package you store the original once. Your app asks for the width it needs, and Sanity creates and caches that variant on the first request.

- **Generous Free plan.** As of 2026-11-25 the [Sanity pricing page](https://www.sanity.io/pricing) lists 100 GB of asset storage and 100 GB of bandwidth per month on Free. The page shows no date, so confirm current limits before you plan production usage.
- **Managed storage and a global Asset CDN** for original files and transformed images.
- **On-demand transformations** from URL parameters, with automatic format negotiation (`auto=format`).
- **CDN caching per variant.** Each parameter set is a distinct URL, cached separately.
- **No Sanity Studio required.** Editors work in Payload.

> [!IMPORTANT]
> This plugin uses Sanity's Content Lake Asset API. Assets uploaded to a dataset are publicly accessible through the Asset CDN, regardless of dataset visibility. Private asset delivery through Sanity Media Library and signed URLs is not currently supported.

## Features

- **Frontend optimization.** Populate presets return a flat, frontend-ready asset with CDN URL, dimensions, focal point, alt text, and LQIP.
- **Image transformations.** One builder, `buildSanityImageUrl`, produces responsive, cropped, and thumbnail URLs.
- **Next.js integration.** `SanityImage` renders a populated asset with `next/image`. A custom loader sends each width request to Sanity.
- **Asset-level alt text.** Write alt text once per media document, translate it per locale, and reuse it everywhere the image appears.
- **Media management.** Justified, grid, and list layouts, file-type cards for non-image files, a detail view with a metadata inspector, and logical folders.
- **Automatic media fields** for `title`, `alt`, and Sanity metadata, added only where the collection lacks them.
- **Reference-aware deletion** that blocks removing media still used by Payload content.
- **Revalidation.** Changes to shared media refresh dependent pages through [`@klnap/revalidation`](https://github.com/klnap/revalidation).
- **Optional** deduplication and webhook synchronization.

## Installation

```bash
bun add @klnap/payload-storage-sanity
```

or

```bash
npm install @klnap/payload-storage-sanity
```

Required peers: `payload`, `@payloadcms/ui`, and `@payloadcms/translations` (`>=3.94.1 <4`), `@sanity/client` (`>=6 <9`), and React and React DOM (`^19.3.1`). Install `next` (`>=16.4.5 <17`) only for the Next.js entries.

Node `^24.22.3 || >=26.13.1`. The published ESM build expects a bundler to resolve extensionless imports. Raw Node.js ESM is not supported.

## Quick start

Add the plugin to your Payload configuration:

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

Without `collections`, the plugin applies Sanity storage to every upload collection that has no other storage adapter. Regenerate the import map after adding or upgrading the plugin:

```sh
bun payload generate:importmap
```

Keep `token` on the server. It is a Sanity write token.

To choose collections, pass a slug-keyed map. Each entry can enable or exclude a collection and set its [folder](#folders):

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: true,
    documents: {
      folder: 'website/documents',
    },
  },
})
```

`true`, `{}`, and an object without `enabled` enable a collection. `false` and `enabled: false` exclude it, and an excluded collection keeps its native Payload behavior. An explicit map never adds unlisted collections. The full rules are in [docs/configuration.md](./docs/configuration.md#collections).

## Frontend optimization

A frontend that reads media through this package follows five steps:

1. Payload returns the media relation, populated by the `default` preset.
2. The preset produces a flat asset: CDN URL, dimensions, focal point, alt text, and LQIP.
3. The component renders that asset directly. No Sanity-specific mapping is needed.
4. A component or URL helper picks the variant: `next/image` requests each width, and `buildSanityImageUrl` takes explicit options.
5. Sanity generates the variant, caches it on the Asset CDN, and serves later requests from cache.

What this gives you:

- **Smaller responses.** The flat asset omits the Sanity record, sync state, and upload internals. The size difference depends on your media.
- **Less mapping code.** Dimensions, focal point, alt text, and placeholder arrive ready to use.
- **Resolved CDN URLs.** The app builds no URLs in the default case.
- **Localized alt text** for the request locale, with no substitution from another language.
- **Responsive delivery.** `next/image` requests the widths it needs, and Sanity produces each one.
- **No pre-generated derivatives.** `upload.imageSizes` is empty, so Payload writes no image sizes.
- **Fewer moving parts for images.** With the Sanity loader, Next.js requests Sanity URLs directly and does not run its own optimizer for those images.

### Frontend-ready media

`populate.preset` controls how media relations are returned:

- `'default'` (default): each relation returns a flat `DefaultPopulateAsset`. Media without a resolvable CDN URL returns the full document instead, and authenticated requests always receive the full document.
- `'full'`: each relation returns the full media document.

```ts
sanityStorage({
  // ...
  populate: { preset: 'default' },
})
```

A `DefaultPopulateAsset` has these fields:

| Field                            | Type               | Notes                                                                           |
| -------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `id`                             | `string \| number` | Payload document id.                                                            |
| `url`                            | `string`           | Public CDN URL of the original.                                                 |
| `width`, `height`, `aspectRatio` | `number`           | From Sanity metadata, when present.                                             |
| `focalX`, `focalY`               | `number`           | Percentages from `0` to `100`. Defaults to `50` when unset.                     |
| `alt`                            | `string \| null`   | Text for the request locale. See [Asset-level alt text](#asset-level-alt-text). |
| `lqip`                           | `string`           | Low-quality placeholder, when Sanity provides one.                              |

This is a real populated relation from the Local API, read with `depth: 1` and the `en` locale:

```json
{
  "id": "1520696f-b4f0-487b-a28c-a04b023216f0",
  "title": "With photo",
  "hero": {
    "id": "fc1eef57-d647-46d6-a8b8-f2a6aca34e30",
    "url": "https://cdn.sanity.io/images/demo/production/2400937a4031dac294d4ee49461fc11ff0d4aa26-1x1.png",
    "focalX": 50,
    "focalY": 50,
    "alt": "Photo caption",
    "width": 1,
    "height": 1,
    "aspectRatio": 1
  }
}
```

The same media document read directly returns the full shape. There `alt` is an object with every locale, `focalX` and `focalY` are `null`, and the response adds `sanity`, `sync`, `sizes`, `thumbnailURL`, `filename`, `mimeType`, and `filesize`. Use `'default'` for pages and storefronts. Use `'full'` when a consumer needs the complete record.

Fetch with the Local API in server code. Pass `locale` and `depth` on the request:

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
```

`depth` controls how many relation levels are expanded. A media relation inside a group is populated at `depth: 1`, because a group adds structure, not relationship depth. Raise `depth` only when a populated document contains further relations you need.

Set `populate.localPopulate: false` to keep the flat asset on REST only. The Local API then returns the full document. `GET /api/media/:id` always returns the full document for the admin editor.

### Image transformations

One function builds every transformed image URL: `buildSanityImageUrl`. It takes a flat populated asset, a full media document, an image URL, or a Sanity asset reference, and applies the same options to each:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity'

const card = buildSanityImageUrl(image, { width: 640, height: 480, fit: 'crop' })
const thumb = buildSanityImageUrl(image, { width: 160, height: 160, fit: 'max' })
```

A responsive `srcset`:

```ts
const srcSet = [480, 960, 1440]
  .map((width) => `${buildSanityImageUrl(image, { width })} ${width}w`)
  .join(', ')
```

Options: `width`, `height`, `fit` (`'max'`, `'min'`, `'crop'`, `'clip'`), `quality`, `rect` (a crop region in pixels), and `autoFormat` (default `true`, adds `auto=format`). Set `autoFormat: false` to turn format negotiation off.

A flat asset or a full media document needs no Sanity client, because its `url` already points at the Asset CDN. Use a `client` only for a bare asset reference without a URL. Files that are not images, such as PDFs, are returned unchanged. The builder returns `null` when there is no image or URL.

Sanity documents more parameters, such as `fm`, `dpr`, and `fp-x` and `fp-y`. This package does not type them. See Sanity's [image URL reference](https://www.sanity.io/docs/apis-and-sdks/image-urls).

Reusable options are plain objects in your code. They are not a package feature:

```ts
export const cardImage = { width: 640, height: 480, fit: 'crop' } as const

buildSanityImageUrl(image, cardImage)
```

Populate presets control what Payload returns. Transforms control the size and crop of a URL.

### Next.js

Import from `@klnap/payload-storage-sanity/next`. Framework-independent code does not need this entry.

Render a populated asset:

```tsx
import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity'
import { SanityImage } from '@klnap/payload-storage-sanity/next'

export function Hero({ image }: { image: DefaultPopulateAsset }) {
  return (
    <div className='relative aspect-video'>
      <SanityImage asset={image} fill sizes='100vw' />
    </div>
  )
}
```

With `fill`, the parent needs a size and `position: relative`. `aspect-video` gives it one. Without `fill`, `SanityImage` uses the asset's `width` and `height`. If either is missing, it switches to `fill`.

What `SanityImage` does with an asset:

- **Source and dimensions.** It passes `url` as `src`, and the native `width` and `height` when present. It also sets `objectFit: 'cover'`.
- **Focal point.** `focalX` and `focalY` become `object-position`. Pass `disableFocal` to turn this off.
- **Placeholder.** It uses the asset's `lqip` as `blurDataURL`. Without one, it uses a neutral blur. Pass `placeholderFallback={false}` to skip that, or `disablePlaceholder` to turn placeholders off.
- **Responsive sizes.** `next/image` generates `srcset` and asks the loader for each width, so `sizes` matters.
- **Alt text.** The asset's text is the default. `alt` overrides it for one image, and `fallbackAlt` applies only when the asset has none.
- **Fallback.** `fallback` renders when the asset or URL is missing or fails to load. Without a fallback, nothing renders. `createSanityImage({ fallback })` sets a default for every image it creates.

Use `toSanityImageProps` when you want the same mapping as plain `next/image` props.

#### Loader and CDN hosts

Set the Sanity loader globally, and each `next/image` width request becomes a Sanity URL:

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

The loader adds `w`, `q`, and `auto=format` to `cdn.sanity.io` URLs. A custom loader applies to every `next/image` in the app. Non-Sanity URLs pass through unchanged and are not optimized.

For a custom CDN host, create the loader with its base URL:

```ts
// sanity-image-loader.ts
import { createSanityImageLoader } from '@klnap/payload-storage-sanity/next'

export default createSanityImageLoader({ cdnBaseUrl: 'https://images.example.com' })
```

Component and loader references are in [docs/consumers.md](./docs/consumers.md).

## Media management

Editors work in the standard Payload media collection. The plugin changes the upload and list experience and keeps Payload's own controls.

### Media gallery

The list view offers three layouts, and you switch between them with the toggle in the list header. Justified and grid come from this plugin. List is Payload's native table:

- **Justified** (default): rows sized from each asset's aspect ratio, so mixed orientations keep their proportions.
- **Grid**: equal tiles for quick scanning.
- **List**: Payload's native table.

Image cards show a thumbnail, with the LQIP as a placeholder while it loads. Non-image files show a card with a file-type icon: PDF, video, audio, archive, spreadsheet, slides, and code. The layout you choose is saved per user and collection. Set `admin.gallery: false` to keep Payload's list view everywhere.

### Media detail view

The edit view for an image shows:

- A large preview of the asset, with the asset title above it.
- A file card with the CDN URL and a copy button, the original filename, size, and MIME type.
- A metadata inspector with dimensions, aspect ratio, asset ID, SHA-1, and path.
- Alt text fields, one per locale when localization is enabled.

Focal point and crop editing are enabled by default. Set `crop: false` or `focalPoint: false` in a collection's Payload `upload` config to turn either off.

During Save, the upload area shows an "Uploading…" state and disables its controls. The preview stays visible. Set `admin.uploadBusyShield: false` to turn this off.

### Folders

Each collection uploads into a logical folder, `Payload` by default. Set another with `collections.<slug>.folder`. The package writes the same folder model that `sanity-plugin-media` uses in Sanity Studio: a `media.folder` document with a `name` and a weak `parent`, and a weak `opt.media.folder` reference on each asset. Nested paths create the missing folders.

Folders are a logical grouping. They do not change URLs. Existing assets keep their folder, so a shared asset is not moved by a later upload.

Sanity Studio and `sanity-plugin-media` are not needed for uploads or CDN delivery. Install the plugin when you want to browse this folder hierarchy in the Studio media browser. The folder model requires `sanity-plugin-media` 6.1.0 or later:

```bash
bun add sanity-plugin-media
```

```ts
import { defineConfig } from 'sanity'
import { media } from 'sanity-plugin-media'

export default defineConfig({
  // Existing configuration
  plugins: [media()],
})
```

Folders are not Media Library folders. Sanity's Media Library uses its own folder system, which this package does not write to. The folder rules are in [docs/configuration.md](./docs/configuration.md#folders).

## Media fields

The plugin adds these fields to each configured upload collection. It never replaces fields you already declare.

| Field    | Type                                            | Visibility                                         | Purpose                                                      |
| -------- | ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `title`  | text                                            | Hidden in the field list, shown in the upload area | Optional asset title. Added only if the collection has none. |
| `alt`    | text, or a group with one text field per locale | Visible                                            | Alt text. Added only if the collection has none.             |
| `sanity` | group with `asset` (JSON)                       | Hidden, read-only                                  | The Sanity asset record. Client requests cannot write it.    |
| `sync`   | group with `status`, `checkedAt`, `errorAt`     | Hidden, read-only                                  | Sync diagnostics.                                            |

Payload's upload support provides `filename`, `mimeType`, `filesize`, `width`, and `height`.

### Asset-level alt text

Write alternative text once, translate it for each language, and reuse it wherever the image appears.

The alt text belongs to the Payload media document. The Sanity asset is shared, and every content document that references the media document receives the same description. Editing it in one place updates every document that references the image, and revalidation can refresh those pages (see below). The per-language layout is inspired by Sanity's Internationalized Array pattern. It is not a dependency, and the package does not use Sanity's array storage.

With Payload localization enabled, the plugin adds an `alt` group with one text field per locale. Without localization, it adds one `alt` text field. Existing `alt` fields are kept unchanged.

Alt options are set per collection:

```ts
sanityStorage({
  // ...
  collections: {
    media: { alt: { required: true } },
  },
})
```

`alt.required` defaults to `false`. When `true`, every configured locale is required, and Payload rejects empty values. Whitespace-only text passes Payload's check, but the frontend reads it as missing.

Editors write the alt text. The plugin does not generate descriptions and does not read them from Sanity metadata.

On the frontend, `DefaultPopulateAsset.alt` holds the text for the request locale:

- **Translated:** the text, trimmed.
- **No translation for that locale:** `null`. No other language is substituted. Payload's localization fallback does not copy one in, because the alt group is not a localized field.
- **Explicitly empty:** `''`. Use this for decorative images.

A single image can override the stored text:

```tsx
<SanityImage asset={image} alt='' />             // decorative: no description
<SanityImage asset={image} alt='Team photo' />   // this context only
<SanityImage asset={image} fallbackAlt='Logo' /> // only when the asset has no alt text
```

An explicit `alt=""` is kept. It is never replaced by the asset description. `fallbackAlt` applies only when the asset has no alt text (`null`). It does not replace an explicitly empty value.

## Asset lifecycle

Uploads, replacements, and deletions keep Sanity assets and Payload rows consistent. The package never deletes remote files.

- **Uploads** send the file to Sanity. The media document stores the asset reference under `sanity.asset`.
- **Replacing a file** uploads the new bytes and keeps the previous Sanity asset.
- **Deleting a media row** removes only the Payload record. The Sanity asset and its CDN URL remain.
- **Failed uploads** can leave orphaned Sanity assets.

With `preventDeleteWhenReferenced: true` (the default), Payload refuses to delete a media row that Payload content still references. On PostgreSQL, transaction locks serialize reference writes and deletes. On other adapters, a guarded delete returns `503`.

`dedupeUploads: true` rejects a create whose bytes match an existing asset. Replacements are not affected, and the shared Sanity asset stays in place.

Sanity deduplicates assets by content, so one asset can serve several documents. Payload's reference check does not see external Sanity documents, weak references, or other datasets. Check every Sanity reference before you delete a Sanity asset. The package never does that automatically.

Direct SQL and external writes bypass Payload hooks, so the reference guard does not see them. Database-specific limits are in [docs/configuration.md](./docs/configuration.md#uploads-and-deduplication).

Sanity's [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn) caches files by a hash of their contents. Replacing a file creates a new URL, so the old URL keeps working until its asset is removed.

## Integration with @klnap/revalidation

[`@klnap/revalidation`](https://github.com/klnap/revalidation) can refresh the pages that show a changed media document, without republishing each page. Its Payload producer finds the documents that directly reference the media document and sends update events. Your Next.js consumer then expires the matching cache tags and paths. Only the references listed below are discovered.

A change to a file, a focal point, or alt text in one place refreshes the dependent pages. An alt change refreshes only the locale whose text changed, so editing the German alt text does not refresh English pages.

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

Add `custom: { revalidation: true }` to each content collection or global that should refresh.

The producer follows direct references only:

- **Triggers:** updates and deletes of a media document. Creates do not trigger it.
- **Matched fields:** `upload` and `relationship` fields to the media collection, inside groups, rows, collapsibles, tabs, and arrays. For globals, arrays and `hasMany` fields are not matched.
- **Published documents only** in collections with drafts. Collections without drafts have no published state, so all their documents qualify.
- **One hop only.** A page that reaches the media through another document, such as a parent that links to the page, is not revalidated. Add a direct upload field to that document type or revalidate it explicitly.
- **Not matched:** blocks, rich text, JSON and join fields, and relations that accept several collections. These are skipped without a log entry.
- **Failures** while reading dependents are logged and do not fail the Payload save. A failure in the locale-change check can stop dispatch for that save, so check logs after media edits.
- **Delivery** runs in memory: events wait about one second and are not retried. Events can be lost if the process exits within that second. Delete events fire before the row is removed, so a rolled-back delete can still send events.

Read the producer guides in the [revalidation repository](https://github.com/klnap/revalidation): `docs/producers/payload.md` and `docs/producers/payload-media-dependencies.md`.

Frontend cache invalidation and Sanity Asset CDN caching are separate. Revalidation expires Next.js cache entries. Neither this package nor revalidation purges the Sanity CDN. A replaced file gets a new hashed URL, so the old URL stays cached until its asset is removed.

## Synchronization

With `sync.enabled: true`, a Sanity webhook marks or deletes media rows when assets change, and reconcile routes check batches of rows. Sync needs `token` and `sync.webhook.secret`. The webhook verifies an HMAC over the raw request body. The default base path is `/sanity-storage`, under Payload's `/api`.

Body limits, status codes, and retry behavior are in [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md).

## Documentation

- [Configuration and public API](./docs/configuration.md): options, defaults, collection rules, and exports.
- [Consumer guide](./docs/consumers.md): populate shapes, Next.js components, and manual `populate`.
- [Failure behavior](./docs/FAILURE_SEMANTICS.md): sync, webhooks, and error handling.
- [Troubleshooting](./docs/TROUBLESHOOTING.md): common setup and runtime issues.
- [Contributing](./CONTRIBUTING.md): development setup and releases.

## License

MIT
