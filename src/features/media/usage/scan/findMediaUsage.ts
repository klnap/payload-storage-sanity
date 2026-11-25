import type {
  CollectionSlug,
  GlobalSlug,
  Payload,
  SanitizedConfig,
  TypeWithID,
  Where,
} from 'payload'
import type { SanityMediaDocument } from '@/features/media/document'
import type { MediaUsageEntry, MediaUsageReferenceLayer } from '@/features/media/usage'
import {
  buildMediaUsageAdminPath,
  collapseMediaUsageEntries,
  collectMediaUploadTargets,
  collectRichTextHosts,
  getLocaleCodes,
  type MediaUploadTarget,
  readLocalesOption,
  resolveAdminLabel,
  valueMatchesMediaId,
} from '@/features/media/usage'
import { getSanityAssetFromMedia } from '@/sanity/assets'
import { forEachMediaReference } from './richTextReferences'

export type FindMediaUsageArgs = {
  config: SanitizedConfig
  mediaCollectionSlug: string
  mediaId: number | string
  payload: Payload
  req?: Parameters<Payload['find']>[0]['req']
  /** Number of results requested per Payload page; scans continue until complete. */
  limitPerField?: number
  stopOnFirstMatch?: boolean
  /**
   * When true (default), scans **published** (`draft: false`) and **draft** (`draft: true`) layers.
   * Draft-only scans miss references still live on published versions after a draft removes the field.
   */
  includePublishedAndDraft?: boolean
  /**
   * When true (default), returns one row per document+field (published wins over draft).
   * Set false only if you need every scanned layer separately.
   */
  collapseForDisplay?: boolean
  /**
   * Access mode for the reference scan.
   * - `true` (default): privileged scan of **every** reference. Required for integrity checks
   *   (the delete guard must see references the caller cannot read).
   * - `false`: scan as the requester (`req.user`). Use for user-visible usage listings so the
   *   caller never sees titles, slugs or ids of documents they cannot read.
   */
  overrideAccess?: boolean
}

const DEFAULT_PER_FIELD_LIMIT = 50
// The existing array response cannot stream; fail visibly instead of retaining unbounded results.
const MAX_USAGE_RESULTS = 10_000
// Rich text is scanned by walking documents. A host larger than this fails the scan (the delete is refused).
const RICH_TEXT_PAGE_SIZE = 200
const MAX_RICH_TEXT_SCAN_DOCS = 5_000
/**
 * True when a rich text JSON value (or any nested value) holds an `upload` node or a link to the media
 * document. Unknown or pathologically deep structures count as a reference, so the delete guard fails closed.
 */
export function containsMediaUploadNode(
  value: unknown,
  mediaCollectionSlug: string,
  mediaId: number | string
): boolean {
  const targetId = String(mediaId)
  let found = false
  const deep = forEachMediaReference(value, mediaCollectionSlug, (raw) => {
    if (valueMatchesMediaId(raw, targetId)) found = true
  })
  return found || deep
}

function collectionLabel(config: SanitizedConfig, slug: string): string {
  const collection = config.collections.find((entry) => entry.slug === slug)
  if (!collection) return slug
  const labels = collection.labels
  if (labels?.singular != null && labels.singular !== '') return String(labels.singular)
  return slug
}

function defaultLocale(config: SanitizedConfig): string | undefined {
  const loc = config.localization
  if (loc && typeof loc === 'object' && 'defaultLocale' in loc) {
    return loc.defaultLocale as string | undefined
  }
  return undefined
}

function documentTitle(
  doc: TypeWithID,
  useAsTitle: string,
  locale?: string | null,
  fallbackLocale?: string | null
): string {
  const record = doc as TypeWithID & Record<string, unknown>

  const name = resolveAdminLabel(record.name, locale, fallbackLocale)
  if (name) return name

  const assetOriginal = getSanityAssetFromMedia(doc as SanityMediaDocument)?.originalFilename
  if (typeof assetOriginal === 'string' && assetOriginal.trim().length > 0) {
    return assetOriginal.trim()
  }

  const originalFilename = resolveAdminLabel(record.originalFilename, locale, fallbackLocale)
  if (originalFilename) return originalFilename

  if (useAsTitle !== 'name' && useAsTitle !== 'originalFilename') {
    const byTitle = resolveAdminLabel(record[useAsTitle], locale, fallbackLocale)
    if (byTitle) return byTitle
  }

  if (doc.id != null) return String(doc.id)
  return 'Document'
}

function whereForTarget(
  fieldPath: string,
  mediaId: number | string,
  hasMany: boolean,
  polymorphic: boolean,
  mediaCollectionSlug: string
): Where {
  if (polymorphic) {
    return {
      and: [
        {
          [`${fieldPath}.value`]: hasMany ? { in: [mediaId] } : { equals: mediaId },
        },
        { [`${fieldPath}.relationTo`]: { equals: mediaCollectionSlug } },
      ],
    }
  }

  if (hasMany) {
    return {
      [fieldPath]: {
        in: [mediaId],
      },
    }
  }

  return {
    [fieldPath]: {
      equals: mediaId,
    },
  }
}

function getFieldValueByPath(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function usageEntryKey(entry: MediaUsageEntry): string {
  return `${entry.type}:${entry.collectionSlug}:${String(entry.id)}:${entry.fieldPath}:${entry.referenceLayer}`
}

function makeUsageEntry(
  args: Omit<MediaUsageEntry, 'adminPath'> & {
    config: SanitizedConfig
    target: MediaUploadTarget
  }
): MediaUsageEntry {
  const { config, target, referenceLayer, versionId, ...rest } = args
  return {
    ...rest,
    referenceLayer,
    versionId,
    adminPath: buildMediaUsageAdminPath({
      config,
      target,
      documentId: rest.id,
    }),
  }
}

export async function findMediaUsage(args: FindMediaUsageArgs): Promise<MediaUsageEntry[]> {
  const {
    config,
    mediaCollectionSlug,
    mediaId,
    payload,
    req,
    limitPerField = DEFAULT_PER_FIELD_LIMIT,
    stopOnFirstMatch = false,
    includePublishedAndDraft = true,
    collapseForDisplay = true,
    overrideAccess = true,
  } = args
  const targets = collectMediaUploadTargets(config, mediaCollectionSlug)
  const locale = req?.locale
  const fallbackLocale = defaultLocale(config)
  const localeCodes = getLocaleCodes(config)
  const readLocales = readLocalesOption(config)
  const matches: MediaUsageEntry[] = []
  const seen = new Set<string>()

  const pushMatch = (entry: MediaUsageEntry): boolean => {
    const key = usageEntryKey(entry)
    if (seen.has(key)) {
      const idx = matches.findIndex((m) => usageEntryKey(m) === key)
      const existing = matches[idx]
      if (existing && !existing.versionId && entry.versionId) {
        matches[idx] = entry
      }
      return false
    }
    if (matches.length >= MAX_USAGE_RESULTS) {
      throw new Error('Media usage scan exceeded the supported result limit')
    }
    seen.add(key)
    matches.push(entry)
    return true
  }

  const shouldStop = (): boolean => stopOnFirstMatch && matches.length > 0

  const draftLayers: boolean[] = includePublishedAndDraft ? [false, true] : [true]

  for (const target of targets) {
    const collectionConfig = config.collections?.find(
      (entry) => entry.slug === target.collectionSlug
    )
    const globalConfig = config.globals?.find((entry) => entry.slug === target.collectionSlug)

    for (const draft of draftLayers) {
      if (target.type === 'collection') {
        const collection = collectionConfig
        if (!collection) {
          continue
        }

        let page = 1
        let hasNextPage = true
        while (hasNextPage) {
          const found = await payload.find({
            collection: target.collectionSlug as CollectionSlug,
            depth: 0,
            limit: limitPerField,
            page,
            pagination: true,
            draft,
            locale: readLocales,
            overrideAccess,
            req,
            where: whereForTarget(
              target.fieldPath,
              mediaId,
              target.hasMany,
              target.polymorphic,
              mediaCollectionSlug
            ),
          })

          const useAsTitle = collection.admin?.useAsTitle ?? 'id'

          for (const doc of found.docs) {
            const id = doc.id

            const referenceLayer: MediaUsageReferenceLayer = draft ? 'draft' : 'published'

            pushMatch(
              makeUsageEntry({
                config,
                target,
                type: 'collection',
                id,
                title: documentTitle(doc, useAsTitle, locale, fallbackLocale),
                name: target.label,
                collectionSlug: target.collectionSlug,
                collectionLabel: collectionLabel(config, target.collectionSlug),
                fieldPath: target.fieldPath,
                fieldLabel: target.fieldLabel,
                referenceLayer,
              })
            )
          }

          if (shouldStop()) {
            return matches
          }

          hasNextPage = found.hasNextPage
          page += 1
        }
      } else {
        const globalDoc = await payload.findGlobal({
          slug: target.collectionSlug as GlobalSlug,
          depth: 0,
          draft,
          locale: readLocales,
          overrideAccess,
          req,
        })

        if (globalDoc) {
          const val = getFieldValueByPath(globalDoc, target.fieldPath)
          if (valueMatchesMediaId(val, mediaId, localeCodes)) {
            const globalTitle =
              resolveAdminLabel(globalConfig?.label, locale, fallbackLocale) ||
              target.collectionSlug

            const referenceLayer: MediaUsageReferenceLayer = draft ? 'draft' : 'published'

            pushMatch(
              makeUsageEntry({
                config,
                target,
                type: 'global',
                id: target.collectionSlug,
                title: globalTitle,
                name: globalTitle,
                collectionSlug: target.collectionSlug,
                collectionLabel: globalTitle,
                fieldPath: target.fieldPath,
                fieldLabel: target.fieldLabel,
                referenceLayer,
              })
            )

            if (shouldStop()) {
              return matches
            }
          }
        }
      }
    }

    if (shouldStop()) {
      return matches
    }
  }

  // Rich text references: upload nodes inside JSON values are invisible to the relationship scan above.
  for (const host of collectRichTextHosts(config, mediaCollectionSlug)) {
    for (const draft of draftLayers) {
      const referenceLayer: MediaUsageReferenceLayer = draft ? 'draft' : 'published'
      if (host.type === 'collection') {
        const collection = config.collections?.find((entry) => entry.slug === host.collectionSlug)
        const useAsTitle = collection?.admin?.useAsTitle ?? 'id'
        let page = 1
        let hasNextPage = true
        let scanned = 0
        while (hasNextPage) {
          const found = await payload.find({
            collection: host.collectionSlug as CollectionSlug,
            depth: 0,
            limit: RICH_TEXT_PAGE_SIZE,
            page,
            pagination: true,
            draft,
            locale: readLocales,
            overrideAccess,
            req,
          })
          scanned += found.docs.length
          if (scanned > MAX_RICH_TEXT_SCAN_DOCS) {
            throw new Error(
              `Media usage rich text scan exceeded ${MAX_RICH_TEXT_SCAN_DOCS} documents in ${host.collectionSlug}`
            )
          }
          for (const doc of found.docs) {
            if (!containsMediaUploadNode(doc, mediaCollectionSlug, mediaId)) continue
            pushMatch(
              makeUsageEntry({
                config,
                target: host,
                type: 'collection',
                id: doc.id,
                title: documentTitle(doc, useAsTitle, locale, fallbackLocale),
                name: host.label,
                collectionSlug: host.collectionSlug,
                collectionLabel: collectionLabel(config, host.collectionSlug),
                fieldPath: host.fieldPath,
                fieldLabel: host.fieldLabel,
                referenceLayer,
              })
            )
          }
          if (shouldStop()) return matches
          hasNextPage = found.hasNextPage
          page += 1
        }
      } else {
        const globalDoc = await payload.findGlobal({
          slug: host.collectionSlug as GlobalSlug,
          depth: 0,
          draft,
          locale: readLocales,
          overrideAccess,
          req,
        })
        if (globalDoc && containsMediaUploadNode(globalDoc, mediaCollectionSlug, mediaId)) {
          const globalConfig = config.globals?.find((entry) => entry.slug === host.collectionSlug)
          const globalTitle =
            resolveAdminLabel(globalConfig?.label, locale, fallbackLocale) || host.collectionSlug
          pushMatch(
            makeUsageEntry({
              config,
              target: host,
              type: 'global',
              id: host.collectionSlug,
              title: globalTitle,
              name: globalTitle,
              collectionSlug: host.collectionSlug,
              collectionLabel: globalTitle,
              fieldPath: host.fieldPath,
              fieldLabel: host.fieldLabel,
              referenceLayer,
            })
          )
          if (shouldStop()) return matches
        }
      }
    }
  }

  const sorted = matches.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'collection' ? -1 : 1
    }
    const byName = a.title.localeCompare(b.title)
    if (byName !== 0) return byName
    return a.fieldLabel.localeCompare(b.fieldLabel)
  })

  return collapseForDisplay ? collapseMediaUsageEntries(sorted) : sorted
}
