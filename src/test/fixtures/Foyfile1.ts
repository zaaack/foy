import { task, desc, option, logger } from '../../'
import { strict, setGlobalOptions } from '../../task'
import { resolve } from 'path'

setGlobalOptions({ strict: true, loading: false, showTaskDuration: false })

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
    p.stdout.trim() === ctx.cwd,
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
  'wait'.options({ t: 100 }),
  'wait'.options({ t: 1 }),
])

task('async', [
  'wait'.async().options({ t: 100 }),
  'wait'.async().options({ t: 1 }),
])
task('async:priority', [
  'wait'.async().options({ t: 1 }),
  'wait'.async(1).options({ t: 100 }),
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

task('pushpopd', async ctx => {
  let pwd = (await ctx.env('NODE_ENV', 'TEST').env('SOME_ENV', 'SOME').exec('pwd', { stdio: 'pipe' })).stdout
  ctx.log(`pwd equals ctx.cwd`, ctx.cwd === pwd)
  ctx.pushd('./aaa')
  ctx.log(`pushd works`, ctx.cwd === resolve(pwd, './aaa'))
  ctx.pushd('./bbb')
  ctx.log(`pushd 2 works`, ctx.cwd === resolve(pwd, './aaa', './bbb'))

  ctx.cd('./ccc')
  ctx.log(`cd works`, ctx.cwd === resolve(pwd, './aaa', './bbb', './ccc'))

  ctx.popd()
  ctx.log(`popd works`, ctx.cwd === resolve(pwd, './aaa'))
  ctx.popd()
  ctx.log(`popd 2 works`, ctx.cwd === resolve(pwd))
})

task('fails', async ctx => {
  logger.info('Fail this task')
  await ctx.exec('node -e "console.log(\\"start\\"); process.exit(1)"')
  logger.info('This line not hit')
});
