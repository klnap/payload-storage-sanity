# Consumers (storefront / Next.js)

Use this when a **storefront or app** reads Payload over REST or **`@payloadcms/sdk`** with nested populate (**`preset: 'default'`** is the plugin default) and sufficient **`depth`** on upload relations. You get a flat **`DefaultPopulateAsset`** per image — no full `sanity` group, no binary fields.

Direct **`GET /api/media/:id`** (admin editor) still returns the full media document.

---

## 1. Fetch with depth and locale

### Flat default (`SanityImage`)

```typescript
import { PayloadSDK } from '@payloadcms/sdk'

const page = await sdk.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 1,
  select: { image: true },
})

// page.image → DefaultPopulateAsset
```

Globals with nested groups need **`depth ≥ 2`**:

```typescript
const home = await sdk.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 2,
  select: {
    image: true,
    socialMedia: {
      image: {
        asset: true,
        alt: true,
      },
    },
  },
})
```

### Manual `populate` (no morph)

Pass a field map under your **upload collection slug** (e.g. `media`):

```typescript
const post = await sdk.find({
  collection: 'posts',
  depth: 1,
  locale: 'pl',
  select: { title: true, heroImage: true },
  populate: {
    media: {
      filename: true,
      focalX: true,
      sanity: { path: true, metadata: { dimensions: true } },
    },
  },
})
```

You receive exactly the selected shape (hydrated URLs, no flattening to `DefaultPopulateAsset`). **Do not pass this into `SanityImage`.** Render with **`next/image`** (or your own component) and declare `src`, `width`, `height`, `alt`, placeholders yourself. See harness `test-next/lib/manual-media-image.tsx`.

### `fullPopulate` / `createPopulate`

When you need the full hook-aligned baseline without copying field trees:

```typescript
import { fullPopulate, createPopulate } from '@klnap/payload-storage-sanity'

const full = await sdk.findGlobal({
  slug: 'home-page',
  depth: 1,
  locale: 'pl',
  select: { image: true },
  populate: { media: fullPopulate() },
})

// lib/media-populate.ts — name as many variants as you need
export const partialPopulate = createPopulate({
  exclude: ['sync', 'originalFilename', 'mimeType', 'sizes'],
})
```

**Why `fullPopulate`?** Payload only expands relations when you pass `populate[collectionSlug]`. The helper mirrors fields the plugin already loads for hooks (`defaultPopulate` / `forceSelect`).

### Config: always full

`sanityStorage({ populate: { preset: 'full' } })` — every nested relation returns the full media document (no morph).

Opt out of Local API DTO morph only: `sanityStorage({ populate: { preset: 'default', localPopulate: false } })`.

---

## 2. `DefaultPopulateAsset` shape

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `string` \| `number` | Payload document id (UUID when `db` uses `idType: 'uuid'`). |
| `url` | `string` | Public CDN URL (from `resolvePublicUrl`). |
| `width` / `height` | `number` \| `null` | From Sanity metadata. |
| `aspectRatio` | `number` \| `null` | |
| `focalX` / `focalY` | `number` \| `null` | |
| `alt` | `string` \| `null` | Request locale (or `fallbackLocale` from collection `alt` config). |
| `lqip` | `string` \| `null` | Low-quality image placeholder when present. |

No `path`, `sanity`, or upload binary fields — safe to pass to the client.

---

## 3. `@klnap/payload-storage-sanity/next`

Optional Next.js entry (peer `next` is optional on the main package).

### `SanityImage` / `createSanityImage`

```tsx
import { SanityImage } from '@klnap/payload-storage-sanity/next'

<SanityImage asset={page.hero} width={1200} height={630} alt="" />
```

`createSanityImage` returns a component with a default `fallback` for broken URLs.

`asset.alt` is already resolved for the request locale during default populate on the CMS — pass **`locale` on SDK/REST fetches**, not on `SanityImage`. Use the `alt` prop only to override the CMS value (decorative images, SEO).

### `next.config` image loader

```typescript
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

```typescript
// sanity-image-loader.ts
export { default } from '@klnap/payload-storage-sanity/next/loader'
```

### Helpers

| Export | Role |
| :--- | :--- |
| `toSanityImageProps` | Map `DefaultPopulateAsset` → `next/image` props |
| `focalObjectPosition` | CSS `object-position` from focal point |
| `buildSanityImageUrl` | Server-side URL builder (also on main entry) |

---

## 4. Type-only imports

| Use | Import |
| :--- | :--- |
| Types | `import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity'` or `/next` |

Types erase at compile time — zero runtime cost.

---

## 5. Component choice (strict contract)

| Fetch | Component |
| :--- | :--- |
| Shallow relation, **no** explicit `populate.media` → `DefaultPopulateAsset` | **`SanityImage`** with `asset={relation}` |
| Explicit `populate.media` (manual, `fullPopulate`, `createPopulate`, …) | **`next/image`** (native props) — not `SanityImage` |

`SanityImage` only accepts **`DefaultPopulateAsset`**. That type is produced by the plugin morph on the default path, not by arbitrary selects.

Optional: `toSanityImageProps` only when you already have a `DefaultPopulateAsset` and want raw `next/image` with the same focal/LQIP mapping.

---

## 6. Checklist

1. CMS: `populate.preset` **`default`** (plugin default) on media collections.
2. Storefront: **`depth ≥ 1`**, `select` on relations; use **`populate.media`** when you need full or partial media (not `context`).
3. Same **`locale` on fetches** (`find` / `findGlobal`) as the UI — not on `SanityImage`.
4. Register the Sanity image loader if you use `next/image` with CDN URLs.
