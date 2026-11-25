import type { Field, PayloadRequest } from 'payload'

/** Set on `req.context` by plugin-owned writes that must set `sanity.asset` with `overrideAccess: false`. */
export const SANITY_UPSTREAM_WRITE_CONTEXT_KEY = 'sanityUpstreamWrite' as const

/** Client REST/Local writes (`overrideAccess: false`) cannot set `sanity.asset`; the plugin's own writes can. */
const isSanityUpstreamWrite = ({ req }: { req: PayloadRequest }): boolean =>
  req.context?.[SANITY_UPSTREAM_WRITE_CONTEXT_KEY] === true

/** Upstream Sanity asset document — only Sanity persistence key (`sanity.asset` JSON). */
export const sanityAssetJsonGroup = (): Field => ({
  name: 'sanity',
  type: 'group',
  label: false,
  access: { create: () => false, update: isSanityUpstreamWrite },
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
const sanitySyncFields = (): Field[] => [
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

/** Same access as `sanity.asset`: client writes cannot set sync.status to missing/error or clear the URL. */
export const sanityMediaSyncFields = (): Field => ({
  name: 'sync',
  type: 'group',
  label: false,
  hidden: true,
  access: { create: () => false, update: isSanityUpstreamWrite },
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
