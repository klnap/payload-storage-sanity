# Frontend consumers

Import framework-independent contracts and utilities from `@klnap/payload-storage-sanity/consumers`. Import Next.js components and loaders from `@klnap/payload-storage-sanity/consumers/next`.

The default populate preset turns eligible populated media relationships into `MediaAsset`. Import this type and `SanityImage` from the Next.js consumer entry. The component accepts the normalized type directly and validates runtime values before rendering.

## Fetch populated media

For a website page with a `heroImage` upload relationship:

For normalized populated relationships, use Payload's generated types after setting the relationship type to the plugin's `MediaAsset` contract, or define a frontend DTO with that type:

```tsx
import {
  SanityImage,
  type MediaAsset,
} from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes="100vw" />
}
```

The default preset applies to eligible populated relationships, not every media document:

| Read | Result |
| --- | --- |
| Relationship at `depth: 0` | Relationship ID; no population occurs. |
| Eligible unauthenticated populated relation with a CDN URL | Normalized `MediaAsset`. |
| Populated relation with no resolvable CDN URL | Full media document. |
| Direct media collection read | Full media document. |
| Authenticated request | Full media document. |
| Explicit `populate` selection for media | Full media document. |
| `populate.preset: 'full'` | Full media document. |
| Local API with `populate.localPopulate: false` | Full media document. |

## Normalized asset shape

```ts
import type { MediaAsset } from '@klnap/payload-storage-sanity/consumers'

const image: MediaAsset = {
  id: 'media-42',
  url: 'https://cdn.sanity.io/images/project/production/hero-1600x900.jpg',
  width: 1600,
  height: 900,
  aspectRatio: 1.7778,
  focalX: 50,
  focalY: 43,
  alt: 'The website team at work',
  lqip: 'data:image/jpeg;base64,...',
}
```

`id`, `url`, `focalX`, `focalY`, and `alt` are required. Dimensions, aspect ratio, and LQIP are optional image metadata. Focal coordinates default to `50`. The URL points to the resolved Sanity CDN asset, not a generated Payload derivative.

Filename, MIME type, byte size, title, and the persisted Sanity asset record are general file/document metadata. They remain on the full Payload media document, not in this frontend DTO.

## Generated Payload types

Payload generates collection types from the configured schema. A relationship is usually typed as an ID or a generated media document. The type generator cannot infer the plugin's runtime `afterRead` transformation, so generated collection types may not describe a normalized relationship.

Payload's generated collection type may still describe a relationship as an ID or full media document because its type generator cannot infer the runtime `afterRead` transformation. Model the frontend response explicitly with `MediaAsset`:

```tsx
import {
  SanityImage,
  type MediaAsset,
} from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes="100vw" />
}
```

The type describes the expected response; `SanityImage` still validates values at runtime. It renders supported Sanity image URLs and uses the configured fallback for files, malformed values, or missing assets.

## Next.js image component

`SanityImage` accepts `MediaAsset` by default and maps its URL, dimensions, focal point, alt text, and LQIP to `next/image`:

```tsx
import {
  SanityImage,
  type MediaAsset,
} from '@klnap/payload-storage-sanity/consumers/next'

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes="100vw" />
}
```

When a dimension is unavailable, the component uses `fill`. Set `fill` explicitly for a container-based layout. Missing assets or image load errors render the `fallback` prop; pass `fallback={null}` to render nothing.

The component uses the responsive widths requested by `next/image` and its scoped Sanity loader by default. It applies focal positioning with `object-fit: cover`; set `disableFocal` to keep the browser's default fit.

### Global loader

Next.js's custom loader applies to every `next/image` component:

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

Compatible Sanity image URLs receive width, quality, and `auto=format` parameters. Sanity file URLs and non-Sanity URLs pass through unchanged. Other `next/image` components do not use Next.js's built-in optimization under this global custom loader.

For mixed image providers, keep the loader scoped to `SanityImage` (the default) or pass it explicitly:

```tsx
import {
  SanityImage,
  sanityImageLoader,
} from '@klnap/payload-storage-sanity/consumers/next'

<SanityImage
  asset={image}
  loader={sanityImageLoader}
  sizes="100vw"
/>
```

Other `next/image` instances then keep Next.js's default loader. Use `createSanityImageLoader({ cdnBaseUrl })` for a custom compatible CDN host.

`SanityImage` accepts the standard `next/image` props except props derived from the asset (`src`, `alt`, dimensions, `fill`, style, and placeholder fields). Its own `alt`, `fallbackAlt`, and `fill` options control those values.

## Custom media shapes

For an application-owned API response with a different field layout, pass `assetMapping`. Mapping paths are dot-separated and must resolve to the corresponding normalized fields:

```tsx
import { SanityImage } from '@klnap/payload-storage-sanity/consumers/next'

<SanityImage
  asset={page.hero}
  assetMapping={{
    url: 'asset.url',
    width: 'asset.metadata.width',
    height: 'asset.metadata.height',
    alt: 'description',
  }}
  sizes="100vw"
/>
```

Use the mapping only for that custom response shape. Its URL must resolve to a supported Sanity image CDN path; mapping alone does not prove that an asset is an image. Do not map a standard default-populated relationship again.

## Explicit full population

Payload's `populate` selection opts out of the normalized default shape for that relation. Use the built-in helpers when the frontend needs full media fields:

```ts
import { fullPopulate } from '@klnap/payload-storage-sanity'

const { docs } = await payload.find({
  collection: 'pages',
  depth: 1,
  populate: {
    media: fullPopulate(),
  },
})
```

`createPopulate()` returns the same baseline selection and can extend or exclude nested fields. Full documents include Payload file metadata and the persisted `sanity.asset` data; consumers can resolve a URL with `buildSanityImageUrl`.

## Direct media reads

Direct media reads keep the full document because Payload's admin editor needs upload fields and metadata. They do not return `MediaAsset` even when the default preset is enabled. Use the native generated media type for full documents, or map a custom response shape when passing it to `SanityImage`.

## Image URL builder

Use `buildSanityImageUrl` when you need a URL without rendering through `SanityImage`:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const url = buildSanityImageUrl(image, {
  width: 960,
  height: 540,
  fit: 'crop',
  quality: 80,
})
```

It accepts a normalized asset, full media document, compatible image URL, or Sanity asset reference. Stored CDN URLs need no client. A bare Sanity asset reference requires a client from `@sanity/client` or `createSanityClient` from the package's `/client` entry.
