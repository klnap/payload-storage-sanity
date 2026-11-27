/** Flat DTO for successfully normalized populated media relationships. */
export type MediaAsset = {
  id: string | number
  url: string
  /** Image metadata, present when the Sanity asset provides it. */
  width?: number
  height?: number
  aspectRatio?: number
  /** Always present: 50 when the asset has no focal point. */
  focalX: number
  focalY: number
  /** Resolved for request locale; `null` when missing or empty (always present on preset `default`). */
  alt: string | null
  lqip?: string
}
