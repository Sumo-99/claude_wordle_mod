import { expect, mock, test } from 'claude-code/testing'

import { parseWordleArgs } from '../lib/lifecycle.js'

test('parses /wordle arguments', () => {
  expect(parseWordleArgs('')).toEqual({ kind: 'open' })
  expect(parseWordleArgs('   ')).toEqual({ kind: 'open' })
  expect(parseWordleArgs('config auto-open on')).toEqual({ kind: 'set-auto-open', value: true })
  expect(parseWordleArgs('  CONFIG  Auto-Open  OFF ')).toEqual({ kind: 'set-auto-open', value: false })
  expect(parseWordleArgs('config auto-open')).toEqual({ kind: 'show-auto-open' })
  expect(parseWordleArgs('config auto-open maybe')).toEqual({ kind: 'usage' })
  expect(parseWordleArgs('config sound on')).toEqual({ kind: 'usage' })
  expect(parseWordleArgs('play')).toEqual({ kind: 'usage' })
  expect(parseWordleArgs('config reduce-motion on')).toEqual({ kind: 'set-reduce-motion', value: true })
  expect(parseWordleArgs('config reduce-motion')).toEqual({ kind: 'show-reduce-motion' })
  expect(parseWordleArgs('config toString')).toEqual({ kind: 'usage' })
})

const setup = ($: any, on: any, store: Record<string, unknown> = {}) => {
  mock.store(on, store)
  const opens: any[] = []
  const closes: any[] = []
  on('ui.open', async (_$: any, e: any) => {
    opens.push(e)

    return { value: undefined } as any
  })
  on('ui.close', async (_$: any, e: any) => {
    closes.push(e)

    return { value: undefined } as any
  })
  // the engine's own bottom for the turn events, beneath the plugin
  on('turn.start', async (_$: any, e: any) => ({ turnId: e.turnId }) as any)
  on('turn.complete', async () => ({ text: 'done' }) as any)

  return { opens, closes }
}

const startTurn = ($: any) => $.turn.start({ text: 'hello', turnId: 't1' })
const completeTurn = ($: any) => $.turn.complete({ turnId: 't1', answer: 'done' } as any)

test('turn.start opens the pane without focus when auto-open is on, and nothing closes it', async ($, on) => {
  const { opens, closes } = setup($, on, { 'config:autoOpen': true })

  await startTurn($)
  expect(opens).toHaveLength(1)
  expect(opens[0].id).toBe('wordle')
  expect(opens[0].focus).toBeUndefined()
  await completeTurn($)
  expect(closes).toHaveLength(0)
})

test('turn.start does not open the pane when auto-open is off or unset', async ($, on) => {
  const off = setup($, on, { 'config:autoOpen': false })
  await startTurn($)
  expect(off.opens).toHaveLength(0)
})

test('/wordle config auto-open on|off writes the flag, and /wordle opens with focus', async ($, on) => {
  const { opens } = setup($, on)
  const run = (args: string) => $.command.run({ command: 'wordle', args, origin: { kind: 'composer' } } as any)

  expect(((await run('config auto-open on')) as any).text).toContain('on')
  await startTurn($)
  expect(opens).toHaveLength(1)

  expect(((await run('config auto-open off')) as any).text).toContain('off')
  await startTurn($)
  expect(opens).toHaveLength(1)

  expect(((await run('')) as any).text).toContain('opened')
  expect(opens).toHaveLength(2)
  expect(opens[1].focus).toBe(true)
})
