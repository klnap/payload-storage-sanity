import {
  type MediaAsset,
  SanityImage,
  sanityImageLoader,
} from '@klnap/payload-storage-sanity/consumers/next'

const asset: MediaAsset = {
  id: 1,
  url: 'https://cdn.sanity.io/images/demo/production/example.jpg',
  alt: 'Example',
  focalX: 50,
  focalY: 50,
  width: 800,
  height: 600,
}

export function Hero({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='100vw' />
}

export function ProjectCard({ image }: { image: MediaAsset }) {
  return <SanityImage asset={image} sizes='(max-width: 768px) 100vw, 50vw' />
}

export default function Page() {
  const loaderUrl = sanityImageLoader({
    src: asset.url ?? '',
    width: 400,
    quality: 75,
  })

  return (
    <main>
      <p data-loader={loaderUrl}>next release consumer</p>
      <Hero image={asset} />
      <ProjectCard image={asset} />
    </main>
  )
}
