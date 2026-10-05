import type { DefaultPopulateAsset } from '../types/defaultPopulate'
import { focalObjectPosition } from '../utils/focalObjectPosition'
import { resolveAssetAlt, type ResolveAssetAltOptions } from './resolveAssetAlt'

export type ToSanityImagePropsOptions = ResolveAssetAltOptions & {
  fill?: boolean
  disableFocal?: boolean
  disablePlaceholder?: boolean
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

  const hasLqip = !opts.disablePlaceholder && Boolean(asset.lqip?.trim())

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
    placeholder: hasLqip ? ('blur' as const) : ('empty' as const),
    blurDataURL: hasLqip ? asset.lqip : undefined,
  }
}
