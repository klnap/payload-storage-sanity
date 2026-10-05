import { describe, expect, test } from 'bun:test'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import type { PayloadRequest } from 'payload'

import { wrapSanityAdapterForUploadRollback } from '../../../src/adapter/wrapSanityAdapterForUploadRollback.js'
import { SANITY_UPLOAD_PENDING_ROLLBACK_KEY } from '../../../src/utils/uploadRollback.js'

describe('wrapSanityAdapterForUploadRollback', () => {
  test('registers sanity.id from handleUpload result', async () => {
    const inner: Adapter = () => ({
      name: 'sanity',
      handleDelete: async () => undefined,
      staticHandler: async () => new Response(),
      handleUpload: async () => ({
        sanity: { id: 'image-registered-jpg' },
        filename: 'image-registered-jpg',
      }),
    })

    const wrapped = wrapSanityAdapterForUploadRollback(inner)({
      collection: { slug: 'media', fields: [] },
    })

    const req = { context: {} } as PayloadRequest
    await wrapped.handleUpload({
      clientUploadContext: undefined,
      collection: { slug: 'media', fields: [] },
      data: {},
      file: {
        buffer: Buffer.from('x'),
        filename: 'x.jpg',
        filesize: 1,
        mimeType: 'image/jpeg',
      },
      req,
      storageFilePath: 'media/x.jpg',
    })

    expect(req.context?.[SANITY_UPLOAD_PENDING_ROLLBACK_KEY]).toEqual(['image-registered-jpg'])
  })
})
