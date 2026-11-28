import { describe, expect, test } from 'bun:test'
import {
  SANITY_UPLOAD_PROTOCOL_VERSION,
  signSanityUploadTicket,
  verifySanityUploadReceipt,
} from '../protocol'
import {
  type CloudflareFetch,
  type CloudflareUploadEnvironment,
  handleCloudflareUpload,
} from './worker'

const secret = 'cloudflare worker test secret with thirty-two bytes'
const endpoint = 'https://worker.example.test/upload'
const content = new TextEncoder().encode('hello')
const claims = {
  audience: endpoint,
  claimEndpoint: 'https://payload.example.test/api/sanity-upload/claims',
  collection: 'media',
  dataset: 'production',
  expiresAt: Date.now() + 60_000,
  filename: 'hello.txt',
  issuedAt: Date.now() - 1_000,
  maxSize: 100,
  mimeType: 'text/plain',
  nonce: crypto.randomUUID(),
  operation: 'create' as const,
  projectId: 'project',
  size: content.byteLength,
  subject: 'user:1',
  version: SANITY_UPLOAD_PROTOCOL_VERSION,
}
const env: CloudflareUploadEnvironment = {
  SANITY_TOKEN: 'sanity secret',
  UPLOAD_TRANSPORT_SECRET: secret,
}

function streamOf(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index === chunks.length) controller.close()
      else controller.enqueue(chunks[index++]!)
    },
    cancel() {
      onCancel?.()
    },
  })
}

async function makeRequest(overrides: Partial<typeof claims> = {}, body = streamOf([content])) {
  const ticket = await signSanityUploadTicket({ ...claims, ...overrides }, secret)
  return new Request(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ticket.token}` },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

function claimSuccess() {
  return Response.json({ status: 'claimed', protocolVersion: 1 }, { status: 201 })
}

function sanityAsset(overrides: Record<string, unknown> = {}) {
  return Response.json({
    document: {
      _id: 'file-abc123-txt',
      _type: 'sanity.fileAsset',
      assetId: 'abc123',
      size: content.byteLength,
      url: 'https://cdn.sanity.io/files/project/production/abc123.txt',
      ...overrides,
    },
  })
}

async function afterConsuming(
  init: RequestInit | undefined,
  response: Response
): Promise<Response> {
  await new Response(init?.body).arrayBuffer()
  return response
}

function transport(fetcher: CloudflareFetch) {
  let claimCount = 0
  let sanityCount = 0
  const wrapped: CloudflareFetch = async (input, init) => {
    if (String(input) === claims.claimEndpoint) {
      claimCount++
      return fetcher(input, init)
    }
    sanityCount++
    return fetcher(input, init)
  }
  return {
    fetcher: wrapped,
    get claimCount() {
      return claimCount
    },
    get sanityCount() {
      return sanityCount
    },
  }
}

describe('Cloudflare upload worker', () => {
  test('allows loopback HTTP only when explicitly enabled for local development', async () => {
    const localEndpoint = 'http://127.0.0.1:8787/upload'
    const localClaims = {
      ...claims,
      audience: localEndpoint,
      claimEndpoint: 'http://127.0.0.1:3000/api/sanity-upload/claims',
    }
    const ticket = await signSanityUploadTicket(localClaims, secret)
    const makeLocalRequest = () =>
      new Request(localEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ticket.token}` },
        body: content,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' })
    let calls = 0
    const fetcher: CloudflareFetch = async (input, init) => {
      calls++
      return String(input) === localClaims.claimEndpoint
        ? claimSuccess()
        : afterConsuming(init, sanityAsset())
    }

    const blocked = await handleCloudflareUpload(makeLocalRequest(), env, fetcher)
    expect(blocked.status).toBe(401)
    expect(calls).toBe(0)

    const allowed = await handleCloudflareUpload(
      makeLocalRequest(),
      { ...env, ALLOW_LOCAL_HTTP: 'true' },
      fetcher
    )
    expect(allowed.status).toBe(200)
    expect(calls).toBe(2)
  })

  test('answers browser preflight for the ticket bearer headers', async () => {
    const response = await handleCloudflareUpload(
      new Request(endpoint, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Headers': 'authorization,content-type',
          'Access-Control-Request-Method': 'POST',
          Origin: 'https://payload.example.test',
        },
      }),
      env
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type')
  })

  test('claims before streaming to Sanity and returns a signed receipt', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const t = transport(async (input, init) => {
      calls.push({ input: String(input), init })
      if (String(input) === claims.claimEndpoint) {
        expect(new Headers(init?.headers).get('authorization')).toMatch(/^Bearer /)
        return claimSuccess()
      }
      expect(String(input)).toBe(
        'https://project.api.sanity.io/v2026-01-01/assets/files/production?filename=hello.txt'
      )
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sanity secret')
      expect(await new Response(init?.body).arrayBuffer()).toEqual(content.buffer)
      return sanityAsset()
    })
    const response = await handleCloudflareUpload(await makeRequest(), env, t.fetcher)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const result = (await response.json()) as { receipt: string }
    expect(
      await verifySanityUploadReceipt(result.receipt, secret, {
        audience: claims.audience,
      })
    ).toEqual({
      assetId: 'file-abc123-txt',
      audience: claims.audience,
      dataset: claims.dataset,
      filename: claims.filename,
      issuedAt: expect.any(Number),
      mimeType: claims.mimeType,
      nonce: claims.nonce,
      projectId: claims.projectId,
      size: content.byteLength,
      version: SANITY_UPLOAD_PROTOCOL_VERSION,
    })
    expect(calls.map((call) => call.input)).toEqual([
      claims.claimEndpoint,
      'https://project.api.sanity.io/v2026-01-01/assets/files/production?filename=hello.txt',
    ])
  })

  test('rejects forged and expired tickets before making requests', async () => {
    const forged = await makeRequest()
    const forgedToken = forged.headers.get('authorization')!.slice('Bearer '.length)
    const badRequest = new Request(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${forgedToken}x` },
      body: content,
    })
    const spy = transport(async () => claimSuccess())
    expect((await handleCloudflareUpload(badRequest, env, spy.fetcher)).status).toBe(401)
    const expired = await makeRequest({ expiresAt: Date.now() - 1 })
    expect((await handleCloudflareUpload(expired, env, spy.fetcher)).status).toBe(401)
    expect(spy.claimCount).toBe(0)
  })

  test('rejects unsafe claim endpoints and malformed Sanity targets before claiming', async () => {
    const spy = transport(async () => claimSuccess())
    const unsafeClaim = await makeRequest({ claimEndpoint: 'http://attacker.example/claim' })
    expect((await handleCloudflareUpload(unsafeClaim, env, spy.fetcher)).status).toBe(401)
    const unsafeTarget = await makeRequest({ projectId: 'project.example' })
    expect((await handleCloudflareUpload(unsafeTarget, env, spy.fetcher)).status).toBe(401)
    expect(spy.claimCount).toBe(0)
  })

  test('rejects ticket claim fields outside the shared protocol', async () => {
    const extendedClaims = { ...claims, cloudflareCapability: true }
    const ticket = await signSanityUploadTicket(extendedClaims, secret)
    const request = new Request(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ticket.token}` },
      body: content,
    })
    const spy = transport(async () => claimSuccess())
    expect((await handleCloudflareUpload(request, env, spy.fetcher)).status).toBe(401)
    expect(spy.claimCount).toBe(0)
  })

  test('rejects claim conflicts and concurrent replays before any Sanity request', async () => {
    let claimed = false
    let sanityRequests = 0
    const fetcher: CloudflareFetch = async (input, init) => {
      if (String(input) === claims.claimEndpoint) {
        if (claimed) return Response.json({ status: 'in-progress' }, { status: 409 })
        claimed = true
        await Promise.resolve()
        return claimSuccess()
      }
      sanityRequests++
      await new Response(init?.body).arrayBuffer()
      return sanityAsset()
    }
    const [first, second] = await Promise.all([
      makeRequest({ nonce: 'parallel-claim' }),
      makeRequest({ nonce: 'parallel-claim' }),
    ])
    const responses = await Promise.all([
      handleCloudflareUpload(first, env, fetcher),
      handleCloudflareUpload(second, env, fetcher),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(sanityRequests).toBe(1)
  })

  test('rejects claim service failures and Sanity failures safely', async () => {
    const claimFailure = await handleCloudflareUpload(await makeRequest(), env, async () =>
      Response.json({ error: 'private details' }, { status: 500 })
    )
    expect(claimFailure.status).toBe(502)
    expect(await claimFailure.text()).not.toContain('private details')

    const sanityFailure = await handleCloudflareUpload(
      await makeRequest(),
      env,
      async (input, init) =>
        String(input) === claims.claimEndpoint
          ? claimSuccess()
          : afterConsuming(init, Response.json({ error: 'private details' }, { status: 500 }))
    )
    expect(sanityFailure.status).toBe(502)
    expect(await sanityFailure.text()).not.toContain('private details')
  })

  test('rejects over-sized, under-sized, and interrupted streams', async () => {
    const over = await handleCloudflareUpload(
      await makeRequest({ maxSize: 6, size: 5 }, streamOf([new Uint8Array(7)])),
      env,
      async (input, init) =>
        String(input) === claims.claimEndpoint
          ? claimSuccess()
          : afterConsuming(init, sanityAsset())
    )
    expect(over.status).toBe(400)

    const under = await handleCloudflareUpload(
      await makeRequest({ size: 6 }),
      env,
      async (input, init) =>
        String(input) === claims.claimEndpoint
          ? claimSuccess()
          : afterConsuming(init, sanityAsset())
    )
    expect(under.status).toBe(400)

    const interrupted = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(content.subarray(0, 2))
        controller.error(new Error('client stream interrupted'))
      },
    })
    const failed = await handleCloudflareUpload(
      await makeRequest({}, interrupted),
      env,
      async (input, init) =>
        String(input) === claims.claimEndpoint
          ? claimSuccess()
          : afterConsuming(init, sanityAsset())
    )
    expect(failed.status).toBe(400)
  })

  test('cancels the request stream when Sanity rejects before consuming it', async () => {
    let cancelled = false
    const response = await handleCloudflareUpload(
      await makeRequest(
        {},
        new ReadableStream({
          cancel() {
            cancelled = true
          },
        })
      ),
      env,
      async (input) =>
        String(input) === claims.claimEndpoint
          ? claimSuccess()
          : Response.json({ error: 'failed' }, { status: 500 })
    )
    expect(response.status).toBe(502)
    expect(cancelled).toBe(true)
  })

  test('uses signed MIME type for Sanity asset kind and rejects untrusted response identity', async () => {
    let uploadUrl = ''
    const imageResponse = await handleCloudflareUpload(
      await makeRequest({ mimeType: 'image/png', filename: 'image.png' }),
      env,
      async (input, init) => {
        if (String(input) === claims.claimEndpoint) return claimSuccess()
        uploadUrl = String(input)
        await new Response(init?.body).arrayBuffer()
        return Response.json({
          document: {
            _id: 'image-abc123-100x100-png',
            _type: 'sanity.imageAsset',
            assetId: 'abc123',
            size: content.byteLength,
            url: 'https://cdn.sanity.io/images/project/production/abc123-100x100.png',
          },
        })
      }
    )
    expect(imageResponse.status).toBe(200)
    expect(uploadUrl).toContain('/assets/images/production?')

    const untrusted = await handleCloudflareUpload(await makeRequest(), env, async (input, init) =>
      String(input) === claims.claimEndpoint
        ? claimSuccess()
        : afterConsuming(
            init,
            sanityAsset({
              url: 'https://cdn.sanity.io/files/other-project/production/hello.txt',
            })
          )
    )
    expect(untrusted.status).toBe(502)

    const wrongSize = await handleCloudflareUpload(await makeRequest(), env, async (input, init) =>
      String(input) === claims.claimEndpoint
        ? claimSuccess()
        : afterConsuming(init, sanityAsset({ size: content.byteLength + 1 }))
    )
    expect(wrongSize.status).toBe(502)
  })

  test('rejects oversized upstream JSON responses', async () => {
    const oversized = await handleCloudflareUpload(await makeRequest(), env, async (input, init) =>
      String(input) === claims.claimEndpoint
        ? claimSuccess()
        : afterConsuming(init, new Response(' '.repeat(70 * 1024), { status: 200 }))
    )
    expect(oversized.status).toBe(502)
  })
})
