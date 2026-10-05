import type { Payload } from 'payload'

import type { PayloadDocumentId } from '../utils/payloadDocumentId'

export type MediaRowForDedupe = {
  id?: PayloadDocumentId
  createdAt?: string
  sanity?: { id?: string | null; sha1hash?: string | null } | null
}

export function duplicateGroupKey(doc: MediaRowForDedupe): string | null {
  const sanityId = doc.sanity?.id?.trim()
  const sha1 = doc.sanity?.sha1hash?.trim()
  if (!sanityId || !sha1) {
    return null
  }
  return `${sanityId}\0${sha1}`
}

export function recordMediaRowForDuplicateCount(
  groups: Map<string, MediaRowForDedupe[]>,
  doc: MediaRowForDedupe
): void {
  const key = duplicateGroupKey(doc)
  if (key == null) {
    return
  }
  const list = groups.get(key)
  if (list) {
    list.push(doc)
  } else {
    groups.set(key, [doc])
  }
}

export function countDuplicatesInGroups(groups: Map<string, MediaRowForDedupe[]>): number {
  let duplicates = 0
  for (const rows of groups.values()) {
    if (rows.length < 2) {
      continue
    }
    rows.sort((a, b) => {
      const ta = a.createdAt ?? ''
      const tb = b.createdAt ?? ''
      if (ta !== tb) {
        return ta < tb ? -1 : 1
      }
      return String(a.id ?? '').localeCompare(String(b.id ?? ''))
    })
    duplicates += rows.length - 1
  }
  return duplicates
}

/** Rows that share sanity.id + sha1hash with an older row (upload dedupe orphans). */
export async function countDuplicateMediaRows(
  payload: Payload,
  collectionSlug: string,
  req?: Parameters<Payload['find']>[0]['req'],
  limit = 500
): Promise<number> {
  const groups = new Map<string, MediaRowForDedupe[]>()
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await payload.find({
      collection: collectionSlug as never,
      depth: 0,
      limit,
      page,
      pagination: true,
      overrideAccess: true,
      req,
    })

    for (const doc of result.docs) {
      recordMediaRowForDuplicateCount(groups, doc as MediaRowForDedupe)
    }

    hasNextPage = result.hasNextPage === true
    page += 1
  }

  return countDuplicatesInGroups(groups)
}
