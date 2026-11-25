# Troubleshooting

See [failure semantics](./FAILURE_SEMANTICS.md) for lifecycle guarantees and operational limits.

## Plugin throws at startup

| Symptom | Cause | Fix |
| --- | --- | --- |
| `projectId` or `dataset` is required | Missing Sanity project configuration. | Set both values. |
| `token` is required when mode is `full` | Upload storage is enabled without a write token. | Provide a server-side token or disable cloud storage. |
| `token` is required when sync is enabled | Sync cannot query or update assets. | Add a write token or disable sync. |
| `sync.webhook.secret` is required | Webhook sync is enabled without an HMAC secret. | Set the secret on the server or disable sync. |
| Unknown collection or collection has no upload | Explicit `collections` map does not match Payload config. | Use existing upload collection slugs. |
| Collection already has a storage adapter | Explicit selection conflicts with another adapter. | Select one storage adapter per collection. Automatic discovery skips existing adapters. |

## Upload fails or asset is missing

1. Confirm the default `mode: 'full'` and a Sanity token with asset write access.
2. Check `uploadMaxSize` and Payload's native multipart limits.
3. Confirm the Sanity project ID and dataset.
4. Inspect Payload logs for `[@klnap/payload-storage-sanity]`.

A Sanity upload can succeed before Payload persistence fails, leaving an unreferenced remote asset. The plugin does not delete remote assets.

## Payload image sizes are empty

Configured upload collections use `upload.imageSizes: []`. Sanity CDN URLs provide resized variants. Existing `sizes` data is not removed or updated automatically.

## Duplicate media rows

`dedupeUploads` defaults to `false`. With `dedupeUploads: true`, a create using identical file bytes returns `409` and identifies the existing media row. PostgreSQL serializes matching uploads across processes; other adapters only serialize the lookup within one process.

## Media deletion fails

`preventDeleteWhenReferenced` defaults to `true`.

- `400`: a supported Payload reference still points to the media document. Check the References tab or `GET /api/{media}/:id/usage`.
- `503`: the database adapter cannot provide the transaction lock required by the guard.

Disabling the guard permits dangling Payload references. It never deletes the Sanity asset.

## Image URL is empty

Check the media document's `sync.status` and persisted `sanity.asset` data. `deleted`, `missing`, and `error` sync states clear hydrated `url` and `thumbnailURL` values. Webhooks or the reconcile endpoint can refresh status. The unavailable-asset recovery UI helps editors replace or unlink broken media.

## Webhook returns 401

The endpoint verifies the HMAC against the raw request body. Confirm `sync.webhook.secret` matches Sanity's webhook, then check the path. The default endpoint is `POST /api/sanity-storage/webhook`.

## Reconcile returns 403

By default, `sync.access` allows users from Payload's admin auth collection (`config.admin.user`). Configure a custom access function for trusted automation.

## Populate shape is unexpected

The default preset normalizes eligible populated relationships only. Set `depth: 1` or higher and pass the requested locale. Direct media reads, authenticated requests, explicit populate selections, and depth-zero relationships keep full documents or IDs.

Use `isDefaultPopulateAsset()` to narrow a generated Payload relationship before passing it to `SanityImage`. Use `assetMapping` for a custom populated shape.

## Next.js images are broken or unoptimized

Import `SanityImage` from `@klnap/payload-storage-sanity/consumers/next`. For a global loader, configure `images.loader` and `loaderFile` as shown in the [README](../README.md#consumers). For mixed providers, use the scoped `sanityImageLoader` prop. A global loader affects every `next/image`; non-Sanity URLs pass through unchanged without Next.js's built-in optimization.

## `assetMapping` does not resolve an image

Use dot-separated paths such as `asset.url` or `metadata.width`. The mapped URL must resolve to a non-empty string. See [custom media shapes](./consumers.md#custom-media-shapes).

## Payload proxy returns 404 or 502

When Payload proxies file delivery, it fetches only compatible Sanity CDN hosts. An upstream 404 remains a 404. Redirects to non-allowlisted hosts return 502.

## Raw Node.js import fails

The published ESM build expects a bundler to resolve extensionless imports. Raw Node.js ESM imports are not supported. See [compatibility](../README.md#compatibility).
