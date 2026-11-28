# Media references and integrity

The deletion guard stops accidental deletion of media that is still used by content. Before a media
document is deleted, the plugin checks supported relationships and embedded media references.

**Deletion protection** is on by default (`preventDeleteWhenReferenced: true`). Deleting a product image
still used by an article, a landing page, or a global such as site settings is blocked until those
references are removed.

The guard checks:

- Upload and relationship fields in supported structures, in collections and globals.
- Uploads embedded in rich text.
- Published and draft content. A reference from either layer blocks the delete.

## References tab

The **References** tab in the media detail view lists where the asset is used. It applies the requesting
user's access rights: editors see only documents they can read, and unreadable documents are not listed.

The guard and the tab are separate. The guard decides whether a delete proceeds and checks the whole
database. The tab is a read-only listing for the current user.

## Turning the guard off

```ts
sanityStorage({
  // ...
  preventDeleteWhenReferenced: false,
  collections: {
    media: {
      preventDeleteWhenReferenced: true,
    },
  },
})
```

## Limits

The guard does not cover:

- Historical document versions.
- Arbitrary URL references in text or in external systems.
- Direct SQL writes that bypass Payload hooks.
- Sanity documents or other Sanity datasets.
- Rich-text structures the plugin does not scan.

## Concurrency and errors

On PostgreSQL, transaction-scoped locks serialize guarded deletes and supported reference writes. Other
adapters without those locks fail guarded deletes with `503` instead of guessing.

The guard deletes nothing in Sanity. Deleting a Payload media record never deletes the remote Sanity
asset. See [failure semantics](./FAILURE_SEMANTICS.md) for locking and error details.
