'use client'

import { useFormFields } from '@payloadcms/ui'
import React from 'react'

import { SanityStableThumbnail } from './SanityStableThumbnail'

export function SanityMediaStablePreviewField() {
  const { filename, thumbnailURL, url } = useFormFields(([fields]) => ({
    filename: fields.filename?.value as string | undefined,
    thumbnailURL: fields.thumbnailURL?.value as string | undefined,
    url: fields.url?.value as string | undefined,
  }))

  const fileSrc = thumbnailURL || url
  if (!fileSrc || !filename) {
    return null
  }

  return (
    <div className="sanity-media-stable-preview-field">
      <SanityStableThumbnail alt={filename} fileSrc={fileSrc} size="medium" />
    </div>
  )
}
