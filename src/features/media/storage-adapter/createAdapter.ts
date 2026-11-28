import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import type { SanityClient } from '@sanity/client'
import type { Field } from 'payload'
import type { SanityMediaFolderOption, SanityMediaFolders, UploadTransport } from '@/core/config'
import { assertSanityReadyForUpload, classifyMedia } from '@/core/config'
import type { JsonValue } from '@/core/contracts'
import {
  isUnavailableSyncStatus,
  mediaSyncStatus,
  normalizeSyncStatus,
  type WithMediaSync,
} from '@/features/asset-sync'
import { resolvePublicUrl } from '@/features/media/cdn'
import type { SanityMediaDocument } from '@/features/media/document'
import { sanityMediaAdminFields } from '@/features/media/fields'
import { hashUploadBytes, lockSanityAssetHash } from '@/features/media/lifecycle/asset-lock'
import {
  readUploadSignature,
  resolveSanityUploadBody,
  slugifyFilename,
} from '@/features/media/storage-adapter'
import { throwSanityUploadAPIError } from '@/features/media/storage-adapter/rollback'
import { getSanityAssetPath } from '@/sanity/assets'
import { fetchSanityUpstreamAsset, isSanityCompatibleHost } from '@/sanity/cdn'
import { SANITY_IMAGE_METADATA_EXTRACT } from '@/sanity/client'
import { mapSanityUploadResult } from './metadata'
import { finalizeSanityUpload } from '../lifecycle/upload/finalizeSanityUpload'
import { SANITY_UPLOAD_CONTEXT_KEY } from '@/features/media/upload-transport/finalizeExternalUpload'
import { verifySanityClientUploadContext } from '@/features/media/upload-transport/protocol'
import { SANITY_UPLOAD_SESSION_COLLECTION } from '@/features/media/upload-transport/sessionCollection'

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
  transport?: UploadTransport
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

export function createSanityAdapter({
  client,
  cdnBaseUrl,
  folder,
  folders,
  projectId,
  dataset,
  token,
  dedupeUploads = false,
  transport,
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
        return await finalizeSanityUpload({
          asset: uploaded,
          cdnBaseUrl,
          client,
          collection,
          data,
          dedupeUploads,
          file: uploadFile,
          folder,
          folders,
          mediaType: classification.mediaType,
          raw:
            typeof raw === 'object' && raw != null && !Array.isArray(raw)
              ? (raw as import('@/core/contracts').JsonObject)
              : undefined,
          req,
        })
      } catch (error) {
        throwSanityUploadAPIError(error, req.t as import('@/core/i18n').SanityStorageTranslateFn)
      }
    },

    handleDelete: async () => {
      // Payload rows can be deleted; remote Sanity assets are retained.
    },

    ...(transport ? { clientUploads: true as const } : undefined),

    staticHandler: async (req, { doc: argDoc, params }) => {
      // Payload passes the access-checked media document as `doc`. Only its stored asset path is proxied,
      // joined to the configured CDN base; the request filename is never used as an upstream URL.
      let doc = argDoc as SanityMediaDocument | undefined
      if (params.clientUploadContext !== undefined && transport) {
        try {
          const { receipt, ticket } = await verifySanityClientUploadContext(
            params.clientUploadContext,
            transport.secret,
            { audience: transport.endpoint, maxSizeBytes: transport.maxSizeBytes }
          )
          const subject = req.user ? `${req.user.collection ?? ''}:${String(req.user.id)}` : ''
          if (
            !req.user ||
            subject !== ticket.subject ||
            params.collection !== ticket.collection ||
            params.filename !== ticket.filename ||
            ticket.projectId !== projectId ||
            ticket.dataset !== dataset
          ) {
            return new Response('Not found', { status: 404 })
          }
          const claim = await req.payload
            .findByID({
              collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
              depth: 0,
              id: ticket.nonce,
              overrideAccess: true,
              req,
            })
            .catch(() => null)
          if (
            claim?.kind !== 'claim' ||
            claim.id !== ticket.nonce ||
            claim.nonce !== ticket.nonce ||
            claim.subject !== ticket.subject ||
            claim.collection !== ticket.collection ||
            claim.operation !== ticket.operation ||
            claim.projectId !== projectId ||
            claim.dataset !== dataset ||
            claim.size !== ticket.size ||
            claim.maxSize !== ticket.maxSize
          ) {
            return new Response('Not found', { status: 404 })
          }
          const asset = await client.getDocument<import('@/sanity/assets').SanityAsset>(
            receipt.assetId
          )
          if (!asset || asset._id !== receipt.assetId || asset.size !== receipt.size) {
            return new Response('Not found', { status: 404 })
          }
          doc = {
            sanity: { asset },
            sync: { status: 'available' },
          } as unknown as SanityMediaDocument
          req.context = {
            ...req.context,
            [SANITY_UPLOAD_CONTEXT_KEY]: params.clientUploadContext,
          }
          const assetUrl = resolvePublicUrl(doc, { cdnBaseUrl })
          if (!assetUrl || !isSanityCompatibleHost(assetUrl, { cdnBaseUrl })) {
            return new Response('Not found', { status: 404 })
          }
          const range = req.headers.get('Range')
          const response = await fetchSanityUpstreamAsset(assetUrl, {
            cdnBaseUrl,
            ...(range ? { headers: { Range: range } } : undefined),
          })
          if (!response.ok || Number(response.headers.get('Content-Length')) > receipt.size) {
            await response.body?.cancel()
            return new Response('Upstream asset not found', { status: 404 })
          }
          const headers = new Headers({
            'Content-Type': response.headers.get('Content-Type') || asset.mimeType,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          const contentRange = response.headers.get('Content-Range')
          if (contentRange) headers.set('Content-Range', contentRange)
          return new Response(capStreamBytes(response.body, receipt.size), {
            headers,
            status: response.status,
          })
        } catch {
          return new Response('Invalid client upload receipt', { status: 404 })
        }
      }
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
