# Failure semantics — `@klnap/payload-storage-sanity`

What the package **does** and **does not** guarantee for operators and integrators. Derived from implementation and tests — not a promise of transactional perfection across Payload and Sanity.

## Configuration (fail fast at boot)

`validateSanityStoragePluginOptions` **throws** before the plugin registers when:

| Condition | Error topic |
| :--- | :--- |
| Missing/blank `projectId` | `projectId` |
| Missing/blank `dataset` | `dataset` |
| `mode: 'full'` (default) without `token` | `token` + full mode |
| `sync.enabled` without `token` | `token` + sync |
| `sync.enabled` without `sync.webhook.secret` | `sync.webhook.secret` |
| Invalid `mode` string | invalid mode |

Messages use the prefix `[@klnap/payload-storage-sanity]`.

**Non-guarantee:** Misconfiguration inside collection slugs (non-upload collection) may surface later from Payload, not from this validator.

## Upload derivatives (`imageSizes`)

**Guarantee:** For every upload collection slug listed under `sanityStorage({ collections })`, the plugin sets **`upload.imageSizes: []`**. Collection-level `imageSizes` definitions are overridden. There is **no** plugin opt-in to re-enable Payload-generated derivatives.

**Non-guarantee:** Some documents may still contain a root **`sizes`** object if the collection previously defined Payload `imageSizes`; the plugin does not remove that field. Resized delivery is expected via **Sanity CDN** (not Payload `sizes` URLs).

## Sanity upload and Payload persist (`mode: 'full'`)

| Step | On success | On failure |
| :--- | :--- | :--- |
| User uploads bytes | Sanity `assets.upload` runs (unless dedupe/`skipCloudStorage`) | Adapter error surfaced to admin/API |
| Payload saves document | Metadata + `sanity.asset` persisted | Request fails |
| Payload fails **after** Sanity upload on same request | — | **Rollback** deletes Sanity asset ids registered on that request context only |

**Guarantee:** Rollback targets assets uploaded **on the failing request**, not a global Sanity cleanup.

**Non-guarantee:** No cross-system two-phase commit — a crash between Sanity success and rollback registration can leave an orphan Sanity asset until manual cleanup.

## Upload deduplication

| Behavior | Detail |
| :--- | :--- |
| Default | **`dedupeUploads: false`** — no SHA-1 dedupe hooks; duplicate uploads are allowed. |
| Trigger | **`dedupeUploads: true`** on **`sanityStorage()`** and **`mode: 'full'`** — **create** with identical file bytes (SHA-1). |
| Mechanism | `beforeChange` throws **`409`** with a public message naming the existing media id. If Sanity returns an already-used asset `_id` after upload, `afterOperation` deletes the orphan row (with `localizedDeleteConfirmed` for admin localized-delete) and throws the same **`409`**. |
| Concurrent uploads | Same hash serialized via in-process lock (`tests/unit/dedupe/model/lock.test.ts`) — not a distributed lock across servers. |

**Non-guarantee:** Crash between duplicate insert and `afterOperation` can leave two Payload rows sharing `sanity.asset._id` / hash until reconcile reports `duplicates`.

## Replace and delete

| Action | Sanity asset |
| :--- | :--- |
| Replace file on media row | New upload; previous Sanity asset deleted if no other media rows reference same `sanity.asset._id`. |
| Delete media row | Sanity asset deleted only when **no** remaining media rows share `sanity.asset._id`. |
| Delete blocked | `400` when references exist (`preventDeleteWhenReferenced`). |

Cloud-storage `handleDelete` is a no-op; cleanup runs in plugin hooks.

## Media availability and URLs

| `sync.status` (unavailable) | API `url` / `thumbnailURL` |
| :--- | :--- |
| `deleted`, `missing`, `error` (normalized) | Cleared on read (`sanitizeMediaDocument` / `afterRead`) |
| `available` / unknown | Hydrated via `resolvePublicUrl` |

**Guarantee:** Storefront responses do not expose CDN URLs for rows marked unavailable when sanitization runs.

**Non-guarantee:** Direct Sanity CDN URLs already leaked elsewhere (email, logs, cache) are outside plugin control.

## CDN fetch and static handler

| Case | Result |
| :--- | :--- |
| URL host not allowlisted | No fetch; 404-style behavior |
| Upstream 404 | 404 to client |
| Redirect to non-allowlisted host | Not followed; 502 |
| Lookalike `cdn.sanity.io.evil.com` | Rejected by host check |

## Webhook endpoint

| Input | Response |
| :--- | :--- |
| Empty body | `400` JSON error |
| Body larger than configured max (`sync.webhook.maxBodySizeBytes`, default **256 KiB**) | `413` (Content-Length early reject and/or bounded body read; before signature verify) |
| Invalid/missing signature | `401` (verification result, no throw) |
| Valid signature | Handler runs; should be **idempotent** (Sanity retries) |

Signature covers **raw body bytes** — JSON reformat without resigning fails.

**Configurable limit:** `sync.webhook.maxBodySizeBytes` (positive integer, bytes). Enforced in the webhook endpoint handler. Payload custom endpoints receive the raw Fetch `Request` (not multipart `upload.limits`); this option does **not** raise upload/busboy limits. Reverse proxies / platforms may still reject larger bodies — raise those separately when increasing the plugin limit.

**Non-guarantee:** Webhook processing time — slow handlers may cause Sanity retries; design for idempotency.

## Media usage API (`GET …/:id/usage`)

| Caller | Result |
| :--- | :--- |
| Unauthenticated | `401` |
| Authenticated non-admin collection | `401` (default `sync.access` / admin auth collection) |
| Admin auth user + read access to media row | `200` with usage scan |

The usage scan uses privileged Local API reads **after** the admin gate; it is not exposed to arbitrary authenticated storefront users.

## Sync and reconcile

| Feature | Requires |
| :--- | :--- |
| Webhook route | `sync.enabled`, `token`, `sync.webhook.secret` |
| Reconcile route | `sync.enabled`, `token`; disabled when `sync.reconcile: false` |
| Reconcile auth | `sync.access` (default: admin users only) |

Upstream delete: `onDeleted: 'mark'` (default) sets sync status and clears URLs, or `'delete'` removes Payload rows.

**Non-guarantee:** Reconcile does not auto-delete duplicate media rows — it **reports** `duplicates` for operator action.

## Upload size limits

Enforced in `beforeChange` when new bytes are present. Plugin raises Payload **`upload.limits.fileSize`** to the **maximum** configured limit across collections (global busboy cap). Per-kind limits still apply at hook time.

Metadata-only saves (alt, focal without new bytes) skip size checks.

## Admin recovery

**Unavailable asset recovery** UI guides replace/unlink when sync indicates broken state — does not automatically restore Sanity assets.

## Persisted document baseline

Media rows use **`sanity.asset`** JSON plus optional **`sync`**. Representative fixtures: `tests/unit/data/persistedMedia.compat.test.ts`.

## Logging

`logSanityUploadIssue` logs a fixed prefix and optional context object — **do not** pass webhook secrets, tokens, or raw bodies into context in custom code.
