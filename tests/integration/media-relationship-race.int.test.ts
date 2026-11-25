import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig } from 'payload'
import { Client } from 'pg'
import { sanityStorage } from '../../src/plugin'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/D4sAAAAASUVORK5CYII=',
  'base64'
)

function gate() {
  let enter!: () => void
  let release!: () => void
  const reached = new Promise<void>((resolve) => {
    enter = resolve
  })
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    reached,
    pause: async () => {
      enter()
      await wait
    },
    release: () => release(),
  }
}

async function waitForAdvisoryWait(observer: Client, applicationName: string): Promise<void> {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    const result = await observer.query(
      `select 1 from pg_stat_activity
       where application_name = $1 and wait_event_type = 'Lock' and wait_event = 'advisory'
       limit 1`,
      [applicationName]
    )
    if (result.rowCount) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`No PostgreSQL advisory-lock wait observed for ${applicationName}`)
}

describe.skipIf(!baseUrl)('media relationship/delete race (Postgres, real plugin)', () => {
  let adminUrl = ''
  const created: string[] = []

  beforeAll(() => {
    adminUrl = new URL(baseUrl as string).toString()
  })

  afterAll(async () => {
    const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
    await admin.connect()
    for (const database of created) {
      await admin.query(`drop database if exists "${database}" with (force)`)
    }
    await admin.end()
  })

  it('coordinates relationship writes and deletion in either transaction order', async () => {
    const databaseName = `pss_relation_${randomBytes(6).toString('hex')}`
    const applicationName = `pss_rel_${randomBytes(5).toString('hex')}`
    const admin = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/postgres') })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()
    created.push(databaseName)

    const databaseUrl = new URL(adminUrl)
    databaseUrl.pathname = `/${databaseName}`
    databaseUrl.searchParams.set('application_name', applicationName)
    const observerUrl = new URL(databaseUrl)
    observerUrl.searchParams.set('application_name', `${applicationName}_observer`)
    const observer = new Client({ connectionString: observerUrl.toString() })
    await observer.connect()

    const deleteGate = gate()
    let holdDeleteId: string | undefined
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'token',
      collections: { media: true },
      resolveFetch: () => async (input) => {
        if (String(input).includes('/assets/images/production')) {
          const hash = createHash('sha1').update(randomBytes(32)).digest('hex')
          const asset = {
            _id: `image-${hash}-1x1-png`,
            _type: 'sanity.imageAsset',
            assetId: hash.slice(0, 12),
            extension: 'png',
            mimeType: 'image/png',
            path: `images/demo/production/${hash}.png`,
            sha1hash: hash,
            size: 32,
            url: `https://cdn.sanity.io/images/demo/production/${hash}.png`,
            metadata: { dimensions: { width: 1, height: 1, aspectRatio: 1 } },
          }
          return Response.json({ document: asset })
        }
        return Response.json({ transactionId: 'local-test-transaction' })
      },
    })
    const config = plugin({
      secret: `relationship-${randomBytes(8).toString('hex')}`,
      serverURL: 'http://relationship.test',
      collections: [
        {
          slug: 'media',
          upload: { disableLocalStorage: true },
          fields: [],
          hooks: {
            beforeDelete: [
              async ({ id }: { id: string }) => {
                if (String(id) === holdDeleteId) await deleteGate.pause()
              },
            ],
          },
        },
        {
          slug: 'articles',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'asset', type: 'relationship', relationTo: 'media' },
            { name: 'uploadAsset', type: 'upload', relationTo: 'media' },
          ],
        },
      ],
      db: postgresAdapter({
        idType: 'uuid',
        pool: { connectionString: databaseUrl.toString() },
        push: true,
      }),
    } as never)
    const payload = new BasePayload()
    await payload.init({ config: await buildConfig(config as never) })
    const db = payload.db as unknown as {
      beginTransaction: () => Promise<string | number | null>
      commitTransaction: (id: string | number) => Promise<void>
      rollbackTransaction: (id: string | number) => Promise<void>
    }
    const openTransactions: Array<string | number> = []

    try {
      const writeFirstMedia = await payload.create({
        collection: 'media',
        data: {} as never,
        file: {
          data: onePixelPng,
          mimetype: 'image/png',
          name: 'write-first.png',
          size: onePixelPng.length,
        },
      })
      const writeFirstId = String(writeFirstMedia.id)
      const writeTransaction = await db.beginTransaction()
      if (writeTransaction == null) throw new Error('transaction unavailable')
      openTransactions.push(writeTransaction)
      await payload.create({
        collection: 'articles',
        data: {
          title: 'write-first',
          asset: writeFirstId,
          uploadAsset: writeFirstId,
        } as never,
        req: { transactionID: writeTransaction } as never,
      })

      const deleteAfterWrite = payload.delete({
        collection: 'media',
        id: writeFirstId,
      })
      await waitForAdvisoryWait(observer, applicationName)
      await db.commitTransaction(writeTransaction)
      openTransactions.splice(openTransactions.indexOf(writeTransaction), 1)
      await expect(deleteAfterWrite).rejects.toThrow()
      await expect(
        payload.findByID({ collection: 'media', id: writeFirstId })
      ).resolves.toBeDefined()
      await expect(
        payload.find({ collection: 'articles', where: { asset: { equals: writeFirstId } } })
      ).resolves.toMatchObject({ totalDocs: 1 })

      const deletionFirstMedia = await payload.create({
        collection: 'media',
        data: {} as never,
        file: {
          data: onePixelPng,
          mimetype: 'image/png',
          name: 'delete-first.png',
          size: onePixelPng.length,
        },
      })
      const deletionFirstId = String(deletionFirstMedia.id)
      holdDeleteId = deletionFirstId
      const deleteTransaction = await db.beginTransaction()
      if (deleteTransaction == null) throw new Error('transaction unavailable')
      openTransactions.push(deleteTransaction)
      const deletion = payload.delete({
        collection: 'media',
        id: deletionFirstId,
        req: { transactionID: deleteTransaction } as never,
      })
      await deleteGate.reached

      const writeAfterDelete = payload.create({
        collection: 'articles',
        data: {
          title: 'write-after-delete',
          asset: deletionFirstId,
          uploadAsset: deletionFirstId,
        } as never,
      })
      await waitForAdvisoryWait(observer, applicationName)
      deleteGate.release()
      await deletion
      await db.commitTransaction(deleteTransaction)
      openTransactions.splice(openTransactions.indexOf(deleteTransaction), 1)
      await expect(writeAfterDelete).rejects.toThrow()
      await expect(
        payload.findByID({
          collection: 'media',
          id: deletionFirstId,
          disableErrors: true,
        })
      ).resolves.toBeNull()
      await expect(
        payload.find({ collection: 'articles', where: { asset: { equals: deletionFirstId } } })
      ).resolves.toMatchObject({ totalDocs: 0 })
    } finally {
      deleteGate.release()
      await Promise.all(
        openTransactions.map((id) => db.rollbackTransaction(id).catch(() => undefined))
      )
      await observer.end()
      await (payload.db as unknown as { destroy?: () => Promise<void> }).destroy?.()
      await (payload.db as unknown as { pool?: { end: () => Promise<void> } }).pool?.end()
    }
  }, 60_000)
})
