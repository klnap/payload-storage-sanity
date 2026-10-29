'use client'

import { ChevronIcon, FieldLabel, Pill, Table, useTranslation } from '@payloadcms/ui'
import { SearchBar } from '@payloadcms/ui/elements/SearchBar'
import type { Column } from 'payload'
import { useCallback, useMemo, useState } from 'react'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import type { MediaUsageEntry } from '@/features/media/usage'

type SortColumn = 'type' | 'status' | 'document' | 'field'

type SortOrder = 'asc' | 'desc'

export function MediaUsageTableClient({ usages }: { usages: MediaUsageEntry[] }) {
  const { t } = useTranslation()
  const st = t as SanityStorageTranslateFn
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('type')
  const [sortDir, setSortDir] = useState<SortOrder>('asc')

  const layerLabel = useCallback(
    (layer: MediaUsageEntry['referenceLayer']) =>
      layer === 'published'
        ? sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usagePublished)
        : sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageDraft),
    [st]
  )

  const filtered = useMemo(() => {
    let result = [...usages]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (u) =>
          u.type.toLowerCase().includes(q) ||
          u.collectionLabel.toLowerCase().includes(q) ||
          u.title.toLowerCase().includes(q) ||
          u.fieldLabel.toLowerCase().includes(q) ||
          layerLabel(u.referenceLayer).toLowerCase().includes(q)
      )
    }

    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      let av: string
      let bv: string
      switch (sortCol) {
        case 'type':
          av = a.type
          bv = b.type
          break
        case 'status':
          av = layerLabel(a.referenceLayer)
          bv = layerLabel(b.referenceLayer)
          break
        case 'document':
          av = a.title
          bv = b.title
          break
        case 'field':
          av = a.fieldLabel
          bv = b.fieldLabel
          break
      }
      return av.localeCompare(bv) * dir
    })

    return result
  }, [layerLabel, search, sortCol, sortDir, usages])

  const toggleSort = useCallback((col: SortColumn, dir: SortOrder) => {
    setSortCol(col)
    setSortDir(dir)
  }, [])

  const columns: Column[] = useMemo(
    () => [
      {
        accessor: 'type',
        active: true,
        field: { name: 'type', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageType)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByTypeAscending
                )}
                className={`sort-column__asc sort-column__button${sortCol === 'type' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('type', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByTypeDescending
                )}
                className={`sort-column__desc sort-column__button${sortCol === 'type' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('type', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <Pill
            key={`type-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
            pillStyle={usage.type === 'global' ? 'warning' : 'light'}
            size='small'
          >
            {usage.type === 'global'
              ? sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageGlobal)
              : sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageCollection)}
          </Pill>
        )),
      },
      {
        accessor: 'status',
        active: true,
        field: { name: 'status', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageStatus)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByStatusAscending
                )}
                className={`sort-column__asc sort-column__button${sortCol === 'status' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('status', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByStatusDescending
                )}
                className={`sort-column__desc sort-column__button${sortCol === 'status' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('status', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <Pill
            key={`snap-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
            pillStyle={usage.referenceLayer === 'published' ? 'success' : 'light'}
            size='small'
          >
            {layerLabel(usage.referenceLayer)}
          </Pill>
        )),
      },
      {
        accessor: 'document',
        active: true,
        field: { name: 'document', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageDocument)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByDocumentAscending
                )}
                className={`sort-column__asc sort-column__button${sortCol === 'document' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('document', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByDocumentDescending
                )}
                className={`sort-column__desc sort-column__button${sortCol === 'document' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('document', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <a
            href={usage.adminPath}
            key={`doc-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
            rel='noreferrer'
            target='_blank'
          >
            {usage.type === 'collection' && usage.title !== String(usage.id)
              ? `${usage.title} · #${usage.id}`
              : usage.title}
          </a>
        )),
      },
      {
        accessor: 'field',
        active: true,
        field: { name: 'field', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageField)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByFieldAscending
                )}
                className={`sort-column__asc sort-column__button${sortCol === 'field' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('field', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByFieldDescending
                )}
                className={`sort-column__desc sort-column__button${sortCol === 'field' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('field', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <span
            key={`field-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
          >
            {usage.fieldLabel}
          </span>
        )),
      },
    ],
    [filtered, layerLabel, sortCol, sortDir, st, toggleSort]
  )

  if (usages.length === 0) {
    // Match Payload list empty state (`.no-results`) — copy is reference-specific
    return (
      <div className='no-results'>
        <h3>{t('general:noResultsFound')}</h3>
        <p>{sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageNotReferenced)}</p>
      </div>
    )
  }

  return (
    <div className='group-field group-field--top-level'>
      <div className='collection-list__wrap'>
        <div className='list-controls'>
          <SearchBar
            label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageSearch)}
            onSearchChange={setSearch}
          />
        </div>
        <div className='collection-list__tables'>
          <div className='table-wrap'>
            <Table columns={columns} data={filtered} />
          </div>
        </div>
      </div>
    </div>
  )
}
