import type { UIFieldServerComponent } from 'payload'

import { findMediaUsage, type MediaUsageEntry } from '../queries/findMediaUsage'
import { MediaUsageTableClient } from './MediaUsageTableClient'

export const MediaUsageInspector: UIFieldServerComponent = async ({
  collectionSlug,
  id,
  payload,
  req,
}) => {
  if (id == null || id === '') {
    return null
  }

  let usages: MediaUsageEntry[] = []

  try {
    usages = await findMediaUsage({
      config: payload.config,
      mediaCollectionSlug: collectionSlug || 'media',
      mediaId: id,
      payload,
      req,
    })
  } catch {
    usages = []
  }

  if (usages.length === 0) {
    return null
  }

  return <MediaUsageTableClient usages={usages} />
}
