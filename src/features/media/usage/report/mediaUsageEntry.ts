export type MediaUsageType = 'collection' | 'global'

/** Whether the reference was found on a published or draft snapshot (live read or version row). */
export type MediaUsageReferenceLayer = 'published' | 'draft'

export type MediaUsageEntry = {
  type: MediaUsageType
  id: number | string
  title: string
  name: string
  collectionSlug: string
  collectionLabel: string
  fieldPath: string
  fieldLabel: string
  referenceLayer: MediaUsageReferenceLayer
  /** When set, `adminPath` opens that version in the admin (published vs draft query param). */
  versionId?: number | string
  adminPath: string
}
