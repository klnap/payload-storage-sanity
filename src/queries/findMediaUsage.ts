import type { CollectionSlug, GlobalSlug, Payload, SanitizedConfig, TypeWithID, Where } from 'payload'

import { buildMediaUsageAdminPath } from '../utils/mediaUsageAdminPath'
import { resolveAdminLabel } from '../utils/resolveAdminLabel'
import { collectMediaUploadTargets, type MediaUploadTarget } from './collectMediaUploadTargets'
import { collapseMediaUsageEntries } from './collapseMediaUsageEntries'
import { getLocaleCodes, readLocalesOption, valueMatchesMediaId } from './mediaReferenceScanUtils'

export type MediaUsageType = 'collection' | 'global'

/** Whether the reference was found on a published or draft snapshot (live read or version row). */
export type MediaUsageReferenceLayer = 'published' | 'draft'

export type MediaUsageEntry = {
  type: MediaUsageType
  id: number | string
  title: string
  name: string
  collectionSlug: string
  collectionLabel: string
  fieldPath: string
  fieldLabel: string
  referenceLayer: MediaUsageReferenceLayer
  /** When set, `adminPath` opens that version in the admin (published vs draft query param). */
  versionId?: number | string
  adminPath: string
}

export type FindMediaUsageArgs = {
  config: SanitizedConfig
  mediaCollectionSlug: string
  mediaId: number | string
  payload: Payload
  req?: Parameters<Payload['find']>[0]['req']
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
}

const DEFAULT_PER_FIELD_LIMIT = 50

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

  const originalFilename = resolveAdminLabel(record.originalFilename, locale, fallbackLocale)
  if (originalFilename) return originalFilename

  if (useAsTitle !== 'name' && useAsTitle !== 'originalFilename') {
    const byTitle = resolveAdminLabel(record[useAsTitle], locale, fallbackLocale)
    if (byTitle) return byTitle
  }

  if (doc.id != null) return String(doc.id)
  return 'Document'
}

function whereForTarget(fieldPath: string, mediaId: number | string, hasMany: boolean): Where {
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
      if (idx >= 0 && !matches[idx].versionId && entry.versionId) {
        matches[idx] = entry
      }
      return false
    }
    seen.add(key)
    matches.push(entry)
    return true
  }

  const shouldStop = (): boolean => stopOnFirstMatch && matches.length > 0

  const draftLayers: boolean[] = includePublishedAndDraft ? [false, true] : [true]

  for (const target of targets) {
    const collectionConfig = config.collections?.find((entry) => entry.slug === target.collectionSlug)
    const globalConfig = config.globals?.find((entry) => entry.slug === target.collectionSlug)

    for (const draft of draftLayers) {
      if (target.type === 'collection') {
        const collection = collectionConfig
        if (!collection) {
          continue
        }

        try {
          const found = await payload.find({
            collection: target.collectionSlug as CollectionSlug,
            depth: 0,
            limit: limitPerField,
            pagination: false,
            draft,
            locale: readLocales,
            overrideAccess: true,
            req,
            where: whereForTarget(target.fieldPath, mediaId, target.hasMany),
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
        } catch {
          // Ignore individual target find errors so other collections continue to resolve
        }
      } else {
        try {
          const globalDoc = await payload.findGlobal({
            slug: target.collectionSlug as GlobalSlug,
            depth: 0,
            draft,
            locale: readLocales,
            overrideAccess: true,
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
        } catch {
          // Ignore individual global find errors
        }
      }
    }

    if (shouldStop()) {
      return matches
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
