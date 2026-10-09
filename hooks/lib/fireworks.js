export const FRAME_MS = 100
export const TOTAL_FRAMES = 30 // 30 frames x 100 ms = 3 seconds

// The smallest screen the picture is laid out for; a bigger pane just gets more gradient.
export const MIN_COLUMNS = 36
export const MIN_ROWS = 11

const LINE1 = 'WORDDDD...'
const LINE2 = 'you solved it!'

// Timeline, in frames (one frame = 100 ms).
const IRIS_FRAMES = 4 // the red opens out from the centre
const RING_STARTS = [0, 1, 2] // three shockwaves, a frame apart
const RING_LIFE = 8 // ~0.8 s from the centre to the edge, fading as they go
const PARTICLE_LIFE = 14
const LINE1_FROM = 2 // letters pop one per frame (~80-100 ms stagger)
const LINE1_DONE = LINE1_FROM + LINE1.length // the shake starts here
const SHAKE = [2, -2, 1, -1, 1, 0]
const LINE2_FROM = LINE1_DONE + 1
const SLIDE = 3 // rows line 2 rises through
const RAY_COUNT = 12
const RAY_TURN_FRAMES = 200 // one full turn of the sunburst every 20 s
const FADE_FRAMES = 5 // reduced motion: the whole picture fades in, then holds

// Raw hex, not theme keys: the scheme is the point here.
const CENTER = [0xff, 0x2d, 0x2d]
const EDGE = [0x2a, 0x00, 0x00]
const RAY = [0xff, 0x6a, 0x3d]
const GLOW = [0xff, 0x8a, 0x8a]
const WHITE = [0xff, 0xf4, 0xe6]
const GOLD = [0xff, 0xd3, 0x4d]
const SPARK_COLORS = ['#ffd34d', '#ff3b3b', '#ffb000', '#ff6b6b', '#fff1a8']
const SPARK_GLYPHS = ['✹', '✦', '✦', '*', '*', '·']
const SHADES = 12 // the gradient is quantized so neighbouring cells share a run

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))))
const hex = c => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
const easeOut = t => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3
// a fixed pseudo-random in [0, 1): the same particle always flies the same way
const noise = i => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453

  return x - Math.floor(x)
}

/**
 * One frame of the win screen as `rows` rows of exactly `columns` cells, each
 * row a list of runs: { text, color?, backgroundColor?, bold? }. Every cell
 * inside the red carries its own background, so the backdrop is exactly the
 * pane; cells the opening iris has not reached yet have none.
 *
 * Pure: the same arguments always draw the same picture. Past the last frame
 * (or before the first) every cell is blank.
 *
 * @param frame 0 … TOTAL_FRAMES - 1
 * @param screen `{ columns, rows }`
 * @param reducedMotion skip the iris, rays' turn, rings, particles and shake; just fade in
 */
export const celebrationRows = (frame, screen, reducedMotion = false) => {
  const W = Math.max(MIN_COLUMNS, screen.columns)
  const H = Math.max(MIN_ROWS, screen.rows)
  const cx = (W - 1) / 2
  const cy = (H - 1) / 2
  // terminal cells are about twice as tall as wide: halve x so circles look round
  const dist = (x, y) => Math.hypot((x - cx) / 2, y - cy)
  const maxD = dist(0, 0)
  const isOn = frame >= 0 && frame < TOTAL_FRAMES
  const fade = reducedMotion ? Math.min(1, (frame + 1) / FADE_FRAMES) : 1

  // --- the backdrop: radial gradient, slowly turning sunburst, opening from the centre
  const iris = reducedMotion ? Infinity : maxD * 1.05 * Math.max(0.15, easeOut(frame / IRIS_FRAMES))
  const turn = reducedMotion ? 0 : (frame / RAY_TURN_FRAMES) * Math.PI * 2
  const bgAt = (x, y) => {
    const d = dist(x, y)
    if (!isOn || d > iris) return undefined
    const t = Math.round((d / maxD) ** 0.8 * SHADES) / SHADES
    let c = mix(CENTER, EDGE, t)
    const angle = Math.atan2(y - cy, (x - cx) / 2) - turn
    if (Math.cos(angle * RAY_COUNT) > 0.55) c = mix(c, RAY, 0.35 * (1 - t))

    return hex(reducedMotion ? mix(EDGE, c, fade) : c)
  }
  const cells = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => ({ ch: ' ', backgroundColor: bgAt(x, y) })),
  )
  const put = (x, y, ch, color, bold, backgroundColor) => {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || x >= W || y < 0 || y >= H || !cells[y][x].backgroundColor) return
    cells[y][x] = { ch, color, bold, backgroundColor: backgroundColor ?? cells[y][x].backgroundColor }
  }

  if (isOn) {
    const shake = reducedMotion ? 0 : (SHAKE[frame - LINE1_DONE] ?? 0)
    const ox = cx + shake
    const line1Y = Math.round(cy) - 1
    const line2Y = line1Y + 2

    if (!reducedMotion) {
      // --- shockwave rings: scale 0 -> 3 (the third of the way out reaches the corners), fading
      RING_STARTS.forEach((start, k) => {
        const age = frame - start
        if (age < 0 || age >= RING_LIFE) return
        const r = (3 * maxD * (age + 1)) / (3 * RING_LIFE)
        const color = hex(mix([0xff, 0xd0, 0xc0], [0xa0, 0x10, 0x10], age / RING_LIFE))
        const glyph = age < 3 ? '•' : '·'
        const steps = Math.ceil(r * 8) + 8
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2 + k * 0.3
          put(ox + Math.cos(a) * r * 2, cy + Math.sin(a) * r, glyph, color, age < 3)
        }
      })

      // --- the red and gold particle burst, with a little gravity
      for (let i = 0; i < 40; i++) {
        const age = frame - (i % 3 === 0 ? 1 : 0)
        if (age < 0 || age >= PARTICLE_LIFE) continue
        const a = (i / 40) * Math.PI * 2 + noise(i) * 0.4
        const speed = 0.9 + noise(i + 100) * 1.4
        const x = ox + Math.cos(a) * speed * age * 2
        const y = cy + Math.sin(a) * speed * age + 0.04 * age * age
        const glyph = SPARK_GLYPHS[Math.min(SPARK_GLYPHS.length - 1, Math.floor((age / PARTICLE_LIFE) * SPARK_GLYPHS.length))]
        put(x, y, glyph, SPARK_COLORS[i % SPARK_COLORS.length], age < 6)
      }
    }

    // --- line 1: letters pop in one at a time, overshoot in gold, then settle white.
    // Every extra D bounces higher and longer than the one before it.
    const left1 = Math.round(ox - (LINE1.length - 1) / 2)
    ;[...LINE1].forEach((ch, i) => {
      if (reducedMotion) {
        if (frame >= 1) put(left1 + i, line1Y, ch, hex(mix(EDGE, WHITE, fade)), true)

        return
      }
      const age = frame - (LINE1_FROM + i)
      if (age < 0) return
      const extraD = i >= 4 && i <= 6 ? i - 3 : 0 // the 2nd, 3rd, 4th D: 1, 2, 3
      const bounce = age === 0 ? 0 : age <= extraD ? Math.min(2, Math.ceil(extraD / 2)) : 0
      if (age === 0) put(left1 + i, line1Y, ch, hex(EDGE), true, hex(GOLD)) // the overshoot: a gold flash
      else put(left1 + i, line1Y - bounce, ch, hex(age <= 1 + extraD ? GOLD : WHITE), true)
    })

    // --- line 2: slides up into place and fades in, then glows in a slow pulse
    const age2 = reducedMotion ? frame - 2 : frame - LINE2_FROM
    if (age2 >= 0) {
      const rise = reducedMotion ? 0 : Math.max(0, SLIDE - age2)
      const y = line2Y + rise
      const left2 = Math.round(ox - (LINE2.length - 1) / 2)
      const shown = reducedMotion ? fade : Math.min(1, (age2 + 1) / (SLIDE + 1))
      const settled = reducedMotion || rise === 0
      const pulse = settled && !reducedMotion ? (Math.sin((age2 - SLIDE) * 0.9) + 1) / 2 : 0.5
      // the glow: a soft lighter halo one cell around the words, breathing with the pulse
      if (settled) {
        for (let gx = left2 - 2; gx < left2 + LINE2.length + 2; gx++) {
          for (const gy of [y - 1, y, y + 1]) {
            const bg = cells[gy]?.[gx]?.backgroundColor
            if (!bg || cells[gy][gx].ch !== ' ') continue
            const base = [1, 3, 5].map(o => parseInt(bg.slice(o, o + 2), 16))
            const strength = (gy === y ? 0.45 : 0.2) * (0.4 + 0.6 * pulse)
            cells[gy][gx] = { ch: ' ', backgroundColor: hex(mix(base, GLOW, strength)) }
          }
        }
      }
      const color = hex(mix(EDGE, mix(WHITE, [0xff, 0xc4, 0xc4], pulse), shown))
      ;[...LINE2].forEach((ch, i) => {
        if (ch !== ' ') put(left2 + i, y, ch, color, true)
      })
    }
  }

  return cells.map(row => {
    const runs = []
    for (const cell of row) {
      const last = runs[runs.length - 1]
      const same = last && last.color === cell.color && last.bold === cell.bold && last.backgroundColor === cell.backgroundColor
      if (same) last.text += cell.ch
      else runs.push({ text: cell.ch, color: cell.color, bold: cell.bold, backgroundColor: cell.backgroundColor })
    }

    return runs
  })
}
