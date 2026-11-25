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

**Guarantee:** For every upload collection selected by `sanityStorage()` (auto-discovered or listed under `collections`), the plugin sets **`upload.imageSizes: []`**. Collection-level `imageSizes` definitions are overridden. There is **no** plugin opt-in to re-enable Payload-generated derivatives.

**Non-guarantee:** Some documents may still contain a root **`sizes`** object if the collection previously defined Payload `imageSizes`; the plugin does not remove that field. Resized delivery is expected via **Sanity CDN** (not Payload `sizes` URLs).

## Sanity upload and Payload persist (`mode: 'full'`)

| Step | On success | On failure |
| :--- | :--- | :--- |
| User uploads bytes | Sanity `assets.upload` runs (unless dedupe/`skipCloudStorage`) | Adapter error surfaced to admin/API |
| Payload saves document | Metadata + `sanity.asset` persisted | Request fails |
| Payload fails **after** Sanity upload on same request | — | Remote assets are retained and can become orphaned |

**Guarantee:** Upload and persist failures never trigger an upstream asset deletion.

**Non-guarantee:** Failed writes can leave orphaned Sanity assets. Payload 3.94 runs lifecycle hooks before transaction commit and exposes no supported post-commit cleanup hook. The package does not offer automatic or operator-triggered remote cleanup; whether to add a safe maintenance contract remains a product decision.

## Upload deduplication

| Behavior | Detail |
| :--- | :--- |
| Default | **`dedupeUploads: false`** — no SHA-1 dedupe hooks; duplicate uploads are allowed. |
| Trigger | **`dedupeUploads: true`** on **`sanityStorage()`** and **`mode: 'full'`** — **create** with identical file bytes (SHA-1). |
| Mechanism | `beforeChange` throws **`409`** with a public message naming the existing media id. If Sanity returns an already-used asset `_id` after upload, `afterOperation` deletes the orphan row (with `localizedDeleteConfirmed` for admin localized-delete) and throws the same **`409`**. |
| Concurrent uploads | PostgreSQL uses a transaction-scoped advisory lock keyed by the file hash through upload completion. Other adapters serialize only the in-process preflight lookup; separate processes can still create duplicate Payload rows. Sanity may still return one content-addressed asset for identical bytes. |

**Non-guarantee:** Crash between duplicate insert and `afterOperation` can leave two Payload rows sharing `sanity.asset._id` / hash until reconcile reports `duplicates`.

The in-process lookup lock is not a cross-process lock. Non-Postgres adapters do not have a transaction-scoped lock, so concurrent creates can both pass the preflight lookup before either row is visible.

## Replace and delete

| Action | Payload row | Sanity asset |
| :--- | :--- | :--- |
| Successful upload | Created or updated | Created or reused; never deleted by the plugin |
| Failed upload or replacement | Transaction fails or rolls back | Retained; may become orphaned |
| Replace file | Updated to the new asset | Previous asset retained |
| Delete unreferenced media row | Deleted | Retained |
| Delete referenced media row | Rejected with `400` when references are found | Unchanged |
| Delete with unavailable reference lock | Rejected with `503` | Unchanged |

Sanity asset IDs identify content within a project and dataset; they do not establish exclusive ownership. Upload responses do not distinguish new assets from reused ones. Strong Sanity references block deletion with `409`, but weak references can remain dangling. Payload cannot enumerate external documents or references in other datasets. Automatic remote cleanup is unsupported; retention is not a claim that orphaned assets are acceptable.

**Concurrent content-reference writes and media deletion:** on Postgres, rich-text references and Payload upload/relationship fields targeting guarded media take the same media-row lock as deletion. Writes lock media ids in sorted order, then verify the rows in their request transaction. A write holding the lock first commits before deletion scans; deletion holding it first commits before the write verifies. PostgreSQL transactions must use `READ COMMITTED`; otherwise the operation fails before acquiring a lock.

The other Payload database adapters do not provide this plugin's transaction-scoped advisory lock. With the default `preventDeleteWhenReferenced: true`, guarded media deletion fails closed on those adapters; uploads and replacements still work without PostgreSQL's cross-process deduplication guarantees. Setting `preventDeleteWhenReferenced: false` explicitly disables this guard. Direct SQL and external database writes bypass Payload hooks. Internal media deletes with `req.context.skipCloudStorage` intentionally bypass the guard. The concurrency guarantee is limited to supported Payload hooks on PostgreSQL.

## Media availability and URLs

| `sync.status` (unavailable) | API `url` / `thumbnailURL` |
| :--- | :--- |
| `deleted`, `missing`, `error` (normalized) | Cleared on read (`sanitizeMediaDocument` / `afterRead`) |
| `available` / unknown | Hydrated to a public CDN URL |

**Guarantee:** Storefront responses do not expose CDN URLs for rows marked unavailable when sanitization runs.

**Non-guarantee:** Direct Sanity CDN URLs already leaked elsewhere (email, logs, cache) are outside plugin control.

## CDN fetch and static handler

| Case | Result |
| :--- | :--- |
| URL host not allowlisted | No fetch; 404-style behavior |
| Upstream 404 | 404 to client |
| Redirect to non-allowlisted host | Not followed; 502 |
| Lookalike `cdn.sanity.io.evil.com` | Rejected by host check |
| SVG, HTML, or XML response on Payload origin | Attachment disposition, sandbox CSP, and `nosniff` |

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
