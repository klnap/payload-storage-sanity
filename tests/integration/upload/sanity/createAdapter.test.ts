import { describe, expect, mock, test } from 'bun:test'
import { createServer } from 'node:http'
import type { SanityClient } from '@sanity/client'
import { createClient } from '@sanity/client'
import type { CollectionConfig } from 'payload'
import { collectTopLevelFieldNames } from '@/features/media/fields'
import { createSanityAdapter } from '@/features/media/storage-adapter'
import { fakeTransaction } from '../../../helpers/fakeTransaction'
import { mockPayloadReq } from '../../../helpers/mockPayloadReq'

const collection = { slug: 'media', fields: [] } as CollectionConfig

const sanityCreds = {
  projectId: 'demo',
  dataset: 'production',
  token: 'token',
}

const sampleUpload = {
  _id: 'image-abc123-800x600-jpg',
  _type: 'sanity.imageAsset',
  _rev: 'rev-1',
  _createdAt: '2020-01-01T00:00:00Z',
  _updatedAt: '2020-01-02T00:00:00Z',
  assetId: 'abc123',
  extension: 'jpg',
  mimeType: 'image/jpeg',
  path: 'images/demo/production/abc123-800x600.jpg',
  sha1hash: 'abc123',
  size: 1000,
  url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
  metadata: {
    dimensions: { width: 800, height: 600, aspectRatio: 1.33 },
  },
}

function mockClient(overrides: Record<string, unknown> = {}): SanityClient {
  return {
    projectId: 'demo',
    dataset: 'production',
    mutate: mock(async () => ({})),
    ...overrides,
  } as unknown as SanityClient
}

describe('createSanityAdapter', () => {
  test('uploads through the Sanity SDK HTTP transport', async () => {
    const requests: Array<{ method: string; path: string; authorization?: string }> = []
    const server = createServer((request, response) => {
      requests.push({
        method: request.method ?? '',
        path: request.url ?? '',
        authorization: request.headers.authorization,
      })
      request.resume()

      if (request.url?.includes('/assets/images/production')) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ document: { ...sampleUpload, metadata: undefined } }))
        return
      }

      if (request.url?.includes('/data/query/production')) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ result: sampleUpload }))
        return
      }

      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ transactionId: 'qualification-transaction' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address == null || typeof address === 'string')
        throw new Error('HTTP server did not bind')

      const token = 'qualification-local-token'
      const client = createClient({
        projectId: 'demo',
        dataset: 'production',
        token,
        apiVersion: '2026-01-01',
        useCdn: false,
        apiHost: `http://127.0.0.1:${address.port}`,
        useProjectHostname: false,
        maxRetries: 0,
      })
      const adapter = createSanityAdapter({
        client,
        projectId: 'demo',
        dataset: 'production',
        token,
      })({ collection })

      const result = await adapter.handleUpload({
        data: {},
        file: {
          buffer: Buffer.from('local-test-image'),
          filename: 'local-test.jpg',
          mimeType: 'image/jpeg',
          filesize: 16,
        },
        req: mockPayloadReq(),
      } as never)

      expect(result.sanity).toMatchObject({ asset: { _id: sampleUpload._id } })
      expect(requests.map(({ method }) => method)).toEqual(['POST', 'GET', 'POST'])
      expect(requests[0]).toMatchObject({
        path: expect.stringContaining('/assets/images/production'),
        authorization: `Bearer ${token}`,
      })
      expect(requests[1]).toMatchObject({
        path: expect.stringContaining('/data/query/production'),
        authorization: `Bearer ${token}`,
      })
      expect(requests[2]).toMatchObject({
        path: expect.stringContaining('/data/mutate/production'),
        authorization: `Bearer ${token}`,
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  test('surfaces real SDK upload failures without persisting a Payload result', async () => {
    const statuses = [400, 401, 403, 404, 409, 429, 500, 503]
    let status = statuses[0]
    let requests = 0
    const server = createServer((request, response) => {
      requests += 1
      request.resume()
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ message: 'simulated upstream failure' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address == null || typeof address === 'string')
        throw new Error('HTTP server did not bind')

      for (const failureStatus of statuses) {
        status = failureStatus
        const client = createClient({
          projectId: 'demo',
          dataset: 'production',
          token: 'qualification-local-token',
          apiVersion: '2026-01-01',
          useCdn: false,
          apiHost: `http://127.0.0.1:${address.port}`,
          useProjectHostname: false,
          maxRetries: 0,
        })
        const adapter = createSanityAdapter({
          client,
          projectId: 'demo',
          dataset: 'production',
          token: 'qualification-local-token',
        })({ collection })
        const previousRequests = requests

        await expect(
          adapter.handleUpload({
            data: {},
            file: {
              buffer: Buffer.from('local-test-file'),
              filename: 'local-test.pdf',
              mimeType: 'application/pdf',
              filesize: 15,
            },
            req: mockPayloadReq(),
          } as never)
        ).rejects.toBeDefined()

        expect(requests - previousRequests).toBe(1)
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  test('does not retry a non-idempotent SDK upload after a 503', async () => {
    let requests = 0
    const server = createServer((request, response) => {
      requests += 1
      request.resume()
      response.writeHead(503, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ message: 'simulated upstream unavailable' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address == null || typeof address === 'string')
        throw new Error('HTTP server did not bind')

      const client = createClient({
        projectId: 'demo',
        dataset: 'production',
        token: 'qualification-local-token',
        apiVersion: '2026-01-01',
        useCdn: false,
        apiHost: `http://127.0.0.1:${address.port}`,
        useProjectHostname: false,
        maxRetries: 5,
        retryDelay: () => 0,
      })
      const adapter = createSanityAdapter({
        client,
        projectId: 'demo',
        dataset: 'production',
        token: 'qualification-local-token',
      })({ collection })

      await expect(
        adapter.handleUpload({
          data: {},
          file: {
            buffer: Buffer.from('local-test-file'),
            filename: 'local-test.pdf',
            mimeType: 'application/pdf',
            filesize: 15,
          },
          req: mockPayloadReq(),
        } as never)
      ).rejects.toBeDefined()

      expect(requests).toBe(1)
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  test('injects Sanity media fields (sidebar + sanity group)', () => {
    const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })

    expect(adapter.name).toBe('sanity')
    const names = collectTopLevelFieldNames(adapter.fields ?? [])
    expect(names).toEqual(['sync', 'sanity'])
  })

  test('handleUpload maps Sanity asset to media document', async () => {
    const upload = mock(async () => sampleUpload)
    const mutate = mock(async () => ({}))
    const fetchMock = mock(async () => sampleUpload)
    const client = mockClient({
      assets: { upload },
      fetch: fetchMock,
      mutate,
    })

    const adapter = createSanityAdapter({ client, ...sanityCreds })({ collection })
    const result = await adapter.handleUpload({
      data: { title: 'keep' },
      file: {
        buffer: Buffer.from('img'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
      req: mockPayloadReq(),
    } as never)

    expect(upload).toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith([
      { createIfNotExists: { _id: expect.any(String), _type: 'media.folder', name: 'Payload' } },
      {
        createIfNotExists: {
          _id: expect.any(String),
          _type: 'media.folder',
          name: 'images',
          parent: { _ref: expect.any(String), _type: 'reference', _weak: true },
        },
      },
      {
        patch: expect.objectContaining({
          id: sampleUpload._id,
          setIfMissing: expect.objectContaining({
            'opt.media.folder': {
              _ref: expect.any(String),
              _type: 'reference',
              _weak: true,
            },
          }),
        }),
      },
    ])
    expect(result.filename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    expect(result).toMatchObject({
      title: 'keep',
      sanity: {
        asset: {
          _id: sampleUpload._id,
          _type: 'sanity.imageAsset',
          _rev: 'rev-1',
          assetId: 'abc123',
          path: sampleUpload.path,
          url: sampleUpload.url,
          size: 1000,
        },
      },
      sync: {
        status: 'available',
      },
    })
  })

  test('handleUpload takes the asset lock on its transaction before the Sanity upload', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)
    const upload = mock(async () => {
      log.push('sanity-upload')
      return sampleUpload
    })
    const client = mockClient({ assets: { upload }, fetch: mock(async () => sampleUpload) })

    const adapter = createSanityAdapter({ client, ...sanityCreds })({ collection })
    await adapter.handleUpload({
      data: {},
      file: {
        buffer: Buffer.from('abc'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
      req: mockPayloadReq({ transactionID: tx.transactionID, payload: { db: tx.db } as never }),
    } as never)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(log).toEqual([
      'show transaction_isolation',
      expect.stringContaining('pg_advisory_xact_lock(hashtext'),
      'sanity-upload',
    ])
  })

  test('handleUpload uploads non-image file as sanity.fileAsset', async () => {
    const mutate = mock(async () => ({}))
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
      mutate,
    })

    const adapter = createSanityAdapter({ client, ...sanityCreds })({ collection })
    const result = await adapter.handleUpload({
      data: { name: 'annual-report' },
      file: {
        buffer: Buffer.from('pdf-binary'),
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        filesize: 10,
      },
      req: mockPayloadReq(),
    } as never)

    expect(upload).toHaveBeenCalled()
    expect(mutate).toHaveBeenCalledWith([
      { createIfNotExists: { _id: expect.any(String), _type: 'media.folder', name: 'Payload' } },
      {
        createIfNotExists: {
          _id: expect.any(String),
          _type: 'media.folder',
          name: 'files',
          parent: { _ref: expect.any(String), _type: 'reference', _weak: true },
        },
      },
      {
        patch: expect.objectContaining({
          id: sampleFileAsset._id,
          setIfMissing: expect.objectContaining({
            'opt.media.folder': {
              _ref: expect.any(String),
              _type: 'reference',
              _weak: true,
            },
          }),
        }),
      },
    ])
    expect(result).toMatchObject({
      sanity: {
        asset: {
          _id: 'file-pdf123-pdf',
          _type: 'sanity.fileAsset',
          extension: 'pdf',
          mimeType: 'application/pdf',
          size: 5000,
          url: sampleFileAsset.url,
        },
      },
      sync: {
        status: 'available',
      },
    })
  })

  test('replacement uploads use the configured folder path', async () => {
    const mutate = mock(async () => ({}))
    const client = mockClient({ assets: { upload: mock(async () => sampleUpload) }, mutate })
    const adapter = createSanityAdapter({
      client,
      ...sanityCreds,
      folder: '/Marketing/Photos',
    })({ collection })

    const result = await adapter.handleUpload({
      data: { id: 'existing-media', sanity: { asset: { _id: 'image-old' } } },
      file: {
        buffer: Buffer.from('img'),
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        filesize: 3,
      },
      req: mockPayloadReq(),
    } as never)

    expect(result.filename).toBe('existing-media')
    expect(mutate).toHaveBeenCalledWith([
      { createIfNotExists: expect.objectContaining({ name: 'Marketing' }) },
      { createIfNotExists: expect.objectContaining({ name: 'Photos' }) },
      { patch: expect.objectContaining({ id: sampleUpload._id }) },
    ])
  })

  test('registers an uploaded asset before fallible folder assignment', async () => {
    const req = mockPayloadReq()
    const client = mockClient({
      assets: { upload: mock(async () => sampleUpload) },
      mutate: mock(async () => {
        throw new Error('folder assignment failed')
      }),
    })
    const adapter = createSanityAdapter({ client, ...sanityCreds })({ collection })

    await expect(
      adapter.handleUpload({
        collection: undefined,
        data: {},
        file: {
          buffer: Buffer.from('img'),
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          filesize: 3,
        },
        req,
      } as never)
    ).rejects.toThrow()
  })

  test('handleDelete retains the Sanity asset', async () => {
    const deleted: string[] = []
    const client = mockClient({
      delete: async (id: string) => {
        deleted.push(id)
      },
    })

    const adapter = createSanityAdapter({ client, ...sanityCreds })({ collection })
    await adapter.handleDelete({
      doc: { sanity: { asset: { _id: 'image-abc123-800x600-jpg' } } } as never,
    } as never)

    expect(deleted).toEqual([])
  })

  test('generateURL uses sanity.path and cdnBaseUrl', () => {
    const adapter = createSanityAdapter({
      client: mockClient(),
      cdnBaseUrl: 'https://cdn.example.com',
      ...sanityCreds,
    })({ collection })

    const url = adapter.generateURL?.({
      collection,
      data: {
        sync: { status: 'available' },
        sanity: {
          asset: {
            _id: 'image-abc123-800x600-jpg',
            path: 'images/demo/production/abc123-800x600.jpg',
          },
        },
      },
      filename: 'abc123-800x600.jpg',
    } as never)

    expect(url).toBe('https://cdn.example.com/images/demo/production/abc123-800x600.jpg')
  })

  // Classification: documented contract — staticHandler must not proxy non-allowlisted hosts.
  test('staticHandler returns 404 when upstream CDN asset is missing', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: {
            sync: { status: 'available' },
            sanity: {
              asset: {
                path: 'images/demo/production/abc123-800x600.jpg',
                url: 'https://cdn.sanity.io/images/demo/production/abc123-800x600.jpg',
              },
            },
          },
          headers: new Headers(),
          params: { filename: 'abc123-800x600.jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(404)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler isolates active SVG content on the Payload origin', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      })) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: {
            sync: { status: 'available' },
            sanity: {
              asset: {
                path: 'images/demo/production/active.svg',
              },
            },
          },
          headers: new Headers(),
          params: { filename: 'active.svg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(200)
      expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response?.headers.get('Content-Disposition')).toBe('attachment')
      expect(response?.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler does not fetch non-allowlisted sanity.url on the document', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response(null, { status: 200 })
    }) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: {
            sync: { status: 'available' },
            sanity: {
              asset: {
                url: 'https://evil.example.com/asset.jpg',
              },
            },
          },
          headers: new Headers(),
          params: { filename: 'file.jpg', collection: 'media' },
        } as never
      )

      expect(fetchCalled).toBe(false)
      expect(response?.status).toBe(404)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler does not fetch non-allowlisted http filename URLs', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response(null, { status: 200 })
    }) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          headers: new Headers(),
          params: {
            filename: 'https://evil.example.com/steal',
            collection: 'media',
          },
        } as never
      )

      expect(fetchCalled).toBe(false)
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
        cdnBaseUrl: 'https://cdn.example.com',
        ...sanityCreds,
      })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: {
            sync: { status: 'available' },
            sanity: {
              asset: {
                path: 'images/demo/production/abc123-800x600.jpg',
              },
            },
          },
          headers: new Headers(),
          params: { filename: 'abc123-800x600.jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(502)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler never fetches an arbitrary cdn.sanity.io URL passed as filename', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response(null, { status: 200 })
    }) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          headers: new Headers(),
          params: {
            filename: 'https://cdn.sanity.io/images/demo/production/other-800x600.jpg',
            collection: 'media',
          },
        } as never
      )

      expect(fetchCalled).toBe(false)
      expect(response?.status).toBe(404)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler rejects an upstream body whose Content-Length exceeds the proxy cap', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 200,
        headers: { 'Content-Length': String(51 * 1024 * 1024) },
      })) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: { sync: { status: 'available' }, sanity: { asset: { path: 'images/x.jpg' } } },
          headers: new Headers(),
          params: { filename: 'x.jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(413)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('staticHandler aborts the upstream read once the streamed body passes the proxy cap', async () => {
    const originalFetch = globalThis.fetch
    const chunkBytes = 1024 * 1024
    let pulled = 0
    let cancelled = false
    const upstreamBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled > 200) {
          controller.close()
          return
        }
        controller.enqueue(new Uint8Array(chunkBytes))
      },
      cancel() {
        cancelled = true
      },
    })
    globalThis.fetch = (async () =>
      new Response(upstreamBody, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })) as never

    try {
      const adapter = createSanityAdapter({ client: mockClient(), ...sanityCreds })({ collection })
      const response = await adapter.staticHandler?.(
        {} as never,
        {
          doc: { sync: { status: 'available' }, sanity: { asset: { path: 'images/x.jpg' } } },
          headers: new Headers(),
          params: { filename: 'x.jpg', collection: 'media' },
        } as never
      )

      expect(response?.status).toBe(200)
      await expect(response?.arrayBuffer()).rejects.toThrow()
      expect(cancelled).toBe(true)
      // 50 MiB cap plus a few chunks already queued by the stream; far from the full 200 MiB.
      expect(pulled).toBeLessThan(60)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
