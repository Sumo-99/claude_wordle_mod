export const LAUNCH_DATE = '2021-06-19' // the first NYT-era Wordle: no puzzle exists before this
const DAY_MS = 86400000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const boardKey = date => `board:${date}`

const toMs = date => Date.parse(`${date}T00:00:00Z`)
const fromMs = ms => new Date(ms).toISOString().slice(0, 10)

export const addDays = (date, n) => fromMs(toMs(date) + n * DAY_MS)

/** `today` and the `count - 1` days before it, newest first. */
export const recentDates = (today, count = 14) => Array.from({ length: count }, (_, i) => addDays(today, -i))

/**
 * Whether `input` names a puzzle the archive can play: a real YYYY-MM-DD,
 * from launch through today. Returns { ok: true, date } or { ok: false, reason }.
 */
export const checkArchiveDate = (input, today) => {
  const date = String(input ?? '').trim()
  if (!DATE_RE.test(date) || Number.isNaN(toMs(date)) || fromMs(toMs(date)) !== date) {
    return { ok: false, reason: 'Enter a date as YYYY-MM-DD' }
  }
  if (date > today) return { ok: false, reason: 'That puzzle is in the future' }
  if (date < LAUNCH_DATE) return { ok: false, reason: `No puzzles before ${LAUNCH_DATE}` }

  return { ok: true, date }
}
