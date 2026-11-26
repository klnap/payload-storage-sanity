import { describe, expect, test } from 'bun:test'
import type { MediaAsset } from '@/consumers/assets'
import { resolveSanityImagePopulatedAsset, type SanityImageAssetMapping } from '@/consumers/image'
import { toSanityImageProps } from '@/consumers/next/toSanityImageProps'

function resolveSanityImageAsset<TAsset extends object>(
  asset: TAsset | null | undefined,
  assetMapping?: SanityImageAssetMapping<TAsset>
): MediaAsset | null | undefined {
  return resolveSanityImagePopulatedAsset(asset, assetMapping)
}

describe('SanityImage asset resolution', () => {
  const defaultAsset: MediaAsset = {
    id: '1',
    url: 'https://cdn.sanity.io/images/demo/production/img.jpg',
    alt: 'Hero',
    focalX: 50,
    focalY: 50,
    width: 800,
    height: 600,
  }

  test('without mapping uses the asset as-is for image construction', () => {
    const asset = { ...defaultAsset }
    const populated = resolveSanityImageAsset(asset)
    expect(toSanityImageProps(populated)).toEqual(toSanityImageProps(defaultAsset))
    expect(populated).toBe(asset)
  })

  test('with mapping uses mapped values for image construction', () => {
    const custom = {
      src: defaultAsset.url,
      label: defaultAsset.alt,
      meta: { w: defaultAsset.width, h: defaultAsset.height },
    }

    const populated = resolveSanityImageAsset(custom, {
      url: 'src',
      alt: 'label',
      width: 'meta.w',
      height: 'meta.h',
    })

    expect(toSanityImageProps(populated)).toEqual(toSanityImageProps(defaultAsset))
    expect(custom).toEqual({
      src: defaultAsset.url,
      label: defaultAsset.alt,
      meta: { w: defaultAsset.width, h: defaultAsset.height },
    })
  })
})
