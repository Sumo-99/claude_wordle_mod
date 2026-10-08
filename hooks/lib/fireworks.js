export const WIDTH = 36
export const HEIGHT = 11
export const FRAME_MS = 110
export const TOTAL_FRAMES = 24

const WORD = 'H O O R A Y !'
const WORD_ROW = 5
const WORD_FROM = 3 // the word pops in once the first bursts are up
// Theme keys, so the colors follow the person's theme.
const PALETTE = ['success', 'warning', 'error', 'suggestion', 'claude', 'permission']

// Each burst: where it goes off (columns are about half as tall as rows, so x
// spreads twice as far), the frame it starts on, and its color.
const BURSTS = [
  { cx: 8, cy: 4, start: 0, color: 'warning' },
  { cx: 27, cy: 3, start: 3, color: 'success' },
  { cx: 18, cy: 7, start: 6, color: 'error' },
  { cx: 5, cy: 7, start: 9, color: 'suggestion' },
  { cx: 30, cy: 7, start: 11, color: 'claude' },
  { cx: 18, cy: 3, start: 13, color: 'permission' },
]
const SPARKS = 12
const LIFE = 5
const GLYPHS = ['✹', '✺', '✦', '✦', '+', '·']

const isInside = (x, y, rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height

/**
 * One frame of the fireworks as positioned runs: [{ x, y, text, color, bold }, …].
 * Only the sparks and letters are returned, never blank cells, so the overlay
 * hides nothing it isn't drawing on. Cells inside any `keepClear` rectangle
 * ({ x, y, width, height }) are dropped: that is where the board's letters are.
 * Pure: the same frame always draws the same picture. Past the last frame it
 * is empty.
 */
export const fireworkRuns = (frame, keepClear = []) => {
  const cells = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => null))
  const put = (x, y, ch, color, bold) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) cells[y][x] = { ch, color, bold }
  }

  if (frame >= 0 && frame < TOTAL_FRAMES) {
    for (const { cx, cy, start, color } of BURSTS) {
      const age = frame - start
      if (age < 0 || age > LIFE) continue
      if (age === 0) put(cx, cy, GLYPHS[0], color, true)
      for (let i = 0; age > 0 && i < SPARKS; i++) {
        const angle = (i / SPARKS) * Math.PI * 2
        put(cx + Math.round(Math.cos(angle) * age * 2), cy + Math.round(Math.sin(angle) * age), GLYPHS[age], color, age < 3)
      }
    }
    if (frame >= WORD_FROM) {
      const left = Math.floor((WIDTH - WORD.length) / 2)
      ;[...WORD].forEach((ch, i) => {
        if (ch !== ' ') put(left + i, WORD_ROW, ch, PALETTE[(i + frame) % PALETTE.length], true)
      })
    }
  }

  const runs = []
  cells.forEach((row, y) => {
    let last
    row.forEach((cell, x) => {
      if (!cell || keepClear.some(rect => isInside(x, y, rect))) return (last = undefined)
      if (last && last.color === cell.color && last.bold === cell.bold && last.x + last.text.length === x) last.text += cell.ch
      else runs.push((last = { x, y, text: cell.ch, color: cell.color, bold: cell.bold }))
    })
  })

  return runs
}
