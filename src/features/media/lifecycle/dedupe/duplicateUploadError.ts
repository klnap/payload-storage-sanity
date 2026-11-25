import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import type { PayloadDocumentId } from '@/core/contracts'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'

export const MEDIA_DUPLICATE_UPLOAD_ERROR_CODE = 'SANITY_STORAGE_DUPLICATE_UPLOAD'

export type MediaDuplicateUploadErrorData = {
  code: typeof MEDIA_DUPLICATE_UPLOAD_ERROR_CODE
  /** Omitted when the existing row is not readable by the requester. */
  existingId?: PayloadDocumentId
}

export function resolveUploadFilename(req: PayloadRequest): string | null {
  const name = req.file?.name
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formatDuplicateUploadCompactMessage(
  t: SanityStorageTranslateFn,
  filename: string,
  existingId: PayloadDocumentId
): string {
  return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadDuplicateCompact, {
    filename,
    existingId: String(existingId),
  })
}

export function formatDuplicateUploadBlockMessage(
  t: SanityStorageTranslateFn,
  existingId: PayloadDocumentId
): string {
  return sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadDuplicateBlock, {
    existingId: String(existingId),
  })
}

/**
 * Public 409 for duplicate bytes or Sanity asset id already stored as another media row.
 * Pass `null` when the existing row is not readable: the 409 then carries no id.
 */
export function throwDuplicateUploadAPIError(
  req: PayloadRequest,
  existingId: PayloadDocumentId | null
): never {
  const t = req.t as SanityStorageTranslateFn
  const filename = resolveUploadFilename(req)
  const message =
    existingId == null
      ? sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.uploadDuplicateHidden)
      : formatDuplicateUploadCompactMessage(t, filename ?? String(existingId), existingId)
  const fieldMessage =
    existingId == null ? message : formatDuplicateUploadBlockMessage(t, existingId)

  throw new APIError(
    message,
    409,
    {
      code: MEDIA_DUPLICATE_UPLOAD_ERROR_CODE,
      ...(existingId != null ? { existingId } : {}),
      errors: [{ path: 'file', message: fieldMessage }],
    } satisfies MediaDuplicateUploadErrorData & {
      errors: Array<{ path: string; message: string }>
    },
    true
  )
}
