import {
  SANITY_UPLOAD_PROTOCOL_VERSION,
  type SanityUploadTicketClaims,
  signSanityUploadReceipt,
  verifySanityUploadTicket,
} from '../protocol'

const MAX_SANITY_RESPONSE_BYTES = 64 * 1024
const DEFAULT_SANITY_API_VERSION = '2026-01-01'
const TICKET_CLAIM_KEYS = [
  'audience',
  'claimEndpoint',
  'collection',
  'dataset',
  'expiresAt',
  'filename',
  'issuedAt',
  'maxSize',
  'mimeType',
  'nonce',
  'operation',
  'projectId',
  'size',
  'subject',
  'version',
] as const

export type CloudflareUploadEnvironment = {
  SANITY_TOKEN: string
  UPLOAD_TRANSPORT_SECRET: string
  SANITY_API_VERSION?: string
  ALLOW_LOCAL_HTTP?: string
}

export type CloudflareFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: CORS_HEADERS })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function isSafeProtocolURL(value: string, allowLocalHTTP: boolean): boolean {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'https:' ||
        (allowLocalHTTP &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function hasAllowedTicketShape(claims: SanityUploadTicketClaims, ticket: string): boolean {
  try {
    const encoded = ticket.split('.')[0]
    if (!encoded) return false
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(
            encoded.replaceAll('-', '+').replaceAll('_', '/') +
              '='.repeat((4 - (encoded.length % 4)) % 4)
          ),
          (character) => character.charCodeAt(0)
        )
      )
    ) as Record<string, unknown>
    const keys = Object.keys(payload).sort()
    const expected: string[] = [...TICKET_CLAIM_KEYS]
    if (Object.hasOwn(payload, 'documentId')) expected.push('documentId')
    expected.sort()
    return (
      keys.length === expected.length &&
      keys.every((key, index) => key === expected[index]) &&
      (claims.operation !== 'create' || !Object.hasOwn(payload, 'documentId'))
    )
  } catch {
    return false
  }
}

function safeSanityTarget(
  claims: SanityUploadTicketClaims,
  kind: 'images' | 'files',
  apiVersion: string
) {
  if (
    !/^[a-z0-9]+$/i.test(claims.projectId) ||
    !/^[a-z0-9_-]+$/i.test(claims.dataset) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(apiVersion)
  ) {
    throw new Error('invalid target')
  }
  return new URL(
    `https://${claims.projectId}.api.sanity.io/v${apiVersion}/assets/${kind}/${encodeURIComponent(claims.dataset)}?filename=${encodeURIComponent(claims.filename)}`
  )
}

async function readBoundedJSON(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) throw new Error('missing response body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SANITY_RESPONSE_BYTES) throw new Error('response too large')
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('invalid response')
  }
  return value as Record<string, unknown>
}

function trustedAsset(
  value: Record<string, unknown>,
  claims: SanityUploadTicketClaims,
  kind: 'images' | 'files'
): string | null {
  const expectedType = kind === 'images' ? 'sanity.imageAsset' : 'sanity.fileAsset'
  const idPrefix = kind === 'images' ? 'image-' : 'file-'
  if (
    value._type !== expectedType ||
    typeof value._id !== 'string' ||
    !value._id.startsWith(idPrefix) ||
    value._id.length > 255 ||
    typeof value.url !== 'string' ||
    value.size !== claims.size ||
    typeof value.assetId !== 'string' ||
    value.assetId.length === 0 ||
    value.assetId.length > 128 ||
    !value._id.startsWith(`${idPrefix}${value.assetId}-`)
  ) {
    return null
  }
  try {
    const url = new URL(value.url)
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    if (
      url.origin !== 'https://cdn.sanity.io' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      segments[0] !== kind ||
      segments[1] !== claims.projectId ||
      segments[2] !== claims.dataset ||
      !segments[3] ||
      !segments[3].startsWith(value.assetId) ||
      !['.', '-'].includes(segments[3][value.assetId.length] ?? '')
    ) {
      return null
    }
  } catch {
    return null
  }
  return value._id
}

export async function handleCloudflareUpload(
  request: Request,
  env: CloudflareUploadEnvironment,
  fetcher: CloudflareFetch = fetch
): Promise<Response> {
  const body = request.body
  const cancelRequest = (reason?: unknown) => body?.cancel(reason).catch(() => undefined)
  if (request.method === 'OPTIONS') {
    const method = request.headers.get('access-control-request-method')
    const headers = request.headers.get('access-control-request-headers')?.toLowerCase().split(',')
    if (
      method !== 'POST' ||
      headers?.some((header) => !['authorization', 'content-type'].includes(header.trim()))
    ) {
      return jsonError('Invalid upload preflight request.', 400)
    }
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (request.method !== 'POST' || !body) {
    await cancelRequest()
    return jsonError('Invalid upload request.', 400)
  }
  const authorization = request.headers.get('authorization')
  const ticket = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!ticket || !env.UPLOAD_TRANSPORT_SECRET || !env.SANITY_TOKEN) {
    await cancelRequest()
    return jsonError('Invalid upload ticket.', 401)
  }

  let claims: SanityUploadTicketClaims
  let kind: 'images' | 'files'
  let target: URL
  try {
    const allowLocalHTTP = env.ALLOW_LOCAL_HTTP === 'true'
    claims = await verifySanityUploadTicket(ticket, env.UPLOAD_TRANSPORT_SECRET, {
      audience: request.url,
    })
    if (
      !hasAllowedTicketShape(claims, ticket) ||
      !isSafeProtocolURL(request.url, allowLocalHTTP) ||
      !isSafeProtocolURL(claims.claimEndpoint, allowLocalHTTP) ||
      !isSafeProtocolURL(claims.audience, allowLocalHTTP)
    ) {
      throw new Error('invalid ticket')
    }
    kind = claims.mimeType.startsWith('image/') ? 'images' : 'files'
    target = safeSanityTarget(claims, kind, env.SANITY_API_VERSION ?? DEFAULT_SANITY_API_VERSION)
  } catch {
    await cancelRequest()
    return jsonError('Invalid or expired upload ticket.', 401)
  }

  const contentLength = request.headers.get('content-length')
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) !== claims.size)
  ) {
    await cancelRequest()
    return jsonError('Upload size does not match its signed ticket.', 400)
  }

  let claimResponse: Response
  try {
    claimResponse = await fetcher(claims.claimEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ticket}` },
      redirect: 'manual',
    })
  } catch {
    await cancelRequest()
    return jsonError('Upload claim could not be confirmed.', 502)
  }
  if (claimResponse.status !== 201) {
    await claimResponse.body?.cancel().catch(() => undefined)
    await cancelRequest()
    return claimResponse.status === 409
      ? jsonError('Upload ticket was already claimed or finalized.', 409)
      : jsonError('Upload claim could not be confirmed.', 502)
  }
  try {
    const claim = await readBoundedJSON(claimResponse)
    if (claim.status !== 'claimed' || claim.protocolVersion !== SANITY_UPLOAD_PROTOCOL_VERSION) {
      await cancelRequest()
      return jsonError('Upload claim could not be confirmed.', 502)
    }
  } catch {
    await cancelRequest()
    return jsonError('Upload claim could not be confirmed.', 502)
  }

  const controller = new AbortController()
  const reader = body.getReader()
  let bytesRead = 0
  let finished = false
  let streamFailure: Error | undefined
  const uploadBody = new ReadableStream<Uint8Array>({
    async pull(stream) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          finished = true
          if (bytesRead !== claims.size) {
            streamFailure = new Error('size mismatch')
            stream.error(streamFailure)
          } else {
            stream.close()
          }
          return
        }
        bytesRead += value.byteLength
        if (bytesRead > claims.size || bytesRead > claims.maxSize) {
          streamFailure = new Error('size limit')
          await reader.cancel(streamFailure).catch(() => undefined)
          stream.error(streamFailure)
          controller.abort(streamFailure)
          return
        }
        stream.enqueue(value)
      } catch (error) {
        streamFailure = error instanceof Error ? error : new Error('stream failed')
        stream.error(streamFailure)
        controller.abort(streamFailure)
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined)
      controller.abort(reason)
    },
  })

  const cancelOnDisconnect = () => {
    controller.abort()
    void reader.cancel().catch(() => undefined)
  }
  if (request.signal.aborted) cancelOnDisconnect()
  else request.signal.addEventListener('abort', cancelOnDisconnect, { once: true })

  let upstream: Response
  try {
    upstream = await fetcher(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SANITY_TOKEN}`,
        'Content-Type': claims.mimeType,
      },
      body: uploadBody,
      // Cloudflare Workers supports streaming request bodies without Node's duplex option.
      signal: controller.signal,
      redirect: 'manual',
    })
  } catch {
    controller.abort()
    await reader.cancel().catch(() => undefined)
    if (streamFailure) {
      return jsonError('Upload stream does not match its signed ticket.', 400)
    }
    return jsonError('Sanity upload failed.', 502)
  } finally {
    request.signal.removeEventListener('abort', cancelOnDisconnect)
  }
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => undefined)
    controller.abort()
    await reader.cancel().catch(() => undefined)
    return jsonError('Sanity upload failed.', 502)
  }
  if (!finished || streamFailure || bytesRead !== claims.size) {
    await upstream.body?.cancel().catch(() => undefined)
    controller.abort()
    await reader.cancel().catch(() => undefined)
    return jsonError('Upload size does not match its signed ticket.', 400)
  }
  let assetResponse: Record<string, unknown>
  try {
    assetResponse = await readBoundedJSON(upstream)
  } catch {
    controller.abort()
    await reader.cancel().catch(() => undefined)
    return jsonError('Sanity returned an invalid asset response.', 502)
  }
  const assetValue = assetResponse.document
  const asset =
    typeof assetValue === 'object' && assetValue !== null && !Array.isArray(assetValue)
      ? (assetValue as Record<string, unknown>)
      : null
  if (!asset) {
    return jsonError('Sanity returned an invalid asset response.', 502)
  }
  const assetId = trustedAsset(asset, claims, kind)
  if (!assetId) {
    await cancelRequest()
    return jsonError('Sanity returned an untrusted asset response.', 502)
  }

  const receipt = await signSanityUploadReceipt(
    {
      assetId,
      audience: claims.audience,
      dataset: claims.dataset,
      filename: claims.filename,
      issuedAt: Date.now(),
      mimeType: claims.mimeType,
      nonce: claims.nonce,
      projectId: claims.projectId,
      size: bytesRead,
      version: SANITY_UPLOAD_PROTOCOL_VERSION,
    },
    env.UPLOAD_TRANSPORT_SECRET
  )
  return Response.json({ receipt: receipt.token }, { headers: CORS_HEADERS })
}
