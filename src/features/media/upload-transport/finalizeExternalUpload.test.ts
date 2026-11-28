import { describe, expect, test } from 'bun:test'
import type { CollectionAfterChangeHook } from 'payload'
import { readClientUploadContext, SANITY_UPLOAD_CONTEXT_KEY } from './finalizeExternalUpload'

describe('external upload context', () => {
  test('reads Payload’s verified context when file processing removed it from req.file', () => {
    const context = { sanityUpload: { ticket: 'ticket', receipt: 'receipt' } }
    const req = {
      context: { payloadClientUploadContext: context },
    } as unknown as Parameters<CollectionAfterChangeHook>[0]['req']

    expect(readClientUploadContext(req)).toBe(context)
  })

  test('prefers the upload file context and supports the adapter fallback', () => {
    const fileContext = { sanityUpload: 'file-context' }
    const req = {
      file: { clientUploadContext: fileContext },
      context: { [SANITY_UPLOAD_CONTEXT_KEY]: { sanityUpload: 'adapter-context' } },
    } as unknown as Parameters<CollectionAfterChangeHook>[0]['req']

    expect(readClientUploadContext(req)).toBe(fileContext)
  })
})
