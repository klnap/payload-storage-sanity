import { describe, expect, test } from 'bun:test'
import { APIError } from 'payload'

import { createSanityMediaUploadMaxSizeBeforeChangeHook } from '../../../src/hooks/uploadMaxSize'
import {
  applyPayloadUploadFileSizeLimit,
  classifyUploadMediaKind,
  computeMaxUploadByteLimit,
  formatUploadMaxSizeError,
  MB,
  mergeUploadMaxSizeConfig,
  normalizeUploadMaxSizeConfig,
  resolveUploadMaxSizeBytes,
  uploadMaxSizeConfigHasLimits,
} from '../../../src/utils/uploadMaxSize'

describe('uploadMaxSize utils', () => {
  test('classifyUploadMediaKind', () => {
    expect(classifyUploadMediaKind('image/jpeg', 'photo.jpg')).toBe('image')
    expect(classifyUploadMediaKind('video/mp4', 'clip.mp4')).toBe('video')
    expect(classifyUploadMediaKind('audio/mpeg', 'track.mp3')).toBe('file')
    expect(classifyUploadMediaKind('application/pdf', 'doc.pdf')).toBe('file')
  })

  test('MB constant', () => {
    expect(MB).toBe(1024 * 1024)
  })

  test('normalizeUploadMaxSizeConfig accepts number shorthand', () => {
    expect(normalizeUploadMaxSizeConfig(25 * MB)).toEqual({ default: 25 * MB })
    expect(normalizeUploadMaxSizeConfig({ byType: { image: 10 } })).toEqual({
      byType: { image: 10 },
    })
  })

  test('mergeUploadMaxSizeConfig normalizes number shorthand on collection', () => {
    const merged = mergeUploadMaxSizeConfig({ default: 100 }, 50)
    expect(merged.default).toBe(50)
  })

  test('resolveUploadMaxSizeBytes uses byType then default', () => {
    const merged = mergeUploadMaxSizeConfig({
      default: 100,
      byType: {
        image: 50,
        video: 200,
      },
    })

    expect(resolveUploadMaxSizeBytes('image', merged)).toBe(50)
    expect(resolveUploadMaxSizeBytes('video', merged)).toBe(200)
    expect(resolveUploadMaxSizeBytes('file', merged)).toBe(100)
  })

  test('byType may exceed default', () => {
    const merged = mergeUploadMaxSizeConfig({
      default: 10,
      byType: { video: 500 },
    })
    expect(resolveUploadMaxSizeBytes('video', merged)).toBe(500)
  })

  test('mergeUploadMaxSizeConfig lets collection override plugin', () => {
    const merged = mergeUploadMaxSizeConfig(
      { default: 100, byType: { image: 40 } },
      { byType: { image: 80 } }
    )

    expect(merged.default).toBe(100)
    expect(merged.byType?.image).toBe(80)
    expect(resolveUploadMaxSizeBytes('image', merged)).toBe(80)
  })

  test('mergeUploadMaxSizeConfig deep-merges byType keys', () => {
    const merged = mergeUploadMaxSizeConfig(
      { default: 100, byType: { image: 40, video: 200 } },
      { byType: { file: 5 } }
    )

    expect(merged.byType?.image).toBe(40)
    expect(merged.byType?.video).toBe(200)
    expect(merged.byType?.file).toBe(5)
  })

  test('computeMaxUploadByteLimit takes max across merged collection configs', () => {
    const max = computeMaxUploadByteLimit(
      { default: 10, byType: { video: 500 } },
      {
        media: { uploadMaxSize: { byType: { image: 80 } } },
        assets: true,
      }
    )
    expect(max).toBe(500)
  })

  test('applyPayloadUploadFileSizeLimit raises upload.limits.fileSize', () => {
    const next = applyPayloadUploadFileSizeLimit({} as never, 500)
    expect(next.upload?.limits?.fileSize).toBe(500)
    expect(next.bodyParser).toBeUndefined()
  })

  test('applyPayloadUploadFileSizeLimit never lowers a larger user limit', () => {
    const next = applyPayloadUploadFileSizeLimit(
      {
        upload: { limits: { fileSize: 2_000 } },
        bodyParser: { limits: { fileSize: 1_500 } },
      } as never,
      500
    )
    expect(next.upload?.limits?.fileSize).toBe(2_000)
  })

  test('applyPayloadUploadFileSizeLimit respects larger bodyParser-only limit', () => {
    const next = applyPayloadUploadFileSizeLimit(
      {
        bodyParser: { limits: { fileSize: 3_000 } },
      } as never,
      500
    )
    expect(next.upload?.limits?.fileSize).toBe(3_000)
  })

  test('uploadMaxSizeConfigHasLimits', () => {
    expect(uploadMaxSizeConfigHasLimits({})).toBe(false)
    expect(uploadMaxSizeConfigHasLimits({ default: 1 })).toBe(true)
    expect(uploadMaxSizeConfigHasLimits({ byType: { file: 1 } })).toBe(true)
  })

  test('formatUploadMaxSizeError', () => {
    expect(formatUploadMaxSizeError('image', 5 * 1024 * 1024, 2 * 1024 * 1024)).toContain(
      'Image'
    )
    expect(formatUploadMaxSizeError('image', 5 * 1024 * 1024, 2 * 1024 * 1024)).toContain('MB')
  })
})

describe('createSanityMediaUploadMaxSizeBeforeChangeHook', () => {
  test('no-ops when no limits configured', async () => {
    const hook = createSanityMediaUploadMaxSizeBeforeChangeHook({})
    const req = {
      file: { data: Buffer.alloc(999), mimetype: 'image/png', name: 'a.png', size: 999 },
    } as never

    const result = await hook({ data: {}, operation: 'create', req } as never)
    expect(result).toEqual({})
  })

  test('rejects oversized image on create', async () => {
    const hook = createSanityMediaUploadMaxSizeBeforeChangeHook({
      plugin: { byType: { image: 100 } },
    })
    const req = {
      file: {
        data: Buffer.alloc(200),
        mimetype: 'image/png',
        name: 'a.png',
        size: 200,
      },
    } as never

    await expect(hook({ data: {}, operation: 'create', req } as never)).rejects.toBeInstanceOf(
      APIError
    )
  })

  test('skips metadata-only update', async () => {
    const hook = createSanityMediaUploadMaxSizeBeforeChangeHook({
      plugin: { default: 1 },
    })
    const req = {} as never

    await expect(
      hook({ data: { alt: 'x' }, operation: 'update', req } as never)
    ).resolves.toEqual({ alt: 'x' })
  })
})
