import type { Field } from 'payload'

const sanityAdmin = { hidden: true, readOnly: true } as const
const readOnly = { readOnly: true } as const

const PALETTE_SWATCH_NAMES = [
  'darkMuted',
  'darkVibrant',
  'dominant',
  'lightMuted',
  'lightVibrant',
  'muted',
  'vibrant',
] as const

const paletteSwatchFields = (): Field[] => [
  { name: 'background', type: 'text', admin: readOnly },
  { name: 'foreground', type: 'text', admin: readOnly },
  { name: 'population', type: 'number', admin: readOnly },
  { name: 'title', type: 'text', admin: readOnly },
]

export const sanityPaletteFields = (): Field[] =>
  PALETTE_SWATCH_NAMES.map((name) => ({
    name,
    type: 'group' as const,
    admin: readOnly,
    fields: paletteSwatchFields(),
  }))

export const sanityMetadataStorageGroup = (): Field => ({
  name: 'metadata',
  type: 'group',
  admin: sanityAdmin,
  fields: [
    {
      name: 'dimensions',
      type: 'group',
      fields: [
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'aspectRatio', type: 'number' },
      ],
    },
    { name: 'lqip', type: 'textarea' },
    { name: 'blurHash', type: 'text' },
    { name: 'thumbHash', type: 'text' },
    { name: 'hasAlpha', type: 'checkbox' },
    { name: 'isOpaque', type: 'checkbox' },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: '_type',
          type: 'text',
          defaultValue: 'geopoint',
          admin: { hidden: true },
        },
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
        { name: 'alt', type: 'number' },
      ],
    },
    {
      name: 'palette',
      type: 'group',
      fields: sanityPaletteFields(),
    },
    {
      name: 'exif',
      type: 'json',
      admin: { hidden: true },
    },
  ],
})

export const sanityUpstreamGroup = (): Field => ({
  name: 'sanity',
  type: 'group',
  admin: sanityAdmin,
  fields: [
    { name: 'id', type: 'text', index: true },
    { name: 'type', type: 'text' },
    { name: 'rev', type: 'text' },
    { name: 'assetId', type: 'text' },
    { name: 'path', type: 'text' },
    { name: 'url', type: 'text' },
    { name: 'extension', type: 'text' },
    { name: 'sha1hash', type: 'text', index: true },
    { name: 'size', type: 'number' },
    { name: 'mimeType', type: 'text' },
    { name: 'originalFilename', type: 'text' },
    sanityMetadataStorageGroup(),
    { name: 'source', type: 'text', defaultValue: 'dataset' },
    { name: 'media', type: 'text' },
  ],
})

export const sanityMediaNameField = (): Field => ({
  name: 'name',
  type: 'text',
  label: 'Name',
  admin: {
    position: 'sidebar',
    description: 'Internal name used for identification.',
  },
})

export const sanityOriginalFilenameField = (): Field => ({
  name: 'originalFilename',
  type: 'text',
  label: 'Original Filename',
  admin: {
    readOnly: true,
    position: 'sidebar',
    description: 'Original name of the uploaded file.',
  },
})

export const sanitySyncFields = (): Field[] => [
  {
    name: 'status',
    type: 'text',
    label: 'Status',
    admin: {
      readOnly: true,
      description: 'Current status of the asset.',
    },
  },
  {
    name: 'checkedAt',
    type: 'date',
    label: 'Checked At',
    admin: {
      readOnly: true,
      description: 'Timestamp when the asset was last verified.',
      date: {
        pickerAppearance: 'dayAndTime',
      },
    },
  },
  {
    name: 'errorAt',
    type: 'text',
    label: 'Last Error',
    admin: {
      readOnly: true,
      description: 'Details of the latest synchronization issue if one occurred.',
    },
  },
]

export const sanityMediaSyncFields = (): Field => ({
  name: 'sync',
  type: 'group',
  label: false,
  admin: {
    readOnly: true,
    position: 'sidebar',
  },
  fields: sanitySyncFields(),
})

export const sanityMediaAdminFields = (): Field[] => [
  sanityMediaNameField(),
  sanityOriginalFilenameField(),
  sanityMediaSyncFields(),
  sanityUpstreamGroup(),
]

export function collectTopLevelFieldNames(fields: Field[]): string[] {
  const names: string[] = []

  for (const field of fields) {
    if (field.type === 'tabs' && 'tabs' in field && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        names.push(...collectTabFieldNames(tab.fields))
      }
      continue
    }

    if (field.type === 'collapsible' && 'fields' in field && Array.isArray(field.fields)) {
      names.push(...collectTabFieldNames(field.fields))
      continue
    }

    if (field.type === 'row') {
      continue
    }

    if ('name' in field && field.name != null && field.name !== '' && field.type !== 'ui') {
      names.push(field.name)
    }
  }

  return names
}

function collectTabFieldNames(fields: Field[]): string[] {
  const names: string[] = []

  for (const field of fields) {
    if (field.type === 'row' && 'fields' in field && Array.isArray(field.fields)) {
      for (const rowField of field.fields) {
        if ('name' in rowField && rowField.name != null && rowField.name !== '') {
          names.push(rowField.name)
        }
      }
      continue
    }

    if ('name' in field && field.name != null && field.name !== '' && field.type !== 'ui') {
      names.push(field.name)
    }
  }

  return names
}
