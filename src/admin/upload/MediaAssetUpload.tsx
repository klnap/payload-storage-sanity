'use client'

import { Upload, useConfig, useDocumentInfo } from '@payloadcms/ui'
import type { ClientCollectionConfig, SanitizedCollectionConfig } from 'payload'

type UploadConfig = Exclude<SanitizedCollectionConfig['upload'], undefined | boolean>

function asUploadConfig(value: unknown): UploadConfig | null {
  if (value == null || value === true || value === false || typeof value !== 'object') {
    return null
  }
  return value as UploadConfig
}

/**
 * `admin.components.edit.Upload` — native Payload Upload (FileDetails + dropzone).
 * Large CDN hero preview lives in {@link MediaAssetUploadHero} for a future upgrade.
 */
export function MediaAssetUpload() {
  const { collectionSlug, initialState, docConfig } = useDocumentInfo()
  const { getEntityConfig } = useConfig()

  const entityConfig =
    typeof collectionSlug === 'string' ? getEntityConfig({ collectionSlug }) : null

  const uploadConfig =
    asUploadConfig(
      docConfig && 'upload' in docConfig ? (docConfig as ClientCollectionConfig).upload : undefined
    ) ??
    asUploadConfig(entityConfig && 'upload' in entityConfig ? entityConfig.upload : undefined) ??
    // Payload Upload destructures `uploadConfig.crop` without optional chaining — never pass undefined.
    ({} as UploadConfig)

  if (!collectionSlug) {
    return null
  }

  return (
    <Upload
      collectionSlug={collectionSlug}
      initialState={initialState}
      uploadConfig={uploadConfig}
    />
  )
}
