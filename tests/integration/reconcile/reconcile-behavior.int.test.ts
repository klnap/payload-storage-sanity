/**
 * Studio reconcile behavior on real Payload and Postgres: real collection access decides who may run it, real
 * pagination decides what a truncated run covers, and a fake Sanity client measures what upstream sees.
 * Nothing here asserts that an export exists.
 */
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig, type Payload } from 'payload'
import { Client } from 'pg'
import { createSanityAssetFetchCache, createSanityReconcileEndpoint } from '@/features/asset-sync'
import { RECONCILE_CONCURRENCY } from '@/features/asset-sync/reconcile/reconcileSanityMedia'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

const assetFor = (id: string) => ({
  _id: id,
  _type: 'sanity.imageAsset',
  _rev: 'r1',
  _createdAt: '2020-01-01T00:00:00Z',
  _updatedAt: '2020-01-02T00:00:00Z',
  assetId: id.slice(6, 46),
  extension: 'jpg',
  mimeType: 'image/jpeg',
  path: `images/demo/production/${id}.jpg`,
  sha1hash: id.slice(6, 46),
  size: 1000,
  url: `https://cdn.sanity.io/images/demo/production/${id}.jpg`,
  metadata: { dimensions: { width: 800, height: 600, aspectRatio: 1.33 } },
})

const ROWS = 25
const rowAssetId = (n: number) => `image-${String(n).padStart(40, '0')}-800x600-jpg`

/** Fake upstream: records every read and tracks how many are in flight at once. */
function trackingClient(delayMs = 2) {
  const reads: string[] = []
  let inFlight = 0
  let peak = 0
  const client = {
    getDocument: mock(async (id: string) => {
      reads.push(id)
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      inFlight -= 1
      return assetFor(id)
    }),
  }
  return { client, reads, peak: () => peak }
}

describe.skipIf(!baseUrl)('reconcile authorization and pagination (postgres)', () => {
  let payload: Payload
  let databaseName = ''
  let adminUrl = ''
  const editor = { id: 'editor-1', role: 'editor' }
  const viewer = { id: 'viewer-1', role: 'viewer' }

  beforeAll(async () => {
    adminUrl = new URL(baseUrl as string).toString()
    databaseName = `pss_reconcile_${randomBytes(6).toString('hex')}`
    const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()
    const isolated = new URL(adminUrl)
    isolated.pathname = `/${databaseName}`

    const config = await buildConfig({
      secret: `reconcile-${randomBytes(8).toString('hex')}`,
      serverURL: 'http://reconcile.test',
      collections: [
        {
          slug: 'media',
          upload: { disableLocalStorage: true },
          access: {
            read: () => true,
            // Only an editor may update media; this is the permission reconcile must respect.
            update: ({ req }) => (req.user as { role?: string } | null)?.role === 'editor',
          },
          fields: [
            {
              name: 'sanity',
              type: 'group',
              fields: [
                {
                  name: 'asset',
                  type: 'group',
                  fields: [
                    { name: '_id', type: 'text' },
                    { name: 'assetId', type: 'text' },
                    { name: 'extension', type: 'text' },
                    { name: 'mimeType', type: 'text' },
                    { name: 'path', type: 'text' },
                    { name: 'sha1hash', type: 'text' },
                    { name: 'size', type: 'number' },
                    { name: 'url', type: 'text' },
                    { name: 'metadata', type: 'json' },
                  ],
                },
              ],
            },
            {
              name: 'sync',
              type: 'group',
              fields: [
                { name: 'status', type: 'text' },
                { name: 'checkedAt', type: 'text' },
                { name: 'errorAt', type: 'text' },
              ],
            },
          ],
        },
      ],
      db: postgresAdapter({
        idType: 'uuid',
        pool: { connectionString: isolated.toString() },
        push: true,
      }),
    })
    payload = new BasePayload()
    await payload.init({ config })

    for (let n = 1; n <= ROWS; n += 1) {
      await payload.create({
        collection: 'media',
        data: {
          sanity: {
            asset: { _id: rowAssetId(n), path: `images/${n}.jpg`, mimeType: 'text/plain' },
          },
        } as never,
        file: {
          data: Buffer.from(`row-${n}`),
          mimetype: 'text/plain',
          name: `row-${n}.txt`,
          size: 5,
        },
        overrideAccess: true,
      })
    }
  }, 180_000)

  afterAll(async () => {
    try {
      await (payload?.db as unknown as { destroy?: () => Promise<void> })?.destroy?.()
      await (payload?.db as unknown as { pool?: { end: () => Promise<void> } })?.pool?.end()
    } finally {
      const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
      await admin.connect()
      await admin.query(`drop database if exists "${databaseName}" with (force)`)
      await admin.end()
    }
  })

  /** Calls the endpoint as `user`, the way Payload's route handler does: `req.user` set, real payload. */
  const callEndpoint = async (user: unknown, body: Record<string, unknown>, client: unknown) => {
    const endpoint = createSanityReconcileEndpoint({
      client: client as never,
      collectionSlug: 'media',
      access: () => true,
    })
    const req = {
      headers: new Headers(),
      text: async () => JSON.stringify(body),
      user,
      payload,
      t: (key: string) => key,
    }
    const response = await endpoint.handler(req as never)
    return { status: response.status, body: (await response.json()) as Record<string, unknown> }
  }

  it('refuses a caller without media update access before any Sanity read', async () => {
    const { client, reads } = trackingClient()
    const result = await callEndpoint(viewer, { maxRows: 10 }, client)
    expect(result.status).toBe(403)
    expect(reads).toHaveLength(0)
  })

  it('runs for an editor and stops at maxRows with a resume point', async () => {
    const { client, reads } = trackingClient()
    const result = await callEndpoint(editor, { maxRows: 10, limit: 7 }, client)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ scanned: 10, truncated: true, nextPage: 2 })
    expect(reads).toHaveLength(10)
  })

  it('a resumed run covers every remaining row, and the two runs together cover every row', async () => {
    const first = trackingClient()
    const firstRun = await callEndpoint(editor, { maxRows: 10, limit: 7 }, first.client)
    expect(firstRun.body).toMatchObject({ truncated: true, nextPage: 2 })

    const second = trackingClient()
    const secondRun = await callEndpoint(
      editor,
      { maxRows: 1000, limit: 7, page: firstRun.body.nextPage },
      second.client
    )
    expect(secondRun.status).toBe(200)
    expect(secondRun.body).toMatchObject({ truncated: false, nextPage: null })

    const covered = new Set([...first.reads, ...second.reads])
    // Every row's asset was read at least once across the two runs.
    expect(covered.size).toBe(ROWS)
    // The resume restarts at the partly processed page, so a few rows may be read twice. Nothing else repeats.
    const duplicates = second.reads.length + first.reads.length - covered.size
    expect(duplicates).toBeLessThanOrEqual(7)
  })

  it('upstream reads never exceed the concurrency bound on real pages', async () => {
    const { client, peak } = (() => {
      const t = trackingClient(5)
      return { client: t.client, peak: t.peak }
    })()
    const result = await callEndpoint(editor, { maxRows: 1000, limit: 20 }, client)
    expect(result.status).toBe(200)
    expect(peak()).toBeLessThanOrEqual(RECONCILE_CONCURRENCY)
    expect(peak()).toBeGreaterThan(1)
  })

  it('a dry run through the endpoint reports without writing the sync state', async () => {
    const syncOf = async () =>
      (
        await payload.find({
          collection: 'media',
          limit: 50,
          overrideAccess: true,
          depth: 0,
          sort: 'createdAt',
        })
      ).docs.map((doc) => JSON.stringify((doc as { sync?: unknown }).sync ?? null))
    const before = await syncOf()
    const { client } = trackingClient()
    const result = await callEndpoint(editor, { dryRun: true, maxRows: 5 }, client)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ dryRun: true, scanned: 5 })
    expect(await syncOf()).toEqual(before)
  })

  // Keeps the cache helper import used (behavior of the shared fetch cache is covered by unit tests).
  void createSanityAssetFetchCache
})
