# Consumers

The optional consumer utilities use media stored through the Payload plugin. Import framework-independent
utilities from `@klnap/payload-storage-sanity/consumers`; import `SanityImage` and Next.js loaders from
`@klnap/payload-storage-sanity/consumers/next`.

The normalized `MediaAsset` contract is documented in [Media Population](./media-population.md).

## Next.js

`SanityImage` accepts a populated `MediaAsset` directly and keeps runtime image validation inside the
component:

```tsx
import {
  SanityImage,
  type MediaAsset,
} from '@klnap/payload-storage-sanity/consumers/next'

export function ArticleCover({ image }: { image: MediaAsset }) {
  return (
    <SanityImage
      asset={image}
      sizes='(max-width: 768px) 100vw, 50vw'
    />
  )
}
```

Next.js supplies responsive widths. The component's scoped loader adds the requested width and quality
to supported Sanity image URLs; Sanity performs the transformations. When called directly, the loader
leaves other URL types unchanged.
The component uses intrinsic dimensions when available, forwards alt text, applies focal positioning
with CSS, and uses LQIP when available. Missing dimensions use `fill`; missing, invalid, or non-image
assets use the `fallback` prop. Pass `fallback={null}` to render nothing.

To serve Sanity assets from a custom origin, such as a proxy you operate, pass `cdnBaseUrl` to one component. Sanity URLs (on `cdn.sanity.io` or the configured origin) move to that origin; unrelated URLs stay unchanged:

```tsx
import { SanityImage, type MediaAsset } from '@klnap/payload-storage-sanity/consumers/next'

export function ArticleCover({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} cdnBaseUrl='https://images.example.com' sizes='100vw' />
}
```

For the default Sanity CDN, Next.js can use the package's default loader entry directly:

```ts
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

A global custom loader affects every `next/image`; other providers will not use Next.js's built-in
optimization. For a custom CDN host, configure `loaderFile` with `createSanityImageLoader`:

```ts
// sanity-image-loader.ts
import { createSanityImageLoader } from '@klnap/payload-storage-sanity/consumers/next'

export default createSanityImageLoader({ cdnBaseUrl: 'https://images.example.com' })
```

Keep the loader scoped to `SanityImage` when the application uses mixed image providers.

### Custom response shapes

For application-owned response shapes, pass `assetMapping` with dot-separated paths:

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
  sizes='100vw'
/>
```

The mapped URL must resolve to a supported Sanity image CDN path. Mapping describes the field layout;
it does not turn a file into an image.

## Framework-independent Image URLs

Use `buildSanityImageUrl` when an application needs a transformed URL without rendering `SanityImage`:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity/consumers'

const url = buildSanityImageUrl(image, {
  width: 960,
  height: 540,
  fit: 'crop',
  quality: 80,
})
```

It accepts a populated asset, a full media document, a URL, or a Sanity asset reference. Options include
`width`, `height`, `fit`, `quality`, a pixel `rect`, `autoFormat`, `cdnBaseUrl`, and `client`. Stored Sanity
image URLs need no client. A bare image asset reference without a URL requires a `SanityClient`, such as
one created by `createSanityClient()` from `@klnap/payload-storage-sanity/client`.

Supported Sanity image URLs receive the requested parameters and `auto=format` by default. File URLs get
no image parameters. When `cdnBaseUrl` is set, Sanity URLs (stored or built) move to that origin. The function returns `null` when it cannot resolve a URL; a bare image reference
without a client throws. It does not infer focal coordinates.
