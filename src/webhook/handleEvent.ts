import type { SanityClient } from '@sanity/client'
import type { Payload } from 'payload'

import { findAllMediaBySanityAssetId } from '../queries/findAllMediaBySanityAssetId'
import { fetchSanityAssetSafe, mediaPatchFromSanityAsset } from '../sync/fetchAsset'
import { markMediaBySanityAssetId } from '../sync/markMedia'
import { mergeMediaSync } from '../utils/mediaSync'
import type { PayloadMediaDraft } from '../utils/payloadMedia'
import { createSanityAssetFetchCache } from '../utils/sanityAssetCache'
import {
  collectWebhookAssetIds,
  isImageAssetId,
  type SanityWebhookPayload,
  webhookMatchesProject,
} from './parsePayload'

export type HandleSanityWebhookArgs = {
  payload: Payload
  client: SanityClient
  collectionSlug: string
  body: SanityWebhookPayload
  projectId: string
  dataset: string
  onDeleted?: 'mark' | 'delete'
  req?: Parameters<Payload['update']>[0]['req']
}

export type HandleSanityWebhookResult = {
  created: number
  deleted: number
  updated: number
  ignored: number
  errors: number
}

function errorMessage(error: Error): string {
  return error.message
}

export async function handleSanityWebhookEvent({
  payload,
  client,
  collectionSlug,
  body,
  projectId,
  dataset,
  onDeleted = 'mark',
  req,
}: HandleSanityWebhookArgs): Promise<HandleSanityWebhookResult> {
  if (!webhookMatchesProject({ body, projectId, dataset })) {
    return { created: 0, deleted: 0, updated: 0, ignored: 0, errors: 0 }
  }

  const result: HandleSanityWebhookResult = {
    created: 0,
    deleted: 0,
    updated: 0,
    ignored: 0,
    errors: 0,
  }

  const { created, deleted, updated } = collectWebhookAssetIds(body)
  const createdIds = created.filter(isImageAssetId)
  const deletedIds = deleted.filter(isImageAssetId)
  const updatedIds = updated.filter(isImageAssetId)
  const fetchCache = createSanityAssetFetchCache()

  for (const sanityAssetId of deletedIds) {
    try {
      if (onDeleted === 'delete') {
        const mediaIds = await markMediaBySanityAssetId({
          payload,
          collectionSlug,
          sanityAssetId,
          syncStatus: 'deleted',
          req,
        })

        for (const mediaId of mediaIds) {
          try {
            await payload.delete({ collection: collectionSlug, id: mediaId, req })
          } catch (error) {
            result.errors += 1
            payload.logger?.error?.(
              `Sanity webhook failed to delete media ${mediaId}: ${
                error instanceof Error ? errorMessage(error) : 'Unknown webhook processing error'
              }`
            )
          }
        }
      } else {
        await markMediaBySanityAssetId({
          payload,
          collectionSlug,
          sanityAssetId,
          syncStatus: 'deleted',
          req,
        })
      }

      result.deleted += 1
    } catch (error) {
      result.errors += 1
      payload.logger?.error?.(
        `Sanity webhook failed to process deleted asset ${sanityAssetId}: ${
          error instanceof Error ? errorMessage(error) : 'Unknown webhook processing error'
        }`
      )
    }
  }

  for (const sanityAssetId of [...createdIds, ...updatedIds]) {
    try {
      const fetchResult = await fetchSanityAssetSafe(client, sanityAssetId, fetchCache)

      if (fetchResult.status !== 'available') {
        await markMediaBySanityAssetId({
          payload,
          collectionSlug,
          sanityAssetId,
          syncStatus: fetchResult.status,
          req,
        })
        result.ignored += 1
        continue
      }

      const matches = await findAllMediaBySanityAssetId({
        payload,
        collectionSlug,
        sanityAssetId,
        req,
      })

      if (matches.length === 0) {
        result.ignored += 1
        continue
      }

      let syncedAny = false

      for (const { id } of matches) {
        try {
          const doc = await payload.findByID({
            collection: collectionSlug,
            depth: 0,
            id,
            overrideAccess: true,
            disableErrors: true,
            req,
          })

          if (doc == null) continue

          // SAFETY: webhook findByID returns media rows with Sanity adapter fields
          const mediaDoc = doc as PayloadMediaDraft & { id?: number }
          if (mediaDoc.id == null || !Number.isFinite(mediaDoc.id)) continue

          const patch = {
            ...mediaPatchFromSanityAsset(fetchResult.asset),
            ...mergeMediaSync(mediaDoc, {
              status: 'available',
              checkedAt: new Date().toISOString(),
              errorAt: null,
            }),
          }

          await payload.update({
            collection: collectionSlug,
            id: mediaDoc.id,
            data: patch,
            depth: 0,
            req,
          })

          syncedAny = true
        } catch (error) {
          result.errors += 1
          payload.logger?.error?.(
            `Sanity webhook failed to sync media for asset ${sanityAssetId}: ${
              error instanceof Error ? errorMessage(error) : 'Unknown webhook processing error'
            }`
          )
        }
      }

      if (!syncedAny) {
        result.ignored += 1
        continue
      }

      if (createdIds.includes(sanityAssetId)) {
        result.created += 1
      } else {
        result.updated += 1
      }
    } catch (error) {
      result.errors += 1
      payload.logger?.error?.(
        `Sanity webhook failed to process asset ${sanityAssetId}: ${
          error instanceof Error ? errorMessage(error) : 'Unknown webhook processing error'
        }`
      )
    }
  }

  return result
}
