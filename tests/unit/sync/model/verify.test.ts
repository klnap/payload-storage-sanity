import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import { verifySanityWebhookSignature } from '@/features/asset-sync'

function signBody(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

describe('verifySanityWebhookSignature', () => {
  test('accepts a valid signature', () => {
    const body = JSON.stringify({ ids: { deleted: ['image-a'] } })
    const result = verifySanityWebhookSignature({
      rawBody: body,
      signatureHeader: signBody(body, 'secret'),
      secret: 'secret',
    })

    expect(result).toEqual({ valid: true })
  })

  test('rejects an invalid signature', () => {
    const body = JSON.stringify({ ids: { deleted: ['image-a'] } })
    const result = verifySanityWebhookSignature({
      rawBody: body,
      signatureHeader: 't=1,v1=deadbeef',
      secret: 'secret',
      maxAgeSeconds: 999999999,
    })

    expect(result.valid).toBe(false)
  })

  test('rejects missing header', () => {
    const result = verifySanityWebhookSignature({
      rawBody: '{}',
      signatureHeader: null,
      secret: 'secret',
    })

    expect(result).toEqual({ valid: false, reason: 'Missing sanity-webhook-signature header' })
  })

  test('rejects expired signature timestamps', () => {
    const body = JSON.stringify({ ids: { updated: ['image-a'] } })
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 600
    const result = verifySanityWebhookSignature({
      rawBody: body,
      signatureHeader: signBody(body, 'secret', expiredTimestamp),
      secret: 'secret',
      maxAgeSeconds: 300,
    })

    expect(result).toEqual({
      valid: false,
      reason: 'Webhook signature timestamp is outside the allowed window',
    })
  })

  test('rejects malformed signature headers', () => {
    const result = verifySanityWebhookSignature({
      rawBody: '{}',
      signatureHeader: 'not-a-valid-header',
      secret: 'secret',
    })

    expect(result).toEqual({ valid: false, reason: 'Malformed sanity-webhook-signature header' })
  })

  test('rejects when webhook secret is not configured', () => {
    const result = verifySanityWebhookSignature({
      rawBody: '{}',
      signatureHeader: 't=1,v1=abc',
      secret: '',
    })

    expect(result).toEqual({ valid: false, reason: 'Webhook secret is not configured' })
  })

  test('rejects signatures with wrong byte length without throwing', () => {
    const body = JSON.stringify({ ids: { updated: ['image-a'] } })
    const timestamp = Math.floor(Date.now() / 1000)
    const result = verifySanityWebhookSignature({
      rawBody: body,
      signatureHeader: `t=${timestamp},v1=abcd`,
      secret: 'secret',
      maxAgeSeconds: 300,
    })

    expect(result).toEqual({ valid: false, reason: 'Invalid webhook signature' })
  })

  test('signature is bound to raw body bytes (JSON-equivalent payloads differ)', () => {
    const canonical = JSON.stringify({ ids: { deleted: ['image-a'] } })
    const pretty = `{\n  "ids": { "deleted": ["image-a"] }\n}`
    expect(canonical).not.toBe(pretty)

    const headerForCanonical = signBody(canonical, 'secret')
    const result = verifySanityWebhookSignature({
      rawBody: pretty,
      signatureHeader: headerForCanonical,
      secret: 'secret',
    })

    expect(result).toEqual({ valid: false, reason: 'Invalid webhook signature' })
  })

  test('rejects invalid signature encoding', () => {
    const body = JSON.stringify({ ids: { updated: ['image-a'] } })
    const timestamp = Math.floor(Date.now() / 1000)
    const result = verifySanityWebhookSignature({
      rawBody: body,
      signatureHeader: `t=${timestamp},v1=not-hex`,
      secret: 'secret',
      maxAgeSeconds: 300,
    })

    expect(result).toEqual({ valid: false, reason: 'Invalid webhook signature encoding' })
  })
})
