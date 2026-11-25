import { expect, test } from 'bun:test'
import { justify } from './justified'

test('fills complete rows with 4px gaps and leaves the final row at its natural size', () => {
  expect(justify([1, 1, 1, 0.5], 549.9)).toEqual([
    { width: 273, height: 272.5 },
    { width: 272, height: 272.5 },
    { width: 240, height: 240 },
    { width: 120, height: 240 },
  ])
})

test('keeps different proportions and document order in the same row', () => {
  expect(justify([2, 1], 544)).toEqual([
    { width: 462, height: 231, marginInlineEnd: 82 },
    { width: 240, height: 240 },
  ])
  expect(justify([2, 1], 400)).toEqual([
    { width: 340, height: 170, marginInlineEnd: 60 },
    { width: 240, height: 240 },
  ])
})

test('handles invalid metadata, extreme images, and containers narrower than the gap', () => {
  const ratios = [0, -1, Number.NaN, Infinity, 1e30, 1e-30, 0.5, 2, 7]

  for (const width of [1, 3, 110, 321, 801, 1201]) {
    const result = justify(ratios, width)
    expect(result).toHaveLength(ratios.length)
    let used = 0
    let height = 0
    for (const tile of result) {
      expect(tile.width).toBeGreaterThanOrEqual(1)
      expect(tile.height).toBeGreaterThan(0)
      const occupiedWidth = tile.width + (tile.marginInlineEnd ?? 0)
      if (!used || used + 4 + occupiedWidth > width) {
        used = 0
        height = tile.height
      }
      expect(tile.height).toBe(height)
      used += (used ? 4 : 0) + occupiedWidth
      expect(used).toBeLessThanOrEqual(width)
    }
  }

  expect(justify(ratios, 0)).toEqual([])
})
