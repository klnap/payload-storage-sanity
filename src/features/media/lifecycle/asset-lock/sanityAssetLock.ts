import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { PayloadRequest } from 'payload'
import { hashFileContent } from '@/features/media/lifecycle/dedupe/contentHash'
import {
  resolveSanityUploadBody,
  type UploadFilePayload,
} from '@/features/media/storage-adapter/uploadBody'
import { lockTransactionKey } from './transactionLock'

const LOCK_NAMESPACE = 'payload-storage-sanity:sanity-asset:'
const SHA1_HEX_PATTERN = /^[a-f0-9]{40}$/
const ASSET_ID_SHA1_PATTERN = /^(?:image|file)-([a-f0-9]{40})-/

/** SHA-1 digest embedded in a Sanity asset id. Null for any other id. */
export function sanityAssetHashFromId(assetId: string): string | null {
  return ASSET_ID_SHA1_PATTERN.exec(assetId)?.[1] ?? null
}

/**
 * SHA-1 of the bytes that `handleUpload` sends to Sanity. Sanity derives the asset id from the same
 * digest, so the upload and delete paths lock the same key. Temp-file bodies are hashed from a
 * separate read; the upload body is opened after the lock.
 */
export async function hashUploadBytes(file: UploadFilePayload): Promise<string> {
  const body = resolveSanityUploadBody(file)
  if (Buffer.isBuffer(body)) return hashFileContent(body)

  body.destroy()
  const hash = createHash('sha1')
  for await (const chunk of createReadStream(file.tempFilePath ?? '')) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

/**
 * Takes a transaction-scoped advisory lock for a content hash on the request's own transaction.
 * The lock lasts until that transaction commits or rolls back. Throws on Postgres when the transaction
 * is unreachable or not READ COMMITTED, because the lock then does not close the race.
 * Returns true when the lock is taken. Other adapters have no advisory locks: they return false without locking.
 */
export async function lockSanityAssetHash(
  req: Partial<PayloadRequest> | undefined,
  sha1: string
): Promise<boolean> {
  if (!SHA1_HEX_PATTERN.test(sha1)) {
    throw new Error('Sanity asset lock needs a SHA-1 hex digest.')
  }
  // The digest is validated as hex above, so inlining it into the lock key is safe.
  return lockTransactionKey(req, `${LOCK_NAMESPACE}${sha1}`, 'Sanity asset lock')
}
