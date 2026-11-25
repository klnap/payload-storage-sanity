'use client'

import { ChevronIcon, FieldLabel, Pill, Table, useTranslation } from '@payloadcms/ui'
import { SearchBar } from '@payloadcms/ui/elements/SearchBar'
import type { Column } from 'payload'
import { useCallback, useMemo, useState } from 'react'
import { tv } from 'tailwind-variants'
import {
  SANITY_STORAGE_I18N_KEYS,
  type SanityStorageTranslateFn,
  sanityStorageTranslate,
} from '@/core/i18n'
import type { MediaUsageEntry } from '@/features/media/usage'

const sortButtonStyles = tv({
  base: 'sort-column__button min-h-[24px] min-w-[24px]',
  variants: {
    direction: { asc: 'sort-column__asc', desc: 'sort-column__desc' },
    active: { true: 'sort-column--active' },
  },
})

type SortColumn = 'type' | 'model' | 'status' | 'document' | 'id' | 'field'

type SortOrder = 'asc' | 'desc'

export function MediaUsageTableClient({
  usages,
  scanFailed = false,
}: {
  usages: MediaUsageEntry[]
  scanFailed?: boolean
}) {
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
          String(u.id).toLowerCase().includes(q) ||
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
        case 'model':
          av = a.collectionLabel
          bv = b.collectionLabel
          break
        case 'status':
          av = layerLabel(a.referenceLayer)
          bv = layerLabel(b.referenceLayer)
          break
        case 'document':
          av = a.title
          bv = b.title
          break
        case 'id':
          av = String(a.id)
          bv = String(b.id)
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
                aria-pressed={sortCol === 'type' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'type' && sortDir === 'asc',
                })}
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
                aria-pressed={sortCol === 'type' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'type' && sortDir === 'desc',
                })}
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
        accessor: 'model',
        active: true,
        field: { name: 'model', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageModel)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByModelAscending
                )}
                aria-pressed={sortCol === 'model' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'model' && sortDir === 'asc',
                })}
                onClick={() => toggleSort('model', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByModelDescending
                )}
                aria-pressed={sortCol === 'model' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'model' && sortDir === 'desc',
                })}
                onClick={() => toggleSort('model', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <span
            key={`model-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
          >
            {usage.collectionLabel}
          </span>
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
                aria-pressed={sortCol === 'status' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'status' && sortDir === 'asc',
                })}
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
                aria-pressed={sortCol === 'status' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'status' && sortDir === 'desc',
                })}
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
                aria-pressed={sortCol === 'document' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'document' && sortDir === 'asc',
                })}
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
                aria-pressed={sortCol === 'document' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'document' && sortDir === 'desc',
                })}
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
            {usage.title}
          </a>
        )),
      },
      {
        accessor: 'id',
        active: true,
        field: { name: 'id', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel
                label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageId)}
                unstyled
              />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByIdAscending
                )}
                aria-pressed={sortCol === 'id' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'id' && sortDir === 'asc',
                })}
                onClick={() => toggleSort('id', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label={sanityStorageTranslate(
                  st,
                  SANITY_STORAGE_I18N_KEYS.usageSortByIdDescending
                )}
                aria-pressed={sortCol === 'id' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'id' && sortDir === 'desc',
                })}
                onClick={() => toggleSort('id', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <span
            key={`id-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}
          >
            {String(usage.id)}
          </span>
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
                aria-pressed={sortCol === 'field' && sortDir === 'asc'}
                className={sortButtonStyles({
                  direction: 'asc',
                  active: sortCol === 'field' && sortDir === 'asc',
                })}
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
                aria-pressed={sortCol === 'field' && sortDir === 'desc'}
                className={sortButtonStyles({
                  direction: 'desc',
                  active: sortCol === 'field' && sortDir === 'desc',
                })}
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

  if (scanFailed) {
    return (
      <div className='no-results' role='alert'>
        <p>{sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.apiMediaUsageFailed)}</p>
      </div>
    )
  }

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
          <div
            aria-label={sanityStorageTranslate(st, SANITY_STORAGE_I18N_KEYS.usageTableScroll)}
            className='table-wrap overflow-x-auto'
            role='region'
            tabIndex={0}
          >
            <Table columns={columns} data={filtered} />
          </div>
        </div>
      </div>
    </div>
  )
}
