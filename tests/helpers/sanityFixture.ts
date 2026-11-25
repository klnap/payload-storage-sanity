import { createHash } from 'node:crypto'

import type { sanityStorage } from '../../src/plugin'

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
)

export function pngVariant(byteIndex: number): Buffer {
  const variant = Buffer.from(png)
  variant[byteIndex] = (variant[byteIndex] ?? 0) ^ 1
  return variant
}

type FixtureAsset = {
  _id: string
  _type: 'sanity.imageAsset'
  _rev: string
  _createdAt: string
  _updatedAt: string
  assetId: string
  extension: 'png'
  mimeType: 'image/png'
  path: string
  sha1hash: string
  size: number
  url: string
  metadata: {
    dimensions: {
      _type: 'sanity.imageDimensions'
      width: number
      height: number
      aspectRatio: number
    }
  }
}

export type SanityFixture = {
  assets: Map<string, FixtureAsset>
  /** Uploaded bytes by SHA-1, served back from the CDN URL. */
  bytes: Map<string, Buffer>
  deleteAttempts: string[]
  failNextMutation: boolean
  failNextUploadAfterStore: boolean
  failNextUploadBeforeStore: boolean
}

async function requestBodyBuffer(body: BodyInit | null | undefined): Promise<Buffer> {
  if (body == null) return Buffer.alloc(0)
  if (typeof body === 'string') return Buffer.from(body)
  if (Buffer.isBuffer(body)) return body
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  }
  if (body instanceof ReadableStream) {
    return Buffer.from(await new Response(body).arrayBuffer())
  }
  if (typeof body === 'object' && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }
  throw new TypeError(`Unsupported Sanity fixture request body: ${typeof body}`)
}

export function createSanityFixture(): SanityFixture & {
  resolveFetch: NonNullable<Parameters<typeof sanityStorage>[0]['resolveFetch']>
} {
  const fixture: SanityFixture = {
    assets: new Map(),
    bytes: new Map(),
    deleteAttempts: [],
    failNextMutation: false,
    failNextUploadAfterStore: false,
    failNextUploadBeforeStore: false,
  }

  const resolveFetch: NonNullable<Parameters<typeof sanityStorage>[0]['resolveFetch']> =
    () => async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))

      if (url.hostname === 'cdn.sanity.io') {
        const hash = /([a-f0-9]{40})/.exec(url.pathname)?.[1]
        const stored = hash ? fixture.bytes.get(hash) : undefined
        if (!stored) return new Response(null, { status: 404 })
        return new Response(new Uint8Array(stored), { headers: { 'content-type': 'image/png' } })
      }

      if (url.pathname.includes('/assets/images/production')) {
        if (fixture.failNextUploadBeforeStore) {
          fixture.failNextUploadBeforeStore = false
          return Response.json(
            { message: 'fixture upload failed before storing bytes' },
            { status: 400 }
          )
        }

        const inputRequest = input instanceof Request ? input.clone() : undefined
        const body = init?.body ?? inputRequest?.body
        const bytes = await requestBodyBuffer(body)
        const hash = createHash('sha1').update(bytes).digest('hex')
        const existingAsset = fixture.assets.get(hash)
        const { width, height } = pngDimensions(bytes)
        const filename = `${hash}-${width}x${height}.png`
        const asset: FixtureAsset = existingAsset ?? {
          _id: `image-${hash}-${width}x${height}-png`,
          _type: 'sanity.imageAsset',
          _rev: 'fixture-rev-1',
          _createdAt: new Date(0).toISOString(),
          _updatedAt: new Date(0).toISOString(),
          assetId: hash.slice(0, 12),
          extension: 'png',
          mimeType: 'image/png',
          path: `images/demo/production/${filename}`,
          sha1hash: hash,
          size: bytes.length,
          url: `https://cdn.sanity.io/images/demo/production/${filename}`,
          metadata: {
            dimensions: {
              _type: 'sanity.imageDimensions',
              width,
              height,
              aspectRatio: width / height,
            },
          },
        }
        if (!existingAsset) fixture.assets.set(hash, asset)
        if (!fixture.bytes.has(hash)) fixture.bytes.set(hash, bytes)

        if (fixture.failNextUploadAfterStore) {
          fixture.failNextUploadAfterStore = false
          return Response.json(
            { message: 'fixture response lost after asset creation' },
            { status: 400 }
          )
        }

        return Response.json({ document: asset })
      }

      if (url.pathname.includes('/data/query/production')) {
        return Response.json({ result: null })
      }

      if (url.pathname.includes('/data/mutate/production')) {
        if (fixture.failNextMutation) {
          fixture.failNextMutation = false
          return Response.json({ message: 'fixture folder mutation failed' }, { status: 400 })
        }
        const inputRequest = input instanceof Request ? input.clone() : undefined
        const body = init?.body ?? inputRequest?.body
        const text = (await requestBodyBuffer(body)).toString('utf8')
        const bodyValue = JSON.parse(text || '{}') as {
          mutations?: Array<{ delete?: string | { id?: string } }>
        }
        const mutations = bodyValue.mutations ?? []
        for (const mutation of mutations) {
          const id = typeof mutation.delete === 'string' ? mutation.delete : mutation.delete?.id
          if (id) {
            fixture.deleteAttempts.push(id)
            for (const [hash, asset] of fixture.assets) {
              if (asset._id === id) fixture.assets.delete(hash)
            }
          }
        }
        return Response.json({ transactionId: 'stateful-fixture-transaction', results: [] })
      }

      return Response.json(
        { message: `Unexpected fixture route: ${url.pathname}` },
        { status: 404 }
      )
    }

  return Object.assign(fixture, { resolveFetch })
}

/** Reads width and height from a PNG IHDR chunk; falls back to 1x1 for non-PNG bytes. */
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length >= 24 && bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  return { width: 1, height: 1 }
}

export function uploadFile(data: Buffer, name: string) {
  return { data, mimetype: 'image/png', name, size: data.length }
}
