import type { SanityClient } from '@sanity/client'
import type { Endpoint, PayloadHandler } from 'payload'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import { handleSanityWebhookEvent } from './handleWebhookEvent'
import { parseSanityWebhookPayload } from './parseWebhookPayload'
import { DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES, readWebhookRawBody } from './readWebhookBody'
import { verifySanityWebhookSignature } from './verifyWebhookSignature'

export {
  DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES,
  isValidWebhookMaxBodySizeBytes,
  MAX_SANITY_WEBHOOK_BODY_BYTES,
  normalizeWebhookMaxBodySizeBytes,
  readWebhookRawBody,
} from './readWebhookBody'

export type CreateSanityWebhookEndpointArgs = {
  client: SanityClient
  collectionSlug: string
  webhookSecret: string
  projectId: string
  dataset: string
  path?: string
  onDeleted?: 'mark' | 'delete'
  /** Max raw body bytes (UTF-8). @default {@link DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES} */
  maxBodySizeBytes?: number
}

export function createSanityWebhookEndpoint({
  client,
  collectionSlug,
  webhookSecret,
  projectId,
  dataset,
  path = '/sanity-storage/webhook',
  onDeleted = 'mark',
  maxBodySizeBytes = DEFAULT_SANITY_WEBHOOK_MAX_BODY_BYTES,
}: CreateSanityWebhookEndpointArgs): Endpoint {
  const handler: PayloadHandler = async (req) => {
    const t = req.t as SanityStorageTranslateFn
    const bodyRead = await readWebhookRawBody(req, maxBodySizeBytes)

    if (!bodyRead.ok) {
      if (bodyRead.reason === 'too_large') {
        return Response.json(
          { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookInvalidPayload) },
          { status: 413 }
        )
      }
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookEmptyBody) },
        { status: 400 }
      )
    }

    const { rawBody } = bodyRead

    const signatureHeader = req.headers.get('sanity-webhook-signature')

    const verification = verifySanityWebhookSignature({
      rawBody,
      signatureHeader,
      secret: webhookSecret,
    })

    if (!verification.valid) {
      req.payload.logger?.warn?.(`Sanity webhook rejected: ${verification.reason}`)
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiUnauthorized) },
        { status: 401 }
      )
    }

    const payloadBody = parseSanityWebhookPayload(rawBody)
    if (!payloadBody) {
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookInvalidPayload) },
        { status: 400 }
      )
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
      return Response.json(
        { error: sanityStorageTranslate(t, SANITY_STORAGE_I18N_KEYS.apiWebhookProcessingFailed) },
        { status: 500 }
      )
    }
  }

  return {
    method: 'post',
    path,
    handler,
  }
}
