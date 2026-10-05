import { describe, expect, test } from 'bun:test'

import {
  hasUploadEditsOnRequest,
  isCloudStorageUpstreamMetadataUpdate,
} from '../../../src/utils/uploadEdits.js'

describe('uploadEdits helpers', () => {
  test('hasUploadEditsOnRequest detects crop query', () => {
    expect(
      hasUploadEditsOnRequest({
        query: { uploadEdits: { crop: { width: 1 } } },
      } as never)
    ).toBe(true)
  })

  test('isCloudStorageUpstreamMetadataUpdate requires skipCloudStorage and sanity patch', () => {
    expect(
      isCloudStorageUpstreamMetadataUpdate(
        { context: { skipCloudStorage: true } } as never,
        { sanity: { id: 'image-a' } }
      )
    ).toBe(true)
    expect(
      isCloudStorageUpstreamMetadataUpdate(
        { context: {} } as never,
        { sanity: { id: 'image-a' } }
      )
    ).toBe(false)
  })
})
