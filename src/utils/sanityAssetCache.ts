import type { FetchSanityAssetResult } from '../sync/fetchAsset'

export class SanityAssetFetchCache {
  private cache = new Map<string, Promise<FetchSanityAssetResult>>()

  get(assetId: string): Promise<FetchSanityAssetResult> | undefined {
    return this.cache.get(assetId)
  }

  set(assetId: string, promise: Promise<FetchSanityAssetResult>): void {
    this.cache.set(assetId, promise)
  }

  delete(assetId: string): boolean {
    return this.cache.delete(assetId)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

export function createSanityAssetFetchCache(): SanityAssetFetchCache {
  return new SanityAssetFetchCache()
}
