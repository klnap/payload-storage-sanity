const gap = 4
export const targetHeight = 240
export const maxTileWidth = 520

export type TileSize = { width: number; height: number; marginInlineEnd?: number }

// Keep controls usable on pathological panoramas and strips; the image still uses object-contain.
export function tileRatio(ratio: number) {
  return Number.isFinite(ratio) && ratio > 0 ? Math.min(8, Math.max(1 / 8, ratio)) : 4 / 3
}

export function justifiedRatio(ratio: number) {
  return Math.min(2.5, tileRatio(ratio))
}

export function justify(ratios: readonly number[], containerWidth: number): TileSize[] {
  const width = Math.floor(containerWidth)
  if (!Number.isFinite(width) || width < 1) return []

  const sizes: TileSize[] = []
  let row: number[] = []
  let sum = 0

  function finish(stretch: boolean) {
    const freeWidth = width - gap * (row.length - 1)
    const single = row.length === 1
    const widthLimit = single ? Math.max(1, Math.floor(width * 0.85)) : freeWidth
    const height = Math.min(
      stretch && !single ? targetHeight * 1.15 : targetHeight,
      widthLimit / sum,
      maxTileWidth / Math.max(...row)
    )
    const rowWidth = Math.max(row.length, Math.round(height * sum))
    let cumulative = 0
    let left = 0

    for (const [index, ratio] of row.entries()) {
      cumulative += ratio
      const remaining = row.length - index - 1
      const right = Math.min(
        rowWidth - remaining,
        Math.max(left + 1, Math.round((cumulative / sum) * rowWidth))
      )
      sizes.push({
        width: right - left,
        height,
        // Keep the next row separate when capping the visible tiles.
        ...(stretch && remaining === 0 && rowWidth < freeWidth
          ? { marginInlineEnd: freeWidth - rowWidth }
          : {}),
      })
      left = right
    }

    row = []
    sum = 0
  }

  for (const value of ratios) {
    const ratio = justifiedRatio(value)
    const available = width - gap * row.length

    if (
      row.length &&
      (available < row.length + 1 ||
        ((sum + ratio) * targetHeight > available &&
          Math.abs((width - gap * (row.length - 1)) / sum - targetHeight) <
            targetHeight - available / (sum + ratio)))
    ) {
      finish(true)
    }

    row.push(ratio)
    sum += ratio
    if (targetHeight * sum + gap * (row.length - 1) >= width) finish(true)
  }

  if (row.length) finish(false)
  return sizes
}
