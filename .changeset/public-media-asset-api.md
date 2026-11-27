---
"@klnap/payload-storage-sanity": major
---

Rename `DefaultPopulateAsset` to `MediaAsset` without a compatibility alias. Remove the image-specific media type and public narrowing guards. Re-export the canonical type from the Next.js consumer entry, and let `SanityImage` accept it directly while validating runtime values.
