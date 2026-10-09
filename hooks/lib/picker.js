import { addDays, checkArchiveDate, LAUNCH_DATE } from './archive.js'
import { stageLabel } from './arcade.js'

export const PLAYED_KEY = 'played-today'

export const ALL_PLAYED_MESSAGE = "You've played every game today!"

// A fixed pick for RANDOM GAME, read from the store when set (a number in [0, 1)): the pane's
// way in for a deterministic test or a repeatable manual check. Unset, picks are Math.random.
export const RANDOM_KEY = 'config:random'

const DAY_MS = 86400000
const dayIndex = date => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${LAUNCH_DATE}T00:00:00Z`)) / DAY_MS)

/** Whether `date` is a pool date: launch day through yesterday. Today is never in it. */
export const isInPool = (date, today) => date >= LAUNCH_DATE && date < today

/** How many dates the pool holds. */
export const poolSize = today => dayIndex(today)

const playedSet = (played, today) => new Set(played.filter(date => isInPool(date, today)))

/** How many pool dates are left to play: the pool minus the ones finished today. */
export const remaining = (today, played) => poolSize(today) - playedSet(played, today).size

// ---- the played-today set: { day, dates }, nothing else ----

/**
 * The dates finished on `today`. A record from another day is empty, and is
 * overwritten with an empty one for today.
 */
export const loadPlayed = async (io, today) => {
  const saved = await io.store.get(PLAYED_KEY)
  if (saved?.day === today && Array.isArray(saved.dates)) return [...saved.dates]
  if (saved) await io.store.set(PLAYED_KEY, { day: today, dates: [] })

  return []
}

/** Adds `date` to today's finished set (once) and returns the set. */
export const markPlayed = async (io, today, date) => {
  const dates = await loadPlayed(io, today)
  if (!dates.includes(date)) dates.push(date)
  await io.store.set(PLAYED_KEY, { day: today, dates })

  return dates
}

export const clearPlayed = async (io, today) => {
  await io.store.set(PLAYED_KEY, { day: today, dates: [] })
}

// ---- RANDOM GAME ----

/**
 * A uniform pick from the pool minus `played`, or null when nothing is left.
 * `rng` returns a number in [0, 1): inject one to make the pick deterministic.
 */
export const randomDate = (today, played, rng = Math.random) => {
  const left = remaining(today, played)
  if (left <= 0) return null
  const skip = playedSet(played, today)
  let pick = Math.min(left - 1, Math.floor(rng() * left))
  for (let i = 0; i < poolSize(today); i++) {
    const date = addDays(LAUNCH_DATE, i)
    if (skip.has(date)) continue
    if (pick === 0) return date
    pick -= 1
  }

  return null
}

// ---- the date stepper ----

/** The newest pool date not played today, or null when every date is played. */
export const newestUnplayed = (today, played) => {
  const skip = playedSet(played, today)
  for (let date = addDays(today, -1); isInPool(date, today); date = addDays(date, -1)) {
    if (!skip.has(date)) return date
  }

  return null
}

/** The dropdown's dates: the `count` newest pool dates not played today, newest first. */
export const recentUnplayed = (today, played, count = 14) => {
  const skip = playedSet(played, today)
  const dates = []
  for (let date = addDays(today, -1); isInPool(date, today) && dates.length < count; date = addDays(date, -1)) {
    if (!skip.has(date)) dates.push(date)
  }

  return dates
}

/**
 * The date the stepper shows: `date` while it is still playable, else the newest
 * unplayed date (yesterday when everything is played, so the stepper always shows a date).
 */
export const shownDate = (date, today, played) =>
  date && isInPool(date, today) && !played.includes(date) ? date : (newestUnplayed(today, played) ?? addDays(today, -1))

/** One step from `date` (dir -1 earlier, +1 later) over played dates, or null at either end. */
export const stepPicker = (date, today, played, dir) => {
  const skip = playedSet(played, today)
  let next = addDays(date, dir)
  while (isInPool(next, today) && skip.has(next)) next = addDays(next, dir)

  return isInPool(next, today) ? next : null
}

/**
 * The played dates the last step jumped over: the run of played dates right behind
 * `date` on the side the step came from (a ◀ step, dir -1, came from the later side).
 */
export const skippedBehind = (date, today, played, dir) => {
  const skip = playedSet(played, today)
  const run = []
  for (let d = addDays(date, -dir); isInPool(d, today) && skip.has(d); d = addDays(d, -dir)) run.push(d)

  return run.sort()
}

/** `skips 06, 07 OCT · played today`; nothing skipped is ''. Many dates are counted instead of listed. */
export const skippedLabel = dates => {
  if (dates.length === 0) return ''
  if (dates.length > 4) return `skips ${dates.length} dates · played today`
  const groups = []
  for (const date of dates) {
    const [day, month] = stageLabel(date).split(' ')
    const last = groups.at(-1)
    if (last?.month === month) last.days.push(day)
    else groups.push({ month, days: [day] })
  }

  return `skips ${groups.map(g => `${g.days.join(', ')} ${g.month}`).join(', ')} · played today`
}

// ---- the typed date ----

/** Whether a typed date can be played from the picker: { ok: true, date } or { ok: false, reason }. */
export const checkPickerDate = (input, today, played) => {
  const check = checkArchiveDate(input, today)
  if (!check.ok) return check
  if (check.date === today) return { ok: false, reason: "Today's puzzle is the daily: open it from ↺ TODAY'S BOARD" }
  if (played.includes(check.date)) return { ok: false, reason: `You already played ${check.date} today` }

  return check
}

// ---- display ----

/** 1903 → '1,903'. */
export const formatCount = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 'DD MON YYYY' for the stepper. */
export const longDate = date => `${stageLabel(date)} ${date.slice(0, 4)}`

const two = n => String(n).padStart(2, '0')

/** HH:MM:SS from `nowMs` to the next local midnight, when the next daily opens. */
export const nextDailyIn = nowMs => {
  const now = new Date(nowMs)
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const seconds = Math.max(0, Math.ceil((midnight - nowMs) / 1000))

  return `${two(Math.floor(seconds / 3600))}:${two(Math.floor((seconds % 3600) / 60))}:${two(seconds % 60)}`
}
