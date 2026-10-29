import { randomUUID } from 'node:crypto'

import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import type { SanityClient } from '@sanity/client'
import type { Field, FileData, TypeWithID } from 'payload'
import { assertSanityReadyForUpload } from '@/core/config'
import type { JsonValue } from '@/core/contracts'
import { isPayloadDocumentId } from '@/core/contracts'
import {
  isUnavailableSyncStatus,
  mediaSyncStatus,
  normalizeSyncStatus,
  readMediaSync,
  type WithMediaSync,
} from '@/features/asset-sync'
import { resolvePublicUrl } from '@/features/media/cdn'
import type { PayloadMediaDraft, SanityMediaDocument } from '@/features/media/document'
import { sanityMediaAdminFields } from '@/features/media/fields'
import {
  SANITY_STORAGE_DEDUPE_CONTEXT_KEY,
  throwDuplicateUploadAPIError,
} from '@/features/media/lifecycle/dedupe'
import {
  findMediaBySanityAssetId,
  mapSanityUploadToMedia,
  normalizeAssetMimeType,
  resolveSanityAssetType,
  resolveSanityUploadBody,
  slugifyFilename,
} from '@/features/media/storage-adapter'
import { throwSanityUploadAPIError } from '@/features/media/storage-adapter/rollback'
import type { SanityAsset } from '@/sanity/assets'
import { getSanityAssetId } from '@/sanity/assets'
import { fetchSanityUpstreamAsset, isSanityCompatibleHost } from '@/sanity/cdn'
import { fetchSanityImageAsset, SANITY_IMAGE_METADATA_EXTRACT } from '@/sanity/client'
import { mapSanityUploadResult } from './metadata'

export type CreateSanityAdapterArgs = {
  client: SanityClient
  cdnBaseUrl?: string
  prefix?: string
  projectId: string
  dataset: string
  token?: string
  dedupeUploads?: boolean
}

function buildInjectedFields(): Field[] {
  return sanityMediaAdminFields()
}

function assetNeedsHydration(asset: SanityAsset): boolean {
  if (asset._type === 'sanity.fileAsset') {
    return asset._rev.length === 0
  }
  return asset._rev.length === 0 || asset.metadata == null
}

export function createSanityAdapter({
  client,
  cdnBaseUrl,
  projectId,
  dataset,
  token,
  dedupeUploads = false,
}: CreateSanityAdapterArgs): Adapter {
  const credentials = { projectId, dataset, token }
  const injectedFields = buildInjectedFields()

  return (): GeneratedAdapter => ({
    name: 'sanity',
    fields: injectedFields,

    generateURL: ({ data }) => {
      if (!data) return ''

      const syncDoc = data as WithMediaSync
      const status = normalizeSyncStatus(mediaSyncStatus(syncDoc))
      if (isUnavailableSyncStatus(status)) {
        return ''
      }

      const url = resolvePublicUrl(data as SanityMediaDocument, { cdnBaseUrl })
      return url ?? ''
    },

    handleUpload: async ({ collection, data, file, req }) => {
      try {
        assertSanityReadyForUpload(
          credentials,
          req.t as import('@/core/i18n').SanityStorageTranslateFn
        )

        const existingSync = readMediaSync((data ?? {}) as WithMediaSync)

        const slugifiedName = slugifyFilename(file.filename)
        const uploadFile = {
          ...file,
          filename: slugifiedName,
        }

        const body = resolveSanityUploadBody(uploadFile)
        const assetType = resolveSanityAssetType(uploadFile.mimeType, uploadFile.filename)
        const contentType = normalizeAssetMimeType(uploadFile.mimeType, uploadFile.filename)

        const result =
          assetType === 'image'
            ? await client.assets.upload('image', body, {
                filename: uploadFile.filename,
                contentType,
                extract: [...SANITY_IMAGE_METADATA_EXTRACT],
              })
            : await client.assets.upload('file', body, {
                filename: uploadFile.filename,
                contentType,
              })

        const raw = result as JsonValue
        const uploaded = mapSanityUploadResult(raw)
        const asset = assetNeedsHydration(uploaded)
          ? await fetchSanityImageAsset(client, uploaded._id).catch(() => uploaded)
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
          const existingRow = await findMediaBySanityAssetId(
            req,
            collectionSlug,
            asset._id,
            currentId
          )
          if (existingRow != null) {
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

        const patch = mapSanityUploadToMedia(
          asset,
          uploadFile,
          (data ?? {}) as PayloadMediaDraft,
          typeof raw === 'object' && raw != null && !Array.isArray(raw)
            ? (raw as import('@/core/contracts').JsonObject)
            : undefined
        )
        const docForUrl = {
          ...data,
          ...patch,
          filename: payloadFilename,
        } as SanityMediaDocument
        const publicUrl = resolvePublicUrl(docForUrl, { cdnBaseUrl })
        return {
          ...patch,
          filename: payloadFilename,
          ...(publicUrl ? { url: publicUrl } : {}),
          sync: {
            ...existingSync,
            status: 'available' as const,
            checkedAt: new Date().toISOString(),
            errorAt: null,
          },
        } as Partial<FileData & TypeWithID>
      } catch (error) {
        throwSanityUploadAPIError(error, req.t as import('@/core/i18n').SanityStorageTranslateFn)
      }
    },

    handleDelete: async () => {
      // Retention-aware Sanity cleanup runs in createMediaDeleteSanityAssetBeforeDeleteHook.
    },

    staticHandler: async (req, { params }) => {
      const reqWithDoc = req as { doc?: SanityMediaDocument }
      const doc = reqWithDoc.doc
      const status = normalizeSyncStatus(doc ? mediaSyncStatus(doc) : undefined)

      if (isUnavailableSyncStatus(status)) {
        return new Response('Asset unavailable', { status: 404 })
      }

      let upstreamUrl = doc ? resolvePublicUrl(doc, { cdnBaseUrl }) : null

      if (
        !upstreamUrl &&
        typeof params.filename === 'string' &&
        /^https?:\/\//i.test(params.filename) &&
        isSanityCompatibleHost(params.filename, { cdnBaseUrl })
      ) {
        upstreamUrl = params.filename
      }

      if (!upstreamUrl) {
        return new Response('Not found', { status: 404 })
      }

      if (
        /^https?:\/\//i.test(upstreamUrl) &&
        !isSanityCompatibleHost(upstreamUrl, { cdnBaseUrl })
      ) {
        return new Response('Not found', { status: 404 })
      }

      try {
        const response = await fetchSanityUpstreamAsset(upstreamUrl, { cdnBaseUrl })
        if (!response.ok) {
          return new Response('Upstream asset not found', { status: 404 })
        }
        return new Response(response.body, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
            'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=31536000',
          },
        })
      } catch {
        return new Response('Failed to fetch upstream asset', { status: 502 })
      }
    },
  })
}
