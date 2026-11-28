import { describe, expect, mock, test } from 'bun:test'
import type { Endpoint } from 'payload'
import type { UploadTransport } from '@/core/config'
import { createSanityUploadTransportEndpoints } from './endpoints'
import { verifySanityUploadTicket } from './protocol'

const transport: UploadTransport = {
  endpoint: 'https://uploads.example.test/v1/upload',
  maxSizeBytes: 10_000,
  protocolVersion: 1,
  secret: 'a test secret with at least thirty-two bytes',
}

function makeRequest({
  body,
  create,
  findByID,
  user = { id: 'u1', collection: 'users' },
}: {
  body?: unknown
  create?: (...args: unknown[]) => Promise<unknown>
  findByID?: (...args: unknown[]) => Promise<unknown>
  user?: unknown
}): Record<string, unknown> {
  return {
    json: async () => body,
    headers: new Headers(),
    user,
    payload: {
      config: { routes: { api: '/api' }, serverURL: 'https://payload.example.test' },
      collections: {
        media: {
          config: {
            access: {},
            upload: { adapter: 'sanity' },
          },
        },
      },
      create: create ?? mock(async () => ({})),
      findByID:
        findByID ??
        mock(async () => {
          throw new Error('Not found')
        }),
    },
  }
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('Sanity upload transport endpoints', () => {
  test('issues short-lived tickets bound to the authorized operation and transport', async () => {
    const [ticketEndpoint] = createSanityUploadTransportEndpoints({
      dataset: 'production',
      projectId: 'project',
      transport,
      maxSizeFor: () => 8_000,
    })
    const request = makeRequest({
      body: {
        collection: 'media',
        filename: 'photo.png',
        mimeType: 'image/png',
        operation: 'create',
        size: 1_000,
      },
    })
    const response = await (ticketEndpoint as Endpoint).handler(request as never)
    expect(response.status).toBe(200)
    const result = await responseBody(response)
    expect(result.endpoint).toBe(transport.endpoint)
    expect(result.protocolVersion).toBe(1)
    const claims = await verifySanityUploadTicket(result.ticket as string, transport.secret)
    expect(claims).toMatchObject({
      audience: transport.endpoint,
      claimEndpoint: 'https://payload.example.test/api/sanity-upload/claims',
      collection: 'media',
      maxSize: 8_000,
      operation: 'create',
      projectId: 'project',
      dataset: 'production',
      size: 1_000,
      subject: 'users:u1',
    })
  })

  test('rejects unauthenticated and oversized ticket requests', async () => {
    const [ticketEndpoint] = createSanityUploadTransportEndpoints({
      dataset: 'production',
      projectId: 'project',
      transport,
      maxSizeFor: () => 500,
    })
    const body = {
      collection: 'media',
      filename: 'photo.png',
      mimeType: 'image/png',
      operation: 'create',
      size: 1_000,
    }
    const oversized = await (ticketEndpoint as Endpoint).handler(makeRequest({ body }) as never)
    expect(oversized.status).toBe(413)
    const unauthenticated = await (ticketEndpoint as Endpoint).handler(
      makeRequest({ body, user: null }) as never
    )
    expect(unauthenticated.status).toBe(403)
    const malformedMetadata = await (ticketEndpoint as Endpoint).handler(
      makeRequest({
        body: { ...body, filename: '../photo.png', mimeType: 'image/png\r\nx-injected: true' },
      }) as never
    )
    expect(malformedMetadata.status).toBe(400)
  })

  test('creates one durable claim and reports duplicate attempts without starting another transfer', async () => {
    const endpoints = createSanityUploadTransportEndpoints({
      dataset: 'production',
      projectId: 'project',
      transport,
      maxSizeFor: () => 8_000,
    })
    const ticketResponse = await endpoints[0]!.handler(
      makeRequest({
        body: {
          collection: 'media',
          filename: 'photo.png',
          mimeType: 'image/png',
          operation: 'create',
          size: 1_000,
        },
      }) as never
    )
    const ticket = (await responseBody(ticketResponse)).ticket as string
    const create = mock(async () => ({}))
    const claimRequest = makeRequest({ create })
    claimRequest.headers = new Headers({ Authorization: `Bearer ${ticket}` })
    const first = await endpoints[1]!.handler(claimRequest as never)
    expect(first.status).toBe(201)
    expect(await responseBody(first)).toMatchObject({ status: 'claimed' })
    expect(create).toHaveBeenCalledTimes(1)

    create.mockImplementation(async () => {
      throw new Error('duplicate key')
    })
    const findByID = mock(async ({ id }: { id: string }) => {
      if (id.endsWith(':finalized')) throw new Error('Not found')
      return { id, kind: 'claim' }
    })
    claimRequest.payload = { ...(claimRequest.payload as object), findByID }
    const replay = await endpoints[1]!.handler(claimRequest as never)
    expect(replay.status).toBe(409)
    expect(await responseBody(replay)).toMatchObject({ status: 'in-progress' })
    expect(create).toHaveBeenCalledTimes(2)
  })
})
