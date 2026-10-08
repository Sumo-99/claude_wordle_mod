export type WordleScore = 'green' | 'yellow' | 'gray'

export type WordleGame = {
  answer: string
  guesses: { word: string; score: WordleScore[] }[]
  status: 'playing' | 'won' | 'lost'
}

/** The day's puzzle: its date and where the word came from. */
export type WordlePuzzle = {
  date: string
  source: 'live' | 'fallback'
}

declare module 'claude-code' {
  interface PluginState {
    'wordle-mod': {
      /** The game in play; null until the day's word has loaded. */
      game: WordleGame | null
      /** Letters typed toward the next guess (0-5, lowercase). */
      draft: string
      puzzle: WordlePuzzle | null
    }
  }
}
