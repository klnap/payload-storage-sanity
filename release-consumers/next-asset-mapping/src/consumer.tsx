import { createSanityImage, type SanityImageProps } from '@klnap/payload-storage-sanity/next'

type HeroAsset = {
  image: string
  metadata: { width: number; height: number }
  caption?: string
}

const HeroSanityImage = createSanityImage<HeroAsset>({
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

const props: SanityImageProps<HeroAsset> = {
  asset: hero,
  assetMapping: {
    url: 'image',
    width: 'metadata.width',
    height: 'metadata.height',
  },
}

export function MappingConsumer() {
  return <HeroSanityImage {...props} />
}
