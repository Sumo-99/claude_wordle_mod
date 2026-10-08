import { atom, read, update } from 'claude-code'

import { FALLBACK_NOTE, renderBoard } from './lib/board-view.js'
import { createGame, submitGuess, WORD_LENGTH } from './lib/game-engine.js'
import { isValidGuess, resolveWord } from './lib/word-source.js'

const PANE = 'wordle'

const game = atom({ plugin: 'wordle-mod', key: 'game' }, null)
const draft = atom({ plugin: 'wordle-mod', key: 'draft' }, '')
const puzzle = atom({ plugin: 'wordle-mod', key: 'puzzle' }, null)

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

/** Resolves today's word and starts a game. Runs from a timer, never from a draw. */
const startToday = async $ => {
  try {
    const date = await today($)
    const { solution, source } = await resolveWord(makeIo($), date)
    await update($, game, () => createGame(solution))
    await update($, draft, () => '')
    await update($, puzzle, () => ({ date, source }))
  } catch {
    $.ui.toast('Could not start a puzzle.')
  } finally {
    isLoading = false
  }
}

const typeLetter = async ($, letter) => {
  const g = await read($, game)
  if (!g || g.status !== 'playing') return
  await update($, draft, d => (d.length < WORD_LENGTH ? d + letter : d))
}

const backspace = async $ => {
  await update($, draft, d => d.slice(0, -1))
}

const REASONS = { length: 'Not enough letters', invalid: 'Not in word list' }

const enter = async $ => {
  const g = await read($, game)
  if (!g || g.status !== 'playing') return
  const word = await read($, draft)
  if (word.length < WORD_LENGTH) return $.ui.toast(REASONS.length)

  const isValid = await isValidGuess(makeIo($), word)
  const out = submitGuess(g, word, () => isValid)
  if (!out.ok) return $.ui.toast(REASONS[out.reason] ?? 'Cannot play that')
  await update($, game, () => out.game)
  await update($, draft, () => '')
  if (out.game.status === 'won') $.ui.toast(`Solved in ${out.game.guesses.length}!`)
  if (out.game.status === 'lost') $.ui.toast(`The word was ${out.game.answer.toUpperCase()}`)
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

  on('command.run', { command: 'wordle' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Wordle', focus: true, closeOnEscape: true })

    return { text: 'Wordle pane opened.' }
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const view = { game: await read($, game), draft: await read($, draft), puzzle: await read($, puzzle) }

    if (!view.game && !isLoading) {
      isLoading = true
      $.clock.after(0, () => startToday($))
    }

    return renderBoard({ h, Box, Text, Button }, view, {
      letter: ch => typeLetter($, ch),
      enter: () => enter($),
      backspace: () => backspace($),
      fallbackInfo: () => $.ui.toast(FALLBACK_NOTE),
    })
  })
}
