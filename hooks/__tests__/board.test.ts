import { expect, mock, test } from 'claude-code/testing'

const SOLUTION = 'prove'

const ok = (body: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(body) })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`plays a game by pressing the on-screen keys (${surface})`, async ($, on) => {
    mock.store(on)
    const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00') })
    on('http.fetch', async () => ({ value: ok({ solution: SOLUTION }) }))
    on('fs.read', async () => ({ value: 'crane\nprove\n' }) as any)
    on('ui.toast', async () => ({ value: undefined }) as any)

    const pane = await $.ui.mount({ plugin: 'wordle-mod', surface, component: 'Pane', props: {}, requestId: 'wordle' } as any)
    await clock.settle()
    await clock.settle()

    const press = async (word: string) => {
      for (const ch of word) await pane.press({ key: `k-${ch}` } as any)
      await pane.press({ key: 'enter' } as any)
    }
    const text = async () => JSON.stringify(await pane.drawn())
    // scored letters are the underlined Texts outside the legend (whose sample letter is 'A')
    const scored = async () =>
      (await pane.findAll({ type: 'Text' } as any))
        .filter((t: any) => t.props.underline)
        .map((t: any) => `${t.text}:${t.props.color}`)

    // a wrong guess scores per tile: c r a n e vs p r o v e -> gray green gray gray green
    await press('crane')
    expect((await scored()).slice(0, 5)).toEqual(['C:inactive', 'R:success', 'A:inactive', 'N:inactive', 'E:success'])
    // the legend explains all three colors
    for (const phrase of ['right letter, right place', 'right letter, wrong place', 'not in the word']) {
      expect(await text()).toContain(phrase)
    }
    // typing in the field: it feeds the same draft, and deleting a character shortens it
    const typed = async (value: string) => {
      await pane.input({ key: 'guess', text: value, kind: 'change' } as any)

      return (await pane.find({ key: 'guess' } as any))?.props.value
    }
    expect(await typed('slate')).toBe('slate')
    expect(await typed('slat')).toBe('slat') // Backspace
    expect(await typed('sl4t?E')).toBe('slte') // non-letters dropped, lowercased
    expect(await typed('slatexyz')).toBe('slate') // capped at five
    expect(await typed('')).toBe('')
    // an illegal word costs nothing
    await press('zzzzz')
    expect(await text()).toContain('Guess 2/6')
    // the rejected word stays in the draft until backspaced away
    for (let i = 0; i < 5; i++) await pane.press({ key: 'back' } as any)
    expect(await text()).not.toContain('▫️Z')
    await press('prove')
    expect((await scored()).slice(5, 10)).toEqual(['P:success', 'R:success', 'O:success', 'V:success', 'E:success'])
    expect(await text()).toContain('Solved in 2/6')
  })
}
