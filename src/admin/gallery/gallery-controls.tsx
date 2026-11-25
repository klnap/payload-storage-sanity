import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Tooltip } from '@base-ui/react/tooltip'
import { tv } from 'tailwind-variants/lite'

const views = [
  {
    value: 'justified',
    label: 'Justified',
    path: 'M1 2h9v5H1z M12 2h3v5h-3z M1 9h5v5H1z M8 9h7v5H8z',
  },
  { value: 'grid', label: 'Grid', path: 'M1 1h6v6H1z M9 1h6v6H9z M1 9h6v6H1z M9 9h6v6H9z' },
  { value: 'list', label: 'List', path: 'M1 2h14v2H1z M1 7h14v2H1z M1 12h14v2H1z' },
] as const

export type GalleryView = (typeof views)[number]['value']

export function isGalleryView(value: unknown): value is GalleryView {
  return views.some((view) => view.value === value)
}

const controls = tv({
  slots: {
    trigger:
      'kmg:inline-flex kmg:h-7 kmg:shrink-0 kmg:cursor-pointer kmg:items-center kmg:justify-center kmg:rounded-sm kmg:border-0 kmg:text-xs kmg:hover:bg-(--theme-elevation-100) kmg:focus-visible:outline-2',
    group: 'kmg:inline-flex kmg:items-center kmg:gap-1',
    tooltip:
      'kmg:rounded-sm kmg:bg-(--theme-elevation-900) kmg:px-2 kmg:py-1 kmg:text-xs kmg:text-(--theme-elevation-0)',
  },
  variants: {
    active: {
      true: { trigger: 'kmg:bg-(--theme-elevation-150) kmg:text-(--theme-elevation-1000)' },
      false: { trigger: 'kmg:bg-transparent kmg:text-(--theme-elevation-800)' },
    },
  },
})

export function GalleryControls({
  mobile,
  onChange,
  view,
}: {
  mobile: boolean
  onChange: (view: GalleryView) => void
  view: GalleryView
}) {
  const styles = controls()
  const layoutButtons = (
    <div className='kmg:flex kmg:items-center kmg:gap-4'>
      <Tooltip.Provider delay={350}>
        <ToggleGroup
          aria-label='Media layout'
          className={styles.group()}
          onValueChange={([next]) => {
            if (next) onChange(next)
          }}
          value={[view]}
        >
          {views.map(({ value, label, path }) => (
            <Tooltip.Root key={value}>
              <Tooltip.Trigger
                render={
                  <Toggle
                    aria-label={label}
                    className={controls({ active: value === view }).trigger({
                      class: 'kmg:w-7 kmg:px-0',
                    })}
                    value={value}
                  />
                }
              >
                <svg
                  aria-hidden='true'
                  fill='currentColor'
                  height='16'
                  viewBox='0 0 16 16'
                  width='16'
                >
                  <path d={path} />
                </svg>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner className='kmg:z-(--z-popup)' sideOffset={4}>
                  <Tooltip.Popup className={styles.tooltip()}>{label}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </ToggleGroup>
      </Tooltip.Provider>
    </div>
  )

  if (mobile) {
    return <div className='kmg:p-2'>{layoutButtons}</div>
  }

  return <div className='kmg:flex kmg:shrink-0 kmg:items-center'>{layoutButtons}</div>
}
