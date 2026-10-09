import { expect, test } from 'claude-code/testing'

import { celebrationRows, FRAME_MS, MIN_COLUMNS, MIN_ROWS, TOTAL_FRAMES } from '../lib/fireworks.js'

const SCREEN = { columns: 60, rows: 20 }
const rows = (frame: number, reduced = false, screen = SCREEN) => celebrationRows(frame, screen, reduced)
const picture = (frame: number, reduced = false) => rows(frame, reduced).map(runs => runs.map(r => r.text).join(''))
const cells = (frame: number, reduced = false) =>
  rows(frame, reduced).map(runs => runs.flatMap(r => [...r.text].map(ch => ({ ch, ...r }))))
const painted = (frame: number, reduced = false) => cells(frame, reduced).flat().filter(c => c.backgroundColor).length
const redness = (hex: string) => parseInt(hex.slice(1, 3), 16)

test('the animation lasts three seconds', () => {
  expect(FRAME_MS * TOTAL_FRAMES).toBe(3000)
})

test('every frame fills the whole screen, cell for cell, and never less than the minimum', () => {
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const shown = picture(f)
    expect(shown).toHaveLength(SCREEN.rows)
    for (const row of shown) expect([...row]).toHaveLength(SCREEN.columns)
  }
  const tiny = celebrationRows(10, { columns: 10, rows: 3 })
  expect(tiny).toHaveLength(MIN_ROWS)
  expect(tiny[0].map(r => r.text).join('')).toHaveLength(MIN_COLUMNS)
})

test('the red opens out from the centre, then covers every cell', () => {
  const first = cells(0)
  expect(first[10][30].backgroundColor).toBeDefined() // the centre is red at once
  expect(first[0][0].backgroundColor).toBeUndefined() // the corners are not yet
  expect(painted(1)).toBeGreaterThan(painted(0))
  expect(painted(4)).toBe(SCREEN.columns * SCREEN.rows)
})

test('the backdrop is a red radial gradient: bright in the middle, dark at the edges', () => {
  const c = cells(20)
  expect(c[10][30].backgroundColor).toMatch(/^#[0-9a-f]{6}$/)
  expect(redness(c[10][30].backgroundColor!)).toBeGreaterThan(redness(c[0][0].backgroundColor!) + 100)
  expect(c[0][0].backgroundColor).toBe('#2a0000')
})

test('the sunburst rays turn slowly', () => {
  const bg = (f: number) => cells(f).flat().map(c => c.backgroundColor).join()
  expect(bg(5)).not.toEqual(bg(25))
})

test('rings and a red and gold burst go off from the centre at the start', () => {
  const sparks = picture(3).join('').replace(/[ A-Za-z.!]/g, '').length
  expect(sparks).toBeGreaterThan(20)
  const colors = new Set(cells(3).flat().filter(c => /[✹✦*•·]/.test(c.ch)).map(c => c.color))
  expect(colors.has('#ffd34d')).toBe(true)
  expect(colors.has('#ff3b3b')).toBe(true)
  // and they have died away by the end
  expect(picture(TOTAL_FRAMES - 1).join('').replace(/[ A-Za-z.!]/g, '')).toBe('')
})

test('WORDDDD... pops in one letter at a time, then "you solved it!" joins it', () => {
  const text = (f: number) => picture(f).join('\n')
  expect(text(2)).toContain('W')
  expect(text(2)).not.toContain('WO')
  expect(text(TOTAL_FRAMES - 1)).toContain('WORDDDD...')
  expect(text(10)).not.toContain('you solved it!')
  expect(text(TOTAL_FRAMES - 1)).toContain('you solved it!')
})

test('line 2 slides up into place under line 1', () => {
  const rowOf = (f: number) => picture(f).findIndex(r => r.includes('you solved it!'))
  expect(rowOf(13)).toBeGreaterThan(rowOf(TOTAL_FRAMES - 1))
})

test('the screen shakes once line 1 is done', () => {
  const col = (f: number) => picture(f).find(r => r.includes('WORDDDD...'))!.indexOf('WORDDDD...')
  expect(col(12)).not.toBe(col(TOTAL_FRAMES - 1))
  expect(col(20)).toBe(col(TOTAL_FRAMES - 1))
})

test('reduced motion: no iris, rings, particles or shake, just a fade in', () => {
  expect(painted(0, true)).toBe(SCREEN.columns * SCREEN.rows)
  for (let f = 0; f < TOTAL_FRAMES; f++) expect(picture(f, true).join('').replace(/[ A-Za-z.!]/g, '')).toBe('')
  const center = (f: number) => redness(cells(f, true)[10][30].backgroundColor!)
  expect(center(4)).toBeGreaterThan(center(0))
  expect(picture(TOTAL_FRAMES - 1, true).join('\n')).toContain('you solved it!')
})

test('frames are pure, and outside the animation the screen is blank', () => {
  expect(rows(7)).toEqual(rows(7))
  for (const f of [-1, TOTAL_FRAMES, TOTAL_FRAMES + 5]) {
    expect(picture(f).every(row => row.trim() === '')).toBe(true)
    expect(painted(f)).toBe(0)
  }
})
