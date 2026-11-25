'use client'

import {
  DefaultListView,
  Spinner,
  toast,
  useAuth,
  useConfig,
  useListDrawerContext,
  useListQuery,
  useLocale,
  usePreferences,
  useSelection,
} from '@payloadcms/ui'
import type { ListViewClientProps } from 'payload'
import { formatAdminURL } from 'payload/shared'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { tv } from 'tailwind-variants/lite'
import { GalleryControls, type GalleryView, isGalleryView } from './gallery-controls'
import { justify } from './justified'
import { presentMedia } from './media'
import { type GalleryLayout, MediaCard } from './media-card'

const results = tv({
  base: 'kmg:m-0 kmg:w-full kmg:list-none kmg:p-0',
  variants: {
    layout: {
      justified: 'kmg:flex kmg:flex-wrap kmg:items-start kmg:gap-[4px]',
      grid: 'kmg:grid kmg:grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] kmg:gap-[4px]',
    },
  },
})

// Payload 3.93 hides the list's beforeActions slot at its small breakpoint.
const smallToolbar = () => window.matchMedia('(max-width: 768px)')
function subscribeToToolbarSize(update: () => void) {
  const query = smallToolbar()
  query.addEventListener('change', update)
  return () => query.removeEventListener('change', update)
}

export function isGalleryQueryReady(
  querySlug: string | undefined,
  collectionSlug: string
): boolean {
  return querySlug === collectionSlug
}

function useGalleryView(collectionSlug: string, enabled: boolean) {
  const { user } = useAuth()
  const { getPreference, setPreference } = usePreferences()
  const key = `media-gallery-view-${encodeURIComponent(collectionSlug)}`
  const scope = user ? `${user.collection}:${user.id}:${key}` : key
  const [choice, setChoice] = useState<{ scope: string; view: GalleryView }>()
  const local = useRef<typeof choice>(undefined)
  const saving = useRef(Promise.resolve())
  const authenticated = Boolean(user)

  useEffect(() => {
    if (!enabled || !authenticated || local.current?.scope === scope) return
    let cancelled = false
    const reading = saving.current.then(() => getPreference<unknown>(key))
    // A pending read can otherwise replace the freshly saved value in Payload's cache.
    saving.current = reading.then(
      () => undefined,
      () => undefined
    )
    void reading
      .then((saved) => {
        if (!cancelled && local.current?.scope !== scope && isGalleryView(saved)) {
          setChoice({ scope, view: saved })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [authenticated, enabled, getPreference, key, scope])

  function changeView(view: GalleryView) {
    const next = { scope, view }
    local.current = next
    setChoice(next)
    if (authenticated) {
      saving.current = saving.current
        .then(() => setPreference(key, view))
        .catch(() => {
          toast.error('Could not save the media layout preference.')
        })
    }
  }

  return { view: choice?.scope === scope ? choice.view : 'justified', changeView } as const
}

function GalleryResults({
  collectionSlug,
  enableRowSelections,
  layout,
}: Pick<ListViewClientProps, 'collectionSlug' | 'enableRowSelections'> & {
  layout: GalleryLayout
}) {
  const { data, collectionSlug: querySlug } = useListQuery()
  const { config } = useConfig()
  const { code } = useLocale()
  const { isInDrawer, onBulkSelect, onSelect } = useListDrawerContext()
  const { user } = useAuth()
  const { selected, setSelection } = useSelection()
  const canSelectMany = enableRowSelections && (!isInDrawer || Boolean(onBulkSelect))
  const docs = data?.docs
  const items = useMemo(
    () =>
      (docs ?? []).flatMap((doc) => {
        const { id } = doc
        return typeof id === 'string' || typeof id === 'number'
          ? [{ id, doc, media: presentMedia(doc, code) }]
          : []
      }),
    [docs, code]
  )

  const [width, setWidth] = useState(0)
  const observe = useCallback((element: HTMLUListElement | null) => {
    if (!element) return
    const measure = () => setWidth(Math.floor(element.getBoundingClientRect().width))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const sizes = useMemo(
    () =>
      layout === 'justified'
        ? justify(
            items.map(({ media }) => media.ratio),
            width
          )
        : [],
    [items, layout, width]
  )

  if (!data || !isGalleryQueryReady(querySlug, collectionSlug))
    return (
      <div aria-label='Loading media' role='status'>
        <Spinner loadingText={null} size='lg' />
      </div>
    )

  return (
    <ul
      aria-label='Media results'
      className={results({ layout })}
      ref={layout === 'justified' ? observe : undefined}
    >
      {items.map(({ id, doc, media }, index) => {
        const editor: unknown = doc._userEditing
        const locked =
          doc._isLocked === true &&
          !!editor &&
          typeof editor === 'object' &&
          'id' in editor &&
          editor.id !== user?.id
        const href = isInDrawer
          ? undefined
          : formatAdminURL({
              adminRoute: config.routes.admin,
              path: `/collections/${collectionSlug}/${encodeURIComponent(String(id))}`,
            })

        return (
          <MediaCard
            href={href}
            key={id}
            layout={layout}
            media={media}
            onActivate={
              isInDrawer && onSelect
                ? () => onSelect({ collectionSlug, doc, docID: String(id) })
                : undefined
            }
            selection={
              canSelectMany
                ? {
                    checked: selected.get(id) === true,
                    disabled: locked,
                    toggle: () => setSelection(id),
                  }
                : undefined
            }
            size={sizes[index]}
          />
        )
      })}
    </ul>
  )
}

export function GalleryList({
  hasCustomDocumentLinks,
  ...props
}: ListViewClientProps & { hasCustomDocumentLinks?: boolean }) {
  const { isGroupingBy } = useListQuery()
  const { isInDrawer } = useListDrawerContext()
  const enabled =
    props.viewType === 'list' && !isGroupingBy && (!hasCustomDocumentLinks || isInDrawer)
  const { view, changeView } = useGalleryView(props.collectionSlug, enabled)
  const mobile = useSyncExternalStore(
    subscribeToToolbarSize,
    () => smallToolbar().matches,
    () => false
  )

  if (!enabled) {
    return <DefaultListView {...props} />
  }

  return (
    <DefaultListView
      {...props}
      beforeActions={
        mobile
          ? props.beforeActions
          : [
              ...(props.beforeActions ?? []),
              <GalleryControls
                key='media-views'
                mobile={false}
                onChange={changeView}
                view={view}
              />,
            ]
      }
      listMenuItems={
        mobile
          ? [
              ...(props.listMenuItems ?? []),
              <GalleryControls key='media-views' mobile onChange={changeView} view={view} />,
            ]
          : props.listMenuItems
      }
      Table={
        view === 'list' ? (
          props.Table
        ) : (
          <GalleryResults
            collectionSlug={props.collectionSlug}
            enableRowSelections={props.enableRowSelections}
            layout={view}
          />
        )
      }
    />
  )
}
