import { task, desc, option, logger } from '../../'
import { strict, setGlobalOptions } from '../../task'

setGlobalOptions({ strict: true, loading: false })

desc('AA')
option('-a <val>', 'aa', { default: 12 })
strict()
task<{ a: boolean }>('aa', async ctx => {
  logger.debug(ctx.options)
  logger.info(ctx.options)
  logger.warn(ctx.options)
  logger.error(ctx.options)
})

let bb = task<{test: number}>('bb', ['aa'], async ctx => {
  logger.debug(ctx.options, ctx.global.options)
})
desc('CC')
option('-c <num>', 'cc', { default: 123 })
task('cc', [{ ...bb, options: { test: 123 } }, 'aa'], async ctx => {
  logger.debug(ctx.options)
})

task('dd', async ctx => {
  ctx.cd('./src')
  let p = await ctx.exec('pwd', {
    stdio: 'pipe'
  })
  logger.debug(
    'p.stdout.trim() === ctx.cwd()',
    p.stdout.trim() === ctx.cwd(),
  )
  logger.debug(p.stdout.trim().endsWith('src'))
})

task('ee', async ctx => {
  await ctx.exec([
    'echo aa',
    'echo bb'
  ])
})

task('ff', [
  'aa'.options({ aa: 1 }),
  'aa'.options({ aa: 2 }),
])

const noop = f => f
task('notForce', [
  'aa'.options({ noop }),
  'aa'.options({ noop }),
])
task('force', [
  'aa'.options({ noop }).force(),
  'aa'.options({ noop }).force(),
])

task<{ t: number }>('wait', async ctx => {
  await new Promise(res => setTimeout(res, ctx.options.t))
  console.log('wait', ctx.options.t)
})
task('sync', [
  'wait'.options({ t: 10 }),
  'wait'.options({ t: 1 }),
])

task('async', [
  'wait'.async().options({ t: 10 }),
  'wait'.async().options({ t: 1 }),
])
task('logOptions', async ctx => {
  logger.debug('logOptions', ctx.options, ctx.global.options, ctx.task.rawArgs)
})

option('-c <val>', 'cc', { default: 1 })
task('resolveOptions', [{
  name: 'logOptions',
  options: { aa: 1 },
  resolveOptions: async ctx => {
    return {
      ...ctx.options,
      rawArgs: ctx.task.rawArgs,
    }
  },
}], async ctx => {
  console.log('rawArgs', ctx.task.rawArgs)
})
