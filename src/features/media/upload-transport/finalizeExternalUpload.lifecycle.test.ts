import { describe, expect, mock, test } from 'bun:test'
import type { CollectionAfterChangeHook } from 'payload'
import type { SanityAsset } from '@/sanity/assets'
import type { UploadTransport } from '@/core/config'
import { createSanityExternalUploadAfterChangeHook } from './finalizeExternalUpload'
import {
  SANITY_UPLOAD_CLAIM_PATH,
  signSanityUploadReceipt,
  signSanityUploadTicket,
} from './protocol'
import {
  SANITY_UPLOAD_FINALIZATION_SUFFIX,
  SANITY_UPLOAD_SESSION_COLLECTION,
} from './sessionCollection'

const transport: UploadTransport = {
  endpoint: 'https://uploads.example.test/v1/upload',
  maxSizeBytes: 10_000,
  protocolVersion: 1,
  secret: 'a test secret with at least thirty-two bytes',
}

const asset: SanityAsset = {
  _id: 'file-asset-id',
  _type: 'sanity.fileAsset',
  _createdAt: '2026-01-01T00:00:00Z',
  _updatedAt: '2026-01-01T00:00:00Z',
  _rev: 'revision',
  assetId: 'asset-id',
  extension: 'pdf',
  mimeType: 'application/pdf',
  originalFilename: 'report.pdf',
  path: 'file-id-report-pdf',
  sha1hash: 'hash',
  size: 256,
  url: 'https://cdn.sanity.io/files/project/production/file-id-report-pdf',
}

async function makeContext() {
  const issuedAt = Date.now()
  const claims = {
    audience: transport.endpoint,
    claimEndpoint: `https://payload.example.test/api${SANITY_UPLOAD_CLAIM_PATH}`,
    collection: 'media',
    dataset: 'production',
    expiresAt: issuedAt + 60_000,
    filename: 'report.pdf',
    issuedAt,
    maxSize: 10_000,
    mimeType: 'application/pdf',
    nonce: 'nonce-1',
    operation: 'create' as const,
    projectId: 'project',
    size: asset.size,
    subject: 'users:user-1',
    version: 1 as const,
  }
  const ticket = await signSanityUploadTicket(claims, transport.secret)
  const receipt = await signSanityUploadReceipt(
    {
      assetId: asset._id,
      audience: claims.audience,
      dataset: claims.dataset,
      filename: claims.filename,
      issuedAt,
      mimeType: claims.mimeType,
      nonce: claims.nonce,
      projectId: claims.projectId,
      size: claims.size,
      version: 1,
    },
    transport.secret
  )
  return { sanityUpload: { protocolVersion: 1, receipt: receipt.token, ticket: ticket.token } }
}

describe('external upload finalization lifecycle', () => {
  test('verifies the durable claim and persists the shared Sanity finalization', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(
      async () =>
        new Response(new TextEncoder().encode('%PDF-1.7\n'), {
          status: 206,
          headers: { 'Content-Range': 'bytes 0-7/256' },
        })
    ) as typeof fetch
    const context = await makeContext()
    const calls: string[] = []
    const claim = {
      id: 'nonce-1',
      kind: 'claim',
      nonce: 'nonce-1',
      subject: 'users:user-1',
      collection: 'media',
      operation: 'create',
      projectId: 'project',
      dataset: 'production',
      size: asset.size,
      maxSize: transport.maxSizeBytes,
    }
    const findByID = mock(async ({ id }: { id: string }) => {
      if (id === 'nonce-1') return claim
      throw new Error('Not found')
    })
    const create = mock(async ({ data }: { data: { id: string } }) => {
      calls.push(`create:${data.id}`)
      return data
    })
    const update = mock(async ({ data }: { data: object }) => {
      calls.push('update')
      return { ...doc, ...data }
    })
    const doc = { id: 'media-1', filename: 'report.pdf' }
    const req = {
      context: { payloadClientUploadContext: context },
      transactionID: 'transaction-1',
      user: { id: 'user-1', collection: 'users' },
      payload: {
        collections: {
          media: {
            config: {
              access: {},
              upload: { adapter: 'sanity' },
            },
          },
        },
        create,
        find: mock(async () => ({ docs: [] })),
        findByID,
        update,
      },
    }
    const hook = createSanityExternalUploadAfterChangeHook({
      client: { getDocument: mock(async () => asset) } as never,
      dataset: 'production',
      dedupeUploads: false,
      folders: false,
      maxSizeFor: () => 10_000,
      projectId: 'project',
      transport,
    })

    let result: unknown
    try {
      result = await (hook as CollectionAfterChangeHook)({
        collection: { slug: 'media' },
        doc,
        operation: 'create',
        req,
      } as never)
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(result).toMatchObject({ id: 'media-1', sanity: { asset: { _id: asset._id } } })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: SANITY_UPLOAD_SESSION_COLLECTION,
        id: 'nonce-1',
      })
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: `nonce-1${SANITY_UPLOAD_FINALIZATION_SUFFIX}`,
          assetId: asset._id,
          kind: 'finalization',
        }),
      })
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([`create:nonce-1${SANITY_UPLOAD_FINALIZATION_SUFFIX}`, 'update'])
  })

  test('requires an active transaction before finalization writes', async () => {
    const context = await makeContext()
    const findByID = mock(async ({ id }: { id: string }) => {
      if (id === 'nonce-1') {
        return {
          id: 'nonce-1',
          kind: 'claim',
          subject: 'users:user-1',
          collection: 'media',
          operation: 'create',
          projectId: 'project',
          dataset: 'production',
          size: asset.size,
          maxSize: transport.maxSizeBytes,
        }
      }
      throw new Error('Not found')
    })
    const hook = createSanityExternalUploadAfterChangeHook({
      client: { getDocument: mock(async () => asset) } as never,
      dataset: 'production',
      dedupeUploads: false,
      folders: false,
      maxSizeFor: () => 10_000,
      projectId: 'project',
      transport,
    })

    await expect(
      (hook as CollectionAfterChangeHook)({
        collection: { slug: 'media' },
        doc: { id: 'media-1' },
        operation: 'create',
        req: {
          context: { payloadClientUploadContext: context },
          user: { id: 'user-1', collection: 'users' },
          payload: {
            collections: {
              media: {
                config: {
                  access: {},
                  upload: { adapter: 'sanity' },
                },
              },
            },
            findByID,
          },
        },
      } as never)
    ).rejects.toThrow('External upload finalization requires an active Payload transaction.')
  })
})
