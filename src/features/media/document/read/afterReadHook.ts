import type { CollectionAfterReadHook } from 'payload'
import type { SanityMediaDocument } from '@/features/media/document'
import { hydrateMediaOnRead } from '@/features/media/document'
import { normalizeLocalizedAltGroup } from '@/features/media/fields'
import {
  applyPopulatePreset,
  enrichMediaSanityMetadataForPopulate,
  resolvePopulateRequestLocale,
  shouldApplyDefaultPopulate,
  shouldMorphMediaPopulate,
} from '@/features/media/populate'
import { sanitizeMediaDocument } from '../sanitizeDocument'

export type CreateSanityMediaAfterReadHookArgs = {
  collectionSlug: string
  cdnBaseUrl?: string
  resolvedPreset: string
  localPopulate?: boolean
  /** When true, `alt` is the injected locale group — coerce SQL `null` to `{}` for admin form state. */
  localizedAltGroup?: boolean
  /** Locale codes for nested `alt.*` select / enrich (from Payload `localization`). */
  altLocaleCodes?: readonly string[]
}

export function createSanityMediaAfterReadHook(
  args: CreateSanityMediaAfterReadHookArgs
): CollectionAfterReadHook {
  return async ({ doc, req, context, findMany }) => {
    if (!doc) return doc

    const locale = resolvePopulateRequestLocale(req)

    const shouldApplyNestedPopulate = shouldApplyDefaultPopulate({
      req,
      context,
      collectionSlug: args.collectionSlug,
      findMany,
      localPopulate: args.localPopulate,
    })

    const willMorph = shouldMorphMediaPopulate({
      context,
      configPreset: args.resolvedPreset,
      mediaCollectionSlug: args.collectionSlug,
      req,
      shouldApplyNestedPopulate,
    })

    let mediaDoc = doc as SanityMediaDocument
    if (willMorph) {
      mediaDoc = await enrichMediaSanityMetadataForPopulate(mediaDoc, {
        req,
        collectionSlug: args.collectionSlug,
        localizedAltGroup: args.localizedAltGroup,
        altLocaleCodes: args.altLocaleCodes,
      })
    }

    mediaDoc = sanitizeMediaDocument(mediaDoc)
    mediaDoc = hydrateMediaOnRead(mediaDoc, args.cdnBaseUrl)

    if (args.localizedAltGroup) {
      mediaDoc = {
        ...mediaDoc,
        alt: normalizeLocalizedAltGroup(mediaDoc.alt, true) as SanityMediaDocument['alt'],
      }
    }

    if (willMorph) {
      const populatedDoc = applyPopulatePreset(mediaDoc, args.resolvedPreset, {
        cdnBaseUrl: args.cdnBaseUrl,
        locale,
      })

      if (
        populatedDoc !== mediaDoc &&
        populatedDoc != null &&
        typeof populatedDoc === 'object' &&
        !Array.isArray(populatedDoc)
      ) {
        return populatedDoc as typeof doc
      }
    }

    return mediaDoc as typeof doc
  }
}
