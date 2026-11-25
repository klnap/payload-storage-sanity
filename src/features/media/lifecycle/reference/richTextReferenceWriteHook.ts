import type { CollectionBeforeChangeHook, GlobalBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'
import { lockMediaRow } from '@/features/media/lifecycle/asset-lock/mediaRowLock'
import { collectRichTextHosts } from '@/features/media/usage/scan/collectMediaUploadTargets'
import { forEachMediaReference } from '@/features/media/usage/scan/richTextReferences'

const REFERENCE_PATH = 'body'

/**
 * Collects the media ids a document embeds in rich text. Returns null when the structure is too deep to
 * read reliably, so the write is refused rather than committed with an unknown reference.
 */
function collectEmbeddedMediaIds(data: unknown, mediaSlug: string): Set<string> | null {
  const ids = new Set<string>()
  const deep = forEachMediaReference(data, mediaSlug, (raw) => {
    if (typeof raw === 'number' || typeof raw === 'string') ids.add(String(raw))
    else if (typeof raw === 'object' && raw !== null && 'id' in raw) {
      const id = (raw as { id?: unknown }).id
      if (typeof id === 'number' || typeof id === 'string') ids.add(String(id))
    }
  })
  return deep ? null : ids
}

type ReferenceWriteArgs = {
  data: unknown
  req: Parameters<CollectionBeforeChangeHook>[0]['req']
  mediaSlug: string
}

/**
 * Reference side of the media delete race. The media row lock is taken first, in id order, and then each
 * referenced row is read inside this transaction. A row deleted by a transaction that committed earlier is
 * refused; a row whose delete is still pending waits for that transaction. Either way no reference commits
 * against a deleted media row.
 */
async function guardRichTextReferences({
  data,
  req,
  mediaSlug,
}: ReferenceWriteArgs): Promise<void> {
  if (data == null || typeof data !== 'object') return
  const ids = collectEmbeddedMediaIds(data, mediaSlug)
  if (ids == null) {
    throw new ValidationError({
      errors: [
        {
          message: 'Rich text content is nested too deeply to verify its media references',
          path: REFERENCE_PATH,
        },
      ],
    })
  }
  const ordered = [...ids].sort()
  for (const id of ordered) {
    await lockMediaRow(req, id)
  }
  for (const id of ordered) {
    const media = await req.payload.findByID({
      collection: mediaSlug as never,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (media == null) {
      throw new ValidationError({
        errors: [{ message: 'Embedded media no longer exists', path: REFERENCE_PATH }],
      })
    }
  }
}

/** Collection write hook: attach to every collection that stores rich text. */
export function createRichTextReferenceCollectionHook(
  mediaSlug: string
): CollectionBeforeChangeHook {
  return async ({ data, req }) => {
    await guardRichTextReferences({ data, req, mediaSlug })
    return data
  }
}

/** Global write hook: attach to every global that stores rich text. */
export function createRichTextReferenceGlobalHook(mediaSlug: string): GlobalBeforeChangeHook {
  return async ({ data, req }) => {
    await guardRichTextReferences({ data, req, mediaSlug })
    return data
  }
}

/**
 * Attaches the rich-text reference hook to every host collection and global that stores rich text.
 * Hosts keep their own hooks; the reference hook runs after them.
 */
export function applyRichTextReferenceHooks<
  T extends { collections?: CollectionLike[]; globals?: GlobalLike[] },
>(config: T, mediaSlugs: readonly string[]): T {
  const hosts = collectRichTextHosts(config as never, '')
  const mediaSet = new Set(mediaSlugs)
  const collectionHosts = new Set(
    hosts
      .filter((h) => h.type === 'collection' && !mediaSet.has(h.collectionSlug))
      .map((h) => h.collectionSlug)
  )
  const globalHosts = new Set(hosts.filter((h) => h.type === 'global').map((h) => h.collectionSlug))
  return {
    ...config,
    collections: config.collections?.map((collection) => {
      if (!collectionHosts.has(collection.slug)) return collection
      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          beforeChange: [
            ...(collection.hooks?.beforeChange ?? []),
            ...mediaSlugs.map((slug) => createRichTextReferenceCollectionHook(slug)),
          ],
        },
      }
    }),
    globals: config.globals?.map((global) => {
      if (!globalHosts.has(global.slug)) return global
      return {
        ...global,
        hooks: {
          ...global.hooks,
          beforeChange: [
            ...(global.hooks?.beforeChange ?? []),
            ...mediaSlugs.map((slug) => createRichTextReferenceGlobalHook(slug)),
          ],
        },
      }
    }),
  }
}

type CollectionLike = {
  slug: string
  hooks?: { beforeChange?: unknown[] } & Record<string, unknown>
}
type GlobalLike = { slug: string; hooks?: { beforeChange?: unknown[] } & Record<string, unknown> }
