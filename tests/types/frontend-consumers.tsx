import type { MediaAsset as FrameworkMediaAsset } from '../../src/consumers'
import { buildSanityImageUrl, type SanityAssetReference } from '../../src/consumers'
import { type MediaAsset, SanityImage, type SanityImageProps } from '../../src/consumers/next'

type Page = {
  heroImage: MediaAsset
}

declare const page: Page

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='100vw' />
}

export function ProjectCard({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='(max-width: 768px) 100vw, 50vw' />
}

const sameContract: FrameworkMediaAsset = page.heroImage
const props: SanityImageProps = { asset: page.heroImage, sizes: '100vw' }
const url: string | null = buildSanityImageUrl(page.heroImage, { width: 960 })
const reference: SanityAssetReference = { _type: 'reference', _ref: 'image-id' }

type ApiImage = {
  media: {
    cdnUrl: string
    dimensions: { width: number; height: number }
  }
  description: string | null
}

declare const customImage: ApiImage
const customProps: SanityImageProps<ApiImage> = {
  asset: customImage,
  assetMapping: {
    url: 'media.cdnUrl',
    width: 'media.dimensions.width',
    height: 'media.dimensions.height',
    alt: 'description',
  },
  sizes: '100vw',
}

void sameContract
void props
void url
void reference
void customProps
