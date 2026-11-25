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
  let scanFailed = false

  try {
    usages = await findMediaUsage({
      config: payload.config,
      mediaCollectionSlug: collectionSlug || 'media',
      mediaId: id,
      payload,
      req,
    })
  } catch (error) {
    payload.logger.error({ err: error }, 'Failed to inspect media references')
    scanFailed = true
  }

  return <MediaUsageTableClient usages={usages} scanFailed={scanFailed} />
}
