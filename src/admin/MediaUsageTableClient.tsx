'use client'

import { ChevronIcon, FieldLabel, Pill, Table } from '@payloadcms/ui'
import { SearchBar } from '@payloadcms/ui/elements/SearchBar'
import type { Column } from 'payload'
import { useCallback, useMemo, useState } from 'react'

import type { MediaUsageEntry } from '../queries/findMediaUsage'

type SortColumn = 'type' | 'status' | 'document' | 'field'

function layerLabel(layer: MediaUsageEntry['referenceLayer']): string {
  return layer === 'published' ? 'Published' : 'Draft'
}
type SortOrder = 'asc' | 'desc'

export function MediaUsageTableClient({ usages }: { usages: MediaUsageEntry[] }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('type')
  const [sortDir, setSortDir] = useState<SortOrder>('asc')

  const filtered = useMemo(() => {
    let result = [...usages]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (u) =>
          u.type.toLowerCase().includes(q) ||
          u.collectionLabel.toLowerCase().includes(q) ||
          String(u.id).toLowerCase().includes(q) ||
          u.fieldLabel.toLowerCase().includes(q) ||
          u.fieldPath.toLowerCase().includes(q) ||
          u.title.toLowerCase().includes(q) ||
          layerLabel(u.referenceLayer).toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'type') {
        cmp = a.type.localeCompare(b.type)
      } else if (sortCol === 'status') {
        cmp = a.referenceLayer.localeCompare(b.referenceLayer)
      } else if (sortCol === 'document') {
        cmp = a.title.localeCompare(b.title)
      } else if (sortCol === 'field') {
        cmp = a.fieldLabel.localeCompare(b.fieldLabel)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [usages, search, sortCol, sortDir])

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
              <FieldLabel label='Type' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Type Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'type' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('type', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Type Descending'
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
            {usage.type === 'global' ? 'Global' : 'Collection'}
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
              <FieldLabel label='Status' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Status Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'status' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('status', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Status Descending'
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
              <FieldLabel label='Document' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Document Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'document' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('document', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Document Descending'
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
              <FieldLabel label='Field' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Field Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'field' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('field', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Field Descending'
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
          <span key={`field-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}-${usage.referenceLayer}`}>
            {usage.fieldLabel}
          </span>
        )),
      },
    ],
    [filtered, sortCol, sortDir, toggleSort]
  )

  return (
    <div className='group-field group-field--top-level'>
      <div className='collection-list__wrap'>
        <div className='list-controls'>
          <SearchBar
            label='Search by Type, Status, Document, or Field'
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
