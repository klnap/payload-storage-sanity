import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { Pool, type PoolClient } from 'pg'

import { lockSanityAssetHash } from '@/features/media/lifecycle/asset-lock'

const databaseUrl = process.env.PAYLOAD_STORAGE_SANITY_TEST_DATABASE_URL

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** True when `promise` settles within `ms`. Waiting lock attempts must still be pending while the holder runs. */
async function resolvesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return Promise.race([promise.then(() => true), sleep(ms).then(() => false)])
}

/** Request whose transaction db is a real pg client. The helper only calls `execute(query)`, as Payload's transaction db does. */
function requestOn(client: PoolClient, transactionID: string): Partial<PayloadRequest> {
  const execute = (query: string) => client.query(query)
  return {
    transactionID,
    payload: {
      db: {
        packageName: '@payloadcms/db-postgres',
        sessions: { [transactionID]: { db: { execute } } },
      },
    },
  } as unknown as Partial<PayloadRequest>
}

describe.skipIf(!databaseUrl?.trim())('sanity asset lock on PostgreSQL', () => {
  let pool: Pool
  let table: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    table = `pss_lock_probe_${randomBytes(6).toString('hex')}`
    await pool.query(`create table ${table} (digest text not null)`)
  })

  afterAll(async () => {
    await pool.query(`drop table if exists ${table}`)
    await pool.end()
  })

  async function begin(): Promise<PoolClient> {
    const client = await pool.connect()
    await client.query('begin')
    return client
  }

  async function finish(...clients: PoolClient[]): Promise<void> {
    for (const client of clients) {
      await client.query('rollback').catch(() => undefined)
      client.release()
    }
  }

  test('a second lock on the same digest waits until the first transaction commits', async () => {
    const digest = randomBytes(20).toString('hex')
    const holder = await begin()
    const waiter = await begin()
    try {
      expect(await lockSanityAssetHash(requestOn(holder, 'holder'), digest)).toBe(true)

      const waiting = lockSanityAssetHash(requestOn(waiter, 'waiter'), digest)
      expect(await resolvesWithin(waiting, 300)).toBe(false)

      await holder.query('commit')
      expect(await waiting).toBe(true)
    } finally {
      await finish(holder, waiter)
    }
  })

  test('a delete that locks after an upload commits rescans and sees the uploaded row', async () => {
    const digest = randomBytes(20).toString('hex')
    const upload = await begin()
    const remove = await begin()
    try {
      expect(await lockSanityAssetHash(requestOn(upload, 'upload'), digest)).toBe(true)
      await upload.query(`insert into ${table} (digest) values ($1)`, [digest])

      const deleteLock = lockSanityAssetHash(requestOn(remove, 'delete'), digest)
      expect(await resolvesWithin(deleteLock, 300)).toBe(false)

      await upload.query('commit')
      expect(await deleteLock).toBe(true)

      const rescan = await remove.query(
        `select count(*)::int as count from ${table} where digest = $1`,
        [digest]
      )
      expect(rescan.rows[0]).toEqual({ count: 1 })
    } finally {
      await finish(upload, remove)
    }
  })
})
