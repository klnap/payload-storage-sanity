# Consumers (storefront / Next.js)

Use this when a **storefront or app** reads Payload over REST (or the Payload SDK) with nested populate (**`preset: 'default'`** is the plugin default) and **`depth ≥ 1`** on upload relations. You get a flat **`DefaultPopulateAsset`** per image — no full `sanity` group, no binary fields.

---

## 1. Fetch with depth and locale

```typescript
const page = await payload.findByID({
  collection: 'pages',
  id: pageId,
  depth: 1,
  locale: 'en',
})

// page.hero is DefaultPopulateAsset when the relation is populated
```

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
| `assetFocalObjectPosition` | CSS `object-position` from focal point |
| `buildSanityImageUrl` | Server-side URL builder (also on main entry) |

---

## 4. Type-only imports

| Use | Import |
| :--- | :--- |
| Types | `import type { DefaultPopulateAsset } from '@klnap/payload-storage-sanity'` or `/next` |

Types erase at compile time — zero runtime cost.

---

## 5. Component choice

| Approach | When |
| :--- | :--- |
| **`SanityImage`** | Default — handles URL, dimensions, LQIP, focal point. |
| **`next/image` + `toSanityImageProps`** | Full control over layout / `sizes`. |
| Plain `<img src={asset.url}>` | Prototypes only — no transforms or LQIP. |

---

## 6. Checklist

1. CMS: `populate.preset` **`default`** (plugin default) on media collections.
2. Storefront requests: **`depth ≥ 1`** on relations that should embed the DTO.
3. Same **`locale`** as the UI when resolving localized `alt`.
4. Register the Sanity image loader if you use `next/image` with CDN URLs.
