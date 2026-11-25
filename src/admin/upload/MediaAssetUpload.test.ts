import { describe, expect, test } from 'bun:test'
import {
  canEditAssetPreview,
  canReplaceAssetFile,
  extractDuplicateMediaId,
  getPreviewAspectRatio,
  shouldHideNativeUpload,
  shouldRenderAssetPreview,
  shouldShowBlurPlaceholder,
} from './MediaAssetUpload'

describe('MediaAssetUpload', () => {
  test('uses the source dimensions for the preview aspect ratio', () => {
    expect(getPreviewAspectRatio(1200, 800)).toBe('1200 / 800')
    expect(getPreviewAspectRatio(undefined, 800)).toBeUndefined()
    expect(getPreviewAspectRatio(0, 800)).toBeUndefined()
    expect(getPreviewAspectRatio(Number.POSITIVE_INFINITY, 800)).toBeUndefined()
  })

  test('shows image editing only when Payload has an enabled image editor', () => {
    expect(canEditAssetPreview(false, { crop: false, focalPoint: false })).toBe(false)
    expect(canEditAssetPreview(false, { crop: true, focalPoint: false })).toBe(true)
    expect(canEditAssetPreview(false, { crop: false, focalPoint: true })).toBe(true)
    expect(canEditAssetPreview(true, { crop: true, focalPoint: true })).toBe(false)
  })

  test('renders previews only for saved assets with a supported image source', () => {
    expect(shouldRenderAssetPreview(1, 'https://cdn.sanity.io/image.jpg')).toBe(true)
    expect(shouldRenderAssetPreview(1, undefined)).toBe(false)
    expect(shouldRenderAssetPreview(null, 'https://cdn.sanity.io/image.jpg')).toBe(false)
    expect(shouldRenderAssetPreview(1, 'https://cdn.sanity.io/image.jpg', true)).toBe(false)
  })

  test('shows blur only while the full image is loading', () => {
    expect(shouldShowBlurPlaceholder(true, false)).toBe(true)
    expect(shouldShowBlurPlaceholder(false, false)).toBe(false)
    expect(shouldShowBlurPlaceholder(false, true)).toBe(false)
  })

  test('hides Payload file details only for image selections with a custom preview', () => {
    expect(shouldHideNativeUpload('image/jpeg')).toBe(true)
    expect(shouldHideNativeUpload('application/pdf')).toBe(false)
    expect(shouldHideNativeUpload(undefined)).toBe(false)
  })

  test('shows file replacement only when update permission allows Payload removal', () => {
    expect(canReplaceAssetFile(true, false)).toBe(true)
    expect(canReplaceAssetFile(false, false)).toBe(false)
    expect(canReplaceAssetFile(undefined, false)).toBe(false)
    expect(canReplaceAssetFile(true, true)).toBe(false)
  })

  test('extracts a duplicate asset ID only from the readable duplicate error', () => {
    expect(
      extractDuplicateMediaId(
        'This file is already in your media library (ID 562e03d0-6b5e-4bd6-b896-9879804fdefc). Open the existing asset instead of uploading again.'
      )
    ).toBe('562e03d0-6b5e-4bd6-b896-9879804fdefc')
    expect(
      extractDuplicateMediaId(
        'This file is already in your media library, but you cannot view it. Ask an administrator for access.'
      )
    ).toBeUndefined()
  })
})
