import { afterEach, describe, expect, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ToSanityImagePropsResult } from '../toSanityImageProps'
import { SanityImageClient } from './SanityImageClient'

describe('SanityImageClient', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.navigator = originalNavigator
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  })

  test('clears its load-error state when the image source changes', async () => {
    const window = new Window({ url: 'http://localhost' })
    globalThis.window = window as never
    globalThis.document = window.document as never
    globalThis.navigator = window.navigator as never
    globalThis.IS_REACT_ACT_ENVIRONMENT = true

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const props = (src: string) => ({
      derived: {
        src,
        alt: '',
        fill: false,
        width: 1,
        height: 1,
        placeholder: 'empty',
      } as ToSanityImagePropsResult,
      fallback: <span>Image failed</span>,
    })

    try {
      await act(async () => {
        root.render(<SanityImageClient {...props('https://cdn.sanity.io/first.jpg')} />)
      })
      const firstImage = container.querySelector('img')
      expect(firstImage?.getAttribute('src')).toContain('first.jpg')

      await act(async () => {
        firstImage?.dispatchEvent(new window.Event('error'))
      })
      expect(container.textContent).toBe('Image failed')

      await act(async () => {
        root.render(<SanityImageClient {...props('https://cdn.sanity.io/second.jpg')} />)
      })
      expect(container.querySelector('img')?.getAttribute('src')).toContain('second.jpg')
      expect(container.textContent).toBe('')
    } finally {
      await act(async () => root.unmount())
      window.happyDOM.abort()
    }
  })
})
