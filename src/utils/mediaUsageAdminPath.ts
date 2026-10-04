import type { SanitizedConfig } from 'payload'
import { formatAdminURL } from 'payload/shared'

import type { MediaUploadTarget } from '../queries/collectMediaUploadTargets'

/** Admin edit URL for the referencing document (not version history). */
export function buildMediaUsageAdminPath(args: {
  config: SanitizedConfig
  target: MediaUploadTarget
  documentId: number | string
}): string {
  const { config, target, documentId } = args
  const adminRoute = config.routes.admin
  const serverURL = config.serverURL

  if (target.type === 'global') {
    return formatAdminURL({
      adminRoute,
      path: `/globals/${target.collectionSlug}`,
      serverURL,
    })
  }

  return formatAdminURL({
    adminRoute,
    path: `/collections/${target.collectionSlug}/${documentId}`,
    serverURL,
  })
}
