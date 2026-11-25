import { createHash } from 'node:crypto'

/** SHA-1 hex digest of file bytes — matches Sanity sha1hash / assetId for deduplication. */
export function hashFileContent(buffer: Buffer | Uint8Array): string {
  return createHash('sha1').update(buffer).digest('hex')
}
