import type {
  DefaultPopulateAsset,
  SanityAssetReference,
  SanityImageSource,
} from '../../src/consumers'
import { buildSanityImageUrl, isDefaultPopulateAsset } from '../../src/consumers'
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

if (isDefaultPopulateAsset(page.heroImage)) {
  const asset: DefaultPopulateAsset = page.heroImage
  const props: SanityImageProps = { asset, sizes: '100vw' }
  const url: string | null = buildSanityImageUrl(asset, { width: 960 })
  void props
  void url
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
