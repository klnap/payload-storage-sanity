import type { SanityClient } from '@sanity/client'
import type { Endpoint, PayloadHandler, PayloadRequest } from 'payload'

import { handleSanityWebhookEvent } from '../webhook/handleEvent'
import { parseSanityWebhookPayload } from '../webhook/parsePayload'
import { verifySanityWebhookSignature } from '../webhook/verify'

export type CreateSanityWebhookEndpointArgs = {
  client: SanityClient
  collectionSlug: string
  webhookSecret: string
  projectId: string
  dataset: string
  path?: string
  onDeleted?: 'mark' | 'delete'
}

async function readRawBody(req: PayloadRequest): Promise<string> {
  if (req.text != null) {
    return req.text()
  }

  const body = req.body
  if (body != null && Object.prototype.toString.call(body) === '[object String]') {
    return String(body)
  }

  return ''
}

export function createSanityWebhookEndpoint({
  client,
  collectionSlug,
  webhookSecret,
  projectId,
  dataset,
  path = '/sanity/webhook',
  onDeleted = 'mark',
}: CreateSanityWebhookEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
    const rawBody = await readRawBody(req)
    if (rawBody.length === 0) {
      return Response.json({ error: 'Empty webhook body' }, { status: 400 })
    }

    const signatureHeader = req.headers.get('sanity-webhook-signature')

    const verification = verifySanityWebhookSignature({
      rawBody,
      signatureHeader,
      secret: webhookSecret,
    })

    if (!verification.valid) {
      return Response.json({ error: verification.reason }, { status: 401 })
    }

    const payloadBody = parseSanityWebhookPayload(rawBody)
    if (!payloadBody) {
      return Response.json({ error: 'Invalid webhook JSON payload' }, { status: 400 })
    }

    try {
      const result = await handleSanityWebhookEvent({
        payload: req.payload,
        client,
        collectionSlug,
        body: payloadBody,
        projectId,
        dataset,
        onDeleted,
        req,
      })

      return Response.json({ ok: true, result })
    } catch (error) {
      req.payload.logger?.error?.(
        `Sanity webhook handler failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
  }

  return {
    method: 'post',
    path,
    handler,
  }
}
