export type WordleScore = 'green' | 'yellow' | 'gray'

export type WordleGame = {
  answer: string
  guesses: { word: string; score: WordleScore[] }[]
  status: 'playing' | 'won' | 'lost'
}

/** The active puzzle: its date, where the word came from, and whether it is today's. */
export type WordlePuzzle = {
  date: string
  source: 'live' | 'fallback'
  /** Only today's puzzle counts toward stats; any other date is practice. */
  isToday: boolean
}

export type WordleStats = {
  currentStreak: number
  maxStreak: number
  wins: number
  played: number
  /** distribution[n - 1] = wins that took n guesses. */
  distribution: number[]
}

declare module 'claude-code' {
  interface PluginState {
    'wordle-mod': {
      /** The game in play; null until the word has loaded. */
      game: WordleGame | null
      /** Letters typed toward the next guess (0-5, lowercase). */
      draft: string
      puzzle: WordlePuzzle | null
      /** Mirror of the persisted `stats` record, for the stats row and HI-SCORE. */
      stats: WordleStats
      /** Whether the stats details (played, distribution, Clear stats) are open under the stats row. */
      isStatsOpen: boolean
      /** The Clear stats control has been pressed once and awaits a second press. */
      isConfirmingClear: boolean
      /** Whether the typed-date field (behind DATE…) is shown. */
      isDateEntryOpen: boolean
      /** True for a moment while the Guess field is drawn empty so it will take the draft again. */
      isFieldBlanked: boolean
      /** Frame of the win celebration; -1 when no animation is running. */
      celebrationFrame: number
      /** The running celebration plays its reduced-motion version (a plain fade). */
      isMotionReduced: boolean
    }
  }
}
