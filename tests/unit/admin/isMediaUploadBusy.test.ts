import { describe, expect, test } from 'bun:test'

import {
  hasMediaBytesUpload,
  isMediaUploadBusy,
} from '../../../src/admin/isMediaUploadBusy.js'

describe('hasMediaBytesUpload', () => {
  test('true when a new File is selected', () => {
    expect(
      hasMediaBytesUpload({
        fileValue: new File(['x'], 'a.png', { type: 'image/png' }),
      })
    ).toBe(true)
  })

  test('true when crop edits are pending', () => {
    expect(
      hasMediaBytesUpload({
        fileValue: undefined,
        uploadEdits: { crop: { unit: '%', x: 0, y: 0, width: 50, height: 50 } },
      })
    ).toBe(true)
  })

  test('false for metadata-only save', () => {
    expect(hasMediaBytesUpload({ fileValue: undefined, uploadEdits: undefined })).toBe(
      false
    )
  })

  test('false for focal-only edit-upload save (default 100% crop)', () => {
    expect(
      hasMediaBytesUpload({
        fileValue: undefined,
        uploadEdits: {
          crop: { unit: '%', x: 0, y: 0, width: 100, height: 100 },
          focalPoint: { x: 20, y: 30 },
          widthInPixels: 1200,
          heightInPixels: 800,
        },
        docWidth: 1200,
        docHeight: 800,
      })
    ).toBe(false)
  })
})

describe('isMediaUploadBusy', () => {
  test('idle when not processing and upload status idle', () => {
    expect(
      isMediaUploadBusy({ processing: false, uploadStatus: 'idle', hasBytesUpload: false })
    ).toBe(false)
    expect(
      isMediaUploadBusy({ processing: false, hasBytesUpload: false })
    ).toBe(false)
  })

  test('not busy on processing without bytes (alt-only save)', () => {
    expect(
      isMediaUploadBusy({ processing: true, uploadStatus: 'idle', hasBytesUpload: false })
    ).toBe(false)
  })

  test('busy when processing with new file', () => {
    expect(
      isMediaUploadBusy({ processing: true, uploadStatus: 'idle', hasBytesUpload: true })
    ).toBe(true)
  })

  test('busy when paste-url upload status is uploading', () => {
    expect(
      isMediaUploadBusy({
        processing: false,
        uploadStatus: 'uploading',
        hasBytesUpload: false,
      })
    ).toBe(true)
  })
})
