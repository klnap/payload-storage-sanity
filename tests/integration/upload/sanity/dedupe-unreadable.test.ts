import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'
import type { CollectionConfig } from 'payload'
import { findMediaByContentHash } from '@/features/media/lifecycle/dedupe'
import { createSanityAdapter } from '@/features/media/storage-adapter'
import { mockPayloadReq } from '../../../helpers/mockPayloadReq'

const collection = { slug: 'media', fields: [] } as CollectionConfig
const creds = { projectId: 'p', dataset: 'd', token: 't', apiVersion: '2024-01-01' }
const ASSET = 'image-f91b77612953a5e5b5bf9de08c016b9c6844ee0e-800x600-jpg'
const uploaded = {
  _id: ASSET,
  _type: 'sanity.imageAsset',
  _rev: 'rev-1',
  _createdAt: '2020-01-01T00:00:00Z',
  _updatedAt: '2020-01-02T00:00:00Z',
  assetId: 'f91b77612953a5e5b5bf9de08c016b9c6844ee0e',
  extension: 'jpg',
  mimeType: 'image/jpeg',
  path: 'images/p/d/f91b-800x600.jpg',
  sha1hash: 'f91b77612953a5e5b5bf9de08c016b9c6844ee0e',
  size: 1000,
  url: 'https://cdn.sanity.io/images/p/d/f91b-800x600.jpg',
  metadata: { dimensions: { width: 800, height: 600, aspectRatio: 1.33 } },
}

describe('requester-scoped duplicate detection', () => {
  test('content-hash lookup applies the requester access even without a user', async () => {
    const flags: Array<boolean | undefined> = []
    const req = {
      payload: {
        find: mock(async (args: { overrideAccess?: boolean }) => {
          flags.push(args.overrideAccess)
          return { docs: [] }
        }),
      },
    } as never
    await findMediaByContentHash(req, 'media', 'f91b77612953a5e5b5bf9de08c016b9c6844ee0e')
    expect(flags.length).toBeGreaterThan(0)
    expect(flags.every((flag) => flag === false)).toBe(true)
  })

  test('an unreadable match with dedupe on is treated as no match: no conflict, the upload completes', async () => {
    const upload = mock(async () => uploaded)
    const client = {
      assets: { upload },
      fetch: mock(async () => uploaded),
      mutate: mock(async () => ({})),
      getDocument: mock(async () => uploaded),
    } as unknown as SanityClient
    // Existence probe (privileged) finds a row; the readability check (requester access) does not.
    const find = mock(async (args: { overrideAccess?: boolean }) =>
      args.overrideAccess === false ? { docs: [] } : { docs: [{ id: 'hidden-row' }] }
    )
    const adapter = createSanityAdapter({
      client,
      ...creds,
      dedupeUploads: true,
    } as never)({ collection })

    const result = await adapter.handleUpload({
      data: {},
      file: {
        buffer: Buffer.from('img'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
      collection,
      req: mockPayloadReq({ payload: { find, db: mockPayloadReq().payload.db } as never }),
    } as never)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ sanity: { asset: { _id: ASSET } } })
  })
})
