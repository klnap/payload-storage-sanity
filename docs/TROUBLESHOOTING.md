# Troubleshooting — `@klnap/payload-storage-sanity`

Practical fixes for problems seen in configuration validation, tests, and support docs. See also [FAILURE_SEMANTICS.md](./FAILURE_SEMANTICS.md) for guarantees vs non-guarantees.

## Plugin throws at startup

| Symptom | Likely cause | What to do |
| :--- | :--- | :--- |
| `` `projectId` is required `` | Missing Sanity project id | Set `projectId` (env or config). |
| `` `dataset` is required `` | Missing dataset name | Set `dataset` (e.g. `production`). |
| `` `token` is required when mode is "full" `` | Uploads enabled without API token | Provide a Sanity token with write access, or use `mode: 'fields-only'` / `off` if you do not upload via Payload. |
| `` `token` is required when sync.enabled is true `` | Sync without credentials | Add `token`, or disable `sync.enabled`. |
| `` `sync.webhook.secret` is required `` | Sync on without webhook secret | Set `sync.webhook.secret` (server env), or disable sync. |
| Invalid `mode` | Typo in `mode` | Use `full`, `fields-only`, or `off` only. |

## Payload image sizes / `sizes` group

Plugin-managed media collections always use **`upload.imageSizes: []`**. The plugin does not generate Payload derivative files for new uploads — use Sanity CDN query params or `@klnap/payload-storage-sanity/next` (`SanityImage`, loaders). Some media rows may still have a persisted **`sizes`** field if the collection previously used Payload `imageSizes`; that data is not updated or removed automatically.

## Upload fails or file never appears on CDN

1. Confirm **`mode: 'full'`** (default) and a valid **`token`** with asset write permissions.
2. Check **`uploadMaxSize`** — oversize files fail in `beforeChange` with a plugin error (bytes, per kind).
3. Inspect Payload logs for `[@klnap/payload-storage-sanity]` — rollback may have deleted a Sanity asset if Payload failed after upload (see failure semantics).
4. Verify Sanity **project id** and **dataset** match the dataset where you expect assets.

## Duplicate media rows after upload

With **`dedupeUploads: true`**, identical bytes on create throw **`409`** naming the existing media id (default is **`false`**; enable explicitly when you want SHA-1 blocking before upload). If you still see admin **localized-delete** confirmation text instead, ensure the package build includes the orphan-cleanup `localizedDeleteConfirmed` context (reinstall / rebuild `@klnap/payload-storage-sanity`). Leftover rows sharing **`sanity.asset.sha1hash`** after a crash: **`POST /api/sanity-storage/reconcile`** with `dryRun: true` and inspect `duplicates`; delete the orphan manually when safe.

## Cannot delete media (400)

Reference integrity is on by default (`preventDeleteWhenReferenced`). The asset is still used on **published** or **draft** documents. Open the **References** tab on the media document or call `GET /api/{media}/:id/usage`. Disable only if you accept orphaned references: `preventDeleteWhenReferenced: false`.

## Broken images in admin or storefront (`url` empty)

1. Check **`sync.status`** on the media document — `deleted`, `missing`, and `error` clear public URLs in API responses.
2. Enable **`sync.enabled`** and webhooks, or run **reconcile**, to refresh metadata from Sanity.
3. Use **Unavailable asset recovery** UI in admin when sync shows a broken state.
4. Confirm **`sanity.asset.path`** / **`sanity.asset.url`** exist on the stored document (metadata-only saves merge from `originalDoc`).

## Webhook returns 401 / signature errors

1. Use the **raw request body** when verifying signatures (the plugin does this on its endpoint).
2. Match **`sync.webhook.secret`** to the secret configured in Sanity’s webhook.
3. Check clock skew — default tolerance is **300 seconds** (`verifySanityWebhookSignature` `maxAgeSeconds`).
4. Ensure Sanity posts to the correct URL: `POST https://<cms>/api<sync.basePath>/webhook` (default `/api/sanity-storage/webhook`).

## Reconcile forbidden (403)

Default **`sync.access`** allows only users from Payload’s **admin auth collection** (`config.admin.user`, usually `users`). Pass a custom `sync.access` for automation, or call **`reconcileSanityMedia`** from a trusted server script with your own rules.

## Populate shape wrong on storefront

| Expectation | Reality |
| :--- | :--- |
| Flat `url`, `width`, `alt` on nested relation | Use preset **`default`** (plugin default) and **`depth ≥ 1`**; do not pass explicit `populate.media` field maps unless you render with **`next/image`** yourself. |
| Full `sanity` group on nested relation | Set `populate: { preset: 'full' }` or use **`fullPopulate()`** / manual `populate`. |
| `SanityImage` with manual populate result | **Unsupported** — `SanityImage` expects **`DefaultPopulateAsset`** or a custom shape plus **`assetMapping`**. |

Pass **`locale`** on SDK/REST fetches, not on `SanityImage`, for localized alt.

## Next.js: images broken or unoptimized

1. Add **`transpilePackages: ['@klnap/payload-storage-sanity']`** if your bundler needs it (common with Next 16).
2. Register the loader: `images.loader = 'custom'` and `loaderFile` re-exporting `@klnap/payload-storage-sanity/next/loader`.
3. Allowlisted hosts: URLs must pass **`isSanityCompatibleHost`** (default `cdn.sanity.io` or your `cdnBaseUrl` host).
4. Import from **`@klnap/payload-storage-sanity/next`**, not the main entry.

## `assetMapping` / TypeScript errors on `SanityImage`

Use **`createSanityImage<YourAsset>()`** or pass **`assetMapping`** with dot paths (`metadata.width`, etc.). Mapping **`url`** is required and must resolve to a non-empty string. See README **assetMapping** section.

## Host / SSRF / proxy 404

Adapter **`staticHandler`** (when Payload proxies files) only fetches **allowlisted** CDN hosts. User-controlled `http://evil` URLs on the document are not fetched. Upstream 404 → handler 404; redirect to non-allowlisted host → 502 (see CDN tests).

## Raw Node `import` of package fails

Published **`dist`** is **bundler-first**. Use Payload, Next, or Bun to run the app. Raw Node ESM without a resolver does not support extensionless relative imports in `dist`. See the **Requirements** section in [README.md](../README.md).
