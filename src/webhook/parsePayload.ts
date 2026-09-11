import * as v from 'valibot'

import { type JsonObject, type JsonValue, parseJsonText } from '../utils/json'

const WebhookPayloadSchema = v.object({
  dataset: v.optional(v.string()),
  projectId: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  ids: v.optional(
    v.object({
      created: v.optional(v.array(v.string())),
      deleted: v.optional(v.array(v.string())),
      updated: v.optional(v.array(v.string())),
    })
  ),
})

export type SanityWebhookPayload = v.InferOutput<typeof WebhookPayloadSchema>

export function parseSanityWebhookPayload(rawBody: string): SanityWebhookPayload | null {
  const parsed = parseJsonText(rawBody)
  if (parsed === null) return null

  const result = v.safeParse(WebhookPayloadSchema, parsed)
  if (!result.success) return null

  return result.output
}

export type WebhookAssetIdBuckets = {
  created: string[]
  deleted: string[]
  updated: string[]
}

export function collectWebhookAssetIds(payload: SanityWebhookPayload): WebhookAssetIdBuckets {
  const ids = payload.ids ?? {}
  return {
    created: ids.created ?? [],
    deleted: ids.deleted ?? [],
    updated: ids.updated ?? [],
  }
}

export function isImageAssetId(id: string): boolean {
  return id.startsWith('image-')
}

export function webhookMatchesProject({
  body,
  projectId,
  dataset,
}: {
  body: SanityWebhookPayload
  projectId: string
  dataset: string
}): boolean {
  if (body.projectId != null && body.projectId !== projectId) return false
  if (body.dataset != null && body.dataset !== dataset) return false
  return true
}

export type { JsonObject, JsonValue }
