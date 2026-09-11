import { describe, expect, test } from 'bun:test'

import {
  isImageFileType,
  normalizeAssetMimeType,
  normalizeImageMimeType,
  resolveSanityAssetType,
  resolveSanityUploadBody,
} from '../../../src/utils/uploadBody.js'

describe('isImageFileType & resolveSanityAssetType', () => {
  test('recognizes all supported image formats', () => {
    const images = [
      'photo.jpg',
      'photo.jpeg',
      'logo.png',
      'graphic.webp',
      'anim.gif',
      'vector.svg',
      'scan.tiff',
      'scan.tif',
      'shot.heic',
      'shot.heif',
      'modern.avif',
      'raw.bmp',
      'icon.ico',
    ]

    for (const filename of images) {
      expect(isImageFileType(undefined, filename)).toBe(true)
      expect(resolveSanityAssetType(undefined, filename)).toBe('image')
    }
  })

  test('recognizes non-image files as file asset type', () => {
    const files = [
      'document.pdf',
      'sheet.xlsx',
      'archive.zip',
      'video.mp4',
      'audio.mp3',
      'data.csv',
      'doc.docx',
    ]

    for (const filename of files) {
      expect(isImageFileType(undefined, filename)).toBe(false)
      expect(resolveSanityAssetType(undefined, filename)).toBe('file')
    }
  })
})

describe('normalizeAssetMimeType', () => {
  test('infers mime type from extension when unknown or generic', () => {
    expect(normalizeImageMimeType(undefined, 'test.png')).toBe('image/png')
    expect(normalizeAssetMimeType('application/octet-stream', 'document.pdf')).toBe(
      'application/pdf'
    )
    expect(normalizeAssetMimeType('application/octet-stream', 'archive.zip')).toBe(
      'application/zip'
    )
    expect(normalizeAssetMimeType('application/octet-stream', 'song.mp3')).toBe('audio/mpeg')
    expect(normalizeAssetMimeType('application/octet-stream', 'movie.mp4')).toBe('video/mp4')
  })
})

describe('resolveSanityUploadBody', () => {
  test('extracts buffer from file.data', () => {
    const buffer = Buffer.from('hello')
    const body = resolveSanityUploadBody({ data: buffer, filename: 'a.png', mimeType: 'image/png' })
    expect(body).toBe(buffer)
  })

  test('converts array to buffer', () => {
    const body = resolveSanityUploadBody({
      data: [1, 2, 3] as never,
      filename: 'a.png',
      mimeType: 'image/png',
    })
    expect(Buffer.isBuffer(body)).toBe(true)
  })
})
