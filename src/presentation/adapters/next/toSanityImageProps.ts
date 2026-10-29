import type { DefaultPopulateAsset } from '@/features/media/populate'
import { focalObjectPosition } from '@/features/media/populate'
import {
  type ResolveAssetAltOptions,
  resolveAssetAlt,
  resolvePlaceholderBlurDataUrl,
} from '@/presentation/image'

export type ToSanityImagePropsOptions = ResolveAssetAltOptions & {
  fill?: boolean
  disableFocal?: boolean
  disablePlaceholder?: boolean
  /** Use a neutral blur when `asset.lqip` is missing (default: true). */
  placeholderFallback?: boolean
  cdnBaseUrl?: string
}

export type ToSanityImagePropsResult = NonNullable<ReturnType<typeof toSanityImageProps>>

export function toSanityImageProps(
  asset: DefaultPopulateAsset | null | undefined,
  opts: ToSanityImagePropsOptions = {}
) {
  if (asset == null || !asset.url || typeof asset.url !== 'string') {
    return null
  }

  const alt = resolveAssetAlt(asset, opts)
  const style: Record<string, string | number> = {}

  if (!opts.disableFocal) {
    style.objectFit = 'cover'
    style.objectPosition = focalObjectPosition(asset)
  }

  const blurDataURL = !opts.disablePlaceholder
    ? resolvePlaceholderBlurDataUrl(asset, {
        cdnBaseUrl: opts.cdnBaseUrl,
        fallback: opts.placeholderFallback,
      })
    : undefined
  const hasBlur = Boolean(blurDataURL)

  const width = asset.width
  const height = asset.height
  const fill = opts.fill ?? (width == null || height == null)

  return {
    src: asset.url,
    alt,
    ...(fill
      ? {}
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
