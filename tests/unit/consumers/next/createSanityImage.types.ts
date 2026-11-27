import type { MediaAsset } from '@/consumers/assets'
import { createSanityImage, type SanityImageProps } from '@/consumers/next'

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
  image: 'https://cdn.sanity.io/images/demo/production/hero.jpg',
  metadata: { width: 1200, height: 800 },
}

// Custom asset accepted without casting to MediaAsset.
const _heroProps: SanityImageProps<HeroAsset> = {
  asset: hero,
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
    alt: 'caption',
  },
}

const _DefaultSanityImage = createSanityImage({
  fallback: null,
})

const defaultAsset: MediaAsset = {
  id: 1,
  url: 'https://cdn.sanity.io/images/demo/production/default.jpg',
  focalX: 50,
  focalY: 50,
  alt: null,
}

const _defaultProps: SanityImageProps = { asset: defaultAsset }

// Factory with mapping + instance override keeps the factory generic asset type.
const _overrideProps: SanityImageProps<HeroAsset> = {
  asset: hero,
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
  },
}
