import { describe, expect, test } from 'bun:test'
import { toSanityImageProps } from '@/consumers/next'
import type { DefaultPopulateAsset } from '@/features/media/populate'
import type { SanityImageAssetMapping } from '@/presentation/image'
import { resolveSanityImagePopulatedAsset } from '@/presentation/image'

type HeroAsset = {
  image: string
  metadata: { width: number; height: number }
  caption?: string
}

type BannerAsset = {
  heroImage: string
  dimensions: { width: number; height: number }
}

/** Mirrors `createSanityImage` instance → factory mapping precedence. */
function resolveWithFactoryDefaults<TAsset extends object>(
  asset: TAsset | null | undefined,
  instanceMapping?: SanityImageAssetMapping<TAsset>,
  factoryMapping?: SanityImageAssetMapping<TAsset>
) {
  const effective = instanceMapping ?? factoryMapping
  return resolveSanityImagePopulatedAsset(asset, effective)
}

describe('createSanityImage assetMapping defaults', () => {
  const target: DefaultPopulateAsset = {
    id: '1',
    url: 'https://cdn.example/hero.jpg',
    alt: 'Caption',
    width: 1200,
    height: 800,
  }

  const factoryMapping: SanityImageAssetMapping<HeroAsset> = {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
    alt: 'caption',
  }

  test('no factory mapping preserves pass-through behavior', () => {
    const asset: DefaultPopulateAsset = { ...target }
    const populated = resolveWithFactoryDefaults(asset)
    expect(populated).toBe(asset)
    expect(toSanityImageProps(populated)).toEqual(toSanityImageProps(target))
  })

  test('factory mapping is applied when instance mapping is omitted', () => {
    const hero: HeroAsset = {
      image: target.url,
      metadata: { width: target.width ?? 0, height: target.height ?? 0 },
      caption: target.alt ?? undefined,
    }

    const populated = resolveWithFactoryDefaults(hero, undefined, factoryMapping)
    expect(toSanityImageProps(populated)).toEqual(toSanityImageProps(target))
  })

  test('instance mapping replaces factory mapping entirely', () => {
    const banner: BannerAsset = {
      heroImage: target.url,
      dimensions: { width: target.width ?? 0, height: target.height ?? 0 },
    }

    const instanceMapping: SanityImageAssetMapping<BannerAsset> = {
      url: 'heroImage',
      width: 'dimensions.width',
      height: 'dimensions.height',
    }

    const populated = resolveWithFactoryDefaults(banner, instanceMapping, factoryMapping)
    expect(toSanityImageProps(populated)?.src).toBe(target.url)
    expect(toSanityImageProps(populated)?.width).toBe(target.width)
    expect(toSanityImageProps(populated)?.height).toBe(target.height)
  })

  test('factory mapping does not mutate the source asset', () => {
    const hero: HeroAsset = {
      image: target.url,
      metadata: { width: 100, height: 200 },
    }
    const snapshot = JSON.stringify(hero)

    resolveWithFactoryDefaults(hero, undefined, factoryMapping)

    expect(JSON.stringify(hero)).toBe(snapshot)
  })

  test('invalid mapped asset uses the same missing-image path as unmapped assets', () => {
    const hero: HeroAsset = {
      image: '',
      metadata: { width: 1, height: 1 },
    }

    const populated = resolveWithFactoryDefaults(hero, undefined, factoryMapping)
    expect(toSanityImageProps(populated)).toBeNull()
    expect(toSanityImageProps(null)).toBeNull()
  })
})
