import { expect, test } from 'claude-code/testing'

import { fireworkRuns, HEIGHT, TOTAL_FRAMES, WIDTH } from '../lib/fireworks.js'

// Paint a frame into a WIDTH x HEIGHT character grid, as the runs would land.
const picture = (frame: number, keepClear = []) => {
  const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => ' '))
  for (const run of fireworkRuns(frame, keepClear)) {
    ;[...run.text].forEach((ch, i) => (grid[run.y][run.x + i] = ch))
  }

  return grid.map(row => row.join(''))
}

test('every run lies inside the WIDTH x HEIGHT area', () => {
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    for (const run of fireworkRuns(f)) {
      expect(run.x).toBeGreaterThanOrEqual(0)
      expect(run.y).toBeGreaterThanOrEqual(0)
      expect(run.x + run.text.length).toBeLessThanOrEqual(WIDTH)
      expect(run.y).toBeLessThan(HEIGHT)
    }
  }
})

test('only sparks are returned, never blank cells', () => {
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    for (const run of fireworkRuns(f)) expect(run.text.trim()).toBe(run.text)
  }
})

test('the first frame is a lone spark, the bursts then spread out', () => {
  const sparks = (f: number) => picture(f).join('').replace(/ /g, '').length

  expect(sparks(0)).toBe(1)
  expect(sparks(2)).toBeGreaterThan(sparks(0))
})

test('HOORAY! pops in after the first bursts and stays until the end', () => {
  const word = (f: number) => picture(f)[5].replace(/ /g, '')

  expect(picture(0).join('')).not.toContain('H')
  expect(word(3)).toContain('HOORAY!')
  expect(word(TOTAL_FRAMES - 1)).toContain('HOORAY!')
})

test('letters change color from frame to frame, and bursts have their own colors', () => {
  const colors = (f: number) => fireworkRuns(f).map(r => r.color)

  expect(colors(5)).not.toEqual(colors(6))
  expect(new Set(fireworkRuns(14).map(r => r.color)).size).toBeGreaterThan(2)
})

test('frames are pure, and outside the animation the picture is empty', () => {
  expect(picture(7)).toEqual(picture(7))
  for (const f of [-1, TOTAL_FRAMES, TOTAL_FRAMES + 5]) expect(fireworkRuns(f)).toEqual([])
})

test('nothing is ever painted inside a keep-clear rectangle', () => {
  // the first burst goes off at x=8,y=4: the fifth letter of the first guess on a practice puzzle
  const grid = { x: 0, y: 4, width: 9, height: 6 }
  expect(fireworkRuns(0).some(r => r.x === 8 && r.y === 4)).toBe(true)

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    for (const run of fireworkRuns(f, [grid])) {
      for (let i = 0; i < run.text.length; i++) {
        const x = run.x + i
        expect(x >= grid.x && x < grid.x + grid.width && run.y >= grid.y && run.y < grid.y + grid.height).toBe(false)
      }
    }
  }
})
