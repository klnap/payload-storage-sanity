# Configuration and public API

`sanityStorage()` registers Sanity through Payload's native cloud-storage plugin. It expects existing
Payload upload collections; it does not create media collections or replace their relationships.

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  collections: {
    media: {
      folder: {
        image: 'website/images',
        video: 'website/videos',
        audio: 'website/audio',
        file: 'website/files',
      },
      alt: { required: true },
    },
  },
  folders: {
    image: 'Payload/images',
    video: 'Payload/videos',
    audio: 'Payload/audio',
    file: 'Payload/files',
  },
})
```

## Plugin options

| Option | Default | Purpose |
| --- | --- | --- |
| `projectId` | required | Sanity project ID. |
| `dataset` | required | Sanity dataset for uploaded assets. |
| `token` | required in `full` mode | Server-side Sanity write token. |
| `apiVersion` | package default | Sanity API version for client requests. |
| `cdnBaseUrl` | Sanity CDN | Origin that serves Sanity assets in place of `cdn.sanity.io`, for example a proxy. Sanity URLs move to this origin; image transformations apply to image paths. |
| `resolveFetch` | — | Custom Sanity client transport. |
| `collections` | automatic discovery | Explicit upload collections to configure. |
| `admin` | gallery enabled | Default admin options for configured collections. |
| `populate` | `preset: 'default'` | Default or full media relationship response. |
| `mode` | `'full'` | Cloud storage and field registration mode. |
| `dedupeUploads` | `false` | Reject duplicate media creates by SHA-1. |
| `preventDeleteWhenReferenced` | `true` | Protect referenced Payload media rows. |
| `uploadMaxSize` | Payload default | Global maximum and optional media-type upload limits. |
| `upload.transport` | internal Sanity upload | Optional direct-to-HTTP-transport upload using the versioned ticket protocol. |
| `folders` | media-type defaults | Global logical folder paths; set `false` to disable assignment. |
| `sync` | disabled | Sanity webhook and reconcile routes. |

`mode: 'full'` uploads files to Sanity and registers the cloud-storage adapter. `fields-only` disables cloud storage and keeps Sanity fields and hooks. `off` disables cloud-storage registration; selected collections may still receive Sanity fields, hooks, and routes.

`token` is optional in the TypeScript contract for modes that do not upload. In the default `full` mode, startup validation requires a non-empty token. Keep it server-only.

## HTTP upload transport

The internal Sanity transport remains the default. Set `upload.transport` to opt supported admin uploads into direct HTTP transfer:

```ts
sanityStorage({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  token: process.env.SANITY_API_TOKEN!,
  upload: {
    transport: {
      endpoint: process.env.SANITY_UPLOAD_TRANSPORT_URL!,
      maxSizeBytes: 50 * 1024 * 1024,
      protocolVersion: 1,
      secret: process.env.SANITY_UPLOAD_TRANSPORT_SECRET!,
    },
  },
})
```

The transport URL must use HTTPS in production; localhost HTTP is allowed only outside production. The shared signing secret must contain at least 32 UTF-8 bytes and must remain server-side in Payload and the trusted transport. Configure `serverURL` as an HTTPS origin reachable by the transport. External transports require the verified PostgreSQL adapter and its transaction support; other database adapters fail during Payload initialization.

The transport endpoint must allow browser `POST` requests from the Payload admin origin, including the `Authorization` and `Content-Type` headers. Handle the corresponding CORS preflight; never allow arbitrary origins with credentials.

Protocol version 1 works as follows:

1. The admin asks Payload for a ticket with the collection, operation, replacement document ID when applicable, filename, MIME hint, and declared byte count. Payload authenticates the user, checks create/update access, applies size policy, and signs a five-minute ticket bound to the operation and configured Sanity project/dataset.
2. The browser sends `POST` to the configured transport endpoint with `Authorization: Bearer <ticket>`, the file's `Content-Type`, and the raw file body.
3. Before transferring bytes, the transport sends `POST` to the ticket's `claimEndpoint` with the same bearer ticket. It may transfer only after Payload returns `201` and `{ "status": "claimed", "protocolVersion": 1 }`. A `409` response means the ticket was already claimed or finalized; the transport must not transfer bytes.
4. The transport streams no more than the signed `maxSize`, verifies the actual byte count against the ticket, uploads only to its fixed Sanity target, and returns JSON `{ "receipt": "<signed-token>" }`. The receipt binds the Sanity asset ID and upload metadata to the ticket.
5. Payload verifies the ticket and receipt, checks the durable claim, rechecks user and document authorization, fetches the asset from the configured Sanity project, and runs the shared metadata, folder, and Payload finalization lifecycle in the same database transaction.

Ticket claims include the version, audience, claim endpoint, nonce, authenticated subject, collection, operation and optional document ID, project, dataset, filename, MIME hint, declared size, maximum size, issue time, and expiry. Receipt claims include the version, audience, nonce, project, dataset, Sanity asset `_id`, filename, MIME hint, actual size, and issue time. Use `verifySanityUploadTicket`, `signSanityUploadReceipt`, and the matching receipt/context verification helpers from the protocol subpath; do not implement alternate token parsing or signing.

The claim endpoint returns `401` for missing, invalid, or expired tickets, `201` for the first durable claim, `409` for an existing claim or finalization, and `500` when the claim cannot be persisted. Ticket creation returns `403` when the user lacks access and `413` when the declared size exceeds policy. The protocol does not define a success fallback: failed external uploads must surface as errors.

Custom HTTP transports implement this protocol; they do not provide Payload browser/server modules or import-map entries. The public `@klnap/payload-storage-sanity/upload-protocol` entry exports framework-independent Web Crypto helpers and protocol types. Cloudflare is a transport implementation of the same contract, not a privileged path.

The transport's `maxSizeBytes` is a hard transfer ceiling. Payload also applies configured media-type limits when issuing tickets and rechecks Sanity's actual asset size before finalization. Transport failures never fall back silently to the internal upload. No release or publication is implied by enabling this option.

## Collection selection

Omit `collections` to discover all upload collections that have no existing storage adapter. Automatic discovery skips collections that already use another adapter.

When you pass `collections`, only its enabled entries are selected. `true`, `{}`, and an options object without `enabled: false` enable a collection. `false` and `{ enabled: false }` exclude it. An empty map selects no collections. Every key must name an existing Payload collection, including disabled entries.

An explicitly enabled collection must have `upload` enabled. In `full` mode, an enabled collection with an existing adapter fails configuration rather than replacing it. A later plugin that replaces Sanity's adapter also fails during Payload initialization. Preserve the order and avoid configuring multiple storage plugins for the same collection.

`collections` is typed as `Partial<Record<UploadCollectionSlug, ...>>`. Payload's generated type augmentation narrows valid keys to upload collection slugs. Generate Payload types after changing collection configuration.

## Collection options

| Option | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Disable this collection's Sanity storage, fields, hooks, and admin changes. |
| `folder` | media-type defaults | Exact path, `false`, or per-type folder overrides for new assets. |
| `alt.enabled` | `true` | Add an alt field/group unless the collection already has `alt`. |
| `alt.required` | `false` | Require non-empty text for each locale. |
| `populate.preset` | `'default'` | Normalize eligible populated relations or return full media documents. |
| `populate.localPopulate` | `true` for default preset | Apply the default preset to Local API reads. |
| `admin.gallery` | `true` | Replace Payload's list view with the plugin gallery unless the collection already has its own list view. Set `false` to keep the native table. |
| `admin.uploadBusyShield` | `true` | Show the neutral upload progress state during save. |
| `uploadMaxSize` | plugin-level setting | Override upload-size limits for this collection. |
| `preventDeleteWhenReferenced` | plugin-level setting | Override the Payload relationship delete guard. |
| `prefix` | Payload adapter default | Native cloud-storage object prefix, not a Sanity folder. |
| `disableLocalStorage` | `true` | Payload cloud-storage option; the plugin disables local file copies. |
| `disablePayloadAccessControl` | `true` | Payload cloud-storage option; direct CDN URLs bypass Payload's file-delivery access-control proxy. |

The plugin keeps native Payload upload settings such as crop, focal-point, MIME-type, and upload-limit options. It sets `upload.imageSizes` to `[]`: Payload does not generate derivative files for configured collections. Sanity's CDN supplies transformed image variants.

Set `disablePayloadAccessControl: false` when generated file URLs must pass through Payload's delivery route. This does not make the underlying Sanity CDN URL private; any exposed direct CDN URL remains publicly accessible.

## Folders

`folders` accepts `false` or per-type paths for `image`, `video`, `audio`, and `file`. Defaults are
`Payload/images`, `Payload/videos`, `Payload/audio`, and `Payload/files`. There is no documents folder.
Collection `folder` accepts `false`, one exact path for every category, or a per-type map.
`folders: false` disables assignment even when a collection sets a path. Otherwise collection overrides
win over global overrides and defaults; category values can also be `false`.

The plugin creates missing `media.folder` documents and assigns new assets through `opt.media.folder`.
It does not move existing assets when options change or reassign a shared asset.

These folders use the `sanity-plugin-media` model, not Sanity Media Library folders. Install `sanity-plugin-media >=6.1.0` only if users need to browse the hierarchy in Sanity Studio. Uploads and CDN delivery do not require Studio.

For assets uploaded outside this Payload adapter, `@klnap/payload-storage-sanity/folders` exports `assignSanityAssetFolder(client, assetId, folderPath)`. It creates missing folders and assigns the asset without changing an existing folder assignment.

## Populate behavior

The `default` preset normalizes only eligible populated media relationships. `full` keeps full media
documents; `localPopulate` controls whether default normalization also applies to Local API reads.
See [Media Population](./media-population.md) for response fields, eligibility, depth, and examples.

## Upload size limits

Use Payload's native upload limits unless you need a plugin-level per-media-kind cap. `uploadMaxSize` has a
`default` byte limit and optional `byType` overrides for `image`, `video`, `audio`, and `file`. Collection
values override plugin values per key. The plugin raises Payload's global multipart cap to the largest
configured limit, then validates each selected media collection separately.

Classification checks bounded file signatures when available, then recognized MIME types and a fixed
extension map. It chooses storage handling and folder policy; it is not security validation. MIME types and
extensions remain caller-controlled hints. Unknown files stay `file` when Payload permits the upload.
Browser playback and Sanity image transformation support are separate classification facts.

## Synchronization

`sync` is optional. Enabling it adds webhook and reconcile endpoints under `/api/sanity-storage` by default.

| Option | Default | Purpose |
| --- | --- | --- |
| `enabled` | `false` | Register sync endpoints and media status fields. |
| `basePath` | `'/sanity-storage'` | Base route under Payload's `/api`. |
| `webhook.secret` | required when enabled | HMAC secret for raw Sanity webhook bodies. |
| `webhook.path` | derived | Override webhook route. |
| `webhook.collection` | selected media collection | Override the collection used for sync updates. |
| `webhook.maxBodySizeBytes` | `262144` | Maximum raw webhook body size. |
| `reconcile` | enabled | Register a protected batch reconcile endpoint; set `false` to disable. |
| `reconcile.path` | derived | Override reconcile route. |
| `reconcile.collection` | selected media collection | Override collection used by reconcile. |
| `onDeleted` | `'mark'` | Mark media unavailable or delete the Payload row after a Sanity deletion event. |
| `access` | admin auth collection | Authorize reconcile requests. |

The webhook verifies an HMAC over the raw request body. Sanity may retry webhooks; handlers must remain idempotent. Sync never deletes remote assets.

## Public package entries

- `@klnap/payload-storage-sanity`: Payload storage plugin, configuration types, and populate helpers.
- `@klnap/payload-storage-sanity/consumers`: `MediaAsset` contract and framework-independent image URL builder.
- `@klnap/payload-storage-sanity/consumers/next`: `SanityImage`, its props, component factory, and scoped image-loader helpers.
- `@klnap/payload-storage-sanity/consumers/next/loader`: default loader required by Next.js `images.loaderFile`.
- `@klnap/payload-storage-sanity/client`: `createSanityClient` for callers building URLs from bare Sanity asset references.
- `@klnap/payload-storage-sanity/folders`: folder assignment for assets uploaded outside the Payload adapter.
- `@klnap/payload-storage-sanity/admin`: admin components and styles referenced by Payload's import map. Consumed through Payload's bundler, not imported directly from Node.js.
- `@klnap/payload-storage-sanity/styles/admin-tailwind.css`: admin styles.

Internal lifecycle, metadata, folder-assignment, and synchronization functions are not public APIs.
