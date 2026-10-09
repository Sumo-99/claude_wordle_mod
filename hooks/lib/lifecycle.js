export const AUTO_OPEN_KEY = 'config:autoOpen'
export const REDUCE_MOTION_KEY = 'config:reduceMotion'

export const USAGE =
  'Usage: /wordle   |   /wordle config auto-open on|off   |   /wordle config reduce-motion on|off   |   /wordle config reset-history [confirm]'

// setting name -> the kinds its show / set commands parse to
const SETTINGS = {
  'auto-open': { show: 'show-auto-open', set: 'set-auto-open' },
  'reduce-motion': { show: 'show-reduce-motion', set: 'set-reduce-motion' },
}

// What reset-history deletes: every saved game and every cached word. Stats and
// settings are different keys and are kept (Clear stats is its own control).
export const HISTORY_KEY_PREFIXES = ['board:', 'word:']

/** The store keys that make up the played-games history. */
export const historyKeys = keys => keys.filter(key => HISTORY_KEY_PREFIXES.some(prefix => key.startsWith(prefix)))

/**
 * Parses what follows `/wordle`:
 *   ''                          -> { kind: 'open' }
 *   'config auto-open on|off'   -> { kind: 'set-auto-open', value }
 *   'config auto-open'          -> { kind: 'show-auto-open' }
 *   'config reduce-motion on|off' / 'config reduce-motion' -> the same, for the win animation
 *   'config reset-history'          -> { kind: 'reset-history-ask' }  (asks first)
 *   'config reset-history confirm'  -> { kind: 'reset-history' }
 * anything else                 -> { kind: 'usage' }
 */
export const parseWordleArgs = args => {
  const words = String(args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { kind: 'open' }
  if (words[0] === 'config' && words[1] === 'reset-history') {
    if (words.length === 2) return { kind: 'reset-history-ask' }
    if (words.length === 3 && words[2] === 'confirm') return { kind: 'reset-history' }

    return { kind: 'usage' }
  }
  const setting = words[0] === 'config' && Object.hasOwn(SETTINGS, words[1]) ? SETTINGS[words[1]] : null
  if (!setting) return { kind: 'usage' }
  if (words.length === 2) return { kind: setting.show }
  if (words.length === 3 && (words[2] === 'on' || words[2] === 'off')) {
    return { kind: setting.set, value: words[2] === 'on' }
  }

  return { kind: 'usage' }
}

export const describeAutoOpen = isOn => `Wordle auto-open is ${isOn ? 'on' : 'off'}.`

export const describeReduceMotion = isOn =>
  `Wordle reduced motion is ${isOn ? 'on: the win screen just fades in' : 'off: the win screen plays in full'}.`

export const describeResetAsk = count =>
  count === 0
    ? 'No saved games to clear.'
    : `This deletes ${count} saved game${count === 1 ? '' : 's'} (and the cached words). Your stats and settings are kept. ` +
      'Run /wordle config reset-history confirm to go ahead.'

export const describeResetDone = count =>
  `Cleared ${count} saved game${count === 1 ? '' : 's'} and the cached words. Stats and settings were kept; today's puzzle starts fresh.`
