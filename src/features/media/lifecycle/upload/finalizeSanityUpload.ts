import { randomUUID } from 'node:crypto'

import type { SanityClient } from '@sanity/client'
import type { CollectionConfig, FileData, PayloadRequest, TypeWithID } from 'payload'
import type { SanityMediaFolderOption, SanityMediaFolders } from '@/core/config'
import { resolveSanityMediaFolder } from '@/core/config'
import { isPayloadDocumentId, type JsonObject } from '@/core/contracts'
import { readMediaSync, type WithMediaSync } from '@/features/asset-sync'
import { resolvePublicUrl } from '@/features/media/cdn'
import type { PayloadMediaDraft, SanityMediaDocument } from '@/features/media/document'
import {
  SANITY_STORAGE_DEDUPE_CONTEXT_KEY,
  throwDuplicateUploadAPIError,
} from '@/features/media/lifecycle/dedupe'
import { findMediaBySanityAssetId } from '@/features/media/storage-adapter/findMediaBySanityAssetId'
import {
  mapSanityUploadToMedia,
  type UploadFileMeta,
} from '@/features/media/storage-adapter/mappers'
import type { SanityAsset } from '@/sanity/assets'
import { getSanityAssetId } from '@/sanity/assets'
import { fetchSanityImageAsset } from '@/sanity/client'
import { assignSanityAssetFolder } from '@/sanity/folders'

export type FinalizeSanityUploadArgs = {
  asset: SanityAsset
  cdnBaseUrl?: string
  client: SanityClient
  collection: CollectionConfig
  data: Partial<FileData & TypeWithID> | null
  dedupeUploads: boolean
  file: UploadFileMeta
  folder?: SanityMediaFolderOption
  folders?: false | SanityMediaFolders
  mediaType: 'image' | 'video' | 'audio' | 'file'
  raw?: JsonObject
  req: PayloadRequest
}

function assetNeedsHydration(asset: SanityAsset): boolean {
  if (asset._type === 'sanity.fileAsset') {
    return asset._rev.length === 0
  }
  return asset._rev.length === 0 || asset.metadata == null
}

/** Persist uploaded asset metadata through the same path for every byte transport. */
export async function finalizeSanityUpload({
  asset: uploaded,
  cdnBaseUrl,
  client,
  collection,
  data,
  dedupeUploads,
  file,
  folder,
  folders,
  mediaType,
  raw,
  req,
}: FinalizeSanityUploadArgs): Promise<Partial<FileData & TypeWithID>> {
  const asset = assetNeedsHydration(uploaded)
    ? await fetchSanityImageAsset(client, uploaded._id).catch((error) => {
        req.payload?.logger?.warn?.(
          `[@klnap/payload-storage-sanity] Sanity asset hydration failed for ${uploaded._id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
        return uploaded
      })
    : uploaded

  // Payload `filename` must be unique (storage key). Sanity asset `_id` lives on `sanity.asset`.
  // Prefer the media document id (uuid collections) so many rows can share one Sanity asset.
  const currentId =
    data != null && typeof data === 'object' && 'id' in data && isPayloadDocumentId(data.id)
      ? data.id
      : null
  const payloadFilename = currentId != null ? String(currentId) : randomUUID()

  const collectionSlug =
    collection != null && typeof collection === 'object' && 'slug' in collection
      ? collection.slug
      : null
  if (typeof collectionSlug === 'string' && collectionSlug.length > 0) {
    const existingRow = await findMediaBySanityAssetId(req, collectionSlug, asset._id, currentId)
    // An unreadable match (id null) is treated as no match: a conflict or duplicate error for it
    // would reveal that the requester cannot see these bytes. Sharing the asset is allowed.
    if (existingRow?.id != null) {
      const priorAssetId = getSanityAssetId((data ?? {}) as SanityMediaDocument)
      // Replace on an existing row with bytes already owned by another media doc.
      if (priorAssetId != null && priorAssetId.length > 0 && priorAssetId !== asset._id) {
        throwDuplicateUploadAPIError(req, existingRow.id)
      }

      if (dedupeUploads) {
        if (!req.context) {
          req.context = {}
        }
        req.context[SANITY_STORAGE_DEDUPE_CONTEXT_KEY] = {
          existingId: existingRow.id,
        }

        // Create path: empty metadata → cloud-storage skips the conflicting `filename` update;
        // afterOperation deletes the orphan row and throws 409 with the existing id.
        return {}
      }
    }
  }

  const folderPath = resolveSanityMediaFolder(mediaType, folder, folders)
  if (folderPath !== false) await assignSanityAssetFolder(client, asset._id, folderPath)

  const patch = mapSanityUploadToMedia(asset, file, (data ?? {}) as PayloadMediaDraft, raw)
  const docForUrl = {
    ...data,
    ...patch,
    filename: payloadFilename,
  } as SanityMediaDocument
  const publicUrl = resolvePublicUrl(docForUrl, { cdnBaseUrl })
  return {
    ...patch,
    filename: payloadFilename,
    ...(publicUrl ? { url: publicUrl } : undefined),
    sync: {
      ...readMediaSync((data ?? {}) as WithMediaSync),
      status: 'available',
      checkedAt: new Date().toISOString(),
      errorAt: null,
    },
  } as Partial<FileData & TypeWithID>
}
