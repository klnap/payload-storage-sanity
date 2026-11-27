import { describe, expect, test } from 'bun:test'

import { parseSanityAssetFolderPath } from './sanityFolderPath'

describe('parseSanityAssetFolderPath', () => {
  test('splits nested paths and ignores surrounding slashes and spaces', () => {
    expect(parseSanityAssetFolderPath('website/images')).toEqual(['website', 'images'])
    expect(parseSanityAssetFolderPath('  //website/images///  ')).toEqual(['website', 'images'])
  })

  test('rejects empty, dot, traversal, backslash, and control-character segments', () => {
    for (const path of ['', '/', '///', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'a/\u0001b', 42]) {
      expect(() => parseSanityAssetFolderPath(path)).toThrow()
    }
  })

  test('handles long runs of slashes in linear time', () => {
    const timeOf = (size: number) => {
      const value = `${'/'.repeat(size)}a${'/'.repeat(size)}`
      const started = performance.now()
      parseSanityAssetFolderPath(value)
      return performance.now() - started
    }
    timeOf(200_000)
    const small = timeOf(200_000)
    const large = timeOf(400_000)
    expect(large / Math.max(small, 0.05)).toBeLessThan(3.5)
  })
})
