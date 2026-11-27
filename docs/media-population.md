# Media Population

Media Population converts eligible populated Payload upload relationships into a flat `MediaAsset`
response. This gives frontend code a stable URL and image metadata without exposing the full Payload
media document. `MediaAsset` is a data contract produced by the plugin, not a consumer component.

Import its type from `@klnap/payload-storage-sanity/consumers` or, for Next.js code,
`@klnap/payload-storage-sanity/consumers/next`.

## When normalization applies

The default `populate.preset: 'default'` applies to populated relationships with a resolvable asset URL.
The relationship must be populated (`depth` greater than zero); at depth zero, Payload returns its
relationship ID.

The plugin keeps the full media document for authenticated reads, direct media document reads, media
collection list routes, explicit per-relation `populate` selections, and reads where no CDN URL resolves.
Use `populate.preset: 'full'` to keep full documents. Local API reads use the default preset unless
`localPopulate: false` is set. Per-collection population options override plugin-level options.

| Read or option | Result |
| --- | --- |
| Eligible populated relationship with a CDN URL | Normalized `MediaAsset` |
| Depth-zero relationship | Relationship ID |
| Direct media read or media collection list | Full Payload media document |
| Authenticated request | Full Payload media document |
| Explicit `populate` selection | Full Payload media document |
| No resolvable CDN URL | Full Payload media document |
| `preset: 'full'` | Full Payload media document |
| Local API with `localPopulate: false` | Full Payload media document |

REST nested population and Local API relationship population are supported. Direct `GET /api/{media}/:id`
reads remain full documents so Payload's admin editor retains its native fields and upload state.

## Response contract

`MediaAsset` is the same flat contract for image and file assets. Images may include dimensions, aspect
ratio, and LQIP; those image-specific metadata fields are optional. The response does not include a
file-kind discriminator, filename, MIME type, byte size, or the persisted Sanity asset object.

The crop integration test asserts this populated response shape after changing the image to 2 × 2
pixels. The asset URL has a content-derived filename, so the test checks its Sanity CDN host:

```ts
expect(populated.hero).toMatchObject({
  id: photo.id,
  url: expect.stringContaining('cdn.sanity.io'),
  width: 2,
  height: 2,
  aspectRatio: 1,
  focalX: 20,
  focalY: 80,
  alt: 'Wide',
})
```

The response has these fields:

```ts
export type MediaAsset = {
  id: string | number
  url: string
  width?: number
  height?: number
  aspectRatio?: number
  focalX: number
  focalY: number
  alt: string | null
  lqip?: string
}
```

`id`, `url`, focal coordinates, and `alt` are present in normalized results. Missing focal values
default to `50`. `alt` is resolved for the request locale and is `null` when no value exists for that
locale; an explicitly empty translation remains empty. Image dimensions and aspect ratio are included
when available. LQIP is included only when Sanity provides it.

Files can be normalized when they have a URL, but image metadata may be absent. `SanityImage` renders
supported Sanity image URLs; it does not render file assets as images.

## Configuration

Set plugin-level defaults:

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  populate: {
    preset: 'default',
    localPopulate: false,
  },
})
```

Override them for one collection:

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: {
      populate: {
        preset: 'full',
      },
    },
  },
})
```

`localPopulate` defaults to `true` with the `default` preset and `false` with `full`. For a full media
document on a specific relationship, use Payload's `populate` selection. The package exports
`fullPopulate()` and `createPopulate()` from its root entry to build these selections; see
[configuration and public API](./configuration.md#populate-behavior).

For the consumer-facing component and image URL APIs, see [Consumers](./consumers.md).
