import {
  type ResolveAssetAltOptions,
  resolveAssetAlt,
  resolvePlaceholderBlurDataUrl,
} from '@/consumers/image'
import { focalObjectPosition } from '@/consumers/image/focalObjectPosition'
import { resolveRenderableMediaAsset } from '@/consumers/image/resolveRenderableMediaAsset'
import { rewriteToCdnOrigin } from '@/sanity/cdn'

export type ToSanityImagePropsOptions = ResolveAssetAltOptions & {
  fill?: boolean
  disableFocal?: boolean
  disablePlaceholder?: boolean
  /** Use a neutral blur when `asset.lqip` is missing (default: true). */
  placeholderFallback?: boolean
  cdnBaseUrl?: string
}

export type ToSanityImagePropsResult = NonNullable<ReturnType<typeof toSanityImageProps>>

export function toSanityImageProps(value: unknown, opts: ToSanityImagePropsOptions = {}) {
  const asset = resolveRenderableMediaAsset(value, opts.cdnBaseUrl)
  if (!asset) return null

  const alt = resolveAssetAlt(asset, opts)
  const style: Record<string, string | number> = {}

  if (!opts.disableFocal) {
    style.objectFit = 'cover'
    style.objectPosition = focalObjectPosition(asset)
  }

  const blurDataURL = !opts.disablePlaceholder
    ? resolvePlaceholderBlurDataUrl(asset, {
        fallback: opts.placeholderFallback,
      })
    : undefined
  const hasBlur = Boolean(blurDataURL)

  const width = asset.width
  const height = asset.height
  const fill = opts.fill ?? (width == null || height == null)

  return {
    src: rewriteToCdnOrigin(asset.url, { cdnBaseUrl: opts.cdnBaseUrl }),
    alt,
    ...(fill
      ? undefined
      : {
          width: width ?? undefined,
          height: height ?? undefined,
        }),
    fill,
    style: Object.keys(style).length > 0 ? style : undefined,
    placeholder: hasBlur ? ('blur' as const) : ('empty' as const),
    blurDataURL: hasBlur ? blurDataURL : undefined,
  }
}
