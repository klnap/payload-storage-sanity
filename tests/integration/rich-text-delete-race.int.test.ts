/**
 * Deterministic race between a rich-text reference write and a media delete, on real Payload and Postgres.
 * Both orders are forced with transactions held open: the second operation must wait for the first, and
 * then it must observe the committed outcome. No reference may commit against a deleted media row.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { BasePayload, buildConfig, type Payload } from 'payload'
import { Client } from 'pg'
import { createMediaReferenceIntegrityBeforeDeleteHook } from '@/features/media/lifecycle/delete/referenceIntegrity'
import { applyRichTextReferenceHooks } from '@/features/media/lifecycle/reference/richTextReferenceWriteHook'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const resolvesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true
    ),
    sleep(ms).then(() => false),
  ])

process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

describe.skipIf(!baseUrl)('rich-text reference write vs media delete (postgres)', () => {
  let payload: Payload
  let databaseName = ''
  let adminUrl = ''

  beforeAll(async () => {
    const url = new URL(baseUrl as string)
    databaseName = `pss_race_${randomBytes(6).toString('hex')}`
    adminUrl = url.toString()
    const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()

    const isolated = new URL(adminUrl)
    isolated.pathname = `/${databaseName}`
    const config = applyRichTextReferenceHooks(
      {
        secret: `race-${randomBytes(8).toString('hex')}`,
        editor: lexicalEditor(),
        serverURL: 'http://race.test',
        collections: [
          {
            slug: 'media',
            upload: { disableLocalStorage: true },
            fields: [{ name: 'filename', type: 'text' }],
            hooks: { beforeDelete: [createMediaReferenceIntegrityBeforeDeleteHook('media')] },
          },
          {
            slug: 'articles',
            fields: [
              { name: 'title', type: 'text' },
              { name: 'body', type: 'richText' },
            ],
          },
        ],
        globals: [],
        db: postgresAdapter({
          idType: 'uuid',
          pool: { connectionString: isolated.toString() },
          push: true,
        }),
      } as never,
      ['media']
    )
    payload = new BasePayload()
    await payload.init({ config: await buildConfig(config as never) })
  }, 120_000)

  afterAll(async () => {
    try {
      await (payload.db as unknown as { destroy?: () => Promise<void> }).destroy?.()
      // Idle pool clients must close before the drop, or the drop reports them as unhandled errors.
      await (payload.db as unknown as { pool?: { end: () => Promise<void> } }).pool?.end()
    } finally {
      const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
      await admin.connect()
      await admin.query(`drop database if exists "${databaseName}" with (force)`)
      await admin.end()
    }
  }, 60_000)

  const db = () =>
    payload.db as unknown as {
      beginTransaction: () => Promise<string | number | null>
      commitTransaction: (id: string | number) => Promise<void>
      rollbackTransaction: (id: string | number) => Promise<void>
    }

  async function begin(): Promise<string | number> {
    const id = await db().beginTransaction()
    if (id == null) throw new Error('transaction unavailable')
    return id
  }

  async function newMedia(): Promise<string> {
    const media = await payload.create({
      collection: 'media',
      data: { filename: `m-${randomBytes(4).toString('hex')}.txt` },
      file: {
        data: Buffer.from('race'),
        mimetype: 'text/plain',
        name: `m-${randomBytes(4).toString('hex')}.txt`,
        size: 4,
      },
      overrideAccess: true,
    })
    return String(media.id)
  }

  const embeddingBody = (mediaId: string) => ({
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: [
        {
          type: 'upload',
          relationTo: 'media',
          value: mediaId,
          version: 1,
          format: '',
          fields: null,
        },
      ],
    },
  })

  it('reference committed first: the delete waits, then is refused and the media row survives', async () => {
    const mediaId = await newMedia()
    const writer = await begin()
    const deleter = await begin()
    try {
      await payload.create({
        collection: 'articles',
        data: { title: 'embeds media', body: embeddingBody(mediaId) as never },
        overrideAccess: true,
        req: { transactionID: writer } as never,
      })

      const deleting = payload.delete({
        collection: 'media',
        id: mediaId,
        overrideAccess: true,
        req: { transactionID: deleter } as never,
      })
      expect(await resolvesWithin(deleting, 400)).toBe(false)

      await db().commitTransaction(writer)
      await expect(deleting).rejects.toThrow(/mediaDeleteBlock|currently referenced/)
    } finally {
      await db()
        .rollbackTransaction(writer)
        .catch(() => undefined)
      await db()
        .rollbackTransaction(deleter)
        .catch(() => undefined)
    }

    expect(
      await payload.findByID({
        collection: 'media',
        id: mediaId,
        overrideAccess: true,
        disableErrors: true,
      })
    ).not.toBeNull()
  })

  it('delete committed first: the reference write waits, then is refused and no reference commits', async () => {
    const mediaId = await newMedia()
    const deleter = await begin()
    const writer = await begin()
    try {
      await payload.delete({
        collection: 'media',
        id: mediaId,
        overrideAccess: true,
        req: { transactionID: deleter } as never,
      })

      const writing = payload.create({
        collection: 'articles',
        data: { title: 'dangling', body: embeddingBody(mediaId) as never },
        overrideAccess: true,
        req: { transactionID: writer } as never,
      })
      expect(await resolvesWithin(writing, 400)).toBe(false)

      await db().commitTransaction(deleter)
      const error = await writing.then(
        () => null,
        (err: { data?: unknown }) => err
      )
      expect(JSON.stringify(error?.data)).toContain('Embedded media no longer exists')
    } finally {
      await db()
        .rollbackTransaction(writer)
        .catch(() => undefined)
      await db()
        .rollbackTransaction(deleter)
        .catch(() => undefined)
    }

    const dangling = await payload.find({
      collection: 'articles',
      where: { title: { equals: 'dangling' } },
      overrideAccess: true,
      limit: 1,
    })
    expect(dangling.totalDocs).toBe(0)
  })
})
