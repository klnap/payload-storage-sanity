import type { PayloadRequest } from 'payload'

/** Default max raw JSON body for Sanity webhooks (256 KiB). */
export const DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES = 256 * 1024

/** @deprecated Use {@link DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES}. */
export const MAX_SANITY_WEBHOOK_BODY_BYTES = DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES

export type ReadWebhookBodyResult =
  | { ok: true; rawBody: string }
  | { ok: false; reason: 'empty' | 'too_large' }

function declaredContentLength(headers: Headers): number | null {
  const raw = headers.get('content-length')
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

/**
 * Reads the webhook raw body with an enforced byte cap.
 * Prefers Content-Length early rejection, then streams when `req.body` is available,
 * otherwise falls back to `req.text()` / string `req.body` and checks length after read.
 */
export async function readWebhookRawBody(
  req: PayloadRequest,
  maxBodyBytes: number
): Promise<ReadWebhookBodyResult> {
  const declared = declaredContentLength(req.headers)
  if (declared != null && declared > maxBodyBytes) {
    return { ok: false, reason: 'too_large' }
  }

  const stream = req.body
  if (stream != null && typeof (stream as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (stream as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value || value.byteLength === 0) continue
        total += value.byteLength
        if (total > maxBodyBytes) {
          try {
            await reader.cancel()
          } catch {
            // ignore cancel errors
          }
          return { ok: false, reason: 'too_large' }
        }
        chunks.push(value)
      }
    } catch {
      return { ok: false, reason: 'empty' }
    }

    if (total === 0) {
      return { ok: false, reason: 'empty' }
    }

    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { ok: true, rawBody: new TextDecoder('utf-8').decode(merged) }
  }

  if (req.text != null) {
    const rawBody = await req.text()
    if (rawBody.length > maxBodyBytes) {
      return { ok: false, reason: 'too_large' }
    }
    if (rawBody.length === 0) {
      return { ok: false, reason: 'empty' }
    }
    return { ok: true, rawBody }
  }

  const body = req.body
  if (body != null && Object.prototype.toString.call(body) === '[object String]') {
    const rawBody = String(body)
    if (rawBody.length > maxBodyBytes) {
      return { ok: false, reason: 'too_large' }
    }
    if (rawBody.length === 0) {
      return { ok: false, reason: 'empty' }
    }
    return { ok: true, rawBody }
  }

  return { ok: false, reason: 'empty' }
}

/** Positive finite integer byte limit, or null when unset / invalid for caller to default. */
export function normalizeWebhookMaxBodySizeBytes(value: unknown): number | null {
  if (value == null) return null
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return null
  }
  return value
}

export function isValidWebhookMaxBodySizeBytes(value: unknown): value is number {
  return normalizeWebhookMaxBodySizeBytes(value) != null
}
