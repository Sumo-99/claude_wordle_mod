import { expect, test } from 'claude-code/testing'

import { fireworkRows, FRAME_MS, HEIGHT, TOTAL_FRAMES, WIDTH } from '../lib/fireworks.js'

const picture = (frame: number) => fireworkRows(frame).map(runs => runs.map(r => r.text).join(''))

test('the animation lasts three seconds', () => {
  expect(FRAME_MS * TOTAL_FRAMES).toBe(3000)
})

test('every frame is a full WIDTH x HEIGHT picture', () => {
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const rows = picture(f)
    expect(rows).toHaveLength(HEIGHT)
    for (const row of rows) expect([...row]).toHaveLength(WIDTH)
  }
})

test('the first frame is a lone spark, the bursts then spread out', () => {
  const sparks = (f: number) => picture(f).join('').replace(/ /g, '').length

  expect(sparks(0)).toBe(1)
  expect(sparks(2)).toBeGreaterThan(sparks(0))
})

test('bursts keep going through the three seconds, not just the first one', () => {
  const sparks = (f: number) => picture(f).join('').replace(/[ HOARY!]/g, '').length

  for (const f of [4, 10, 18, 25]) expect(sparks(f)).toBeGreaterThan(0)
})

test('HOORAY! pops in after the first bursts and stays until the end', () => {
  const word = (f: number) => picture(f)[5].replace(/ /g, '')

  expect(picture(0).join('')).not.toContain('H')
  expect(word(3)).toContain('HOORAY!')
  expect(word(TOTAL_FRAMES - 1)).toContain('HOORAY!')
})

test('letters change color from frame to frame, and bursts have their own colors', () => {
  const colors = (f: number) => fireworkRows(f).flat().map(r => r.color)

  expect(colors(5)).not.toEqual(colors(6))
  expect(new Set(fireworkRows(14).flat().map(r => r.color).filter(Boolean)).size).toBeGreaterThan(2)
})

test('frames are pure, and outside the animation the picture is blank', () => {
  expect(picture(7)).toEqual(picture(7))
  for (const f of [-1, TOTAL_FRAMES, TOTAL_FRAMES + 5]) {
    expect(picture(f).every(row => row.trim() === '')).toBe(true)
  }
})
