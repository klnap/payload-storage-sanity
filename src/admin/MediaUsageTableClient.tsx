'use client'

import { ChevronIcon, FieldLabel, Pill, SearchIcon, Table } from '@payloadcms/ui'
import type { Column } from 'payload'
import { useCallback, useMemo, useState } from 'react'

import type { MediaUsageEntry } from '../queries/findMediaUsage'

type SortColumn = 'type' | 'name' | 'id' | 'field'
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
          (u.name && u.name.toLowerCase().includes(q)) ||
          u.collectionLabel.toLowerCase().includes(q) ||
          String(u.id).toLowerCase().includes(q) ||
          u.fieldLabel.toLowerCase().includes(q) ||
          u.fieldPath.toLowerCase().includes(q) ||
          u.title.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'type') {
        cmp = a.type.localeCompare(b.type)
      } else if (sortCol === 'name') {
        cmp = (a.name || a.collectionLabel).localeCompare(b.name || b.collectionLabel)
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
            key={`type-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}`}
            pillStyle={usage.type === 'global' ? 'warning' : 'light'}
            size='small'
          >
            {usage.type === 'global' ? 'Global' : 'Collection'}
          </Pill>
        )),
      },
      {
        accessor: 'name',
        active: true,
        field: { name: 'name', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel label='Name' unstyled />
            </span>
            <div className='sort-column__buttons'>
              <button
                aria-label='Sort by Name Ascending'
                className={`sort-column__asc sort-column__button${sortCol === 'name' && sortDir === 'asc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('name', 'asc')}
                type='button'
              >
                <ChevronIcon direction='up' />
              </button>
              <button
                aria-label='Sort by Name Descending'
                className={`sort-column__desc sort-column__button${sortCol === 'name' && sortDir === 'desc' ? ' sort-column--active' : ''}`}
                onClick={() => toggleSort('name', 'desc')}
                type='button'
              >
                <ChevronIcon direction='down' />
              </button>
            </div>
          </div>
        ),
        renderedCells: filtered.map((usage) => (
          <span
            key={`name-${usage.collectionSlug}-${usage.id}-${usage.fieldPath}`}
            style={{ fontWeight: 500 }}
          >
            {usage.name || usage.collectionLabel}
          </span>
        )),
      },
      {
        accessor: 'id',
        active: true,
        field: { name: 'id', type: 'text' } as Column['field'],
        Heading: (
          <div className='sort-column'>
            <span className='sort-column__label'>
              <FieldLabel label='Document / ID' unstyled />
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
              <span>{usage.type === 'global' ? 'Global' : `ID: ${usage.id}`}</span>
            </code>
            {usage.type !== 'global' && usage.title && usage.title !== String(usage.id) ? (
              <span style={{ marginLeft: 6, opacity: 0.75 }}>({usage.title})</span>
            ) : null}
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
