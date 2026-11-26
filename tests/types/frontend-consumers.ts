import type {
  MediaAsset,
  MediaImageAsset,
  SanityAssetReference,
  SanityImageSource,
} from '../../src/consumers'
import { buildSanityImageUrl, isMediaAsset, isMediaImageAsset } from '../../src/consumers'
import type { SanityImageProps } from '../../src/consumers/next'

type GeneratedMedia = {
  id: number
  url: string | null
  alt?: { en?: string | null }
}

type Hero = {
  heroImage: GeneratedMedia | number | null
}

declare const page: Hero

if (isMediaAsset(page.heroImage)) {
  const asset: MediaAsset = page.heroImage
  const url: string | null = buildSanityImageUrl(asset, { width: 960 })
  // @ts-expect-error A general media asset may be a file; narrow it before using SanityImage.
  const unsafeProps: SanityImageProps = { asset, sizes: '100vw' }
  void url
  void unsafeProps
}

if (isMediaImageAsset(page.heroImage)) {
  const image: MediaImageAsset = page.heroImage
  const props: SanityImageProps = { asset: image, sizes: '100vw' }
  void props
}

type ApiImage = {
  media: {
    cdnUrl: string
    dimensions: { width: number; height: number }
  }
  description: string | null
}

const reference: SanityAssetReference = { _type: 'reference', _ref: 'image-id' }
const source: SanityImageSource = reference

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

void customProps
void source
