import { describe, expect, test } from 'bun:test'

import {
  hasUploadEditsOnRequest,
  isCloudStorageUpstreamMetadataUpdate,
  isDefaultFullCrop,
  isFocalOnlyUploadEdits,
  uploadEditsRequireBytesReupload,
} from '../../../src/utils/uploadEdits.js'

const defaultCrop = { unit: '%' as const, x: 0, y: 0, width: 100, height: 100 }

describe('uploadEdits helpers', () => {
  test('hasUploadEditsOnRequest detects uploadEdits query', () => {
    expect(
      hasUploadEditsOnRequest({
        query: { uploadEdits: { crop: { width: 1 } } },
      } as never)
    ).toBe(true)
    expect(
      hasUploadEditsOnRequest({
        query: { uploadEdits: { focalPoint: { x: 10, y: 20 } } },
      } as never)
    ).toBe(true)
  })

  test('isDefaultFullCrop accepts admin default and missing crop', () => {
    expect(isDefaultFullCrop(undefined)).toBe(true)
    expect(isDefaultFullCrop(defaultCrop)).toBe(true)
    expect(isDefaultFullCrop({ unit: '%', x: 0, y: 0, width: 50, height: 100 })).toBe(
      false
    )
  })

  test('uploadEditsRequireBytesReupload false for focal-only modal payload', () => {
    expect(
      uploadEditsRequireBytesReupload(
        {
          crop: defaultCrop,
          focalPoint: { x: 12, y: 34 },
          widthInPixels: 600,
          heightInPixels: 400,
        },
        { docWidth: 600, docHeight: 400 }
      )
    ).toBe(false)
  })

  test('uploadEditsRequireBytesReupload true for real crop or resize', () => {
    expect(
      uploadEditsRequireBytesReupload(
        { crop: { unit: '%', x: 0, y: 0, width: 50, height: 100 } },
        { docWidth: 600, docHeight: 400 }
      )
    ).toBe(true)
    expect(
      uploadEditsRequireBytesReupload(
        {
          crop: defaultCrop,
          widthInPixels: 300,
          heightInPixels: 400,
        },
        { docWidth: 600, docHeight: 400 }
      )
    ).toBe(true)
  })

  test('isFocalOnlyUploadEdits when query has default crop only', () => {
    expect(
      isFocalOnlyUploadEdits(
        {
          query: {
            uploadEdits: {
              crop: defaultCrop,
              focalPoint: { x: 1, y: 2 },
              widthInPixels: 800,
              heightInPixels: 600,
            },
          },
        } as never,
        { originalDoc: { width: 800, height: 600 } }
      )
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
