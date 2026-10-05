import type { PayloadRequest } from 'payload'

import {
  isAdminCollectionRoute,
  isDirectMediaDocumentApiRequest,
  isMediaCollectionListApiRequest,
} from './mediaApiRoute'
import { shouldForcePopulateMorph, shouldSkipPopulateMorph } from './requestContext'

export type ShouldApplyDefaultPopulateArgs = {
  req?: PayloadRequest
  context?: unknown
  collectionSlug?: string
  findMany?: boolean
  /**
   * When false, Local API reads keep the full media document (legacy).
   * @default true for preset `default`
   */
  localPopulate?: boolean
}

/**
 * True when media `afterRead` should return the flat storefront DTO (`DefaultPopulateAsset`).
 * False for authenticated requests (admin), direct `/api/{media}/:id`, collection list routes, and when opted out on Local API.
 */
export function shouldApplyDefaultPopulate({
  req,
  context,
  collectionSlug,
  findMany,
  localPopulate = true,
}: ShouldApplyDefaultPopulateArgs): boolean {
  if (shouldSkipPopulateMorph(context)) return false

  // Admin and other authenticated reads use the same `/api/*` routes as the storefront.
  // Keep the native media document shape (filename, thumbnails, sanity group) for editors.
  if (req?.user) return false

  if (shouldForcePopulateMorph(context)) return true

  if (collectionSlug) {
    if (isDirectMediaDocumentApiRequest(req, collectionSlug)) return false
    if (isMediaCollectionListApiRequest(req, collectionSlug)) return false
    if (isAdminCollectionRoute(req, collectionSlug)) return false
  }

  if (localPopulate === false && req?.payloadAPI === 'local') {
    return false
  }

  // Flat DTO only when media is read as a populated relation (dataloader / findMany batch).
  // Root reads (admin editor, findByID, POST create response) keep the full document shape.
  if (findMany !== true) {
    return false
  }

  return true
}
