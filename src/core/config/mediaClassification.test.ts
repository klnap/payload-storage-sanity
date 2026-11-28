import { describe, expect, test } from 'bun:test'
import { classifyMedia } from './mediaClassification'

describe('classifyMedia', () => {
  test('classifies known MIME and controlled extension hints', () => {
    expect(classifyMedia({ mimeType: 'video/webm' }).mediaType).toBe('video')
    expect(classifyMedia({ filename: 'audio.mp3' })).toMatchObject({
      mediaType: 'audio',
      mimeType: 'audio/mpeg',
      browserPlaybackSupported: true,
    })
    expect(classifyMedia({ filename: 'anything.unknown' }).mediaType).toBe('file')
  })

  test('uses bounded signatures before MIME and extension hints', () => {
    expect(
      classifyMedia({
        mimeType: 'image/png',
        filename: 'picture.png',
        signature: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      })
    ).toMatchObject({ mediaType: 'file', mimeType: 'application/pdf' })
    expect(
      classifyMedia({
        mimeType: 'application/octet-stream',
        filename: 'unknown.bin',
        signature: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      })
    ).toMatchObject({ mediaType: 'image', imageTransformationSupported: true })
  })

  test('recognizes audio MP4 brands before the video fallback', () => {
    expect(classifyMedia({ signature: new TextEncoder().encode('0000ftypM4A ') })).toMatchObject({
      mediaType: 'audio',
      mimeType: 'audio/mp4',
      browserPlaybackSupported: true,
    })
    const genericMp4 = new TextEncoder().encode('0000ftypisom')
    expect(classifyMedia({ filename: 'audio.m4a', signature: genericMp4 })).toMatchObject({
      mediaType: 'audio',
      mimeType: 'audio/mp4',
    })
    expect(classifyMedia({ signature: genericMp4 })).toMatchObject({
      mediaType: 'video',
      mimeType: 'video/mp4',
    })
  })

  test('preserves specific office MIME types for ZIP-based files', () => {
    const signature = Uint8Array.from([0x50, 0x4b, 0x03, 0x04])
    expect(
      classifyMedia({
        filename: 'report.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        signature,
      }).mimeType
    ).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(
      classifyMedia({
        filename: 'report.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        signature,
      }).mimeType
    ).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(
      classifyMedia({
        filename: 'archive.zip',
        mimeType: 'application/pdf',
        signature,
      }).mimeType
    ).toBe('application/zip')
    expect(
      classifyMedia({
        filename: 'archive.pdf',
        mimeType: 'application/pdf',
        signature: Uint8Array.from([0x50, 0x4b, 0x05, 0x06]),
      }).mimeType
    ).toBe('application/zip')
  })

  test('distinguishes playback and transformation support from category', () => {
    expect(classifyMedia({ filename: 'movie.avi' })).toMatchObject({
      mediaType: 'video',
      browserPlaybackSupported: false,
    })
    expect(classifyMedia({ filename: 'vector.svg' })).toMatchObject({
      mediaType: 'image',
      imageTransformationSupported: false,
    })
    expect(classifyMedia({ filename: 'poster.jpg', role: 'poster' }).role).toBe('poster')
    expect(classifyMedia({ filename: 'movie.mp4', role: 'poster' }).role).toBe('asset')
  })
})
