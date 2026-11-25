# Consumers (storefront / Next.js)

Use this when a **storefront or app** reads Payload over REST or **`@payloadcms/sdk`** with nested populate (**`preset: 'default'`** is the plugin default) and sufficient **`depth`** on upload relations. You get a flat **`DefaultPopulateAsset`** per image — no full `sanity` group, no binary fields.

**Package layout (internal):** framework-agnostic resolution lives in `src/presentation/image/`; the public entry **`@klnap/payload-storage-sanity/next`** is built from `src/presentation/adapters/next/` (React / `next/image` only). Import the npm subpath — not internal `src/` paths.

Direct **`GET /api/media/:id`** (admin editor) still returns the full media document.

---

## 1. Fetch with depth and locale

### Flat default (`SanityImage`)

```typescript
import { PayloadSDK } from '@payloadcms/sdk'

const sdk = new PayloadSDK({ baseURL: `${process.env.NEXT_PUBLIC_PAYLOAD_URL}/api` })

const page = await sdk.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 1,
  select: { image: true },
})

// page.image → DefaultPopulateAsset
```

Relations inside groups, in collections or globals, are populated at **`depth: 1`**. Raise `depth` only for relations of relations:

```typescript
const home = await sdk.findGlobal({
  slug: 'home-page',
  locale: 'pl',
  depth: 1,
  select: {
    image: true,
    socialMedia: {
      image: true,
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

You receive exactly the selected shape (hydrated URLs, no flattening to `DefaultPopulateAsset`). **Do not pass this into `SanityImage`.** Render with **`next/image`** (or your own component) and declare `src`, `width`, `height`, `alt`, placeholders yourself.

When the media collection uses the injected **localized alt group**, selecting **`alt: true`** (or nested locale keys) returns an **object** (`alt.pl`, …), not a single string — use **`resolveLocalizedAlt(doc.alt, { locale: 'pl' })`** from the main package, or map a string field via **`assetMapping`**. Each locale stands alone: a missing translation returns `null`, never another language. See **[README — Asset-level alt text](../README.md#asset-level-alt-text)**.

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
| `url` | `string` | Public CDN URL (hydrated from the stored Sanity asset path). |
| `width` / `height` | `number` (optional) | From Sanity metadata. |
| `aspectRatio` | `number` (optional) | |
| `focalX` / `focalY` | `number` | Percentages, 0–100. Always present; `50` when the asset has no focal point. |
| `alt` | `string` \| `null` | Text for the request **`locale`**. `null` when that locale has no translation; `''` when it is explicitly empty (decorative). Omit **`locale`** → usually **`null`**. |
| `lqip` | `string` (optional) | Low-quality image placeholder when present. |

No `path`, `sanity`, or upload binary fields — safe to pass to the client when the relation was morphed to this DTO. If **`url`** is missing (unavailable asset), morph may fall back to a full media document instead — guard **`asset?.url`** (see README [Frontend-ready media](../README.md#frontend-ready-media)).

---

## 3. `@klnap/payload-storage-sanity/next`

Optional Next.js entry (peer `next` is optional on the main package).

### `SanityImage` / `createSanityImage`

```tsx
import { SanityImage } from '@klnap/payload-storage-sanity/next'

<SanityImage asset={page.hero} sizes="(max-width: 768px) 100vw, 1200px" />
```

Without a `fallback`, `SanityImage` renders nothing for a missing or broken asset. `createSanityImage({ fallback })` sets a default for every image it creates.

`asset.alt` is already resolved for the request locale during default populate on the CMS — pass **`locale` on SDK/REST fetches**, not on `SanityImage`. Use the **`alt`** prop to override the CMS value for one image. `alt=""` marks it decorative and is kept as-is. **`fallbackAlt`** applies only when the asset has no alt text (`null`).

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

`SanityImage` accepts **`DefaultPopulateAsset`** or a **custom asset** when you supply **`assetMapping`** (see [Next.js](../README.md#nextjs)). Default morph produces `DefaultPopulateAsset` on REST nested populate and Local API reads when the preset is `default`.

Optional: `toSanityImageProps` when you already have a `DefaultPopulateAsset` and want raw `next/image` with the same focal/LQIP mapping.

### Custom populate shape + `assetMapping`

```tsx
import { createSanityImage } from '@klnap/payload-storage-sanity/next'

const CardImage = createSanityImage<{ src: string; w: number; h: number }>({
  assetMapping: { url: 'src', width: 'w', height: 'h' },
})
```

---

## 6. Checklist

1. CMS: `populate.preset` **`default`** (plugin default) on media collections.
2. Storefront: **`depth ≥ 1`**, `select` on relations; use **`populate.media`** when you need full or partial media (not `context`).
3. Same **`locale` on fetches** (`find` / `findGlobal`) as the UI — not on `SanityImage`.
4. Register the Sanity image loader if you use `next/image` with CDN URLs.
