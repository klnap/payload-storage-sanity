import type { Adapter, GeneratedAdapter } from '@payloadcms/plugin-cloud-storage/types'
import type { SanityClient } from '@sanity/client'
import type { Field, FileData, TypeWithID } from 'payload'

import { SANITY_IMAGE_METADATA_EXTRACT } from '../client/createSanityClient'
import { fetchSanityImageAsset } from '../client/fetchSanityImageAsset'
import { sanityMediaAdminFields } from '../fields/mediaFields'
import { isUnavailableSyncStatus, normalizeSyncStatus } from '../sync/status'
import type { SanityAsset } from '../types/asset'
import type { SanityMediaDocument } from '../types/sanityStorageDocument'
import type { JsonValue } from '../utils/json'
import { mapSanityUploadToMedia } from '../utils/mappers'
import { mediaSyncStatus, readMediaSync, type WithMediaSync } from '../utils/mediaSync'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { resolvePublicUrl } from '../utils/resolvePublicUrl'
import { slugifyFilename } from '../utils/slugify'
import {
  normalizeAssetMimeType,
  resolveSanityAssetType,
  resolveSanityUploadBody,
} from '../utils/uploadBody'

import { assertSanityReadyForUpload } from '../utils/sanityConfig'
import { throwSanityUploadAPIError } from '../utils/sanityUploadError'
import { mapSanityUploadResult } from './metadata'

export type CreateSanityAdapterArgs = {
  client: SanityClient
  cdnBaseUrl?: string
  prefix?: string
  projectId: string
  dataset: string
  token?: string
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

    handleUpload: async ({ data, file }) => {
      try {
        assertSanityReadyForUpload(credentials)

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

        const uploaded = mapSanityUploadResult(result as JsonValue)
        const asset = assetNeedsHydration(uploaded)
          ? await fetchSanityImageAsset(client, uploaded._id).catch(() => uploaded)
          : uploaded

        const patch = mapSanityUploadToMedia(asset, uploadFile, (data ?? {}) as PayloadMediaDraft)
        const docForUrl = {
          ...data,
          ...patch,
          filename: asset._id,
        } as SanityMediaDocument
        const publicUrl = resolvePublicUrl(docForUrl, { cdnBaseUrl })
        const dimensions =
          asset._type === 'sanity.imageAsset' ? asset.metadata?.dimensions : undefined

        return {
          ...patch,
          filename: asset._id,
          ...(publicUrl ? { url: publicUrl } : {}),
          ...(dimensions?.width != null ? { width: dimensions.width } : {}),
          ...(dimensions?.height != null ? { height: dimensions.height } : {}),
          ...(asset.size != null ? { filesize: asset.size } : {}),
          sync: {
            ...existingSync,
            status: 'available' as const,
            checkedAt: new Date().toISOString(),
            errorAt: null,
          },
        } as Partial<FileData & TypeWithID>
      } catch (error) {
        throwSanityUploadAPIError(error)
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

      const upstreamUrl = doc
        ? resolvePublicUrl(doc, { cdnBaseUrl })
        : params.filename?.startsWith('http')
          ? params.filename
          : null

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
