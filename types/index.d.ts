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
      /** Mirror of the persisted `stats` record, for the stats pane. */
      stats: WordleStats
      /** Whether the separate stats pane is open (the main pane's toggle reads it). */
      isStatsOpen: boolean
      /** The stats pane's clear button has been pressed once and awaits a second press. */
      isConfirmingClear: boolean
      /** Frame of the win fireworks; -1 when no animation is running. */
      celebrationFrame: number
    }
  }
}
