import { afterAll, describe, expect, it } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, buildConfig } from 'payload'
import { Client } from 'pg'
import { sanityStorage } from '../../src/plugin'

const baseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL?.trim()
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

describe.skipIf(!baseUrl)('external upload replay ledger with PostgreSQL', () => {
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

  it('enforces one claim per nonce through the database primary key', async () => {
    const databaseName = `pss_upload_claim_${randomBytes(6).toString('hex')}`
    const adminUrl = new URL(baseUrl as string)
    adminUrl.pathname = '/postgres'
    const admin = new Client({ connectionString: adminUrl.toString() })
    await admin.connect()
    await admin.query(`create database "${databaseName}"`)
    await admin.end()
    createdDatabases.push(databaseName)

    const databaseUrl = new URL(baseUrl as string)
    databaseUrl.pathname = `/${databaseName}`
    const plugin = sanityStorage({
      projectId: 'demo',
      dataset: 'production',
      token: 'synthetic-token',
      collections: { media: true },
      upload: {
        transport: {
          endpoint: 'https://uploads.example.test/v1/upload',
          maxSizeBytes: 1_000_000,
          protocolVersion: 1,
          secret: 'a test secret with at least thirty-two bytes',
        },
      },
    })
    const config = plugin({
      secret: `upload-ledger-${randomBytes(8).toString('hex')}`,
      serverURL: 'https://upload-ledger.test',
      collections: [{ slug: 'media', upload: true, fields: [] }],
      db: postgresAdapter({
        pool: { connectionString: databaseUrl.toString() },
        push: true,
      }),
    } as never)

    payload = new BasePayload()
    await payload.init({ config: await buildConfig(config as never) })
    const nonce = `nonce-${randomBytes(12).toString('hex')}`
    const claim = {
      id: nonce,
      kind: 'claim' as const,
      nonce,
      subject: 'users:u1',
      collection: 'media',
      operation: 'create' as const,
      projectId: 'demo',
      dataset: 'production',
      audience: 'https://uploads.example.test/v1/upload',
      filename: 'asset.png',
      mimeType: 'image/png',
      size: 256,
      maxSize: 1_000_000,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    }
    const results = await Promise.allSettled([
      payload.create({
        collection: 'sanity-upload-sessions' as never,
        data: claim,
        overrideAccess: true,
      }),
      payload.create({
        collection: 'sanity-upload-sessions' as never,
        data: claim,
        overrideAccess: true,
      }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const stored = await payload.findByID({
      collection: 'sanity-upload-sessions' as never,
      id: nonce,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({ id: nonce, kind: 'claim', subject: 'users:u1' })
  })
})
