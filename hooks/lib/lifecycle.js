export const AUTO_OPEN_KEY = 'config:autoOpen'
export const REDUCE_MOTION_KEY = 'config:reduceMotion'

export const USAGE = 'Usage: /wordle   |   /wordle config auto-open on|off   |   /wordle config reduce-motion on|off'

// setting name -> the kinds its show / set commands parse to
const SETTINGS = {
  'auto-open': { show: 'show-auto-open', set: 'set-auto-open' },
  'reduce-motion': { show: 'show-reduce-motion', set: 'set-reduce-motion' },
}

/**
 * Parses what follows `/wordle`:
 *   ''                          -> { kind: 'open' }
 *   'config auto-open on|off'   -> { kind: 'set-auto-open', value }
 *   'config auto-open'          -> { kind: 'show-auto-open' }
 *   'config reduce-motion on|off' / 'config reduce-motion' -> the same, for the win animation
 * anything else                 -> { kind: 'usage' }
 */
export const parseWordleArgs = args => {
  const words = String(args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { kind: 'open' }
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
