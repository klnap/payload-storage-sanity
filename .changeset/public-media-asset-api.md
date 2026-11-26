---
"@klnap/payload-storage-sanity": major
---

Rename `DefaultPopulateAsset` to `MediaAsset` and `isDefaultPopulateAsset()` to `isMediaAsset()`, with no compatibility aliases. Require `isMediaImageAsset()` before `SanityImage`; Sanity file URLs now use its fallback instead of rendering.
