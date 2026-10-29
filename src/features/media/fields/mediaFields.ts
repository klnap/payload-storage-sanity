import type { Field } from 'payload'

/** Upstream Sanity asset document — only Sanity persistence key (`sanity.asset` JSON). */
export const sanityAssetJsonGroup = (): Field => ({
  name: 'sanity',
  type: 'group',
  label: false,
  admin: { readOnly: true, hidden: true },
  fields: [
    {
      name: 'asset',
      type: 'json',
      label: false,
      admin: { readOnly: true },
    },
  ],
})

/** Sync diagnostics — always hidden in admin; kept for persistence / reconcile. */
export const sanitySyncFields = (): Field[] => [
  {
    name: 'status',
    type: 'text',
    label: 'Status',
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'checkedAt',
    type: 'date',
    label: 'Checked at',
    admin: {
      readOnly: true,
      date: {
        pickerAppearance: 'dayAndTime',
      },
    },
  },
  {
    name: 'errorAt',
    type: 'text',
    label: 'Last error',
    admin: {
      readOnly: true,
    },
  },
]

export const sanityMediaSyncFields = (): Field => ({
  name: 'sync',
  type: 'group',
  label: false,
  hidden: true,
  admin: {
    readOnly: true,
  },
  fields: sanitySyncFields(),
})

export const sanityMediaAdminFields = (): Field[] => [
  sanityMediaSyncFields(),
  sanityAssetJsonGroup(),
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
