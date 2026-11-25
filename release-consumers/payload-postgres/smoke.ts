import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { Client } from 'pg'

const connectionURL = process.env.PSS_POSTGRES_CONSUMER_DATABASE_URL?.trim()
if (!connectionURL) {
  throw new Error('PSS_POSTGRES_CONSUMER_DATABASE_URL is required for the PostgreSQL consumer')
}

const databaseName = `pss_release_${randomBytes(6).toString('hex')}`
const adminURL = new URL(connectionURL)
adminURL.pathname = '/postgres'
const admin = new Client({ connectionString: adminURL.toString() })
await admin.connect()
await admin.query(`create database "${databaseName}"`)
await admin.end()

const databaseURL = new URL(connectionURL)
databaseURL.pathname = `/${databaseName}`
process.env.PSS_POSTGRES_CONSUMER_DATABASE_URL = databaseURL.toString()

const assets = new Map<string, { bytes: Buffer; id: string }>()
const remoteDeleteAttempts: string[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url)
  if (url.hostname !== 'api.sanity.io' && !url.hostname.endsWith('.api.sanity.io')) {
    return originalFetch(input, init)
  }

  if (url.pathname.includes('/assets/files/')) {
    const body = init?.body
    const bytes =
      typeof body === 'string'
        ? Buffer.from(body)
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : body instanceof ArrayBuffer
            ? Buffer.from(body)
            : input instanceof Request
              ? Buffer.from(await input.clone().arrayBuffer())
              : Buffer.from('synthetic fixture file')
    const sha1 = createHash('sha1').update(bytes).digest('hex')
    const id = `file-${sha1}-txt`
    assets.set(id, { bytes, id })
    return Response.json({
      document: {
        _id: id,
        _type: 'sanity.fileAsset',
        _rev: 'fixture-rev',
        _createdAt: new Date(0).toISOString(),
        _updatedAt: new Date(0).toISOString(),
        assetId: sha1.slice(0, 12),
        originalFilename: 'fixture.txt',
        extension: 'txt',
        mimeType: 'text/plain',
        size: bytes.length,
        path: `files/fixture/production/${id}.txt`,
        url: `https://cdn.sanity.io/files/fixture/production/${id}.txt`,
        sha1hash: sha1,
      },
    })
  }

  if (url.pathname.includes('/data/mutate/')) {
    const request = input instanceof Request ? input.clone() : undefined
    const rawBody =
      typeof init?.body === 'string'
        ? init.body
        : request
          ? Buffer.from(await request.arrayBuffer()).toString('utf8')
          : ''
    const body = rawBody ? (JSON.parse(rawBody) as { mutations?: unknown[] }) : {}
    for (const mutation of body.mutations ?? []) {
      if (mutation && typeof mutation === 'object' && 'delete' in mutation) {
        remoteDeleteAttempts.push(JSON.stringify(mutation))
      }
    }
    return Response.json({ transactionId: `fixture-${remoteDeleteAttempts.length}`, results: [] })
  }

  if (url.pathname.includes('/data/query/')) {
    return Response.json({ result: [] })
  }

  throw new Error(`Unexpected Sanity request: ${url.pathname}`)
}) as typeof fetch

let payload: Awaited<ReturnType<typeof import('payload').getPayload>> | undefined
try {
  const [{ config }, { getPayload }] = await Promise.all([
    import('./src/config.js'),
    import('payload'),
  ])
  payload = await getPayload({ config })

  const media = await payload.create({
    collection: 'media',
    data: { alt: 'fixture media' },
    file: {
      name: 'fixture.txt',
      data: Buffer.from('synthetic fixture file'),
      mimetype: 'text/plain',
      size: 22,
    },
  })
  const assetId = (media as { sanity?: { asset?: { _id?: string } } }).sanity?.asset?._id
  assert.equal(typeof assetId, 'string')
  assert.equal(assets.has(assetId as string), true)

  const article = await payload.create({
    collection: 'articles',
    data: { title: 'referencing article', cover: media.id },
  })
  await assert.rejects(
    payload.delete({ collection: 'media', id: media.id }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: number }).status === 400
  )

  const retainedMedia = await payload.findByID({ collection: 'media', id: media.id })
  assert.equal(
    (retainedMedia as { sanity?: { asset?: { _id?: string } } }).sanity?.asset?._id,
    assetId
  )
  assert.equal((await payload.count({ collection: 'media' })).totalDocs, 1)

  await payload.delete({ collection: 'articles', id: article.id })
  await payload.delete({ collection: 'media', id: media.id })
  await assert.rejects(payload.findByID({ collection: 'media', id: media.id }))
  assert.equal(assets.has(assetId as string), true, 'local deletion retains the remote asset')
  assert.deepEqual(remoteDeleteAttempts, [])
} finally {
  const db = payload?.db as
    | { destroy?: () => Promise<void>; pool?: { end: () => Promise<void> } }
    | undefined
  try {
    await payload?.destroy()
    await db?.destroy?.()
    await db?.pool?.end()
  } finally {
    globalThis.fetch = originalFetch
    const cleanup = new Client({ connectionString: adminURL.toString() })
    await cleanup.connect()
    try {
      await cleanup.query(`drop database if exists "${databaseName}" with (force)`)
    } finally {
      await cleanup.end()
    }
  }
}
