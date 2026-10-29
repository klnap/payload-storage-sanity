import type { SanitySyncStatus } from '@/features/asset-sync'
import type { SanityImageAsset } from '@/sanity/assets'

export type FetchSanityAssetResult =
  | { status: 'available'; asset: SanityImageAsset }
  | { status: Exclude<SanitySyncStatus, 'available'>; asset?: undefined; message?: string }
