# Asset ownership, delivery, and lifecycle

This page explains which system owns what, how the two stay in step, and what a delete or crop does.
For option names, see [configuration](./configuration.md). For error and locking behavior, see
[failure semantics](./FAILURE_SEMANTICS.md).

## Why Sanity stores the files

Payload manages content, relationships, media records, and editorial workflows. Sanity provides managed
asset storage and a global Asset CDN that serves files and on-demand image transformations.

The plugin connects the two. Payload remains the media workspace. Sanity stores the bytes and delivers
them. Sanity provides the CDN and transformation infrastructure; the plugin runs neither. Sanity's
[Image API](https://www.sanity.io/docs/apis-and-sdks/image-urls) resizes, crops, and negotiates formats
with `auto=format`. Its [Asset CDN](https://www.sanity.io/docs/apis-and-sdks/asset-cdn) caches the
requested variants, so Payload does not need to store predefined sizes.

## Ownership

| Data | Owner |
|---|---|
| Media document, title, alt text, folder, relationships | Payload |
| Asset bytes and Sanity asset ID | Sanity |
| Sanity asset details (`sanity.asset`) | Payload, read-only, copied from Sanity |
| Image transformations | Sanity Image API, requested by consumers |

Sanity Studio is not required. Uploads and folder assignment work without it.

## Access and CDN delivery

Plugin uploads are ordinary Sanity Content Lake dataset assets. Their CDN URLs are public, even when the
dataset is private. Sanity Media Library's private assets and signed URLs are a separate system and are
not used here.

Payload's access control protects Payload API records. By default, generated file URLs point straight to
Sanity and bypass Payload's file-delivery proxy (`disablePayloadAccessControl: true`). Setting it to
`false` routes generated URLs through Payload. That does not make an exposed Sanity CDN URL private.

Treat every uploaded file as publicly fetchable once its URL is known.

## Frontend use

Consumers read `MediaAsset` values from populated responses. [Consumers](./consumers.md) covers the
Next.js `SanityImage` component, custom CDN origins, and `buildSanityImageUrl()` for other frameworks.
Consumers apply transformations; Payload stores no resized files.

## Synchronization

Payload rows and Sanity assets can diverge when someone changes or deletes an asset in Sanity. Optional
sync repairs this:

- A signed webhook at `/api/sanity-storage/webhook` processes Sanity events. Sanity may retry them, so handlers are safe to repeat.
- A batch reconcile endpoint at `/api/sanity-storage/reconcile` checks rows in batches against Sanity and
  reports duplicates. By default it writes sync status and the `sanity.asset` data it reads back. A request
  with `dryRun: true` only reports. Neither mode deletes a Sanity asset.
- `onDeleted: 'mark'` (default) marks the row unavailable, and the row stops returning its URLs.
- `onDeleted: 'delete'` removes the row, subject to the reference guard.

Webhook delivery is not guaranteed in real time. Run reconcile to recover from missed events. Neither
setting deletes a Sanity asset.

## Lifecycle

- **Upload:** uploads the Sanity asset, then creates the Payload media document. If Payload persistence
  fails after the Sanity upload succeeds, the Sanity asset stays unreferenced.
- **Replacement:** uploads a new asset and updates the media document. The previous asset is not deleted.
- **Crop:** uploads the cropped bytes as a new asset and points the media document at it. The uncropped
  asset stays in Sanity, and its URL may still work.
- **Deletion:** deletes the Payload row only. Sanity assets are content-addressed and can be shared, so
  check other references before any external cleanup.
- **Sync:** see above. Neither setting deletes a Sanity asset.

Replacement and crop do not revoke shared URLs or clear copies in caches, logs, or other systems. The
package runs no destructive cleanup of Sanity assets. If you need that, run a separate, operator-managed
cleanup.

## Consistency boundary

Payload and Sanity are separate systems, so no transaction spans both. A failed Payload write can leave
an unreferenced Sanity asset. A delete in Payload leaves the Sanity asset in place. Webhooks and
reconcile close most drift, but not instantly. The reference guard protects Payload relationships only.

## Security

Report vulnerabilities through the [security policy](https://github.com/klnap/payload-storage-sanity/blob/main/SECURITY.md).
