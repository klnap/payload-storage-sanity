import { describe, expect, test } from 'bun:test'

import { isSanityCompatibleHost } from '@/sanity/cdn'

describe('isSanityCompatibleHost', () => {
  test('allows cdn.sanity.io', () => {
    expect(isSanityCompatibleHost('https://cdn.sanity.io/images/p/d/file.jpg')).toBe(true)
  })

  test('rejects lookalike subdomains', () => {
    expect(isSanityCompatibleHost('https://cdn.sanity.io.evil.com/x')).toBe(false)
  })

  test('rejects userinfo host confusion', () => {
    expect(isSanityCompatibleHost('https://cdn.sanity.io@evil.com/x')).toBe(false)
  })

  test('allows custom cdn origin host', () => {
    expect(
      isSanityCompatibleHost('https://assets.example.com/x', {
        cdnBaseUrl: 'https://assets.example.com',
      })
    ).toBe(true)
  })

  // Classification: test-only — SSRF allowlist edge cases
  test('rejects non-http schemes', () => {
    expect(isSanityCompatibleHost('file:///etc/passwd')).toBe(false)
    expect(isSanityCompatibleHost('javascript:alert(1)')).toBe(false)
    expect(isSanityCompatibleHost('data:text/plain,hi')).toBe(false)
  })

  test('scheme-relative cdn.sanity.io URL is allowlisted', () => {
    expect(isSanityCompatibleHost('//cdn.sanity.io/images/p/d/x.jpg')).toBe(true)
  })

  test('normalizes host casing', () => {
    expect(isSanityCompatibleHost('https://CDN.SANITY.IO/images/p/d/x.jpg')).toBe(true)
  })
})
