import { expect, test } from 'bun:test'
import { collectionHasTitleField, plainTitleField } from './titleField'

test('injects a hidden optional title that persists with the form', () => {
  expect(plainTitleField()).toEqual({ name: 'title', type: 'text', admin: { hidden: true } })
})

test('detects an existing title field so the default is not duplicated', () => {
  expect(collectionHasTitleField([{ name: 'title', type: 'text' }])).toBe(true)
  expect(collectionHasTitleField([{ name: 'alt', type: 'text' }])).toBe(false)
  expect(collectionHasTitleField(undefined)).toBe(false)
})
