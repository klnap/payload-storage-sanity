import { describe, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fakeTransaction } from '../../../../../tests/helpers/fakeTransaction'
import { hashUploadBytes, lockSanityAssetHash, sanityAssetHashFromId } from './index'

const SHA1_OF_ABC = createHash('sha1').update('abc').digest('hex')
const LOCK_STATEMENT = `select pg_advisory_xact_lock(hashtext('payload-storage-sanity:sanity-asset:${SHA1_OF_ABC}'))`
const ISOLATION_STATEMENT = 'show transaction_isolation'

describe('sanityAssetHashFromId', () => {
  test('extracts the digest from image and file asset ids', () => {
    expect(sanityAssetHashFromId(`image-${SHA1_OF_ABC}-800x600-jpg`)).toBe(SHA1_OF_ABC)
    expect(sanityAssetHashFromId(`file-${SHA1_OF_ABC}-pdf`)).toBe(SHA1_OF_ABC)
  })

  test('returns null for anything that is not an asset id', () => {
    expect(sanityAssetHashFromId('media-document-id')).toBeNull()
    expect(sanityAssetHashFromId(`image-${SHA1_OF_ABC.toUpperCase()}-800x600-jpg`)).toBeNull()
  })
})

describe('hashUploadBytes', () => {
  test('hashes buffer bodies to the SHA-1 Sanity uses in the asset id', async () => {
    expect(await hashUploadBytes({ buffer: Buffer.from('abc'), filename: 'a.jpg' })).toBe(
      SHA1_OF_ABC
    )
  })

  test('hashes temp-file bodies by streaming the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pss-lock-'))
    try {
      const tempFilePath = join(dir, 'upload.bin')
      await writeFile(tempFilePath, 'abc')
      expect(await hashUploadBytes({ tempFilePath, filename: 'a.bin' })).toBe(SHA1_OF_ABC)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('lockSanityAssetHash', () => {
  test('checks isolation before taking the transaction-scoped lock', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)

    await lockSanityAssetHash(
      { transactionID: tx.transactionID, payload: { db: tx.db } } as never,
      SHA1_OF_ABC
    )

    expect(log).toEqual([ISOLATION_STATEMENT, LOCK_STATEMENT])
  })

  test('refuses without a transaction and runs no statement', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)

    await expect(
      lockSanityAssetHash({ payload: { db: tx.db } } as never, SHA1_OF_ABC)
    ).rejects.toThrow('refusing without it')
    await expect(lockSanityAssetHash(undefined, SHA1_OF_ABC)).rejects.toThrow('refusing without it')
    expect(log).toEqual([])
  })

  test('refuses when the transaction session is unknown', async () => {
    const tx = fakeTransaction()

    await expect(
      lockSanityAssetHash({ transactionID: 'other', payload: { db: tx.db } } as never, SHA1_OF_ABC)
    ).rejects.toThrow('refusing without it')
  })

  test('returns without locking on adapters that have no advisory locks', async () => {
    const execute = mock(async () => ({ rows: [] }))
    const req = {
      transactionID: 'tx-sqlite',
      payload: {
        db: {
          packageName: '@payloadcms/db-sqlite',
          sessions: {
            'tx-sqlite': { db: { execute }, reject: async () => {}, resolve: async () => {} },
          },
        },
      },
    }

    expect(await lockSanityAssetHash(req as never, SHA1_OF_ABC)).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  test('reports the lock as taken on Postgres', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)

    expect(
      await lockSanityAssetHash(
        { transactionID: tx.transactionID, payload: { db: tx.db } } as never,
        SHA1_OF_ABC
      )
    ).toBe(true)
  })

  test('refuses a non-hex digest before touching the database', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)

    await expect(
      lockSanityAssetHash(
        { transactionID: tx.transactionID, payload: { db: tx.db } } as never,
        "x'); drop table media; --"
      )
    ).rejects.toThrow('SHA-1 hex digest')
    expect(log).toEqual([])
  })

  test('refuses transactions that are not READ COMMITTED before acquiring the lock', async () => {
    const execute = mock(async (query: string) => ({
      rows: query === ISOLATION_STATEMENT ? [{ transaction_isolation: 'repeatable read' }] : [],
    }))
    const req = {
      transactionID: 'tx-rr',
      payload: {
        db: {
          packageName: '@payloadcms/db-postgres',
          sessions: {
            'tx-rr': { db: { execute }, reject: async () => {}, resolve: async () => {} },
          },
        },
      },
    }

    await expect(lockSanityAssetHash(req as never, SHA1_OF_ABC)).rejects.toThrow('READ COMMITTED')
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(ISOLATION_STATEMENT)
  })
})

describe('upload and webhook lock the same content hash', () => {
  test('the upload-side digest produces the lock statement of the delete-side asset id', async () => {
    const log: string[] = []
    const tx = fakeTransaction(log)
    const req = { transactionID: tx.transactionID, payload: { db: tx.db } } as never

    await lockSanityAssetHash(req, await hashUploadBytes({ buffer: Buffer.from('abc') }))
    await lockSanityAssetHash(req, sanityAssetHashFromId(`image-${SHA1_OF_ABC}-1x1-png`) ?? '')

    expect(log).toEqual([ISOLATION_STATEMENT, LOCK_STATEMENT, ISOLATION_STATEMENT, LOCK_STATEMENT])
  })
})
