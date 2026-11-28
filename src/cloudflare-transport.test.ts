import { describe, expect, test } from 'bun:test'
import { cloudflareTransport } from './cloudflare-transport'

describe('cloudflareTransport', () => {
  test('configures the versioned transport with the default size limit', () => {
    expect(
      cloudflareTransport({
        secret: 'a test secret with at least thirty-two bytes',
        workerUrl: 'https://uploads.example.test',
      })
    ).toEqual({
      endpoint: 'https://uploads.example.test',
      maxSizeBytes: 50 * 1024 * 1024,
      protocolVersion: 1,
      secret: 'a test secret with at least thirty-two bytes',
    })
  })

  test('accepts an explicit transport size limit', () => {
    expect(
      cloudflareTransport({
        maxSizeBytes: 8_000,
        secret: 'a test secret with at least thirty-two bytes',
        workerUrl: 'https://uploads.example.test',
      }).maxSizeBytes
    ).toBe(8_000)
  })
})
