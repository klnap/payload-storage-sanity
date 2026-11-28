import { describe, expect, test } from 'bun:test'
import { resolveSanityMediaFolder } from './mediaFolders'

describe('resolveSanityMediaFolder', () => {
  test('uses per-type defaults and ordinary collection/global precedence', () => {
    expect(resolveSanityMediaFolder('image')).toBe('Payload/images')
    expect(resolveSanityMediaFolder('video')).toBe('Payload/videos')
    expect(resolveSanityMediaFolder('audio')).toBe('Payload/audio')
    expect(resolveSanityMediaFolder('file')).toBe('Payload/files')
    expect(
      resolveSanityMediaFolder('image', { image: 'Collection/images' }, { image: 'Global' })
    ).toBe('Collection/images')
    expect(resolveSanityMediaFolder('image', undefined, { image: 'Global' })).toBe('Global')
    expect(resolveSanityMediaFolder('image', 'Exact/path')).toBe('Exact/path')
  })

  test('supports disabling folder assignment', () => {
    expect(resolveSanityMediaFolder('image', false)).toBe(false)
    expect(resolveSanityMediaFolder('image', { image: false })).toBe(false)
    expect(resolveSanityMediaFolder('image', undefined, false)).toBe(false)
    expect(resolveSanityMediaFolder('image', { image: 'Collection/images' }, false)).toBe(false)
  })
})
