import { describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SanityClient } from '@sanity/client'
import type { CollectionConfig } from 'payload'

import { createSanityAdapter } from '../../../src/adapter/createAdapter.js'

const collection = { slug: 'media', fields: [] } as CollectionConfig

const hydratedAsset = {
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

describe('upload lifecycle integration', () => {
  test('streams from disk when buffer is empty and persists metadata on media patch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanity-upload-'))
    const filePath = join(dir, 'photo.png')
    writeFileSync(filePath, 'png-bytes')

    const upload = mock(async (_type: string, body: unknown, options: { contentType: string }) => {
      expect(options.contentType).toBe('image/png')
      expect(body).not.toBeInstanceOf(Buffer)
      return hydratedAsset
    })

    const fetchMock = mock(async () => hydratedAsset)
    const client = {
      projectId: 'demo',
      dataset: 'production',
      assets: { upload },
      fetch: fetchMock,
    } as unknown as SanityClient

    const adapter = createSanityAdapter({ client })({ collection })
    const result = await adapter.handleUpload({
      data: { title: 'Disk upload' },
      file: {
        buffer: Buffer.alloc(0),
        tempFilePath: filePath,
        filename: 'photo.png',
        mimeType: 'application/octet-stream',
        filesize: 9,
      },
    } as never)

    expect(upload).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      title: 'Disk upload',
      sanity_id: hydratedAsset._id,
      url: hydratedAsset.url,
      width: 800,
      height: 600,
      size: 1000,
      sync: { status: 'available' },
    })
  })

  test('skips hydration fetch when upload response already includes revision and metadata', async () => {
    const upload = mock(async () => hydratedAsset)
    const fetchMock = mock(async () => hydratedAsset)
    const client = {
      assets: { upload },
      fetch: fetchMock,
    } as unknown as SanityClient

    const adapter = createSanityAdapter({ client })({ collection })
    await adapter.handleUpload({
      data: {},
      file: {
        buffer: Buffer.from('jpg'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
    } as never)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('hydrates asset when upload response is incomplete', async () => {
    const sparseUpload = {
      _id: hydratedAsset._id,
      _type: hydratedAsset._type,
      _rev: '',
      assetId: hydratedAsset.assetId,
      url: hydratedAsset.url,
      mimeType: hydratedAsset.mimeType,
    }

    const upload = mock(async () => sparseUpload)
    const fetchMock = mock(async () => hydratedAsset)
    const client = {
      assets: { upload },
      fetch: fetchMock,
    } as unknown as SanityClient

    const adapter = createSanityAdapter({ client })({ collection })
    const result = await adapter.handleUpload({
      data: {},
      file: {
        buffer: Buffer.from('jpg'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
    } as never)

    expect(fetchMock).toHaveBeenCalled()
    expect(result?.width).toBe(800)
  })

  test('generateURL returns empty string for unavailable sync status', () => {
    const client = { projectId: 'demo', dataset: 'production' } as unknown as SanityClient
    const adapter = createSanityAdapter({ client })({ collection })

    const url = adapter.generateURL?.({
      collection,
      data: { sanity_id: 'image-a-jpg', sync: { status: 'deleted' } },
      filename: 'a.jpg',
    } as never)

    expect(url).toBe('')
  })
})
