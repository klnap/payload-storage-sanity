import { describe, expect, test } from 'bun:test'
import { SortColumn } from '@payloadcms/ui'
import { isValidElement, type ReactNode } from 'react'
import { GalleryControls } from './gallery-controls'

function containsType(node: ReactNode, type: unknown): boolean {
  if (Array.isArray(node)) return node.some((child) => containsType(child, type))
  if (!isValidElement<{ children?: ReactNode }>(node)) return false
  if (node.type === type) return true
  return containsType(node.props.children, type)
}

describe('GalleryControls', () => {
  test('renders the layout toggles without a Date sort column', () => {
    const controls = GalleryControls({ mobile: false, onChange: () => {}, view: 'grid' })

    expect(containsType(controls, SortColumn)).toBe(false)
  })
})
