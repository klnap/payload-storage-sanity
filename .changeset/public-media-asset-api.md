---
"@klnap/payload-storage-sanity": minor
---

Breaking (pre-1.0): rename `DefaultPopulateAsset` to `MediaAsset` without a compatibility alias. Replace the image-specific media type with `MediaAsset`, and remove the public narrowing guards. Re-export the canonical type from the Next.js consumer entry; `SanityImage` accepts `MediaAsset` directly and validates runtime values.

Fix `cdnBaseUrl` handling: it is now the origin that serves Sanity assets in place of `https://cdn.sanity.io`. `buildSanityImageUrl()`, `createSanityImageLoader()`, and `SanityImage` move Sanity URLs to that origin, and they apply image transformations to URLs already on that origin.

Fix the media detail preview so the replace and edit controls sit in their own row and never overlap the image, including very wide panoramas. The image keeps its aspect ratio inside the padded area.
