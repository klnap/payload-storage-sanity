import type { CollectionSlug, GlobalSlug, Payload, SanitizedConfig, TypeWithID, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'

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
  /** Max matches per indexed field query. Defaults to 50. */
  limitPerField?: number
  /** Stop after the first inbound reference is found (for delete guards). */
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

function documentTitle(doc: TypeWithID, useAsTitle: string): string {
  const record = doc as TypeWithID & { [key: string]: string | number | boolean | null | undefined }

  if (record['name'] != null && record['name'] !== '') return String(record['name'])
  if (record['originalFilename'] != null && record['originalFilename'] !== '')
    return String(record['originalFilename'])
  if (useAsTitle !== 'name' && useAsTitle !== 'originalFilename') {
    const byTitle = record[useAsTitle]
    if (byTitle != null && byTitle !== '') return String(byTitle)
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
  let current: any = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
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
            title: documentTitle(doc, useAsTitle),
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
        const globalDoc = await payload.findGlobal({
          slug: target.collectionSlug as GlobalSlug,
          depth: 0,
          draft: true,
          req,
        })

        if (globalDoc) {
          const val = getFieldValueByPath(globalDoc, target.fieldPath)
          if (valueMatchesMediaId(val, mediaId)) {
            matches.push({
              type: 'global',
              id: 'global',
              title: target.label,
              name: target.label,
              collectionSlug: target.collectionSlug,
              collectionLabel: target.label,
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
    // Sort Collections before Globals, or by name then title
    if (a.type !== b.type) {
      return a.type === 'collection' ? -1 : 1
    }
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.title.localeCompare(b.title)
  })
}
