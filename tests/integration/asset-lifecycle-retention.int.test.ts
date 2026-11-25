import { afterAll, describe, expect, it } from 'bun:test'
import { createHash, randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig } from 'payload'
import { Client } from 'pg'
import { sanityStorage } from '../../src/plugin'
import { createSanityFixture, png, pngVariant, uploadFile } from '../helpers/sanityFixture'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

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
