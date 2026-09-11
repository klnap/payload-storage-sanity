import { createHmac, timingSafeEqual } from 'node:crypto'

export type VerifySanityWebhookArgs = {
  rawBody: string
  signatureHeader: string | null
  secret: string
  maxAgeSeconds?: number
}

export type VerifySanityWebhookResult = { valid: true } | { valid: false; reason: string }

type ParsedSignatureHeader = {
  timestamp?: string
  signature?: string
}

function parseSignatureHeader(header: string): ParsedSignatureHeader {
  const parts = header.split(',').map((part) => part.trim())
  const parsed: ParsedSignatureHeader = {}

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (!key || !value) continue
    if (key === 't') parsed.timestamp = value
    if (key === 'v1') parsed.signature = value
  }

  return parsed
}

/** Validates Sanity webhook HMAC signatures (`sanity-webhook-signature` header). */
export function verifySanityWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  maxAgeSeconds = 300,
}: VerifySanityWebhookArgs): VerifySanityWebhookResult {
  if (!signatureHeader) {
    return { valid: false, reason: 'Missing sanity-webhook-signature header' }
  }

  if (!secret) {
    return { valid: false, reason: 'Webhook secret is not configured' }
  }

  const { timestamp, signature } = parseSignatureHeader(signatureHeader)

  if (!timestamp || !signature) {
    return { valid: false, reason: 'Malformed sanity-webhook-signature header' }
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > maxAgeSeconds) {
    return { valid: false, reason: 'Webhook signature timestamp is outside the allowed window' }
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex')

  try {
    const valid = timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    return valid ? { valid: true } : { valid: false, reason: 'Invalid webhook signature' }
  } catch {
    return { valid: false, reason: 'Invalid webhook signature encoding' }
  }
}
