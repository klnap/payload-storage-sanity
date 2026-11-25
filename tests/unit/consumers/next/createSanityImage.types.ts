import { createSanityImage, type SanityImageProps } from '@/consumers/next'
import type { DefaultPopulateAsset } from '@/features/media/populate'

type HeroAsset = {
  image: string
  metadata: { width: number; height: number }
  caption?: string
}

const _HeroSanityImage = createSanityImage<HeroAsset>({
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
    alt: 'caption',
  },
})

const hero: HeroAsset = {
  image: 'https://cdn.example/hero.jpg',
  metadata: { width: 1200, height: 800 },
}

// Custom asset accepted without casting to DefaultPopulateAsset.
const _heroProps: SanityImageProps<HeroAsset> = {
  asset: hero,
}

const _DefaultSanityImage = createSanityImage({
  fallback: null,
})

const defaultAsset: DefaultPopulateAsset = {
  id: 1,
  url: 'https://cdn.example/default.jpg',
  alt: null,
}

const _defaultProps: SanityImageProps = {
  asset: defaultAsset,
}

// Factory with mapping + instance override keeps the factory generic asset type.
const _overrideProps: SanityImageProps<HeroAsset> = {
  asset: hero,
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
  },
}
