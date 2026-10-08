export const STATS_KEY = 'stats'

export const DEFAULT_STATS = {
  currentStreak: 0,
  maxStreak: 0,
  wins: 0,
  played: 0,
  distribution: [0, 0, 0, 0, 0, 0],
}

/** The stats after one finished game: a pure update, never mutating `stats`. */
export const applyCompletion = (stats, { won, guessCount }) => {
  const distribution = [...stats.distribution]
  if (won) distribution[guessCount - 1] = (distribution[guessCount - 1] ?? 0) + 1
  const currentStreak = won ? stats.currentStreak + 1 : 0

  return {
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    wins: stats.wins + (won ? 1 : 0),
    played: stats.played + 1,
    distribution,
  }
}

export const winPercent = stats => (stats.played === 0 ? 0 : Math.round((stats.wins / stats.played) * 100))

/** Stored stats, filled out with defaults so a partial or missing record is safe. */
export const loadStats = async io => {
  const saved = await io.store.get(STATS_KEY)

  return { ...DEFAULT_STATS, ...(saved ?? {}), distribution: saved?.distribution ?? [...DEFAULT_STATS.distribution] }
}

/**
 * Records one finished game of TODAY's puzzle and returns the new stats. The
 * caller must not call this for an archived date: practice never counts.
 */
export const recordCompletion = async (io, result) => {
  const next = applyCompletion(await loadStats(io), result)
  await io.store.set(STATS_KEY, next)

  return next
}
