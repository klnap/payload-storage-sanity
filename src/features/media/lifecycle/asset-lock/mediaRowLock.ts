import type { PayloadRequest } from 'payload'
import { lockTransactionKey } from './transactionLock'

const MEDIA_ROW_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

/**
 * Serializes a media row's delete against reference writes. The delete guard and the rich-text reference
 * hook both take this lock, so a reference cannot commit between the guard's scan and the row delete.
 */
export async function lockMediaRow(
  req: Partial<PayloadRequest> | undefined,
  mediaId: number | string
): Promise<boolean> {
  const id = String(mediaId)
  if (!MEDIA_ROW_ID_PATTERN.test(id)) {
    throw new Error('Media row lock needs a plain document id.')
  }
  return lockTransactionKey(req, `payload-storage-sanity:media-row:${id}`, 'Media row lock')
}
