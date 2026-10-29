import type { UIFieldServerComponent } from 'payload'
import type { MediaUsageEntry } from '@/features/media/usage'
import { findMediaUsage } from '@/features/media/usage'
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

  return <MediaUsageTableClient usages={usages} />
}
