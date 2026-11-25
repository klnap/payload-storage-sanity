import { afterAll, describe, expect, it } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig } from 'payload'
import { Client } from 'pg'
import { sanityStorage } from '../../src/plugin'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
)

function pngVariant(byteIndex: number): Buffer {
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
    dimensions: { _type: 'sanity.imageDimensions'; width: 1; height: 1; aspectRatio: 1 }
  }
}

type SanityFixture = {
  assets: Map<string, FixtureAsset>
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

function createSanityFixture(): SanityFixture & {
  resolveFetch: NonNullable<Parameters<typeof sanityStorage>[0]['resolveFetch']>
} {
  const fixture: SanityFixture = {
    assets: new Map(),
    deleteAttempts: [],
    failNextMutation: false,
    failNextUploadAfterStore: false,
    failNextUploadBeforeStore: false,
  }

  const resolveFetch: NonNullable<Parameters<typeof sanityStorage>[0]['resolveFetch']> =
    () => async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))

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
        const filename = `${hash}-1x1.png`
        const asset: FixtureAsset = existingAsset ?? {
          _id: `image-${hash}-1x1-png`,
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
            dimensions: { _type: 'sanity.imageDimensions', width: 1, height: 1, aspectRatio: 1 },
          },
        }
        if (!existingAsset) fixture.assets.set(hash, asset)

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

function uploadFile(data: Buffer, name: string) {
  return { data, mimetype: 'image/png', name, size: data.length }
}

describe.skipIf(!baseUrl)('asset lifecycle with PostgreSQL and stateful Sanity fixture', () => {
  const createdDatabases: string[] = []
  let payload: BasePayload | undefined

  afterAll(async () => {
    await (payload?.db as unknown as { destroy?: () => Promise<void> } | undefined)?.destroy?.()
    await (
      payload?.db as unknown as { pool?: { end: () => Promise<void> } } | undefined
    )?.pool?.end()

    if (createdDatabases.length === 0) return
    const adminUrl = new URL(baseUrl as string)
    adminUrl.pathname = '/postgres'
    const admin = new Client({ connectionString: adminUrl.toString() })
    await admin.connect()
    for (const database of createdDatabases) {
      await admin.query(`drop database if exists "${database}" with (force)`)
    }
    await admin.end()
  })

  it('preserves remote assets through dedupe, replacement, deletion, rollback, and upload failures', async () => {
    const databaseName = `pss_lifecycle_${randomBytes(6).toString('hex')}`
    const adminUrl = new URL(baseUrl as string)
    adminUrl.pathname = '/postgres'
    const admin = new Client({ connectionString: adminUrl.toString() })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()
    createdDatabases.push(databaseName)

    const databaseUrl = new URL(baseUrl as string)
    databaseUrl.pathname = `/${databaseName}`
    const fixture = createSanityFixture()
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'synthetic-fixture-token',
      collections: { media: true, archive: true },
      resolveFetch: fixture.resolveFetch,
    })
    const config = plugin({
      secret: `lifecycle-${randomBytes(8).toString('hex')}`,
      serverURL: 'http://asset-lifecycle.test',
      collections: [
        {
          slug: 'media',
          upload: { disableLocalStorage: true },
          fields: [{ name: 'label', type: 'text' }],
        },
        {
          slug: 'archive',
          upload: { disableLocalStorage: true },
          fields: [{ name: 'label', type: 'text' }],
        },
      ],
      db: postgresAdapter({
        idType: 'uuid',
        pool: { connectionString: databaseUrl.toString() },
        push: true,
      }),
    } as never)

    payload = new BasePayload()
    await payload.init({ config: await buildConfig(config as never) })
    const db = payload.db as unknown as {
      beginTransaction: () => Promise<string | number | null>
      rollbackTransaction: (id: string | number) => Promise<void>
    }

    const original = await payload.create({
      collection: 'media',
      data: { label: 'original' },
      file: uploadFile(png, 'original.png'),
    } as never)
    const shared = await payload.create({
      collection: 'archive',
      data: { label: 'shared' },
      file: uploadFile(png, 'shared.png'),
    } as never)
    const originalAssetId = original.sanity?.asset?._id
    expect(originalAssetId).toMatch(/^image-[a-f0-9]{40}-1x1-png$/)
    expect(shared.sanity?.asset?._id).toBe(originalAssetId)
    expect(original.sanity?.asset?.metadata?.dimensions).toMatchObject({ width: 1, height: 1 })
    expect(fixture.assets.size).toBe(1)

    const replacementBytes = pngVariant(42)
    const replaced = await payload.update({
      collection: 'media',
      id: original.id,
      data: { label: 'replaced' },
      file: uploadFile(replacementBytes, 'replacement.png'),
    } as never)
    const replacementAssetId = replaced.sanity?.asset?._id
    expect(replacementAssetId).not.toBe(originalAssetId)
    expect(fixture.assets.has(createHash('sha1').update(png).digest('hex'))).toBe(true)
    expect(fixture.assets.has(createHash('sha1').update(replacementBytes).digest('hex'))).toBe(true)

    const failedReplacementBytes = pngVariant(46)
    fixture.failNextUploadBeforeStore = true
    await expect(
      payload.update({
        collection: 'media',
        id: original.id,
        data: { label: 'failed replacement' },
        file: uploadFile(failedReplacementBytes, 'failed-replacement.png'),
      } as never)
    ).rejects.toThrow()
    await expect(payload.findByID({ collection: 'media', id: original.id })).resolves.toMatchObject(
      {
        sanity: { asset: { _id: replacementAssetId } },
      }
    )
    expect(fixture.assets.size).toBe(2)

    const transactionID = await db.beginTransaction()
    if (transactionID == null) throw new Error('PostgreSQL transaction unavailable')
    await payload.delete({
      collection: 'media',
      id: original.id,
      req: { transactionID },
    } as never)
    await db.rollbackTransaction(transactionID)
    await expect(payload.findByID({ collection: 'media', id: original.id })).resolves.toMatchObject(
      {
        sanity: { asset: { _id: replacementAssetId } },
      }
    )
    expect(fixture.assets.size).toBe(2)

    await payload.delete({ collection: 'archive', id: shared.id } as never)
    await payload.delete({ collection: 'media', id: original.id } as never)
    expect(await payload.count({ collection: 'media' })).toMatchObject({ totalDocs: 0 })
    expect(await payload.count({ collection: 'archive' })).toMatchObject({ totalDocs: 0 })
    expect(fixture.assets.size).toBe(2)
    expect(fixture.deleteAttempts).toEqual([])

    const beforeFailedUploadCount = await payload.count({ collection: 'media' })
    const notStoredBytes = pngVariant(43)
    fixture.failNextUploadBeforeStore = true
    await expect(
      payload.create({
        collection: 'media',
        data: { label: 'failed-before-store' },
        file: uploadFile(notStoredBytes, 'not-stored.png'),
      } as never)
    ).rejects.toThrow()
    expect(await payload.count({ collection: 'media' })).toMatchObject({
      totalDocs: beforeFailedUploadCount.totalDocs,
    })

    const lostResponseBytes = pngVariant(44)
    fixture.failNextUploadAfterStore = true
    await expect(
      payload.create({
        collection: 'media',
        data: { label: 'lost-response' },
        file: uploadFile(lostResponseBytes, 'lost-response.png'),
      } as never)
    ).rejects.toThrow()
    expect(fixture.assets.has(createHash('sha1').update(lostResponseBytes).digest('hex'))).toBe(
      true
    )
    expect(await payload.count({ collection: 'media' })).toMatchObject({ totalDocs: 0 })

    const persistenceFailureBytes = pngVariant(45)
    fixture.failNextMutation = true
    await expect(
      payload.create({
        collection: 'media',
        data: { label: 'folder-mutation-failure' },
        file: uploadFile(persistenceFailureBytes, 'folder-failure.png'),
      } as never)
    ).rejects.toThrow()
    expect(
      fixture.assets.has(createHash('sha1').update(persistenceFailureBytes).digest('hex'))
    ).toBe(true)
    expect(await payload.count({ collection: 'media' })).toMatchObject({ totalDocs: 0 })
    expect(fixture.deleteAttempts).toEqual([])
  }, 60_000)
})
