import type { CollectionSlug, Payload, SanitizedConfig, TypeWithID, Where } from 'payload'
import { formatAdminURL } from 'payload/shared'

import { collectMediaUploadTargets } from './collectMediaUploadTargets'

export type MediaUsageEntry = {
  id: number | string
  title: string
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
  // SAFETY: Record property lookup for dynamic document title field
  const record = doc as TypeWithID & { [key: string]: string | number | boolean | null | undefined }

  // Priority: name → originalFilename → useAsTitle field → id
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
    const collection = config.collections.find((entry) => entry.slug === target.collectionSlug)
    if (!collection) {
      continue
    }

    try {
      // SAFETY: target.collectionSlug is collected from sanitized config collections
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
          id,
          title: documentTitle(doc, useAsTitle),
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
  }

  return matches.sort((a, b) => {
    const byCollection = a.collectionLabel.localeCompare(b.collectionLabel)
    if (byCollection !== 0) return byCollection
    return a.title.localeCompare(b.title)
  })
}
