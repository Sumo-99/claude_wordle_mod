import { atom, read, update } from 'claude-code'

import { FALLBACK_NOTE, renderBoard } from './lib/board-view.js'
import { boardKey, checkArchiveDate } from './lib/archive.js'
import { stepStage } from './lib/arcade.js'
import { FRAME_MS, TOTAL_FRAMES } from './lib/fireworks.js'
import {
  AUTO_OPEN_KEY,
  describeAutoOpen,
  describeReduceMotion,
  describeResetAsk,
  describeResetDone,
  historyKeys,
  parseWordleArgs,
  REDUCE_MOTION_KEY,
  USAGE,
} from './lib/lifecycle.js'
import { createGame, submitGuess, WORD_LENGTH } from './lib/game-engine.js'
import { DEFAULT_STATS, loadStats, recordCompletion, STATS_KEY } from './lib/stats.js'
import { isValidGuess, resolveWord } from './lib/word-source.js'

const PANE = 'wordle'

const game = atom({ plugin: 'wordle-mod', key: 'game' }, null)
const draft = atom({ plugin: 'wordle-mod', key: 'draft' }, '')
const puzzle = atom({ plugin: 'wordle-mod', key: 'puzzle' }, null)
const stats = atom({ plugin: 'wordle-mod', key: 'stats' }, DEFAULT_STATS)
const isStatsOpen = atom({ plugin: 'wordle-mod', key: 'isStatsOpen' }, false)
const isConfirmingClear = atom({ plugin: 'wordle-mod', key: 'isConfirmingClear' }, false)
const isDateEntryOpen = atom({ plugin: 'wordle-mod', key: 'isDateEntryOpen' }, false)
const celebrationFrame = atom({ plugin: 'wordle-mod', key: 'celebrationFrame' }, -1)
const isMotionReduced = atom({ plugin: 'wordle-mod', key: 'isMotionReduced' }, false)

const CLEAR_CONFIRM_MS = 5000

// A plugin has one hooks module and the engine's `$` can't cross an import, so
// everything that touches `$` lives here; lib/ is pure and takes closures.
const makeIo = $ => ({
  store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
  fetch: (url, init) => $.http.fetch(url, init),
  sleep: ms => $.clock.sleep(ms),
  readData: file => $.fs.read(`${$.plugin.root}/data/${file}`),
})

const today = async $ => {
  const d = new Date(await $.clock.now())
  const pad = n => String(n).padStart(2, '0')

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

let isLoading = false

/**
 * Makes `date` the active puzzle: its word, and the saved board if that date was
 * started before (so switching back resumes it). Runs from a timer or a handler,
 * never from a draw.
 */
const startDate = async ($, date) => {
  try {
    const io = makeIo($)
    const { solution, source } = await resolveWord(io, date)
    const saved = await io.store.get(boardKey(date))
    // If this date was started on an offline word and the live word has since come
    // back different, finish the game already in progress on the word it began with
    // (still marked offline) rather than throwing the player's guesses away.
    const keepSaved = saved && (saved.answer === solution || saved.guesses.length > 0)
    const resumed = keepSaved ? saved : createGame(solution)
    const shownSource = resumed.answer === solution ? source : 'fallback'
    const isToday = date === (await today($))
    const savedStats = await loadStats(io)
    await update($, game, () => resumed)
    await update($, draft, () => '')
    await update($, puzzle, () => ({ date, source: shownSource, isToday }))
    await update($, stats, () => savedStats)
  } catch {
    $.ui.toast('Could not start a puzzle.')
  } finally {
    isLoading = false
  }
}

/**
 * Gives the keyboard back to the Guess field. A click on an on-screen key leaves
 * the focus ring on that key, and then Enter would press the key again (the
 * Backspace key, say, deleting a letter instead of submitting) and a physical
 * Backspace would do nothing. With the ring back on the field, Enter submits and
 * Backspace edits it, whichever way the last letter went in. A refusal (the field
 * is gone because the game is over, or the pane doesn't hold the keys) is fine.
 */
const focusGuess = async $ => {
  try {
    await $.ui.focus({ requestId: PANE, key: 'guess' })
  } catch {
    // focus is a convenience; never let it get in the way of a press
  }
}

// While true the Guess field is drawn empty. See resyncField.
const isFieldBlanked = atom({ plugin: 'wordle-mod', key: 'isFieldBlanked' }, false)

const RESYNC_GAP_MS = 60

/**
 * Makes the Guess field show the draft again. Found from the live diagnostic log:
 * the field empties its own text on Enter, and it takes the `value` we draw it with
 * only when that value CHANGES between two drawings. After a rejected guess the
 * draft is unchanged, so the value was too, and the field stayed empty while the
 * draft lived on unseen; the next keystroke then replaced it ("type from scratch").
 * Drawing it empty and then with the draft is a change each time, so it takes both.
 * Edits that arrive during the empty moment come from a blanked field and are
 * dropped (see setDraft).
 */
const resyncField = async $ => {
  await update($, isFieldBlanked, () => true)
  // on a timer, not awaited: the handler that rejected the guess is not held up for it
  $.clock.after(RESYNC_GAP_MS, () => update($, isFieldBlanked, () => false))
}

/**
 * A guess that can't be played (too short, or not a word). As in the real Wordle
 * the letters STAY and the guess costs nothing: the player just edits the word.
 */
const rejectGuess = async ($, message) => {
  $.ui.toast(message)
  await resyncField($)
}

const typeLetter = async ($, letter) => {
  const g = await read($, game)
  if (!g || g.status !== 'playing') return
  await update($, draft, d => (d.length < WORD_LENGTH ? d + letter : d))
}

const backspace = async $ => {
  await update($, draft, d => d.slice(0, -1))
}

/** The typing field's text, reduced to the draft: lowercase letters, at most five. */
const setDraft = async ($, text) => {
  const g = await read($, game)
  if (!g || g.status !== 'playing') return
  const letters = String(text).toLowerCase().replace(/[^a-z]/g, '').slice(0, WORD_LENGTH)
  if (await read($, isFieldBlanked)) return // an edit of the field while it is being refilled
  await update($, draft, () => letters)
  // the draft is trimmed to letters, five at most; if that changed what was typed (a sixth
  // letter, a digit), the field must be told, or it keeps showing the longer text
  if (letters !== String(text).toLowerCase()) await resyncField($)
}

const REASONS = { length: 'Not enough letters', invalid: 'Not in word list' }

const enter = async $ => {
  const g = await read($, game)
  if (!g || g.status !== 'playing') return
  const word = await read($, draft)
  if (word.length < WORD_LENGTH) return rejectGuess($, REASONS.length)

  const isValid = await isValidGuess(makeIo($), word)
  const out = submitGuess(g, word, () => isValid)
  if (!out.ok) return rejectGuess($, REASONS[out.reason] ?? 'Cannot play that')
  await update($, game, () => out.game)
  await update($, draft, () => '')
  const active = await read($, puzzle)
  if (active) await $.store.set(boardKey(active.date), out.game)
  // Only a finished game of today's puzzle counts; practice dates never do. The
  // game was 'playing' before this guess, so this fires once per game, and a
  // finished board that is merely resumed later never reaches here.
  if (out.game.status !== 'playing' && active && active.date === (await today($))) {
    const next = await recordCompletion(makeIo($), {
      won: out.game.status === 'won',
      guessCount: out.game.guesses.length,
    })
    await update($, stats, () => next)
  }
  if (out.game.status === 'won') {
    $.ui.toast(`Solved in ${out.game.guesses.length}!`)
    await celebrate($)
  }
  if (out.game.status === 'lost') $.ui.toast(`The word was ${out.game.answer.toUpperCase()}`)
}

/** ▶ TODAY and the date field: validate, then switch the active puzzle. */
const pickDate = async ($, input) => {
  const check = checkArchiveDate(input, await today($))
  if (!check.ok) return $.ui.toast(check.reason)
  await update($, isDateEntryOpen, () => false)
  await startDate($, check.date)
}

/** ◀ (dir -1) and ▶ (dir +1) beside the stage date: one day back or forward. */
const stepToStage = async ($, dir) => {
  const active = await read($, puzzle)
  const now = await today($)
  const date = stepStage(active?.date ?? now, now, dir)
  if (date) await pickDate($, date)
}

/** DATE…: shows or hides the typed-date field, and gives it the keyboard when it opens. */
const toggleDateEntry = async $ => {
  const isOpen = await update($, isDateEntryOpen, v => !v)
  if (!isOpen) return focusGuess($)
  try {
    await $.ui.focus({ requestId: PANE, key: 'archive-date' })
  } catch {
    // the person can click into it instead
  }
}

let celebrationTimer = null

/**
 * Plays the win celebration: a timer steps the frame until the animation ends,
 * or until `skipCelebration` cuts it short. Reads the reduced-motion setting
 * once, as it starts.
 */
const celebrate = async $ => {
  if ((await read($, celebrationFrame)) >= 0) return
  const isReduced = (await $.store.get(REDUCE_MOTION_KEY)) === true
  await update($, isMotionReduced, () => isReduced)
  await update($, celebrationFrame, () => 0)
  celebrationTimer?.cancel()
  const timer = $.clock.every(FRAME_MS, async () => {
    const frame = await update($, celebrationFrame, n => (n < 0 ? n : n + 1))
    if (frame < 0 || frame >= TOTAL_FRAMES) {
      timer.cancel()
      await update($, celebrationFrame, () => -1)
    }
  })
  celebrationTimer = timer
}

/** The win screen's own control (a click, or the Enter hotkey): back to the board now. */
const skipCelebration = async $ => {
  celebrationTimer?.cancel()
  celebrationTimer = null
  await update($, celebrationFrame, () => -1)
}

/**
 * Wipes the saved stats. Two presses within a few seconds: the first arms the
 * button, the second clears. Saved boards are kept, so a finished puzzle stays
 * finished; only streaks, win % and the distribution reset.
 */
const clearStats = async $ => {
  if (!(await read($, isConfirmingClear))) {
    await update($, isConfirmingClear, () => true)
    $.clock.after(CLEAR_CONFIRM_MS, () => update($, isConfirmingClear, () => false))

    return
  }
  await $.store.set(STATS_KEY, DEFAULT_STATS)
  await update($, stats, () => DEFAULT_STATS)
  await update($, isConfirmingClear, () => false)
  $.ui.toast('Stats cleared.')
}

/** ▾ MORE / ▴ LESS beside the stats row: the details (played, distribution, Clear stats). */
const toggleStats = async $ => {
  await update($, isStatsOpen, v => !v)
}

/** @type {import('claude-code').Register} */
export const register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wordle',
      description: 'Open the Wordle pane',
    })

    return next(e)
  })

  on('command.run', { command: 'wordle' }, async ($, e) => {
    const cmd = parseWordleArgs(e.args)
    if (cmd.kind === 'usage') return { text: USAGE }
    if (cmd.kind === 'show-auto-open') return { text: describeAutoOpen((await $.store.get(AUTO_OPEN_KEY)) === true) }
    if (cmd.kind === 'set-auto-open') {
      await $.store.set(AUTO_OPEN_KEY, cmd.value)

      return { text: describeAutoOpen(cmd.value) }
    }
    if (cmd.kind === 'show-reduce-motion') return { text: describeReduceMotion((await $.store.get(REDUCE_MOTION_KEY)) === true) }
    if (cmd.kind === 'set-reduce-motion') {
      await $.store.set(REDUCE_MOTION_KEY, cmd.value)

      return { text: describeReduceMotion(cmd.value) }
    }
    if (cmd.kind === 'reset-history-ask' || cmd.kind === 'reset-history') {
      const doomed = historyKeys(await $.store.keys())
      const games = doomed.filter(key => key.startsWith('board:')).length
      if (cmd.kind === 'reset-history-ask') return { text: describeResetAsk(games) }

      for (const key of doomed) await $.store.delete(key)
      // the open game is history too: drop it so a pane that is showing it starts today afresh
      await update($, game, () => null)
      await update($, draft, () => '')
      await update($, puzzle, () => null)

      return { text: describeResetDone(games) }
    }
    await $.ui.open({ id: PANE, title: 'Wordle', focus: true, closeOnEscape: true })

    return { text: 'Wordle pane opened.' }
  })

  // Auto-open: only if the person turned it on. No `focus` (the mod opened it,
  // not the person, so it must not take the keyboard from the next prompt), and
  // there is deliberately no turn.complete hook: the pane never auto-closes.
  on('turn.start', async ($, e, next) => {
    try {
      if ((await $.store.get(AUTO_OPEN_KEY)) === true) {
        await $.ui.open({ id: PANE, title: 'Wordle', closeOnEscape: true })
      }
    } catch {
      // a refused open must never get in the way of Claude's turn
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const view = {
      game: await read($, game),
      draft: await read($, draft),
      puzzle: await read($, puzzle),
      today: await today($),
      stats: await read($, stats),
      isStatsOpen: await read($, isStatsOpen),
      isConfirmingClear: await read($, isConfirmingClear),
      isDateEntryOpen: await read($, isDateEntryOpen),
      celebrationFrame: await read($, celebrationFrame),
      isMotionReduced: await read($, isMotionReduced),
      isFieldBlanked: await read($, isFieldBlanked),
      // the win screen fills the pane: the Pane's own width and row room (this build hands
      // them over under `e.props`), the rows capped so the red stays about the board's height.
      // It must not be taller than the room, or the `1: continue` row on its bottom is clipped.
      screen: {
        columns: e.props?.bodyColumns ?? e.viewport?.columns ?? 40,
        rows: Math.min(26, e.props?.scroll?.bodyRows ?? Math.max(12, (e.viewport?.rows ?? 30) - 6)),
      },
      // the board's width, which picks side by side or stacked (this build hands the
      // Pane's size over under `e.props`)
      layout: { columns: e.props?.bodyColumns ?? e.viewport?.columns ?? 78 },
    }

    if (!view.game && !isLoading) {
      isLoading = true
      $.clock.after(0, async () => startDate($, await today($)))
    }

    return renderBoard({ h, Box, Text, Button, Input }, view, {
      letter: async ch => {
        await typeLetter($, ch)
        await focusGuess($)
      },
      enter: async () => {
        await enter($)
        await focusGuess($)
      },
      backspace: async () => {
        await backspace($)
        await focusGuess($)
      },
      input: text => setDraft($, text),
      pickDate: async value => {
        await pickDate($, value)
        // a refused typed date leaves its field open, and the keyboard with it
        if (!(await read($, isDateEntryOpen))) await focusGuess($)
      },
      stepStage: async dir => {
        await stepToStage($, dir)
        await focusGuess($)
      },
      toggleStats: () => toggleStats($),
      toggleDateEntry: () => toggleDateEntry($),
      clearStats: () => clearStats($),
      fallbackInfo: () => $.ui.toast(FALLBACK_NOTE),
      skipCelebration: () => skipCelebration($),
    })
  })
}
