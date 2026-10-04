import type { DefaultPopulateAsset } from '../types/defaultPopulate'

export function assetFocalObjectPosition(
  asset: Pick<DefaultPopulateAsset, 'focalX' | 'focalY'>
): string {
  const x = asset.focalX ?? 50
  const y = asset.focalY ?? 50
  return `${x}% ${y}%`
}
