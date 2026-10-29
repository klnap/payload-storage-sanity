import { describe, expect, test } from 'bun:test'

import { fetchSanityUpstreamAsset } from '@/sanity/cdn'

describe('fetchSanityUpstreamAsset', () => {
  test('does not follow redirects to non-allowlisted hosts', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (init?.redirect === 'manual' && url.includes('cdn.sanity.io')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://evil.example.com/asset' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as typeof fetch

    try {
      const response = await fetchSanityUpstreamAsset('https://cdn.sanity.io/images/demo/x.jpg')
      expect(response.status).toBe(502)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('rejects non-allowlisted initial URL', async () => {
    const response = await fetchSanityUpstreamAsset('https://evil.example.com/x')
    expect(response.status).toBe(404)
  })

  // Classification: test-only — redirect limit / cross-host SSRF
  test('follows one allowlisted redirect then returns final response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (init?.redirect === 'manual' && url.includes('cdn.sanity.io/a')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.sanity.io/b/final.jpg' },
        })
      }
      if (init?.redirect === 'manual' && url.includes('cdn.sanity.io/b/final.jpg')) {
        return new Response('ok', { status: 200 })
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as typeof fetch

    try {
      const response = await fetchSanityUpstreamAsset('https://cdn.sanity.io/a/start.jpg')
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('rejects chained redirects beyond one hop', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input)
      if (init?.redirect === 'manual' && url.includes('cdn.sanity.io/a')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.sanity.io/b/mid.jpg' },
        })
      }
      if (init?.redirect === 'manual' && url.includes('cdn.sanity.io/b/mid.jpg')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.sanity.io/c/final.jpg' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    }) as typeof fetch

    try {
      const response = await fetchSanityUpstreamAsset('https://cdn.sanity.io/a/start.jpg')
      expect(response.status).toBe(502)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
