# Sanity upload folders

Status: implemented. Owner: `@klnap/payload-storage-sanity`. Payload consumers configure a folder path per collection; standalone consumers pass a path directly.

## Problem

Assets uploaded by Payload and Services appear together in the Sanity Studio media browser. Uploads should identify their source through the media plugin's folders.

## Behavior

- Uploads through `@klnap/payload-storage-sanity`, including replacements and files, use `collections.<slug>.folder`, defaulting to `Payload`.
- Folder paths accept slash-separated segments, e.g. `Payload/Blog`. Leading/trailing slashes and segment whitespace are normalized. Empty interior segments, `.` / `..`, backslashes and control characters are rejected.
- Folder identity is case-insensitive to preserve the package's deterministic folder IDs.
- Consumer apps choose their own folder path per upload. A consumer's fixed path applies only to the uploads it configures; other uploads do not inherit it.
- Each upload creates missing folder ancestors using deterministic document IDs derived from the normalized path. Concurrent uploads reuse those documents.
- Folder creation and asset assignment run atomically after a successful asset upload. Folder assignment failure fails the upload operation through its existing error handling.
- Use the `sanity-plugin-media` contract: folder documents have `_type: 'media.folder'` and `name`; assets use a weak reference at `opt.media.folder`. This is Studio grouping metadata, not a Media Library folder or a native Content Lake directory.
- Preserve other asset metadata, media tags, and CDN URLs. Folder membership is Studio metadata, not a CDN path.
- Sanity deduplicates identical bytes into a shared asset. A shared asset keeps its first folder assignment; later uploads to another collection or folder do not move it.
- Historical assets are unchanged. Existing assets are not backfilled.

## Implementation

Share the folder assignment helper through the package's standalone `./folders` entry, which has no Payload runtime imports. The Payload adapter passes its per-collection path; other consumers pass their own fixed path. Consumers depend on the package like any other npm dependency. The helper uses `SanityClient.mutate` with `createIfNotExists` and `setIfMissing`, so concurrent paths converge and an existing shared asset is not moved. Configure `sanity-plugin-media` in Studio to browse the groups.

## Verification

- Exercise Payload image and file uploads and at least one standalone consumer upload path.
- Verify stable folder creation, weak references, and atomic asset patches.
- Verify mutation errors use existing upload error responses.
- Run the package tests and typecheck.

## Documentation

Consumer-facing behavior and the required write permissions are documented in the package README under "Sanity Studio folders".
