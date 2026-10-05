'use client'

import { ShimmerEffect, useFormProcessing } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

import './SanityStableThumbnail.scss'

export type SanityStableThumbnailProps = {
  alt?: string
  className?: string
  fileSrc?: string | null
  imageCacheTag?: string
  /** Show upload/save overlay when form is processing and src may change. */
  showProcessingOverlay?: boolean
  size?: 'small' | 'medium' | 'large'
}

function appendCacheTag(src: string, tag?: string): string {
  if (!tag) return src
  const separator = src.includes('?') ? '&' : '?'
  return `${src}${separator}tag=${encodeURIComponent(tag)}`
}

export function SanityStableThumbnail({
  alt = '',
  className = '',
  fileSrc,
  imageCacheTag,
  showProcessingOverlay = true,
  size = 'medium',
}: SanityStableThumbnailProps) {
  const processing = useFormProcessing()
  const src = useMemo(
    () => (fileSrc ? appendCacheTag(fileSrc, imageCacheTag) : null),
    [fileSrc, imageCacheTag]
  )

  const [visibleSrc, setVisibleSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(src))

  useEffect(() => {
    if (!src) {
      setVisibleSrc(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const img = new Image()
    img.src = src
    img.onload = () => {
      setVisibleSrc(src)
      setLoading(false)
    }
    img.onerror = () => {
      setLoading(false)
    }
  }, [src])

  const showOverlay = loading || (showProcessingOverlay && processing)

  const classNames = [
    'sanity-stable-thumbnail',
    `sanity-stable-thumbnail--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      {visibleSrc ? (
        <img alt={alt} className="sanity-stable-thumbnail__img" src={visibleSrc} />
      ) : null}
      {showOverlay ? (
        <div className="sanity-stable-thumbnail__overlay" aria-hidden>
          <ShimmerEffect height="100%" />
        </div>
      ) : null}
    </div>
  )
}
