import { describe, expect, test } from 'bun:test'
import { toSanityImageProps } from '@/consumers/next'
import type { DefaultPopulateAsset } from '@/features/media/populate'
import {
  resolveSanityImagePopulatedAsset,
  type SanityImageAssetMapping,
} from '@/presentation/image'

function resolveSanityImageAsset<TAsset extends object>(
  asset: TAsset | null | undefined,
  assetMapping?: SanityImageAssetMapping<TAsset>
): DefaultPopulateAsset | null | undefined {
  return resolveSanityImagePopulatedAsset(asset, assetMapping)
}

describe('SanityImage asset resolution', () => {
  const defaultAsset: DefaultPopulateAsset = {
    id: '1',
    url: 'https://cdn.example/img.jpg',
    alt: 'Hero',
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
