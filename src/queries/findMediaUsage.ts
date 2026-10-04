import type { CollectionSlug, GlobalSlug, Payload, SanitizedConfig, TypeWithID, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'

import { resolveAdminLabel } from '../utils/resolveAdminLabel'
import { collectMediaUploadTargets } from './collectMediaUploadTargets'

export type MediaUsageType = 'collection' | 'global'

export type MediaUsageEntry = {
  type: MediaUsageType
  id: number | string
  title: string
  name: string
  collectionSlug: string
  collectionLabel: string
  fieldPath: string
  fieldLabel: string
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

function valueMatchesMediaId(value: unknown, mediaId: number | string): boolean {
  if (value == null) return false
  const targetId = String(mediaId)

  const extractId = (item: unknown): string | null => {
    if (item == null) return null
    if (typeof item === 'string' || typeof item === 'number') return String(item)
    if (typeof item === 'object' && 'id' in item && item.id != null) return String(item.id)
    return null
  }

  if (Array.isArray(value)) {
    return value.some((item) => extractId(item) === targetId)
  }

  return extractId(value) === targetId
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
  } = args
  const targets = collectMediaUploadTargets(config, mediaCollectionSlug)
  const adminRoute = config.routes.admin
  const serverURL = config.serverURL
  const locale = req?.locale
  const fallbackLocale = defaultLocale(config)
  const matches: MediaUsageEntry[] = []

  for (const target of targets) {
    if (target.type === 'collection') {
      const collection = config.collections.find((entry) => entry.slug === target.collectionSlug)
      if (!collection) {
        continue
      }

      try {
        const found = await payload.find({
          collection: target.collectionSlug as CollectionSlug,
          depth: 0,
          limit: limitPerField,
          pagination: false,
          draft: true,
          req,
          where: whereForTarget(target.fieldPath, mediaId, target.hasMany),
        })

        const useAsTitle = collection.admin?.useAsTitle ?? 'id'

        for (const doc of found.docs) {
          const id = doc.id

          matches.push({
            type: 'collection',
            id,
            title: documentTitle(doc, useAsTitle, locale, fallbackLocale),
            name: target.label,
            collectionSlug: target.collectionSlug,
            collectionLabel: collectionLabel(config, target.collectionSlug),
            fieldPath: target.fieldPath,
            fieldLabel: target.fieldLabel,
            adminPath: formatAdminURL({
              adminRoute,
              path: `/collections/${target.collectionSlug}/${id}`,
              serverURL,
            }),
          })
        }

        if (stopOnFirstMatch && matches.length > 0) {
          return matches
        }
      } catch {
        // Ignore individual target find errors so other collections continue to resolve
      }
    } else if (target.type === 'global') {
      try {
        const globalDef = config.globals?.find((entry) => entry.slug === target.collectionSlug)
        const globalDoc = await payload.findGlobal({
          slug: target.collectionSlug as GlobalSlug,
          depth: 0,
          draft: true,
          req,
        })

        if (globalDoc) {
          const val = getFieldValueByPath(globalDoc, target.fieldPath)
          if (valueMatchesMediaId(val, mediaId)) {
            const globalTitle =
              resolveAdminLabel(globalDef?.label, locale, fallbackLocale) ||
              target.collectionSlug

            matches.push({
              type: 'global',
              id: target.collectionSlug,
              title: globalTitle,
              name: globalTitle,
              collectionSlug: target.collectionSlug,
              collectionLabel: globalTitle,
              fieldPath: target.fieldPath,
              fieldLabel: target.fieldLabel,
              adminPath: formatAdminURL({
                adminRoute,
                path: `/globals/${target.collectionSlug}`,
                serverURL,
              }),
            })

            if (stopOnFirstMatch && matches.length > 0) {
              return matches
            }
          }
        }
      } catch {
        // Ignore individual global find errors
      }
    }
  }

  return matches.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'collection' ? -1 : 1
    }
    const byName = a.title.localeCompare(b.title)
    if (byName !== 0) return byName
    return a.fieldLabel.localeCompare(b.fieldLabel)
  })
}
