/** Classification: test-only — webhook handler verifies signature over req.text raw bytes. */
import { describe, expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import {
  createSanityWebhookEndpoint,
  DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES,
  MAX_SANITY_WEBHOOK_BODY_BYTES,
  readWebhookRawBody,
} from '@/features/asset-sync'

function signBody(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

function streamFromString(value: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(value)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe('createSanityWebhookEndpoint', () => {
  test('rejects request when signature does not match raw body bytes', async () => {
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
    })

    const canonical = JSON.stringify({
      ids: { updated: ['image-a'] },
      projectId: 'p',
      dataset: 'd',
    })
    const wrongBody = `{\n  "ids": { "updated": ["image-a"] },\n  "projectId": "p",\n  "dataset": "d"\n}`

    const req = {
      text: async () => wrongBody,
      headers: new Headers({
        'sanity-webhook-signature': signBody(canonical, 'secret'),
      }),
      payload: { logger: { warn: mock(() => {}) } },
      t: (key: string) => key,
    }

    const response = await endpoint.handler(req as never)
    expect(response.status).toBe(401)
  })

  test('uses the default body size cap', () => {
    expect(DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES).toBe(256 * 1024)
    expect(MAX_SANITY_WEBHOOK_BODY_BYTES).toBe(DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES)
  })

  test('accepts a body below a custom larger limit', async () => {
    const body = JSON.stringify({
      ids: { updated: ['image-a'] },
      projectId: 'p',
      dataset: 'd',
    })
    const endpoint = createSanityWebhookEndpoint({
      client: {
        getDocument: mock(async () => null),
      } as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: 10 * 1024,
    })

    const req = {
      text: async () => body,
      headers: new Headers({
        'sanity-webhook-signature': signBody(body, 'secret'),
        'content-length': String(body.length),
      }),
      payload: {
        find: mock(async () => ({ docs: [], hasNextPage: false })),
        logger: { warn: mock(() => {}), error: mock(() => {}) },
      },
      t: (key: string) => key,
    }

    const response = await endpoint.handler(req as never)
    expect(response.status).toBe(200)
  })

  test('accepts a body exactly at the configured limit', async () => {
    const limit = 64
    const body = 'a'.repeat(limit)
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: limit,
    })

    const req = {
      text: async () => body,
      headers: new Headers({
        'sanity-webhook-signature': signBody(body, 'secret'),
        'content-length': String(limit),
      }),
      payload: { logger: { warn: mock(() => {}), error: mock(() => {}) } },
      t: (key: string) => key,
    }

    const response = await endpoint.handler(req as never)
    // Exact-size body is accepted for size gate; JSON parse may fail → 400, not 413
    expect(response.status).not.toBe(413)
  })

  test('rejects oversized webhook bodies before signature verification', async () => {
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: 32,
    })

    const body = 'x'.repeat(64)
    const req = {
      text: async () => body,
      headers: new Headers(),
      payload: { logger: { warn: mock(() => {}) } },
      t: (key: string) => key,
    }

    const response = await endpoint.handler(req as never)
    expect(response.status).toBe(413)
  })

  test('rejects when Content-Length already exceeds the limit without reading the body', async () => {
    const text = mock(async () => {
      throw new Error('text() should not be called')
    })
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: 16,
    })

    const response = await endpoint.handler({
      text,
      headers: new Headers({ 'content-length': '100' }),
      payload: { logger: { warn: mock(() => {}) } },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(413)
    expect(text).not.toHaveBeenCalled()
  })

  test('rejects streamed bodies that exceed the limit mid-read', async () => {
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: 8,
    })

    const response = await endpoint.handler({
      body: streamFromString('0123456789'),
      headers: new Headers(),
      payload: { logger: { warn: mock(() => {}) } },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(413)
  })

  test('ignores malformed Content-Length and still enforces the read limit', async () => {
    const body = 'x'.repeat(40)
    const endpoint = createSanityWebhookEndpoint({
      client: {} as never,
      collectionSlug: 'media',
      webhookSecret: 'secret',
      projectId: 'p',
      dataset: 'd',
      maxBodySizeBytes: 16,
    })

    const response = await endpoint.handler({
      text: async () => body,
      headers: new Headers({ 'content-length': 'not-a-number' }),
      payload: { logger: { warn: mock(() => {}) } },
      t: (key: string) => key,
    } as never)

    expect(response.status).toBe(413)
  })
})

describe('readWebhookRawBody', () => {
  test('returns empty when no body is available', async () => {
    const result = await readWebhookRawBody(
      { headers: new Headers() } as never,
      DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES
    )
    expect(result).toEqual({ ok: false, reason: 'empty' })
  })

  test('reads a stream at the exact limit', async () => {
    const body = 'exact!'
    const result = await readWebhookRawBody(
      {
        body: streamFromString(body),
        headers: new Headers({ 'content-length': String(body.length) }),
      } as never,
      body.length
    )
    expect(result).toEqual({ ok: true, rawBody: body })
  })
})
