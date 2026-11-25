# @klnap/payload-storage-sanity

Payload cloud storage adapter for Sanity. Image and file bytes go to Sanity, the media document stays in Payload, and the Sanity asset reference and metadata are stored under `sanity.asset`.

Sanity CDN assets are public. Payload access rules protect Payload API operations, not CDN URLs. Do not use this package for private media.

## Why

Payload's cloud-storage API stores files outside Payload, but the host still has to keep Sanity asset metadata, public URLs, references and deletion behavior aligned with the media row. This package does that work inside the plugin, so the media collection keeps its normal fields, hooks and admin UI.

## Features

- **Uploads to Sanity** with Payload's native upload UI and drawers.
- **Media list** with justified, grid and list layouts, saved per user and collection.
- **Asset title** as an optional `title` field above the preview.
- **Edit view** with a large preview, a native file card (CDN URL, original filename, size, type) and a metadata inspector.
- **Reference guard** that blocks deleting media still referenced by Payload content.
- **Optional deduplication** of identical uploads.
- **Optional sync** with Sanity webhooks and reconcile routes.
- **CDN URL helpers** for Sanity image transforms.

## Install

Once published, install the package alongside its required peers:

```sh
npm install @klnap/payload-storage-sanity
# or
bun add @klnap/payload-storage-sanity
```

Requirements:

- Payload, `@payloadcms/ui` and `@payloadcms/translations` `>=3.94.1 <4`
- `@sanity/client` `>=6 <9`
- React and React DOM `^19.3.1` for admin features
- Node `^24.22.3 || >=26.13.1`
- `next >=16.4.5 <17` for the optional `/next` entry

Sanity Studio is optional. Uploads need a Sanity project, dataset and write token.

The published ESM build expects a bundler to resolve extensionless imports. Raw Node.js ESM is not supported.

## Quick start

Add the plugin to an existing Payload configuration. Each collection must already exist with `upload: true`. The plugin adds storage fields, hooks, a usage endpoint and admin components, and disables Payload local storage by default.

```ts
import { buildConfig } from 'payload'
import { sanityStorage } from '@klnap/payload-storage-sanity'

export default buildConfig({
  // Keep your existing database, secret and other configuration.
  collections: [{ slug: 'media', upload: true, fields: [] }],
  plugins: [
    sanityStorage({
      projectId: process.env.SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET!,
      token: process.env.SANITY_API_TOKEN!,
      collections: { media: true },
    }),
  ],
})
```

`sanityStorage()` loads the admin styles automatically; no host CSS import is needed.
After adding or upgrading the plugin, regenerate the import map:

```sh
payload generate:importmap
```

## Uploads and the media document

In the default `mode: 'full'`, Payload sends bytes to Sanity. The media document stores the asset reference and metadata under `sanity.asset`. If Sanity metadata is missing, the adapter hydrates it when possible. If hydration fails, it logs a warning and keeps the upload response.

The plugin sets `upload.imageSizes` to an empty array. Payload does not generate image derivatives, and previously stored `sizes` data is not removed. Use Sanity CDN transforms instead:

```ts
import { buildSanityImageUrl } from '@klnap/payload-storage-sanity'

const url = buildSanityImageUrl({ client, value: media, width: 800 })
```

`buildSanityImageUrl` returns `null` when no image asset is available. `resolvePublicUrl(media, { transform })` accepts width, height, `fit`, `rect` and format options.

### Alt text

`alt.enabled` defaults to `true`. If the collection has no `alt` field, the plugin adds a plain text field, or an `alt` group with one text field per locale when localization is configured. `alt.required` defaults to `false`. `alt.fallbackLocale` applies only to the localized group.

The plugin creates the fields, not the values. It does not infer or copy alt text from Sanity metadata. Existing `alt` fields are left unchanged.

### Title

The plugin adds an optional `title` text field if the collection has none. It shows above the preview in the upload area, labelled "Title". The value is stored with the media document. Hidden in Payload's field list, and included in the default populate select.

A collection that defines its own `title` field keeps it, and gets no extra input.

### Edit view

- A large preview of the asset.
- Payload's native file card, populated with the CDN URL (with a copy button), the original filename, size and MIME type.
- A metadata inspector listing filename, type, extension, size, asset ID, SHA-1, CDN URL, path, dimensions and aspect ratio.

### Media list

The list view has three layouts, switched with Payload's toggle buttons:

- **Justified** (default): rows sized from each asset's aspect ratio. Ratios are capped at 8:1 and 1:8.
- **Grid**: equal tiles.
- **List**: Payload's native table.

The selected layout is saved per user and collection in Payload preferences. Until a preference loads, the view is Justified.

The gallery toolbar has no date sort control. Date sorting is available in the List layout only, through Payload's column headers.

A collection that already defines its own list view component keeps it. Set `admin.gallery: false` to use Payload's list view everywhere.

## Replacement, deletion and duplicate uploads

The plugin never deletes Sanity assets automatically. Replacing a file uploads the new bytes and keeps the previous asset. Deleting a media row removes only the Payload record; the Sanity asset stays. Failed uploads or replacements can leave orphaned Sanity assets.

Sanity deduplicates assets by content, and an upload response does not prove an asset is new or owned by one document. External Sanity documents, weak references and other datasets are outside Payload's reference scan. Remote deletion is an operator decision and must account for every Sanity reference.

With `preventDeleteWhenReferenced: true` (default), Payload blocks deleting a media row that supported Payload content references, in every storage mode. On PostgreSQL, transaction-scoped locks serialize reference writes and media deletion. On SQLite and other adapters without those locks, guarded deletion returns `503`. Uploads, replacements and local deduplication still work, without cross-process guarantees. Direct SQL and external writes bypass Payload hooks.

`preventDeleteWhenReferenced: false` disables the reference guard. It does not delete Sanity assets.

`dedupeUploads: true` rejects create operations with identical bytes. It does not reject replacements or re-uploads. A rejected duplicate removes only its temporary row; the shared Sanity asset stays. PostgreSQL serializes concurrent creates across processes. Other adapters serialize only the in-process check.

## Configuration

| Option                                              | Default                          | Behavior                                                                                                                                                                |
| --------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId`, `dataset`                              | Required                         | Sanity project and dataset.                                                                                                                                             |
| `token`                                             | Required for `full` mode or sync | Sanity write token.                                                                                                                                                     |
| `mode`                                              | `'full'`                         | `'full'` uploads to Sanity. `'fields-only'` adds metadata fields without the storage adapter. `'off'` skips storage registration and keeps configured fields and hooks. |
| `collections`                                       | Required                         | Map each existing upload collection slug to `true` or to collection options.                                                                                            |
| `collections.<slug>.disablePayloadAccessControl`    | `true`                           | Allows file delivery without Payload access checks. CDN URLs stay public regardless.                                                                                    |
| `folder`                                            | `'Payload'`                      | Sanity media folder for new uploads and replacements. Ancestors are created. Existing assets are not moved.                                                             |
| `cdnBaseUrl`                                        | Sanity CDN                       | Base URL for public asset URLs.                                                                                                                                         |
| `populate`                                          | Default preset                   | Populates Sanity metadata in REST and, by default, Local API reads. Direct media-document reads return the full document.                                               |
| `uploadMaxSize`                                     | None                             | Per-collection or global byte limit, on top of Payload's upload limit.                                                                                                  |
| `preventDeleteWhenReferenced`                       | `true`                           | Refuses deletion of a media row that Payload content references.                                                                                                        |
| `dedupeUploads`                                     | `false`                          | Rejects identical-byte creates. See the limits above.                                                                                                                   |
| `alt.enabled`, `alt.required`, `alt.fallbackLocale` | `true`, `false`, none            | Alt text field behavior.                                                                                                                                                |
| `admin.gallery`                                     | `true`                           | Justified / grid / list media list. Set `false` to keep Payload's list view.                                                                                            |
| `admin.uploadBusyShield`                            | `true`                           | During Save, shows an "Uploading…" state and disables controls in the upload area. The preview stays visible.                                                           |
| `sync.enabled`                                      | `false`                          | Adds webhook and reconcile routes. Requires `token` and `sync.webhook.secret`.                                                                                          |
| `sync.onDeleted`                                    | `'mark'`                         | When Sanity reports deletion: `'mark'` marks the rows unavailable, `'delete'` removes them.                                                                             |
| `sync.reconcile`                                    | `true` when sync is on           | Batch reconcile route. Default access: a signed-in, non-service admin user. Set `false` to disable, or `sync.access` to change who may call it.                         |

Admin options can be set plugin-wide under `admin` and overridden per collection under `collections.<slug>.admin`.

When sync is enabled, the webhook verifies an HMAC over the raw request body. The default base path is `/sanity-storage`, under Payload's `/api` route. Body limits, status handling and sync guarantees are in [failure behavior](./docs/FAILURE_SEMANTICS.md).

## Exports

| Subpath                                                   | Contents                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `@klnap/payload-storage-sanity`                           | `sanityStorage`, `buildSanityImageUrl`, `resolvePublicUrl` and types |
| `@klnap/payload-storage-sanity/client`                    | Sanity client creation                                               |
| `@klnap/payload-storage-sanity/folders`                   | Assign Sanity assets to media folder paths                           |
| `@klnap/payload-storage-sanity/admin`                     | Admin UI components                                                  |
| `@klnap/payload-storage-sanity/next`                      | Next.js image components and loaders                                 |
| `@klnap/payload-storage-sanity/next/loader`               | Next.js `loaderFile` entry                                           |
| `@klnap/payload-storage-sanity/styles/admin-tailwind.css` | Admin stylesheet, including the gallery utilities (prefixed `kmg:`)  |

Consumer guides: [docs/consumers.md](./docs/consumers.md). Setup and operational issues: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## Development

```sh
bun install --frozen-lockfile
bun test src tests
bun run typecheck
bun run lint
bun run build
bun run check:release
```

`bun run test:int` uses `PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL` or starts a disposable PostgreSQL container. `bun run check:release` checks the built package in isolated consumers. The full consumer matrix runs only when requested manually. Set `PSS_POSTGRES_CONSUMER_DATABASE_URL` to include its PostgreSQL consumer.

## Releases

Releases use a version tag matching `package.json`, such as `v0.1.0`. The GitHub Actions release workflow validates the package and its packed artifact before publishing through npm trusted publishing. The npm trusted publisher must allow `npm publish` and match the `release.yml` workflow and `npm` environment.

For a new npm package, publish a temporary `0.0.0-stage` version with the `stage` dist-tag before configuring trusted publishing. It is a bootstrap version, not npm's separate staged-publishing approval flow. Do not publish it with the `latest` tag.

## License

MIT
