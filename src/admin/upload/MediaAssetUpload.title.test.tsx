import { expect, mock, test } from 'bun:test'
import { Window } from 'happy-dom'
import { act, type ChangeEvent, useState } from 'react'
import { createRoot } from 'react-dom/client'

const titleChanges: string[] = []
let changeTitle: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined

const Empty = () => null
const MockTextInput = ({
  onChange,
  path,
  readOnly,
  value,
}: {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  path: string
  readOnly?: boolean
  value?: string
}) => {
  changeTitle = onChange
  return <input name={path} onChange={onChange} disabled={readOnly} value={value || ''} />
}

mock.module('@payloadcms/ui', () => ({
  Button: Empty,
  CopyToClipboard: Empty,
  Drawer: Empty,
  EditUpload: Empty,
  TextInput: MockTextInput,
  Upload: Empty,
  useConfig: () => ({ getEntityConfig: () => null }),
  useDocumentInfo: () => ({ collectionSlug: 'media', data: {} }),
  useField: ({ path }: { path: string }) => {
    const [value, setValue] = useState(path === 'title' ? 'Original title' : undefined)
    return {
      value,
      setValue: (next: string) => {
        if (path === 'title') titleChanges.push(next)
        setValue(next)
      },
    }
  },
  useForm: () => ({ getData: () => ({}), setModified: () => {} }),
  useFormModified: () => false,
  useLocale: () => ({ code: 'en' }),
  useModal: () => ({ openModal: () => {}, closeModal: () => {} }),
  useTranslation: () => ({ t: (key: string) => key }),
  useUploadEdits: () => ({
    uploadEdits: {},
    resetUploadEdits: () => {},
    updateUploadEdits: () => {},
  }),
}))

test('title input is controlled by the Payload form without a read-only warning', async () => {
  const { MediaAssetUpload } = await import('./MediaAssetUpload')
  const window = new Window({ url: 'http://localhost' })
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    MutationObserver: globalThis.MutationObserver,
    error: console.error,
  }
  globalThis.window = window as never
  globalThis.document = window.document as never
  globalThis.navigator = window.navigator as never
  globalThis.MutationObserver = window.MutationObserver as never
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const errors: unknown[][] = []
  console.error = (...args) => errors.push(args)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  try {
    await act(async () => root.render(<MediaAssetUpload titleInput />))
    const input = container.querySelector<HTMLInputElement>('input[name="title"]')
    expect(errors.flat().join(' ')).not.toContain('without an `onChange` handler')
    expect(input?.value).toBe('Original title')
    await act(async () => {
      changeTitle?.({ target: { value: 'Updated title' } } as ChangeEvent<HTMLInputElement>)
    })
    expect(input?.value).toBe('Updated title')
    expect(titleChanges).toEqual(['Updated title'])
  } finally {
    await act(async () => root.unmount())
    console.error = original.error
    globalThis.window = original.window
    globalThis.document = original.document
    globalThis.navigator = original.navigator
    globalThis.MutationObserver = original.MutationObserver
    Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    window.happyDOM.abort()
  }
})
