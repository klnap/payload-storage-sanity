import { randomUUID } from 'node:crypto'

import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import type { SanityClient } from '@sanity/client'
import type { Field, FileData, TypeWithID } from 'payload'
import type { SanityMediaFolderOption, SanityMediaFolders } from '@/core/config'
import { assertSanityReadyForUpload, classifyMedia, resolveSanityMediaFolder } from '@/core/config'
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
import { hashUploadBytes, lockSanityAssetHash } from '@/features/media/lifecycle/asset-lock'
import {
  SANITY_STORAGE_DEDUPE_CONTEXT_KEY,
  throwDuplicateUploadAPIError,
} from '@/features/media/lifecycle/dedupe'
import {
  findMediaBySanityAssetId,
  mapSanityUploadToMedia,
  readUploadSignature,
  resolveSanityUploadBody,
  slugifyFilename,
} from '@/features/media/storage-adapter'
import { throwSanityUploadAPIError } from '@/features/media/storage-adapter/rollback'
import type { SanityAsset } from '@/sanity/assets'
import { getSanityAssetId, getSanityAssetPath } from '@/sanity/assets'
import { fetchSanityUpstreamAsset, isSanityCompatibleHost } from '@/sanity/cdn'
import { fetchSanityImageAsset, SANITY_IMAGE_METADATA_EXTRACT } from '@/sanity/client'
import { assignSanityAssetFolder } from '@/sanity/folders'
import { mapSanityUploadResult } from './metadata'

export type CreateSanityAdapterArgs = {
  client: SanityClient
  cdnBaseUrl?: string
  folder?: SanityMediaFolderOption
  folders?: false | SanityMediaFolders
  prefix?: string
  projectId: string
  dataset: string
  token?: string
  dedupeUploads?: boolean
}

/**
 * Upper bound for bytes proxied from Sanity. Enforced while streaming, so an oversized upstream
 * read is cancelled instead of buffered.
 */
const SANITY_PROXY_MAX_BYTES = 50 * 1024 * 1024

function capStreamBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): ReadableStream<Uint8Array> | null {
  if (body == null) return null
  let total = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        if (total > maxBytes) {
          // Erroring the transform cancels the upstream body (pipeThrough cancels its source).
          throw new Error('Upstream asset exceeds the proxy size limit')
        }
        controller.enqueue(chunk)
      },
    })
  )
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
  folder,
  folders,
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

        // Serialize uploads with Sanity deletion webhooks for the same content hash.
        await lockSanityAssetHash(req, await hashUploadBytes(uploadFile))

        const body = resolveSanityUploadBody(uploadFile)
        const classification = classifyMedia({
          mimeType: uploadFile.mimeType,
          filename: uploadFile.filename,
          signature: await readUploadSignature(uploadFile),
        })
        const assetType = classification.mediaType === 'image' ? 'image' : 'file'
        const contentType = classification.mimeType

        const result =
          assetType === 'image'
            ? client.assets.upload('image', body, {
                filename: uploadFile.filename,
                contentType,
                extract: [...SANITY_IMAGE_METADATA_EXTRACT],
              })
            : client.assets.upload('file', body, {
                filename: uploadFile.filename,
                contentType,
              })

        const raw = (await result) as JsonValue
        const uploaded = mapSanityUploadResult(raw)
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
          const existingRow = await findMediaBySanityAssetId(
            req,
            collectionSlug,
            asset._id,
            currentId
          )
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

        const folderPath = resolveSanityMediaFolder(classification.mediaType, folder, folders)
        if (folderPath !== false) await assignSanityAssetFolder(client, asset._id, folderPath)

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
          ...(publicUrl ? { url: publicUrl } : undefined),
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
      // Payload rows can be deleted; remote Sanity assets are retained.
    },

    staticHandler: async (_req, { doc: argDoc }) => {
      // Payload passes the access-checked media document as `doc`. Only its stored asset path is proxied,
      // joined to the configured CDN base; the request filename is never used as an upstream URL.
      const doc = argDoc as SanityMediaDocument | undefined
      const status = normalizeSyncStatus(doc ? mediaSyncStatus(doc) : undefined)

      if (isUnavailableSyncStatus(status)) {
        return new Response('Asset unavailable', { status: 404 })
      }

      const upstreamUrl =
        doc && getSanityAssetPath(doc) ? resolvePublicUrl(doc, { cdnBaseUrl }) : null

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
        const declaredLength = Number(response.headers.get('Content-Length'))
        if (declaredLength > SANITY_PROXY_MAX_BYTES) {
          await response.body?.cancel()
          return new Response('Asset too large', { status: 413 })
        }
        const contentType = response.headers.get('Content-Type') || 'application/octet-stream'
        const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
        const headers = new Headers({
          'Content-Type': contentType,
          'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
        })
        if (
          mediaType === 'image/svg+xml' ||
          mediaType === 'text/html' ||
          mediaType === 'application/xhtml+xml' ||
          mediaType === 'text/xml' ||
          mediaType === 'application/xml'
        ) {
          headers.set('Content-Disposition', 'attachment')
          headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
        }
        return new Response(capStreamBytes(response.body, SANITY_PROXY_MAX_BYTES), {
          headers,
        })
      } catch {
        return new Response('Failed to fetch upstream asset', { status: 502 })
      }
    },
  })
}
