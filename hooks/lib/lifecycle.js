export const AUTO_OPEN_KEY = 'config:autoOpen'

export const USAGE = 'Usage: /wordle   |   /wordle config auto-open on|off'

/**
 * Parses what follows `/wordle`:
 *   ''                          -> { kind: 'open' }
 *   'config auto-open on|off'   -> { kind: 'set-auto-open', value }
 *   'config auto-open'          -> { kind: 'show-auto-open' }
 * anything else                 -> { kind: 'usage' }
 */
export const parseWordleArgs = args => {
  const words = String(args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { kind: 'open' }
  if (words[0] !== 'config' || words[1] !== 'auto-open') return { kind: 'usage' }
  if (words.length === 2) return { kind: 'show-auto-open' }
  if (words.length === 3 && (words[2] === 'on' || words[2] === 'off')) {
    return { kind: 'set-auto-open', value: words[2] === 'on' }
  }

  return { kind: 'usage' }
}

export const describeAutoOpen = isOn => `Wordle auto-open is ${isOn ? 'on' : 'off'}.`
