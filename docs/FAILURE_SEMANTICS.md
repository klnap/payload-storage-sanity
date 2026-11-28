# Failure semantics and asset lifecycle

This plugin coordinates Payload writes with Sanity Asset API requests. They are separate systems; no transaction spans both services.

## Uploads and Payload persistence

The plugin calls Sanity's Content Lake Asset API through `@sanity/client` (`client.assets.upload('image', ...)` for images and `client.assets.upload('file', ...)` for other files). Payload stores the asset reference and media document. The asset upload can succeed before Payload persistence fails, leaving an unreferenced Sanity asset.

Replacing a file uploads the replacement. Cropping also uploads new cropped bytes and replaces the Payload row's `sanity.asset` reference; the row no longer points to the uncropped asset. The old Sanity asset is retained, but may become unreferenced from Payload. Deleting a Payload media row deletes only the Payload row; this plugin does not call the Sanity asset-delete API. Failed, replaced, or cropped uploads can leave assets that no Payload media document references. Retain or clean them through an operator-managed process that accounts for shared assets and Sanity references.

Sanity asset IDs are content-addressed, not exclusive ownership claims. Upload deduplication is opt-in with `dedupeUploads: true` and applies to creates. It rejects a duplicate Payload media create by file SHA-1; it does not establish that the Sanity asset is unused elsewhere.

PostgreSQL uses a transaction-scoped advisory lock keyed by the file hash through upload completion. Other adapters serialize only the preflight lookup within one process. Concurrent processes can still create duplicate Payload rows. Sanity may return the same content-addressed asset for identical bytes.

## Payload-generated image sizes

For every configured upload collection, the plugin sets `upload.imageSizes: []`. It overrides collection-level `imageSizes`, so new uploads do not produce Payload derivative files. Use Sanity CDN URL parameters for resized variants.

The plugin does not remove existing `sizes` data from media documents. Existing derivatives are not rewritten or deleted.

## Local media deletion and references

`preventDeleteWhenReferenced` defaults to `true`. It blocks deleting a Payload media document while supported Payload upload, relationship, or rich-text references remain.

- PostgreSQL uses transaction-scoped locks to serialize supported Payload reference writes and guarded media deletion.
- SQLite and other adapters without those locks fail guarded deletion with `503`.
- `preventDeleteWhenReferenced: false` disables the guard.
- Direct SQL and external database writes bypass Payload hooks and the guard.
- Internal operations with `req.context.skipCloudStorage` bypass the guard.

This protects Payload media rows only. It does not inspect all Sanity documents, other datasets, or external systems, and it never deletes remote assets.

## Asset access and URLs

This package uploads dataset assets with Sanity's Content Lake Asset API. Dataset assets are publicly accessible through the Sanity Asset CDN, even when the dataset itself is private. Private Sanity Media Library assets and signed delivery URLs are not supported.

Payload's adapter defaults to direct CDN URLs with `disablePayloadAccessControl: true`. Set it to `false` to route generated file URLs through Payload's file-delivery proxy. This cannot make an already exposed Sanity CDN URL private.

Unavailable assets clear hydrated Payload `url` and `thumbnailURL` values when media sanitization runs. URLs already copied to caches, logs, emails, or other systems remain outside plugin control.

The plugin's image URL builder only adds transformations to supported Sanity image URLs. Non-image file URLs are returned unchanged. A file URL is not an image derivative.

## Sync endpoints

With `sync.enabled: true`, the plugin registers webhook and reconcile endpoints under `/api/sanity-storage` by default.

| Condition | Behavior |
| --- | --- |
| Webhook body is empty | `400`. |
| Body exceeds `sync.webhook.maxBodySizeBytes` | `413`; default limit is `262144` bytes. |
| HMAC is missing or invalid | `401`; no media update occurs. |
| HMAC is valid | The handler processes the Sanity event. |
| Reconcile route is disabled | No reconcile endpoint is registered. |
| Reconcile authorization fails | Request is rejected by the configured access function. |

The webhook signature covers the raw request bytes. Parsing and reserializing JSON before verification changes the signed body. The configured body limit applies to the webhook handler; Payload multipart upload limits and reverse-proxy limits are separate.

Webhook handlers are safe to repeat because Sanity may retry delivery. `onDeleted: 'mark'` (default) marks media unavailable, and the row stops returning its URLs. `onDeleted: 'delete'` removes matching Payload media rows, subject to the reference guard. Neither policy deletes Sanity assets.

Reconcile checks batches of media rows and reports duplicate assets for operator action; it does not automatically delete duplicate Payload rows or remote assets. Reconcile is protected by `sync.access`, which defaults to the admin auth collection.

## Failures and recovery

- A Sanity upload error fails the upload; a later Payload persistence error can leave the Sanity asset behind.
- A webhook authentication or body-size failure returns an error without applying the event.
- A Sanity or Payload sync failure is recorded in media sync status or logs; reconcile can recheck unavailable rows.
- Unavailable media is marked by sync status. Replace or remove the Payload row through the normal Payload admin; the plugin does not register a recovery UI, and it never recreates or deletes Sanity assets.
- Logs use a fixed prefix and structured context. Do not include write tokens, webhook secrets, or raw request bodies in custom logs.

## Cache behavior

Sanity caches Asset CDN URLs and transformed variants independently from frontend caches. Cache invalidation integrations such as [`@klnap/revalidation`](https://www.npmjs.com/package/@klnap/revalidation) do not purge Sanity's CDN. A replacement has a new content-addressed URL; the old asset remains available until separately removed.
