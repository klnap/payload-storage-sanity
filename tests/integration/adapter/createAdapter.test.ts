import { describe, expect, mock, test } from 'bun:test'
import type { SanityClient } from '@sanity/client'
import type { CollectionConfig } from 'payload'

import { createSanityAdapter } from '../../../src/adapter/createAdapter.js'
import { collectTopLevelFieldNames } from '../../../src/fields/mediaFields.js'

const collection = { slug: 'media', fields: [] } as CollectionConfig

const sampleUpload = {
  _id: 'image-abc123-800x600-jpg',
  _type: 'sanity.imageAsset',
  _rev: 'rev-1',
  _createdAt: '2020-01-01T00:00:00Z',
  _updatedAt: '2020-01-02T00:00:00Z',
  assetId: 'abc123',
  extension: 'jpg',
  mimeType: 'image/jpeg',
  path: 'images/demo/production/abc.jpg',
  sha1hash: 'abc123',
  size: 1000,
  url: 'https://cdn.sanity.io/images/demo/production/abc.jpg',
  metadata: {
    dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
  },
}

function mockClient(overrides: Record<string, unknown> = {}): SanityClient {
  return {
    projectId: 'demo',
    dataset: 'production',
    ...overrides,
  } as unknown as SanityClient
}

describe('createSanityAdapter', () => {
  test('injects Sanity media fields (sync sidebar + hidden storage)', () => {
    const adapter = createSanityAdapter({ client: mockClient() })({ collection })

    expect(adapter.name).toBe('sanity')
    const names = collectTopLevelFieldNames(adapter.fields ?? [])
    expect(names).toEqual([
      'name',
      'originalFilename',
      'sync',
      'sanity_id',
      '_type',
      '_rev',
      'sanity_createdAt',
      'sanity_updatedAt',
      'assetId',
      'path',
      'extension',
      'sha1hash',
      'size',
      'metadata',
    ])
  })

  test('handleUpload maps Sanity asset to media document', async () => {
    const upload = mock(async () => sampleUpload)
    const fetchMock = mock(async () => sampleUpload)
    const client = mockClient({
      assets: { upload },
      fetch: fetchMock,
    })

    const adapter = createSanityAdapter({ client })({ collection })
    const result = await adapter.handleUpload({
      data: { title: 'keep' },
      file: {
        buffer: Buffer.from('img'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
    } as never)

    expect(upload).toHaveBeenCalled()
    expect(result).toMatchObject({
      title: 'keep',
      sanity_id: sampleUpload._id,
      _type: 'sanity.imageAsset',
      _rev: 'rev-1',
      sanity_createdAt: '2020-01-01T00:00:00Z',
      sanity_updatedAt: '2020-01-02T00:00:00Z',
      assetId: 'abc123',
      url: sampleUpload.url,
      width: 800,
      height: 600,
      size: 1000,
      sync: {
        status: 'available',
      },
    })
  })

  test('handleUpload uploads non-image file as sanity.fileAsset', async () => {
    const sampleFileAsset = {
      _id: 'file-pdf123-pdf',
      _type: 'sanity.fileAsset',
      _rev: 'rev-file-1',
      _createdAt: '2020-01-01T00:00:00Z',
      _updatedAt: '2020-01-02T00:00:00Z',
      assetId: 'pdf123',
      extension: 'pdf',
      mimeType: 'application/pdf',
      path: 'files/demo/production/doc.pdf',
      sha1hash: 'hash123',
      size: 5000,
      url: 'https://cdn.sanity.io/files/demo/production/doc.pdf',
    }

    const upload = mock(async (type: string) => {
      expect(type).toBe('file')
      return sampleFileAsset
    })

    const client = mockClient({
      assets: { upload },
      fetch: mock(async () => sampleFileAsset),
    })

    const adapter = createSanityAdapter({ client })({ collection })
    const result = await adapter.handleUpload({
      data: { name: 'annual-report' },
      file: {
        buffer: Buffer.from('pdf-binary'),
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        filesize: 10,
      },
    } as never)

    expect(upload).toHaveBeenCalled()
    expect(result).toMatchObject({
      sanity_id: 'file-pdf123-pdf',
      _type: 'sanity.fileAsset',
      extension: 'pdf',
      mimeType: 'application/pdf',
      size: 5000,
      url: sampleFileAsset.url,
      sync: {
        status: 'available',
      },
    })
  })

  test('handleDelete is a no-op; retention runs in beforeDelete hook', async () => {
    const deleted: string[] = []
    const client = mockClient({
      delete: async (id: string) => {
        deleted.push(id)
      },
    })

    const adapter = createSanityAdapter({ client })({ collection })
    await adapter.handleDelete({
      doc: { sanity_id: 'image-abc123-800x600-jpg' } as never,
    } as never)

    expect(deleted).toEqual([])
  })

  test('generateURL uses sanity_id', () => {
    const adapter = createSanityAdapter({
      client: mockClient(),
      cdnBaseUrl: 'https://cdn.sanity.io/images/demo/production',
    })({ collection })

    const url = adapter.generateURL?.({
      collection,
      data: { sanity_id: 'image-abc123-800x600-jpg' },
      filename: 'abc.jpg',
    } as never)

    expect(url).toContain('cdn.sanity.io')
    expect(url).toContain('image-abc123-800x600-jpg')
  })

  test('staticHandler returns 404 when upstream CDN asset is missing', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient() })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          headers: new Headers(),
          params: { filename: 'image-abc123-800x600-jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(404)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler returns 502 when upstream fetch fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error('network down')
    }) as never

    try {
      const adapter = createSanityAdapter({
        client: mockClient(),
        cdnBaseUrl: 'https://cdn.sanity.io/images/demo/production',
      })({ collection })
      const response = await adapter.staticHandler?.(
        { doc: { sanity_id: 'image-abc123-800x600-jpg' } } as never,
        {
          headers: new Headers(),
          params: { filename: 'image-abc123-800x600-jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(502)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
