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

/** What the opening splash draws from (see hooks/lib/splash.js), read once as the pane opens. */
export type WordleSplashOptions = {
  /** Today, 'YYYY-MM-DD': the HUD's STAGE. */
  date: string
  hiScore: number
  /** Today's puzzle is finished: row 9 reads PICK YOUR NEXT GAME, and the hand-off opens the picker. */
  isTodayDone: boolean
  /** The 1 s settled picture instead of the animation. */
  reducedMotion: boolean
  /** Opened by auto-open: the 2 s cut. */
  isAutoOpen: boolean
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
      /** The height made the last draw stack (board over controls), not the width; read back for the switch-back gap. Session only. */
      isStacked: boolean
      /** The body rows the pane had when it opened (null until its first draw); it stacks only once the room grows past them. Session only. */
      openRows: number | null
      /** Which screen the pane shows: the game board, or the Pick a game screen. */
      mode: 'game' | 'picker'
      /** The date the picker's stepper was moved to (null: the newest date not played today). */
      pickerDate: string | null
      /** Which way the stepper last moved (-1 earlier, +1 later), for the "skips …" caption. */
      pickerDir: -1 | 1
      /** Mirror of the persisted `played-today` record: the dates whose game ended on `day`. */
      playedToday: { day: string | null; dates: string[] }
      /** Today's saved board once it is finished (the picker's header and 1UP); null otherwise. */
      todayGame: WordleGame | null
      /** The clock at the picker's last once-a-second tick; redraws the countdown. */
      tick: number
      /** The opening splash while it plays (`frame` counts 100 ms frames from the open); null otherwise. Session only. */
      splash: { id: number; frame: number; opts: WordleSplashOptions } | null
    }
  }
}
