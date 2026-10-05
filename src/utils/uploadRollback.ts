import type { SanityClient } from '@sanity/client'
import type { PayloadRequest } from 'payload'

import { deleteSanityAsset } from './retention'
import { logSanityUploadIssue } from './sanityUploadLog'

export const SANITY_UPLOAD_PENDING_ROLLBACK_KEY = '_sanityStoragePendingRollback' as const

type PendingRollbackContext = string[]

function pendingList(req: PayloadRequest): PendingRollbackContext {
  if (!req.context) {
    req.context = {}
  }
  const existing = req.context[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]
  if (Array.isArray(existing)) {
    return existing as PendingRollbackContext
  }
  const list: PendingRollbackContext = []
  req.context[SANITY_UPLOAD_PENDING_ROLLBACK_KEY] = list
  return list
}

/** Record a Sanity asset uploaded this request; rolled back if Payload persist fails later. */
export function registerPendingSanityAsset(req: PayloadRequest, sanityAssetId: string): void {
  const id = sanityAssetId.trim()
  if (!id) return
  const list = pendingList(req)
  if (!list.includes(id)) {
    list.push(id)
  }
}

export function clearPendingSanityAssets(req: PayloadRequest): void {
  if (!req.context) return
  delete req.context[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]
}

function isNotFoundDeleteError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const err = error as { statusCode?: number; response?: { statusCode?: number } }
  const status = err.statusCode ?? err.response?.statusCode
  return status === 404
}

/**
 * Best-effort delete of assets uploaded during this request when persist hooks fail.
 * Does not scan Sanity globally — only IDs registered via {@link registerPendingSanityAsset}.
 */
export async function rollbackPendingSanityAssets(
  client: SanityClient,
  req: PayloadRequest
): Promise<void> {
  const raw = req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]
  if (!Array.isArray(raw) || raw.length === 0) {
    return
  }

  const ids = [...raw]

  for (const assetId of ids) {
    if (typeof assetId !== 'string' || !assetId.trim()) continue
    try {
      await deleteSanityAsset(client, assetId)
    } catch (error) {
      if (isNotFoundDeleteError(error)) {
        continue
      }
      logSanityUploadIssue(`Failed to roll back Sanity asset "${assetId}" after upload persist failure.`, {
        error,
      })
    }
  }
}
