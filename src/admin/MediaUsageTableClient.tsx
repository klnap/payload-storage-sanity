'use client'

import { ChevronIcon, FieldLabel, Pill, SearchIcon, Table } from '@payloadcms/ui'
import type { Column } from 'payload'
import { useCallback, useMemo, useState } from 'react'

import type { MediaUsageEntry } from '../queries/findMediaUsage'

type SortColumn = 'collection' | 'id' | 'field'
type SortOrder = 'asc' | 'desc'

export function MediaUsageTableClient({ usages }: { usages: MediaUsageEntry[] }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortColumn>('collection')
  const [sortDir, setSortDir] = useState<SortOrder>('asc')

  const filtered = useMemo(() => {
    let result = [...usages]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (u) =>
          u.collectionLabel.toLowerCase().includes(q) ||
          String(u.id).toLowerCase().includes(q) ||
          u.fieldLabel.toLowerCase().includes(q) ||
          u.fieldPath.toLowerCase().includes(q) ||
          u.title.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'collection') {
        cmp = a.collectionLabel.localeCompare(b.collectionLabel)
      } else if (sortCol === 'id') {
        const aNum = Number(a.id)
        const bNum = Number(b.id)
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          cmp = aNum - bNum
        } else {
          cmp = String(a.id).localeCompare(String(b.id))
        }
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
        accessor: 'collection',
        active: true,
        // SAFETY: Synthetic column definition matching Payload Table Column contract
        field: { name: 'collection', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel label='Collection' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Collection Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'collection' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('collection', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Collection Descending'
                className={`sort-column__desc sort-column__button${sortCol === 'collection' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('collection', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <Pill
            key={`col-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}`}
            pillStyle='light'
            size='small'
          >
            {usage.collectionLabel}
          </Pill>
        )),
      },
      {
        accessor: 'id',
        active: true,
        // SAFETY: Synthetic column definition matching Payload Table Column contract
        field: { name: 'id', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel label='ID' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by ID Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'id' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('id', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by ID Descending'
                className={`sort-column__desc sort-column__button${sortCol === 'id' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('id', 'desc')}
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
            key={`id-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}`}
            rel='noreferrer'
            target='_blank'
          >
            <code className='code-cell' style={{ whiteSpace: 'nowrap' }}>
              <span>ID: {usage.id}</span>
            </code>
          </a>
        )),
      },
      {
        accessor: 'field',
        active: true,
        // SAFETY: Synthetic column definition matching Payload Table Column contract
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
          <span key={`fld-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}`}>
            {usage.fieldLabel}
          </span>
        )),
      },
    ],
    [filtered, sortCol, sortDir, toggleSort]
  )

  return (
    <div className='group-field group-field--top-level'>
      <div className='list-controls'>
        <div className='search-bar'>
          <SearchIcon />
          <div className='search-filter'>
            <input
              aria-label='Search'
              className='search-filter__input'
              id='search-filter-input'
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search'
              type='text'
              value={search}
            />
          </div>
        </div>
      </div>

      <div className='collection-list__tables'>
        <Table columns={columns} data={filtered} />
      </div>
    </div>
  )
}
