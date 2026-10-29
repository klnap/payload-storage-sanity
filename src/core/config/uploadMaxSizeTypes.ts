export type SanityUploadMediaKind = 'image' | 'video' | 'file'

export type SanityStorageUploadMaxSizeByType = {
  image?: number
  video?: number
  file?: number
}

/** Max upload size in bytes. `default` applies when no `byType` rule matches. */
export type SanityStorageUploadMaxSizeConfig = {
  /** Limit for all kinds without a `byType` entry. */
  default?: number
  /** Per-kind overrides (may be lower or higher than `default`). */
  byType?: SanityStorageUploadMaxSizeByType
}

/** Shorthand: a number sets `default` only. */
export type SanityStorageUploadMaxSizeInput = number | SanityStorageUploadMaxSizeConfig
