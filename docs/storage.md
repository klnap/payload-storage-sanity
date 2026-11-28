# Storage

How the plugin stores uploads in Sanity and what it changes on each Payload collection. Option reference:
[configuration](./configuration.md).

## Collections

When `collections` is omitted, the plugin uses upload collections that have no storage adapter. Set
`collections` to choose them and to set a folder for each:

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
    },
  },
})
```

Explicit configuration selects only the listed, enabled collections. `enabled: false` excludes one. The
plugin does not replace an existing storage adapter on a collection.

For each selected collection, the plugin:

- Disables local file copies (`disableLocalStorage: true`).
- Sets `upload.imageSizes` to `[]`, so Payload generates no image-size derivatives.
- Enables Payload's crop and focal-point editors. A collection can set its own `upload.crop` or
  `upload.focalPoint`.
- Keeps Payload's upload editor, MIME-type handling, and native metadata.

## Folders

Global `folders` defaults to `Payload/images`, `Payload/videos`, `Payload/audio`, and `Payload/files`.
`folders: false` disables assignment even when a collection sets a path. Otherwise
`collections.<slug>.folder` overrides those paths with one exact path, per-type paths, or `false`.
Category values can also be `false`. The plugin creates missing logical folder records and assigns new
assets to them. Changing paths does not move existing assets or reassign shared assets.

Folders use the `sanity-plugin-media` model, not Sanity Media Library folders. Install `sanity-plugin-media`
only if editors also need to browse them in Sanity Studio.

For assets uploaded outside the Payload adapter, use `assignSanityAssetFolder` from
`@klnap/payload-storage-sanity/folders`.

## Local copies and image sizes

Local copies stay off for selected collections, and Payload generates no image-size derivatives. Request
resized variants with Sanity CDN parameters, through `buildSanityImageUrl()` or `SanityImage`. Existing
`sizes` data on older media documents is not rewritten or deleted.

## Replacement

Uploading a replacement creates a new Sanity asset. Deleting or replacing a media record does not delete
its Sanity asset. See [asset lifecycle](./asset-lifecycle.md).

## Upload deduplication

Duplicate protection is opt-in:

```ts
sanityStorage({
  // ...
  dedupeUploads: true,
})
```

With it on, a media create whose bytes match an existing media document's SHA-1 hash is rejected with HTTP
`409`. A replacement upload whose bytes already belong to another media row is also rejected with `409`, and
this check runs even without `dedupeUploads`. The response names the existing document when the editor can read it. The check covers creating
Payload media documents. It does not replace Sanity's own deduplication: Sanity stores content-addressed
assets, so identical bytes can share one Sanity asset, while the plugin decides whether a second Payload
media document may be created.

Concurrency depends on the database adapter:

- **PostgreSQL:** a transaction-scoped advisory lock keyed by the file hash serializes matching creates
  across processes until the upload completes.
- **Other adapters:** the plugin serializes only the lookup within one process. Concurrent processes can
  still create duplicate Payload documents.

## Upload size limits

`uploadMaxSize` limits upload size in bytes. A number sets the default for every media kind. An object
sets a `default` and optional `byType` overrides for `image`, `video`, `audio`, and `file`:

```ts
sanityStorage({
  // ...
  uploadMaxSize: {
    default: 10 * 1024 * 1024,
    byType: {
      image: 20 * 1024 * 1024,
      video: 500 * 1024 * 1024,
      audio: 100 * 1024 * 1024,
      file: 50 * 1024 * 1024,
    },
  },
  collections: {
    media: {
      uploadMaxSize: { byType: { image: 5 * 1024 * 1024 } },
    },
  },
})
```

Collection values override plugin values key by key. The plugin raises Payload's global multipart limit to
the largest configured value, then validates each selected collection separately. Infrastructure in front
of Payload, such as a reverse-proxy body limit, can still reject larger requests first.

Media categories use bounded file signatures when available, then known MIME types and a fixed extension
map. This is classification, not security validation. MIME and extension values are caller-controlled hints;
unknown files remain `file` when Payload restrictions permit them. Browser playback and Sanity image
transformation support are tracked separately.
