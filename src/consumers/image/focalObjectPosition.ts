import type { DefaultPopulateAsset } from '../assets'

export function focalObjectPosition(
  asset: Pick<DefaultPopulateAsset, 'focalX' | 'focalY'>
): string {
  const x = asset.focalX ?? 50
  const y = asset.focalY ?? 50
  return `${x}% ${y}%`
}
