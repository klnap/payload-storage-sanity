import { describe, expect, test } from 'bun:test'

import { joinCdnOriginAndPath, trimTrailingSlash } from './joinCdnOriginAndPath'

describe('trimTrailingSlash', () => {
  test('removes every trailing slash and keeps inner ones', () => {
    expect(trimTrailingSlash('https://images.example.com///')).toBe('https://images.example.com')
    expect(trimTrailingSlash('https://example.com/sanity/')).toBe('https://example.com/sanity')
    expect(trimTrailingSlash('')).toBe('')
    expect(trimTrailingSlash('/')).toBe('')
    expect(trimTrailingSlash('a//b')).toBe('a//b')
  })
})

describe('joinCdnOriginAndPath', () => {
  test('joins origin, optional path prefix, and asset path without doubling slashes', () => {
    expect(joinCdnOriginAndPath('https://cdn.example.com/', '/images/a/b.jpg')).toBe(
      'https://cdn.example.com/images/a/b.jpg'
    )
    expect(joinCdnOriginAndPath('https://proxy.example.com/sanity///', '///files/x.pdf')).toBe(
      'https://proxy.example.com/sanity/files/x.pdf'
    )
    expect(joinCdnOriginAndPath('https://cdn.example.com', '')).toBe('https://cdn.example.com')
    expect(joinCdnOriginAndPath('https://cdn.example.com/', '///')).toBe('https://cdn.example.com')
  })

  test('scales linearly with long runs of slashes', () => {
    // A quadratic trim would take about 4x as long when the input doubles; a linear one about 2x.
    const timeOf = (size: number) => {
      const origin = `https://cdn.example.com${'/'.repeat(size)}x`
      const path = `${'/'.repeat(size)}asset`
      let best = Number.POSITIVE_INFINITY
      for (let run = 0; run < 5; run += 1) {
        const started = performance.now()
        joinCdnOriginAndPath(origin, path)
        best = Math.min(best, performance.now() - started)
      }
      return best
    }
    timeOf(200_000)
    const small = timeOf(200_000)
    const large = timeOf(400_000)
    expect(large / Math.max(small, 0.05)).toBeLessThan(3.5)
  })
})
