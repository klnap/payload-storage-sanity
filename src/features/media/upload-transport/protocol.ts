export const SANITY_UPLOAD_PROTOCOL_VERSION = 1 as const
export const SANITY_UPLOAD_TICKET_PATH = '/sanity-upload/tickets'
export const SANITY_UPLOAD_CLAIM_PATH = '/sanity-upload/claims'
const MAX_TOKEN_LENGTH = 8_192
const MAX_TICKET_LIFETIME_MS = 10 * 60 * 1_000
const encoder = new TextEncoder()

export type SanityUploadOperation = 'create' | 'update'

export type SanityUploadTicketClaims = {
  audience: string
  claimEndpoint: string
  collection: string
  dataset: string
  documentId?: number | string
  expiresAt: number
  filename: string
  issuedAt: number
  maxSize: number
  mimeType: string
  nonce: string
  operation: SanityUploadOperation
  projectId: string
  size: number
  subject: string
  version: typeof SANITY_UPLOAD_PROTOCOL_VERSION
}

export type SanityUploadReceiptClaims = {
  assetId: string
  audience: string
  dataset: string
  filename: string
  issuedAt: number
  mimeType: string
  nonce: string
  projectId: string
  size: number
  version: typeof SANITY_UPLOAD_PROTOCOL_VERSION
}

export type SanityUploadTicket = {
  claims: SanityUploadTicketClaims
  token: string
}

export type SanityUploadReceipt = {
  claims: SanityUploadReceiptClaims
  token: string
}

export type SanityClientUploadContext = {
  sanityUpload: {
    protocolVersion: typeof SANITY_UPLOAD_PROTOCOL_VERSION
    receipt: string
    ticket: string
  }
}

function encodeBase64URL(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64URL(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid upload token encoding.')
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function isSafeProtocolURL(value: string): boolean {
  try {
    const url = new URL(value)
    const localHTTP =
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    return (
      (url.protocol === 'https:' || localHTTP) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  if (encoder.encode(secret).byteLength < 32) {
    throw new Error('Upload transport secret must be at least 32 UTF-8 bytes.')
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign', 'verify']
  )
}

async function signClaims<T extends { version: number }>(
  claims: T,
  secret: string
): Promise<string> {
  const key = await importSigningKey(secret)
  const payload = encodeBase64URL(encoder.encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${encodeBase64URL(new Uint8Array(signature))}`
}

async function verifyClaims<T extends { version: number }>(
  token: string,
  secret: string
): Promise<T> {
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('Upload token is too large.')
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) {
    throw new Error('Invalid upload token format.')
  }
  const key = await importSigningKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(decodeBase64URL(signature)),
    toArrayBuffer(encoder.encode(payload))
  )
  if (!valid) throw new Error('Invalid upload token signature.')
  let claims: unknown
  try {
    claims = JSON.parse(new TextDecoder().decode(decodeBase64URL(payload)))
  } catch {
    throw new Error('Invalid upload token claims.')
  }
  if (
    typeof claims !== 'object' ||
    claims === null ||
    !('version' in claims) ||
    claims.version !== SANITY_UPLOAD_PROTOCOL_VERSION
  ) {
    throw new Error('Unsupported upload protocol version.')
  }
  return claims as T
}

export async function signSanityUploadTicket(
  claims: SanityUploadTicketClaims,
  secret: string
): Promise<SanityUploadTicket> {
  return { claims, token: await signClaims(claims, secret) }
}

export async function verifySanityUploadTicket(
  token: string,
  secret: string,
  options: { audience?: string; now?: number } = {}
): Promise<SanityUploadTicketClaims> {
  const claims = await verifyClaims<SanityUploadTicketClaims>(token, secret)
  if (
    !isBoundedString(claims.audience, 2_048) ||
    !isSafeProtocolURL(claims.audience) ||
    !isBoundedString(claims.claimEndpoint, 2_048) ||
    !isSafeProtocolURL(claims.claimEndpoint) ||
    !isBoundedString(claims.nonce, 64) ||
    !isBoundedString(claims.subject, 256) ||
    !isBoundedString(claims.collection, 128) ||
    !isBoundedString(claims.projectId, 128) ||
    !isBoundedString(claims.dataset, 128) ||
    !isBoundedString(claims.filename, 255) ||
    !isBoundedString(claims.mimeType, 255) ||
    !Number.isSafeInteger(claims.size) ||
    claims.size <= 0 ||
    !Number.isSafeInteger(claims.maxSize) ||
    claims.maxSize < claims.size ||
    !Number.isSafeInteger(claims.issuedAt) ||
    !Number.isSafeInteger(claims.expiresAt) ||
    claims.expiresAt <= claims.issuedAt ||
    claims.expiresAt - claims.issuedAt > MAX_TICKET_LIFETIME_MS ||
    (claims.operation !== 'create' && claims.operation !== 'update') ||
    (claims.operation === 'create' && claims.documentId != null) ||
    (claims.operation === 'update' &&
      !(
        Number.isSafeInteger(claims.documentId) ||
        (typeof claims.documentId === 'string' &&
          claims.documentId.length > 0 &&
          claims.documentId.length <= 128)
      ))
  ) {
    throw new Error('Invalid upload ticket claims.')
  }
  if (options.audience !== undefined && claims.audience !== options.audience) {
    throw new Error('Upload ticket audience mismatch.')
  }
  if (claims.expiresAt <= (options.now ?? Date.now())) {
    throw new Error('Upload ticket has expired.')
  }
  if (claims.issuedAt > (options.now ?? Date.now())) {
    throw new Error('Upload ticket issue time is in the future.')
  }
  return claims
}

export async function signSanityUploadReceipt(
  claims: SanityUploadReceiptClaims,
  secret: string
): Promise<SanityUploadReceipt> {
  return { claims, token: await signClaims(claims, secret) }
}

export async function verifySanityUploadReceipt(
  token: string,
  secret: string,
  options: { audience?: string; now?: number } = {}
): Promise<SanityUploadReceiptClaims> {
  const claims = await verifyClaims<SanityUploadReceiptClaims>(token, secret)
  if (
    !isBoundedString(claims.assetId, 255) ||
    !isBoundedString(claims.audience, 2_048) ||
    !isSafeProtocolURL(claims.audience) ||
    !isBoundedString(claims.nonce, 64) ||
    !isBoundedString(claims.projectId, 128) ||
    !isBoundedString(claims.dataset, 128) ||
    !isBoundedString(claims.filename, 255) ||
    !isBoundedString(claims.mimeType, 255) ||
    !Number.isSafeInteger(claims.size) ||
    claims.size <= 0 ||
    !Number.isSafeInteger(claims.issuedAt)
  ) {
    throw new Error('Invalid upload receipt claims.')
  }
  if (options.audience !== undefined && claims.audience !== options.audience) {
    throw new Error('Upload receipt audience mismatch.')
  }
  if (claims.issuedAt > (options.now ?? Date.now())) {
    throw new Error('Upload receipt issue time is in the future.')
  }
  return claims
}

export async function verifySanityClientUploadContext(
  value: unknown,
  secret: string,
  options: { audience?: string; maxSizeBytes?: number; now?: number } = {}
): Promise<{
  receipt: SanityUploadReceiptClaims
  ticket: SanityUploadTicketClaims
}> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sanityUpload' in value) ||
    typeof value.sanityUpload !== 'object' ||
    value.sanityUpload === null
  ) {
    throw new Error('Missing Sanity upload context.')
  }
  const context = value.sanityUpload as Record<string, unknown>
  if (
    context.protocolVersion !== SANITY_UPLOAD_PROTOCOL_VERSION ||
    typeof context.ticket !== 'string' ||
    typeof context.receipt !== 'string'
  ) {
    throw new Error('Invalid Sanity upload context.')
  }
  const ticket = await verifySanityUploadTicket(context.ticket, secret, options)
  if (options.maxSizeBytes != null && ticket.maxSize > options.maxSizeBytes) {
    throw new Error('Upload ticket exceeds the transport size limit.')
  }
  const receipt = await verifySanityUploadReceipt(context.receipt, secret, {
    audience: ticket.audience,
    now: options.now,
  })
  if (
    receipt.nonce !== ticket.nonce ||
    receipt.audience !== ticket.audience ||
    receipt.projectId !== ticket.projectId ||
    receipt.dataset !== ticket.dataset ||
    receipt.filename !== ticket.filename ||
    receipt.mimeType !== ticket.mimeType ||
    receipt.size !== ticket.size ||
    receipt.size > ticket.maxSize ||
    receipt.issuedAt < ticket.issuedAt ||
    receipt.issuedAt > ticket.expiresAt
  ) {
    throw new Error('Upload receipt does not match its ticket.')
  }
  return { receipt, ticket }
}
