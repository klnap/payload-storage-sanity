# Media platform architecture

Status: implementation specification for the media-platform initiative. The
implementation tracker records shipped, verified, blocked, and pending work.

## Implementation order

Implement backend and storage capabilities before enhanced admin UI. Preserve
the existing admin interface and its functionality until the final UI phase.
Minimal UI integration needed to validate an upload transport is in scope.

1. Media classification and configurable Sanity folders.
2. Transport-independent upload lifecycle architecture.
3. Internal, Cloudflare, and custom upload transports.
4. Cloudflare Worker implementation and CLI scaffolding.
5. Video media model and metadata.
6. Poster ownership, persistence, shared focal point, and safe cleanup.
7. Drafts, versions, references, and lifecycle integration.
8. Frontend consumers and public API.
9. Backend security review and integration verification.
10. Enhanced Media Management UI, including gallery, media details, video
    previews and player, poster selection, and focal-point editing.
11. Final browser verification, documentation, and release readiness.

Do not let gallery layout, sidebar animation, preview spacing, media type icons,
hover previews, or individual media views block storage architecture work.
These UI items remain in scope for phase 10, not removed from the initiative.

## Goals

- Make Sanity storage the primary product: Payload owns media records and
  editorial workflows; Sanity owns binary assets and CDN delivery.
- Add one coherent Enhanced Media Management experience for images, video,
  audio, and files.
- Keep consumers as an additional capability in the same package.
- Keep internal Sanity upload as the zero-configuration default. Optional
  transports move bytes only; the package owns authorization and persistence.
- Preserve existing asset identities and editorial data. Configuration changes
  never silently move or delete existing assets.

## Non-goals

- Replacing Payload collections, relationships, access control, drafts, or
  versions.
- Replacing Sanity asset storage or CDN delivery.
- Making Cloudflare a required service or a storage/CDN provider.
- Adding transcoding, adaptive streaming, a general asset garbage collector,
  a queue, R2, or another mandatory infrastructure service.
- Making Sanity CDN URLs private. Payload access control does not revoke a
  known Sanity URL.
- Automatically reorganizing existing assets or changing their project,
  dataset, URL, or identity.

## Current architecture baseline

Verified at `v0.3.4` (`36535cda`):

- `sanityStorage()` selects Payload upload collections, composes Payload's
  cloud-storage plugin, constructs the Sanity adapter, and installs media
  lifecycle hooks (`src/plugin.ts`, `src/apply-sanity-media-collection.ts`).
- The adapter uploads images through Sanity's image pipeline and all other
  uploads through its file pipeline. It hydrates asset metadata, assigns an
  optional collection folder, maps the asset to the Payload document, and
  reports sync state (`src/features/media/storage-adapter/createAdapter.ts`).
- The default collection folder is currently `Payload`. Folder paths use
  `media.folder` records and weak asset references. `createIfNotExists` and
  `setIfMissing` preserve existing folder identity and do not move shared,
  deduplicated assets (`src/sanity/folders/assignSanityAssetFolder.ts`).
- Payload owns the media document. Replacing or deleting it does not delete
  the Sanity asset. Payload crop processing uploads cropped bytes as a new
  asset; focal-only edits update Payload metadata without re-uploading.
- The package already provides justified, grid, and native list views,
  image/file previews, references, deletion protection, normalization, and
  Next.js image consumers. Browser-level tests are not present in the package.
- Baseline `bun run check` passed on the commit above. Its expected integration
  failure-injection logs did not fail the suite.

The current default folder and image/file upload split are migration-relevant:
the target defaults apply only to future uploads. Existing assets and explicit
folder paths remain unchanged.

## Target architecture

Keep one package and preserve the existing ownership boundary:

```text
Payload media document and lifecycle
  ├─ authorization, collection rules, drafts, versions, references
  ├─ classification, metadata, folder selection, crop, and finalization
  └─ UploadTransport: transfer bytes only
       ├─ internal Sanity transport (default)
       └─ optional Cloudflare Worker transport
            └─ Sanity Assets API → Sanity asset/CDN
```

The browser transport is an opt-in path for supported admin uploads. REST,
Local API, crop processing, and other server-side operations continue through
the internal server-side path unless separately verified. No transport error
falls back silently.

Payload 3.94.1 exposes adapter `clientUploads` and signed receipts. Its cloud
storage `afterChange` hook deliberately skips `handleUpload` when a file has
`clientUploadContext`; therefore external uploads need a separate shared,
idempotent finalization seam. Payload's built-in receipt binds identity,
collection, filename, and expiry, but does not alone provide one-time replay
prevention or bind the replacement document and operation. The package must
add those checks and durable concurrency-safe finalization state.

Use a hidden Payload upload-session collection as the replay and idempotency
ledger. Payload signs the ticket with the authorized operation claims. Before
transferring bytes, the Worker asks Payload to create an immutable claim record
whose unique document ID is the session nonce. A duplicate claim returns a
bounded `in-progress` or `already-finalized` result; it never starts a second
transfer.

Finalization creates a second immutable record in the same collection, with a
different unique ID derived from the session nonce, and updates the media
document in one Payload transaction. The unique finalization record elects one
winner when requests race. A retry reads the committed record and returns its
stored result. If the transaction fails, both the finalization record and media
write roll back while the earlier claim remains; retry must reuse the same
verified transfer receipt, not claim the ticket again. A Worker crash after
Sanity accepts bytes but before a receipt is saved can leave an unfinalized
asset; a new authorized ticket may retry, and uncertain assets are retained.
Expired records can be removed lazily in bounded batches; no scheduler or queue
is required.

The finalization endpoint performs authorization explicitly because Payload
Local API operations default to access override. It starts the database
transaction and passes the same request to claim/finalization operations.
Remote Sanity uploads happen before this transaction; Payload `afterChange`
hooks must not repeat the transfer or introduce non-idempotent remote effects
inside the commit path.

Enable Cloudflare only when the configured Payload database proves unique
claims and multi-operation transactions. PostgreSQL 3.94.1 is the verified
target. Other adapters remain unsupported for this transport until their
concurrency and transaction behavior passes the same tests. Internal uploads
remain available without this constraint.

### Media model

Use one category union: `image | video | audio | file`. Keep category separate
from MIME type, browser playback support, image-transform support, and
technical role. A poster is an image with a technical role, not another media
category. Classification uses bounded trusted evidence available at each
lifecycle stage; browser MIME and filename extensions are hints, not security
validation. Unknown or unsupported files remain ordinary files when collection
policy permits them.

A video remains one Payload media document with a primary video asset, optional
technical poster asset and timestamp, available dimensions/duration, shared
focal point, editorial metadata, and normal Payload references. The poster is
not a second media document. Missing or unsupported metadata is represented as
unavailable, not fabricated.

`MediaAsset` is the one normalized consumer representation. It supports all
categories and optional video poster data. Image consumers validate image
capability internally before applying transformations. Native video consumers
use Sanity delivery and the same focal point as the poster.

### Upload transport contract

Expose a public `UploadTransport` contract and use it for the built-in
Cloudflare transport. The contract is limited to byte transfer and transport
capabilities: initialization/authorization input, transfer, progress,
cancellation, transfer errors, and a verifiable receipt. The core lifecycle
alone validates the authorized operation, Sanity target, asset result,
metadata, folder, and Payload persistence.

The internal transport remains the default and requires no extra configuration.
Cloudflare is opt-in through `upload.transport` and requires a transactional
database. Export `UploadTransport` from
the root server API, `cloudflareTransport()` from
`@klnap/payload-storage-sanity/cloudflare-transport`, and the Worker handler
from the dedicated `@klnap/payload-storage-sanity/cloudflare` entry. The Worker
entry must not import Payload, React, Next.js, Sharp, or other Node-only
runtime modules. All three paths and their declarations must pass
packed-consumer tests before being treated as supported API.

```ts
import { cloudflareTransport } from '@klnap/payload-storage-sanity/cloudflare-transport'
import { sanityStorage } from '@klnap/payload-storage-sanity'

sanityStorage({
  projectId,
  dataset,
  token,
  upload: {
    transport: cloudflareTransport({
      workerUrl: process.env.SANITY_UPLOAD_WORKER_URL!,
      secret: process.env.SANITY_UPLOAD_SECRET!,
    }),
  },
})
```

The Worker template imports only
`@klnap/payload-storage-sanity/cloudflare`; it does not inline the runtime.

### Upload and persistence lifecycle

1. Payload authorizes the current user, collection, create/replacement target,
   target Sanity project/dataset, media restrictions, and byte limit.
2. For external transfer, Payload issues a short-lived ticket bound to that
   operation and audience. The Worker verifies it before accepting bytes.
3. The Worker streams bounded bytes to the fixed Sanity Assets API target. It
   does not accept arbitrary upstream URLs or choose Payload business rules.
4. A signed, operation-bound receipt identifies the uploaded Sanity asset.
5. Payload verifies the receipt, rechecks authorization and target identity,
   then performs the same metadata/folder/document lifecycle as internal
   uploads without transferring the bytes through the Payload request.
6. A failed Payload write leaves an uploaded but unfinalized Sanity asset.
   Report that state; do not delete an asset that may be shared.

The exact mechanism must use Payload's supported client-upload lifecycle where
available. Replay prevention and finalization idempotency must be enforced by
the existing database architecture; no in-memory-only or eventually consistent
lookup is sufficient for a cross-process guarantee.

The Sanity Assets API accepts file bytes as the upload request body and uses
`Content-Type` for file asset MIME metadata. Cloudflare documents stream
processing as the way to avoid buffering large bodies within its 128 MB Worker
memory limit; this does not guarantee unlimited uploads. `FixedLengthStream`
sets `Content-Length` and enforces the exact byte count, so use it when the
chosen Sanity request path requires a known length. Verify the complete
`@sanity/client` request and Worker runtime path with representative files.
Vercel Edge Functions retain a 4.5 MB request-body limit; a Cloudflare browser
transport bypasses that app request for bytes, but server-side uploads remain
subject to their host runtime.

Sources: [Sanity Assets API](https://www.sanity.io/docs/http-reference/assets),
[Cloudflare Workers Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/),
[Cloudflare FixedLengthStream](https://developers.cloudflare.com/workers/runtime-apis/streams/transformstream/),
[Vercel Function limits](https://vercel.com/docs/functions/limitations).

### Folder resolution

Default logical folders:

```text
Payload/
├── images/
├── videos/
│   └── _posters/
├── audio/
└── files/
```

Folders are `sanity-plugin-media` organizational metadata, not buckets,
permissions, or Media Library folders. Do not add collection/date/user
subdirectories or move existing assets.

The public configuration shape is:

```ts
sanityStorage({
  folders: {
    image: 'Assets/Images',
    video: 'Assets/Videos',
    audio: 'Assets/Audio',
    file: 'Assets/Files',
    poster: 'Assets/Internal/Posters',
  },
  collections: {
    media: {
      folder: {
        image: 'Website/Images',
        video: 'Website/Videos',
        audio: 'Website/Audio',
        file: 'Website/Files',
        poster: 'Website/Internal/Posters',
      },
    },
    documents: { folder: 'Company/Documents' },
  },
})
```

This is the target configuration. Add `poster` overrides with the video
workstream, when poster uploads pass their role into folder resolution.

`folders: false` disables folder assignment globally. A collection
`folder: false` disables assignment for that collection. A category value of
`false` disables that category. A collection string is the exact path for all
categories and is never extended with a media-type segment. Global disable
takes precedence. Otherwise a collection string takes precedence over category
paths; ordinary folder precedence is collection category, global category,
then default. A poster resolves from collection poster, global poster, then
effective video path plus `/_posters`. If video assignment is disabled and no
poster override exists, poster assignment is disabled.

Folder creation is lazy, idempotent, project/dataset scoped, parent-aware, and
safe under concurrent uploads. Use deterministic bounded IDs and atomic
`createIfNotExists` mutations. Existing folder conflicts must be observable.
Folder assignment failure is recoverable without re-uploading the binary.
Sanity deduplicates identical bytes; a shared asset keeps its first folder
assignment, so category configuration cannot move or independently organize
shared assets.

### Video posters and focal point

The active poster belongs to its video document. Editors seek the actual video
with native browser APIs, inspect the displayed frame, and confirm before
upload. Slider movement creates no asset; cancellation creates no remote
asset. Capture must correspond to the confirmed decoded frame or fail visibly.
Cross-origin and unsupported extraction cases report the limitation.

Poster and video share one normalized focal coordinate. Cover consumers apply
the same focal point to the poster and video; detail playback preserves the
full video composition. Focal-only edits never re-upload the video or poster.

Technical posters never appear as ordinary Payload media documents or choices.
Their context is the owning video. A dedicated `sanity-plugin-media` tag may
identify only posters whose exclusive technical ownership is proven. Studio
admins may use that plugin's `excludeTags` option to omit tagged assets from
its browser and picker; this is optional UI filtering, not access control, and
does not promise invisibility in every Sanity interface. This option is
verified in `sanity-plugin-media@6.6.6`'s
[published type declarations](https://www.npmjs.com/package/sanity-plugin-media).
Never tag or hide an ordinary or shared asset merely because it is reused as a
poster.

Only obsolete plugin-generated posters are candidates for cleanup. Ordinary
assets are retained. Delete only when exclusive technical ownership, absence
of Payload draft/version/external references, and race safety are established.
If cross-system fencing cannot establish those facts, retain the poster and
report cleanup as unverified; never trade data integrity for cleanup.

### Drafts, versions, references, and crop

Use Payload's native draft and version model. A document save is the commit
boundary for the active poster. Historical versions and drafts keep the assets
they reference. Recheck references and access control for every supported
operation. Existing reference-scan coverage remains explicitly bounded to
documented Payload structures.

Physical crop remains distinct from Sanity crop metadata: the active Payload
record points to a new asset containing cropped pixels. The original asset and
old URL remain; this is not secure redaction or URL revocation. Focal-only
changes remain metadata-only.

### Security boundaries

- Sanity write tokens and upload secrets remain server-side.
- Tickets bind identity, collection, operation, document, project, dataset,
  restrictions, size, expiry, nonce, and audience as applicable.
- Enforce streamed byte counts, not only declared lengths. Reject replay and
  unauthorized finalization using concurrency-safe state.
- The Worker uses fixed upstream origins, explicit CORS, bounded metadata,
  timeouts, cancellation, validated upstream responses, and safe errors.
- Never trust browser-supplied asset IDs, MIME, filename, folder, URL, or
  project/dataset as authorization.
- Retain uncertain or shared assets. Folder, filename, tag, and upload success
  do not prove exclusive ownership.

### Failure semantics

Payload and Sanity do not share a transaction. Distinguish:

1. transfer not started;
2. transfer failed or outcome unknown;
3. Sanity asset uploaded but Payload document not persisted;
4. Payload document persisted but optional poster cleanup failed.

Retries must be idempotent for the same authorized operation. A failed
finalization must not silently initiate a second transfer. A cleanup failure
after document persistence does not roll back the successful Payload write.
Ordinary Sanity assets are never generic rollback targets.

## Public API decisions

- Keep `sanityStorage()` and the package name. Do not split product areas into
  plugins.
- Keep internal Sanity upload as the default.
- Add category-aware global `folders` and per-collection folder settings while
  preserving an explicit string folder as an exact path.
- Export the transport contract for third-party implementations. Keep the
  Worker runtime on `./cloudflare`, its Payload-side factory on
  `./cloudflare-transport`, and the frontend consumer boundary framework-safe.
- Keep `MediaAsset` canonical. Add native video consumption without requiring
  a paid player or processing service.
- Do not add public guards or configuration switches that duplicate internal
  validation and invariants.

## Compatibility and migration

- The published package remains in `0.x`; consumer-visible API breaks require
  a Changeset and migration note.
- Existing Payload documents, Sanity IDs, folders, URLs, references, drafts,
  and versions are not rewritten.
- New default folder assignments affect future uploads only. Explicit legacy
  string paths retain their exact meaning.
- Switching project/dataset affects new uploads only. Existing IDs retain
  their original Sanity project/dataset context; the plugin does not migrate
  bytes or rewrite URLs.
- Cloudflare is optional. Without it, existing internal upload behavior
  remains available.
- Enabling Cloudflare adds a hidden Payload upload-session collection for
  replay claims and finalization. It requires database transactions and unique
  constraints; PostgreSQL is verified, while other adapters fail closed until
  tested. Managed Payload migrations must include the new collection before
  enabling the transport. Disabling the transport does not migrate or delete
  session records.
- No release, publication, or release-PR merge is part of this initiative
  without explicit authorization.

## Acceptance criteria

The tracker is authoritative for status and evidence. Completion requires:

- Existing full package checks pass, with baseline failures separated from
  regressions.
- Folder precedence and disabling pass table-driven tests; concurrent folder
  creation produces one legitimate tree and does not move shared assets.
- One classifier covers server/admin/consumer behavior without claiming
  playback support from MIME alone.
- Internal uploads remain unchanged for existing supported paths.
- Cloudflare and custom transports use one public contract; authorization,
  replay, byte limits, receipts, finalization, and failures have executable
  regression coverage.
- Worker streaming is proven in the supported runtime with bounded memory and
  packed-artifact Wrangler bundling.
- Video posters are captured from the confirmed frame, stay within the video
  document, share focal coordinates, and are not independently selectable.
- Technical posters stay out of Payload selection surfaces; optional Sanity
  tag exclusion filters only proven-exclusive posters. Cleanup deletes only
  proven-exclusive obsolete posters; uncertain cases retain assets.
- Gallery/detail behavior is verified in a real Payload browser fixture for
  geometry, resizing, light/dark mode, selection, keyboard access, and video
  interactions.
- Crop, references, access control, drafts, versions, custom CDN, normalization,
  and existing consumer exports pass regression tests.
- Packed consumers install from the actual tarball, including Worker and
  independently authored transport fixtures.
- Documentation claims match shipped source and verification. No npm release
  is created or published.

## Decision log

| Decision | Alternative | Reason and verification measure |
| --- | --- | --- |
| Keep Payload as the only media-document authority. | Create plugin-owned video/poster documents. | Avoids duplicate editorial/access/version models; verify one Payload document per video and native relationship behavior. |
| Keep Sanity as byte storage and CDN; Cloudflare only transfers bytes. | Store in R2/Stream or serve through Worker. | Meets product boundary without a second mandatory storage/CDN; verify resulting asset ID and URL remain Sanity-owned. |
| Use one category classifier and separate capabilities/roles. | Infer category independently in each UI and transport. | Prevents inconsistent file behavior; table-driven tests must cover supported, ambiguous, and unknown formats. |
| Keep poster inside video media representation and retain uncertain assets. | Ordinary image document or eager cleanup after replacement. | Avoids selectable orphan posters and unsafe deletion; test drafts, versions, deduplication, shared references, and concurrent replacement. |
| Reuse Payload's supported `clientUploads` hook, a private Payload session/claim collection, and a shared finalization transaction. | Proxy large browser bodies through Payload/Vercel, assume `handleUpload` runs for client uploads, or use an in-memory replay cache. | The installed Payload 3.94.1 hook skips `handleUpload` for `clientUploadContext`; its DB API exposes transactions and unique fields. Verify atomic claims, rollback, idempotent retries, Worker streaming, and packed clients. |
| Keep the package single and split only runtime entry points. | Separate packages or broad root exports. | Preserves product coherence and Worker/framework boundaries; verify package export map and packed runtime dependency graphs. |
| Preserve existing assets and exact explicit string folders. | Backfill or move assets when defaults change. | Prevents silent data mutation; verify no existing asset patch occurs during configuration changes. |
