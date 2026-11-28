import type { SanityClient } from '@sanity/client'
import type { CollectionAfterChangeHook } from 'payload'
import type { SanityMediaFolderOption, SanityMediaFolders, UploadTransport } from '@/core/config'
import { classifyMedia } from '@/core/config'
import type { SanityMediaDocument } from '@/features/media/document'
import type { JsonObject } from '@/core/contracts'
import { resolvePublicUrl } from '@/features/media/cdn'
import { finalizeSanityUpload } from '@/features/media/lifecycle/upload/finalizeSanityUpload'
import type { SanityAsset } from '@/sanity/assets'
import { fetchSanityUpstreamAsset } from '@/sanity/cdn'
import {
  SANITY_UPLOAD_FINALIZATION_SUFFIX,
  SANITY_UPLOAD_SESSION_COLLECTION,
} from './sessionCollection'
import { authorizeUploadRequest } from './endpoints'
import { verifySanityClientUploadContext } from './protocol'

export const SANITY_UPLOAD_CONTEXT_KEY = 'sanityStorageExternalUploadContext'

export function readClientUploadContext(
  req: Parameters<CollectionAfterChangeHook>[0]['req']
): unknown {
  const file = req.file as { clientUploadContext?: unknown } | undefined
  return (
    file?.clientUploadContext ??
    req.context?.[SANITY_UPLOAD_CONTEXT_KEY] ??
    req.context?.payloadClientUploadContext
  )
}

function recordMatches(
  record: Record<string, unknown>,
  claims: Awaited<ReturnType<typeof verifySanityClientUploadContext>>['ticket'],
  docId: string | number
): boolean {
  return (
    record.kind === 'finalization' &&
    record.nonce === claims.nonce &&
    record.subject === claims.subject &&
    record.collection === claims.collection &&
    record.operation === claims.operation &&
    record.documentId === String(docId) &&
    record.projectId === claims.projectId &&
    record.dataset === claims.dataset
  )
}

async function readSanityAssetSignature(
  asset: SanityAsset,
  cdnBaseUrl?: string
): Promise<Uint8Array> {
  const url = resolvePublicUrl(
    { sanity: { asset }, sync: { status: 'available' } } as unknown as SanityMediaDocument,
    { cdnBaseUrl }
  )
  if (!url) throw new Error('Sanity asset has no safe URL for content validation.')
  const response = await fetchSanityUpstreamAsset(url, {
    cdnBaseUrl,
    headers: { Range: 'bytes=0-31' },
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error('Sanity asset content could not be validated.')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < 32) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const chunk = value.subarray(0, 32 - total)
      chunks.push(chunk)
      total += chunk.byteLength
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const signature = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    signature.set(chunk, offset)
    offset += chunk.byteLength
  }
  if (signature.length === 0) throw new Error('Sanity asset content is empty.')
  return signature
}

export function createSanityExternalUploadAfterChangeHook({
  cdnBaseUrl,
  client,
  dataset,
  dedupeUploads,
  folder,
  folders,
  maxSizeFor,
  projectId,
  transport,
}: {
  cdnBaseUrl?: string
  client: SanityClient
  dataset: string
  dedupeUploads: boolean
  folder?: SanityMediaFolderOption
  folders?: false | SanityMediaFolders
  maxSizeFor: (mimeType: string, filename: string) => number | undefined
  projectId: string
  transport: UploadTransport
}): CollectionAfterChangeHook {
  return async ({ collection, doc, operation, req }) => {
    if (req.context?.skipCloudStorage) return
    const uploadContext = readClientUploadContext(req)
    if (uploadContext == null) return

    const { receipt, ticket } = await verifySanityClientUploadContext(
      uploadContext,
      transport.secret,
      { audience: transport.endpoint, maxSizeBytes: transport.maxSizeBytes }
    )
    const collectionSlug = collection.slug
    const documentId = doc.id
    if (
      !req.user ||
      `${req.user.collection ?? ''}:${String(req.user.id)}` !== ticket.subject ||
      ticket.collection !== collectionSlug ||
      ticket.operation !== operation ||
      ticket.projectId !== projectId ||
      ticket.dataset !== dataset ||
      (operation === 'update' && String(ticket.documentId) !== String(documentId)) ||
      (operation !== 'create' && operation !== 'update')
    ) {
      throw new Error('External upload ticket does not authorize this media operation.')
    }

    const authorized = await authorizeUploadRequest(req, {
      collection: collectionSlug,
      documentId: operation === 'update' ? documentId : undefined,
      filename: ticket.filename,
      mimeType: ticket.mimeType,
      operation,
      size: ticket.size,
    })
    if (!authorized) {
      throw new Error('Not authorized to finalize this media upload.')
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
      claim.subject !== ticket.subject ||
      claim.collection !== ticket.collection ||
      claim.operation !== ticket.operation ||
      claim.projectId !== ticket.projectId ||
      claim.dataset !== ticket.dataset ||
      claim.size !== ticket.size ||
      claim.maxSize !== ticket.maxSize
    ) {
      throw new Error('External upload has no matching durable claim.')
    }

    const finalizationId = `${ticket.nonce}${SANITY_UPLOAD_FINALIZATION_SUFFIX}`
    const priorFinalization = await req.payload
      .findByID({
        collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
        depth: 0,
        id: finalizationId,
        overrideAccess: true,
        req,
      })
      .catch(() => null)
    if (priorFinalization) {
      if (!recordMatches(priorFinalization, ticket, documentId)) {
        throw new Error('External upload ticket was already finalized for another document.')
      }
      const result = priorFinalization.result
      return result && typeof result === 'object' && !Array.isArray(result)
        ? ({ ...doc, ...(result as Partial<SanityMediaDocument>) } as typeof doc)
        : doc
    }
    if (req.transactionID == null) {
      throw new Error('External upload finalization requires an active Payload transaction.')
    }

    const raw = await client.getDocument<SanityAsset>(receipt.assetId)
    if (!raw || raw._id !== receipt.assetId || raw.size !== receipt.size) {
      throw new Error('Sanity asset does not match the signed upload receipt.')
    }
    const asset = raw as SanityAsset
    const actualFilename = asset.originalFilename || ticket.filename
    const classification = classifyMedia({
      mimeType: ticket.mimeType,
      filename: actualFilename,
      signature: await readSanityAssetSignature(asset, cdnBaseUrl),
    })
    if (classification.mimeType !== asset.mimeType) {
      throw new Error('Sanity asset MIME type does not match its uploaded content.')
    }
    if (asset.size > (maxSizeFor(asset.mimeType, actualFilename) ?? transport.maxSizeBytes)) {
      throw new Error('Sanity asset exceeds the configured media size limit.')
    }

    const patch = await finalizeSanityUpload({
      asset,
      cdnBaseUrl,
      client,
      collection,
      data: doc as unknown as Parameters<typeof finalizeSanityUpload>[0]['data'],
      dedupeUploads,
      file: { filename: ticket.filename, mimeType: asset.mimeType },
      folder,
      folders,
      mediaType: classification.mediaType,
      raw: raw as unknown as JsonObject,
      req,
    })
    const result = JSON.parse(JSON.stringify(patch)) as Record<string, unknown>
    const recordData = {
      id: finalizationId,
      kind: 'finalization' as const,
      nonce: ticket.nonce,
      subject: ticket.subject,
      collection: ticket.collection,
      operation: ticket.operation,
      documentId: String(documentId),
      projectId: ticket.projectId,
      dataset: ticket.dataset,
      audience: ticket.audience,
      filename: ticket.filename,
      mimeType: ticket.mimeType,
      size: ticket.size,
      maxSize: ticket.maxSize,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt,
      assetId: receipt.assetId,
      result,
    }
    try {
      await req.payload.create({
        collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
        data: recordData,
        overrideAccess: true,
        req,
      })
    } catch {
      const racedFinalization = await req.payload
        .findByID({
          collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
          depth: 0,
          id: finalizationId,
          overrideAccess: true,
          req,
        })
        .catch(() => null)
      if (!racedFinalization || !recordMatches(racedFinalization, ticket, documentId)) {
        throw new Error('External upload finalization could not be persisted.')
      }
    }

    const priorSkipCloudStorage = req.context?.skipCloudStorage
    req.context = { ...req.context, skipCloudStorage: true }
    try {
      await req.payload.update({
        collection: collectionSlug as never,
        data: patch,
        depth: 0,
        draft: doc._status === 'draft',
        id: documentId,
        req,
      })
    } finally {
      if (req.context) {
        if (priorSkipCloudStorage === undefined) delete req.context.skipCloudStorage
        else req.context.skipCloudStorage = priorSkipCloudStorage
      }
    }
    return { ...doc, ...patch }
  }
}
