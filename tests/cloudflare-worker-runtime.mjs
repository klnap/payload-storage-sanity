import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { unstable_startWorker } from 'wrangler'
import {
  SANITY_UPLOAD_PROTOCOL_VERSION,
  signSanityUploadTicket,
  verifySanityUploadReceipt,
} from '../dist/upload-protocol.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entrypoint = join(packageRoot, 'tests/fixtures/cloudflare-upload-worker.ts')
const secret = 'synthetic-cloudflare-runtime-secret-32-bytes'
const payload = new TextEncoder().encode('hello')
let worker
let workerUrl
let configDirectory

before(async () => {
  configDirectory = await mkdtemp(join(tmpdir(), 'pss-cloudflare-runtime-'))
  const config = join(configDirectory, 'wrangler.jsonc')
  await writeFile(
    config,
    JSON.stringify({
      name: 'payload-sanity-runtime-test',
      main: entrypoint,
      compatibility_date: '2026-01-01',
      vars: {
        ALLOW_LOCAL_HTTP: 'true',
        SANITY_TOKEN: 'synthetic-sanity-token',
        UPLOAD_TRANSPORT_SECRET: secret,
      },
    })
  )
  worker = await unstable_startWorker({
    config,
    projectRoot: packageRoot,
    entrypoint,
    name: 'payload-sanity-runtime-test',
    dev: { persist: false, server: { port: 0 }, inspector: false, logLevel: 'error' },
  })
  await worker.ready
  workerUrl = await worker.url
})

after(async () => {
  await worker?.dispose()
  if (configDirectory) await rm(configDirectory, { recursive: true, force: true })
})

test('runs the signed streaming upload flow in Wrangler workerd', async () => {
  const endpoint = new URL('/upload', workerUrl).href
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
    nonce: 'wrangler-runtime-test-nonce',
    operation: 'create',
    projectId: 'project',
    size: payload.byteLength,
    subject: 'users:runtime-test',
    version: SANITY_UPLOAD_PROTOCOL_VERSION,
  }
  const ticket = await signSanityUploadTicket(claims, secret)
  const preflight = await worker.fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://payload.example.test',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*')

  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(payload.subarray(0, 2))
      controller.enqueue(payload.subarray(2))
      controller.close()
    },
  })
  const response = await worker.fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${ticket.token}` },
    body,
    duplex: 'half',
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  const receipt = await verifySanityUploadReceipt(result.receipt, secret, { audience: endpoint })
  assert.equal(receipt.assetId, 'file-abc123-txt')
  assert.equal(receipt.size, payload.byteLength)
  assert.equal(receipt.nonce, claims.nonce)

  const calls = await (await worker.fetch(new URL('/__calls', workerUrl))).json()
  assert.deepEqual(calls, [
    { kind: 'claim' },
    { kind: 'sanity', streamed: true, size: payload.byteLength },
  ])
})
