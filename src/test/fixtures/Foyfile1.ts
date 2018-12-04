import { task, desc, option, logger } from '../../'
import { strict, setGlobalOptions } from '../../task';

setGlobalOptions({ strict: true, loading: false })

desc('AA')
option('-a <val>', 'aa', {  default: 12 })
task<{ a: boolean }>('aa', async ctx => {
  logger.debug(ctx.options)
  logger.info(ctx.options)
  logger.warn(ctx.options)
  logger.error(ctx.options)
})

let bb = task<{test: number}>('bb', ['aa'], async ctx => {
  logger.debug(ctx.options)
})
desc('CC')
option('-c <num>', 'cc', { default: 123 })
task('cc', [{...bb, options: { test: 123 } }, 'aa'], async ctx => {
  logger.debug(ctx.options)
})


task('dd', async ctx => {
  ctx.cd('./src')
  let p = await ctx.exec('pwd', {
    stdio: 'pipe'
  })
  logger.debug(p.stdout.trim().endsWith('src'))
})
