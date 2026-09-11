import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import type { SanityClient } from '@sanity/client'
import type { Field, FileData, TypeWithID } from 'payload'

import { SANITY_IMAGE_METADATA_EXTRACT } from '../client/createSanityClient'
import { fetchSanityImageAsset } from '../client/fetchSanityImageAsset'
import { sanityMediaAdminFields } from '../fields/mediaFields'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityAsset } from '../types/asset'
import type { JsonValue } from '../utils/json'
import { mapSanityUploadToMedia } from '../utils/mappers'
import { mediaSyncStatus, readMediaSync, type WithMediaSync } from '../utils/mediaSync'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { slugifyFilename } from '../utils/slugify'
import {
  normalizeAssetMimeType,
  resolveSanityAssetType,
  resolveSanityUploadBody,
} from '../utils/uploadBody'

import { mapSanityUploadResult, sanityAssetIdFromDocument } from './metadata'

export type CreateSanityAdapterArgs = {
  client: SanityClient
  cdnBaseUrl?: string
  prefix?: string
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

export function createSanityAdapter({ client, cdnBaseUrl }: CreateSanityAdapterArgs): Adapter {
  const injectedFields = buildInjectedFields()

  return (): GeneratedAdapter => ({
    name: 'sanity',
    fields: injectedFields,

    generateURL: ({ data }) => {
      // SAFETY: data conforms to media document structure in generateURL callback
      const syncDoc = data as WithMediaSync | undefined
      const status = normalizeSyncStatus(syncDoc ? mediaSyncStatus(syncDoc) : undefined)
      if (isUnavailableSyncStatus(status)) {
        return ''
      }

      // SAFETY: data contains media url if populated or uploaded
      const directUrl = (data as { url?: string } | undefined)?.url
      if (directUrl && directUrl.trim().length > 0) {
        if (cdnBaseUrl && cdnBaseUrl.trim().length > 0) {
          return directUrl.replace(/https:\/\/cdn\.sanity\.io/, cdnBaseUrl.replace(/\/$/, ''))
        }
        return directUrl
      }

      // SAFETY: syncDoc has been cast to WithMediaSync above
      const assetId = syncDoc ? sanityAssetIdFromDocument(syncDoc) : null
      if (!assetId) return ''

      if (cdnBaseUrl && assetId) {
        return `${cdnBaseUrl.replace(/\/$/, '')}/${assetId}`
      }

      // Build canonical Sanity CDN URL from client config as last resort
      const { projectId, dataset } = client.config()
      if (projectId && dataset) {
        const assetType = assetId.startsWith('image-') ? 'images' : 'files'
        return `https://cdn.sanity.io/${assetType}/${projectId}/${dataset}/${assetId}`
      }

      return ''
    },

    handleUpload: async ({ data, file }) => {
      // SAFETY: data conforms to media draft document shape
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

      // SAFETY: Sanity assets.upload returns a JSON-serializable asset document
      const uploaded = mapSanityUploadResult(result as JsonValue)
      const asset = assetNeedsHydration(uploaded)
        ? await fetchSanityImageAsset(client, uploaded._id).catch(() => uploaded)
        : uploaded

      // SAFETY: data conforms to PayloadMediaDraft
      const patch = mapSanityUploadToMedia(asset, uploadFile, (data ?? {}) as PayloadMediaDraft)

      // SAFETY: Returns file data & ID partial matching Payload upload result contract
      return {
        ...patch,
        // Store the Sanity asset _id as the Payload filename.
        // generateFileURL uses this to build the CDN URL (with or without transform params).
        filename: asset._id,
        sync: {
          ...existingSync,
          status: 'available' as const,
          checkedAt: new Date().toISOString(),
          errorAt: null,
        },
      } as Partial<FileData & TypeWithID>
    },

    handleDelete: async () => {
      // Retention-aware Sanity cleanup runs in createMediaDeleteSanityAssetBeforeDeleteHook.
    },

    staticHandler: async (req, { params }) => {
      const { filename } = params
      // SAFETY: Static handler request object contains doc populated by Payload static handler
      const reqWithDoc = req as { doc?: WithMediaSync & { url?: string } }
      const doc = reqWithDoc.doc
      const status = normalizeSyncStatus(doc ? mediaSyncStatus(doc) : undefined)

      if (isUnavailableSyncStatus(status)) {
        return new Response('Asset unavailable', { status: 404 })
      }

      const assetId = doc ? sanityAssetIdFromDocument(doc) : null

      // Priority: 1. stored Sanity CDN url, 2. custom cdnBaseUrl + assetId, 3. canonical Sanity CDN from client config
      let upstreamUrl: string | null = null
      if (doc?.url && doc.url.trim().length > 0 && doc.url.startsWith('http')) {
        upstreamUrl =
          cdnBaseUrl && cdnBaseUrl.trim().length > 0
            ? doc.url.replace(/https:\/\/cdn\.sanity\.io/, cdnBaseUrl.replace(/\/$/, ''))
            : doc.url
      } else if (cdnBaseUrl && assetId) {
        upstreamUrl = `${cdnBaseUrl.replace(/\/$/, '')}/${assetId}`
      } else if (assetId) {
        // Build canonical Sanity CDN URL from client config as last resort
        const { projectId, dataset } = client.config()
        if (projectId && dataset) {
          const assetType = assetId.startsWith('image-') ? 'images' : 'files'
          upstreamUrl = `https://cdn.sanity.io/${assetType}/${projectId}/${dataset}/${assetId}`
        }
      } else if (filename?.startsWith('http')) {
        upstreamUrl = filename
      }

      if (!upstreamUrl) {
        return new Response('Not found', { status: 404 })
      }

      try {
        const response = await fetch(upstreamUrl)
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
