const PANE = 'wordle'

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

  // Placeholder; the real board is stage 04.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    return h(Box, { flexDirection: 'column' }, h(Text, null, 'Wordle — coming soon'))
  })
}
