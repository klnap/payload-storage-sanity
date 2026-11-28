import type { Endpoint, PayloadRequest, Where } from 'payload'
import type { UploadTransport } from '@/core/config'
import {
  SANITY_UPLOAD_CLAIM_PATH,
  SANITY_UPLOAD_TICKET_PATH,
  signSanityUploadTicket,
  type SanityUploadTicketClaims,
  verifySanityUploadTicket,
} from './protocol'
import {
  SANITY_UPLOAD_FINALIZATION_SUFFIX,
  SANITY_UPLOAD_SESSION_COLLECTION,
} from './sessionCollection'

const TICKET_LIFETIME_MS = 5 * 60 * 1_000
const MIME_TYPE_PATTERN = /^[!#$%&'*+.^`|~\w-]+\/[!#$%&'*+.^`|~\w-]+$/
type UploadTicketRequest = {
  collection: string
  documentId?: number | string
  filename: string
  mimeType: string
  operation: 'create' | 'update'
  size: number
}

function isValidMimeType(value: string): boolean {
  if (
    value !== value.trim() ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
    })
  ) {
    return false
  }
  const [essence, ...parameters] = value.split(';')
  return MIME_TYPE_PATTERN.test(essence ?? '') && parameters.every((parameter) => parameter.trim())
}

function isSafeFilename(value: string): boolean {
  return (
    value === value.trim() &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0)
      return (
        !['/', '\\', ':'].includes(character) &&
        codePoint !== undefined &&
        codePoint > 0x1f &&
        codePoint !== 0x7f
      )
    })
  )
}

function readBearerToken(req: PayloadRequest): string | null {
  const value = req.headers.get('authorization')
  if (!value?.startsWith('Bearer ')) return null
  const token = value.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

function isUploadTicketRequest(value: unknown): value is UploadTicketRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const body = value as Record<string, unknown>
  return (
    typeof body.collection === 'string' &&
    (body.operation === 'create' || body.operation === 'update') &&
    typeof body.filename === 'string' &&
    body.filename.length > 0 &&
    body.filename.length <= 255 &&
    isSafeFilename(body.filename) &&
    typeof body.mimeType === 'string' &&
    body.mimeType.length > 0 &&
    body.mimeType.length <= 255 &&
    isValidMimeType(body.mimeType) &&
    Number.isSafeInteger(body.size) &&
    (body.size as number) > 0 &&
    (body.operation !== 'update' ||
      (typeof body.documentId === 'string' && body.documentId.length > 0) ||
      (typeof body.documentId === 'number' && Number.isSafeInteger(body.documentId)))
  )
}

export async function authorizeUploadRequest(
  req: PayloadRequest,
  body: UploadTicketRequest
): Promise<boolean> {
  if (!req.user) return false
  const collection = req.payload.collections[body.collection]?.config
  if (collection?.upload?.adapter !== 'sanity') return false
  const access = collection.access[body.operation]
  const accessResult = access
    ? await access({
        collectionConfig: collection,
        data: { filename: body.filename, mimeType: body.mimeType, filesize: body.size },
        id: body.documentId,
        req,
      })
    : true
  if (accessResult === false) return false
  if (body.operation === 'create') return true
  if (body.documentId == null) return false

  const idWhere: Where = { id: { equals: body.documentId } }
  const where: Where = accessResult === true ? idWhere : { and: [idWhere, accessResult] }
  const result = await req.payload.find({
    collection: body.collection as never,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where,
  })
  return result.docs.length === 1
}

function claimData(claims: Awaited<ReturnType<typeof verifySanityUploadTicket>>) {
  return {
    id: claims.nonce,
    kind: 'claim' as const,
    nonce: claims.nonce,
    subject: claims.subject,
    collection: claims.collection,
    operation: claims.operation,
    ...(claims.documentId == null ? {} : { documentId: String(claims.documentId) }),
    projectId: claims.projectId,
    dataset: claims.dataset,
    audience: claims.audience,
    filename: claims.filename,
    mimeType: claims.mimeType,
    size: claims.size,
    maxSize: claims.maxSize,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  }
}

export function createSanityUploadTransportEndpoints({
  dataset,
  projectId,
  transport,
  maxSizeFor,
}: {
  dataset: string
  projectId: string
  transport: UploadTransport
  maxSizeFor: (collection: string, mimeType: string, filename: string) => number | undefined
}): Endpoint[] {
  const tickets: Endpoint = {
    path: SANITY_UPLOAD_TICKET_PATH,
    method: 'post',
    handler: async (req) => {
      let body: unknown
      try {
        if (!req.json)
          return Response.json({ error: 'Invalid upload ticket request.' }, { status: 400 })
        body = await req.json()
      } catch {
        return Response.json({ error: 'Invalid upload ticket request.' }, { status: 400 })
      }
      if (!isUploadTicketRequest(body)) {
        return Response.json({ error: 'Invalid upload ticket request.' }, { status: 400 })
      }
      if (body.operation === 'create' && body.documentId !== undefined) {
        return Response.json(
          { error: 'Create tickets cannot include a document ID.' },
          { status: 400 }
        )
      }
      if (!(await authorizeUploadRequest(req, body))) {
        return Response.json(
          { error: 'Not authorized to upload to this collection.' },
          { status: 403 }
        )
      }
      const maxSize = Math.min(
        transport.maxSizeBytes,
        maxSizeFor(body.collection, body.mimeType, body.filename) ?? transport.maxSizeBytes
      )
      if (maxSize == null || body.size > maxSize) {
        return Response.json(
          { error: 'The upload exceeds the configured size limit.' },
          { status: 413 }
        )
      }

      const issuedAt = Date.now()
      const serverURL = req.payload.config.serverURL
      if (!serverURL) {
        return Response.json(
          { error: 'Payload serverURL must be configured for uploads.' },
          { status: 500 }
        )
      }
      const apiRoute = (req.payload.config.routes.api ?? '/api').replace(/\/+$/, '')
      const claims = {
        audience: transport.endpoint,
        claimEndpoint: new URL(`${apiRoute}${SANITY_UPLOAD_CLAIM_PATH}`, serverURL).toString(),
        collection: body.collection,
        dataset,
        ...(body.documentId == null ? {} : { documentId: body.documentId }),
        expiresAt: issuedAt + TICKET_LIFETIME_MS,
        filename: body.filename,
        issuedAt,
        maxSize,
        mimeType: body.mimeType,
        nonce: crypto.randomUUID(),
        operation: body.operation,
        projectId,
        size: body.size,
        subject: `${req.user?.collection ?? ''}:${String(req.user?.id)}`,
        version: transport.protocolVersion,
      } as const
      const ticket = await signSanityUploadTicket(claims, transport.secret)
      return Response.json({
        endpoint: transport.endpoint,
        protocolVersion: transport.protocolVersion,
        ticket: ticket.token,
      })
    },
  }

  const claims: Endpoint = {
    path: SANITY_UPLOAD_CLAIM_PATH,
    method: 'post',
    handler: async (req) => {
      const token = readBearerToken(req)
      if (!token) {
        return Response.json({ error: 'A signed upload ticket is required.' }, { status: 401 })
      }
      let verified: SanityUploadTicketClaims
      try {
        verified = await verifySanityUploadTicket(token, transport.secret, {
          audience: transport.endpoint,
        })
      } catch {
        return Response.json({ error: 'Invalid or expired upload ticket.' }, { status: 401 })
      }
      try {
        await req.payload.create({
          collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
          data: claimData(verified),
          overrideAccess: true,
          req,
        })
        return Response.json(
          { status: 'claimed', protocolVersion: transport.protocolVersion },
          { status: 201 }
        )
      } catch {
        const claimed = await req.payload
          .findByID({
            collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
            depth: 0,
            id: verified.nonce,
            overrideAccess: true,
            req,
          })
          .catch(() => null)
        if (!claimed) {
          return Response.json({ error: 'Upload claim could not be persisted.' }, { status: 500 })
        }
        const finalizedId = `${verified.nonce}${SANITY_UPLOAD_FINALIZATION_SUFFIX}`
        const finalized = await req.payload
          .findByID({
            collection: SANITY_UPLOAD_SESSION_COLLECTION as never,
            depth: 0,
            id: finalizedId,
            overrideAccess: true,
            req,
          })
          .catch(() => null)
        return Response.json(
          {
            status: finalized ? 'already-finalized' : 'in-progress',
            protocolVersion: transport.protocolVersion,
          },
          { status: 409 }
        )
      }
    },
  }
  return [tickets, claims]
}
