import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const work = await mkdtemp(join(tmpdir(), 'storage-sanity-payload-'))
process.env.DATABASE_URL = `file:${join(work, 'payload.db')}`

const uploads: string[] = []
const mutations: string[] = []
type StoredMedia = {
  id: number
  filename?: string
  sanity?: { asset?: { _id?: string; mimeType?: string } }
  url?: string
}
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
              : Buffer.alloc(0)
    const sha1 = createHash('sha1').update(bytes).digest('hex')
    // Real Sanity file id shape (file-<sha1>-<ext>); the asset-id guard rejects anything else.
    const id = `file-${sha1}-txt`
    uploads.push(id)
    return Response.json({
      document: {
        _id: id,
        _type: 'sanity.fileAsset',
        assetId: id.replace('file-', ''),
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
    mutations.push(String(init?.body ?? ''))
    return Response.json({ transactionId: `fixture-${mutations.length}`, results: [] })
  }
  if (url.pathname.includes('/data/query/')) {
    return Response.json({ result: [] })
  }
  throw new Error(`Unexpected Sanity request: ${url.pathname}`)
}) as typeof fetch

try {
  const { config } = await import('./src/config')
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config })
  try {
    const first = await payload.create({
      collection: 'media',
      data: { alt: 'first upload' },
      file: {
        name: 'fixture.txt',
        data: Buffer.from('first bytes'),
        mimetype: 'text/plain',
        size: 11,
      },
    })
    const firstMedia = first as unknown as StoredMedia
    assert.equal(firstMedia.filename, String(firstMedia.id))
    assert.equal(firstMedia.sanity?.asset?._id, uploads[0])
    assert.equal(firstMedia.sanity?.asset?.mimeType, 'text/plain')
    assert.match(firstMedia.url ?? '', /^https:\/\/cdn\.sanity\.io\/files\//)

    await assert.rejects(
      payload.create({
        collection: 'media',
        data: { alt: 'duplicate upload' },
        file: {
          name: 'duplicate.txt',
          data: Buffer.from('first bytes'),
          mimetype: 'text/plain',
          size: 11,
        },
      }),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status?: number }).status === 409
    )
    assert.equal(uploads.length, 1, 'the duplicate is rejected before another remote upload')
    assert.equal((await payload.count({ collection: 'media' })).totalDocs, 1)

    const replaced = (await payload.update({
      collection: 'media',
      id: firstMedia.id,
      data: { alt: 'replacement' },
      file: {
        name: 'replacement.txt',
        data: Buffer.from('new bytes!'),
        mimetype: 'text/plain',
        size: 10,
      },
    })) as unknown as StoredMedia
    assert.equal(replaced.sanity?.asset?._id, uploads[1])

    await assert.rejects(
      payload.delete({ collection: 'media', id: firstMedia.id }),
      /Could not verify whether this media asset is still referenced/
    )
    const retainedMedia = (await payload.findByID({
      collection: 'media',
      id: firstMedia.id,
    })) as unknown as StoredMedia
    assert.equal(retainedMedia.sanity?.asset?._id, uploads[1])
    assert.equal(uploads.length, 2)
    // SQLite has no transaction lock, so deletion fails closed and replacement retains both upstream assets.
    const deleteMutations = mutations.filter((body) => body.includes('"delete"'))
    assert.equal(deleteMutations.length, 0, 'sqlite keeps both upstream assets without a lock')
  } finally {
    await payload.destroy()
  }
} finally {
  globalThis.fetch = originalFetch
  await rm(work, { recursive: true, force: true })
}
