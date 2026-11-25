import { describe, expect, test } from 'bun:test'
import type { PayloadRequest } from 'payload'
import { readWebhookRawBody } from './readWebhookBody'

describe('readWebhookRawBody text fallback enforces a byte cap', () => {
  test('a body under the cap in UTF-16 units but over it in bytes is refused', async () => {
    const text = 'é'.repeat(200) // 200 code units, 400 UTF-8 bytes
    const req = { headers: new Headers(), text: async () => text } as unknown as PayloadRequest
    expect(await readWebhookRawBody(req, 300)).toEqual({ ok: false, reason: 'too_large' })
  })

  test('a body within the byte cap is accepted with its encoded bytes', async () => {
    const text = '{"ids":{}}'
    const req = { headers: new Headers(), text: async () => text } as unknown as PayloadRequest
    const result = await readWebhookRawBody(req, 300)
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.rawBytes.byteLength).toBe(new TextEncoder().encode(text).byteLength)
  })
})
