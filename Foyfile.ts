import { task, desc, option, logger, fs, strict, setGlobalOptions, setOption, sleep, namespace, exec, before, execa } from './src/'
import marked from 'marked'
import * as ejs from 'ejs'

setGlobalOptions({ spinner: false, strict: true })

before(() => {

})

desc('build whole project')
task('build', async ctx => {
  await fs.rmrf('./lib')
  await ctx.exec([
    'tsc -p ./tsconfig.build.json',
    'chmod +x ./lib/cli.js',
  ])
})

desc('generate doc')
task('doc', async ctx => {
  await fs.rmrf('./docs/api/')
  await ctx.exec(`typedoc --theme default --excludePrivate  --out ./docs/api ./src/index.ts`)
  await ctx.exec(`touch ./docs/.nojekyll`)
})


task<{ args: string, env: NodeJS.ProcessEnv }>('test', async ctx => {
  // https://github.com/nodejs/node/issues/51555#issuecomment-2290742072
  await ctx.env('DISABLE_V8_COMPILE_CACHE', '1').exec(
    `tsx --test-concurrency=4 --test "./src/test/*.test.ts" ${ctx.options.args || ''} ${ctx.task.rawArgs
      .map((a) => `"${a}"`)
      .join(' ')}`,
    { env: ctx.options.env || process.env },
  )
})

task('test:update-snap', [{
  name: 'test',
  options: {
    env: {
      ...process.env,
      UPDATE_SNAP: '1'
    }
  }
}])

task('watch', [{
  name: 'test',
  option: { args: `-w --watch-extensions ts,tsx` },
}])
// npm_package_version:
task<{ version: string }>('preversion', async ctx => {
  await ctx.exec('pnpm i')
  await Promise.all([
    ctx.run('test'),
    ctx.run('build'),
    ctx.run('site'),
  ])
  await fs.rmrf('./lib/test')
  await ctx.exec([
    `changelog --${ctx.options.version}`,
    `git add -A`,
    `git commit -m 'Update CHANGELOG.md & doc'`,
  ])
})

task('postversion', async ctx => {
  await ctx.exec(`git push origin master --tags`)
})

option('-v, --version <version>', 'patch | minor | major', { default: 'patch' })
task<{ version: string }>('publish', ['preversion'.options(ctx => ({ version: ctx.options.version }))], async ctx => {
  await ctx.exec([
    `npm version ${ctx.options.version}`,
    `npm publish --registry=https://registry.npmjs.org/ --access public`,
    `git push origin master --tags`,
  ])
})

task('site:home', async ctx => {
  let pkg = await ctx.fs.readJson('./package.json')
  let desc = pkg.description
  let md = await ctx.fs.readFile('./README.md', 'utf8')
  let content = marked(md)

  let data = {
    name: 'Foy',
    desc,
    content,
    githubUrl: 'https://github.com/zaaack/foy',
    author: 'Zack Young',
    authorUrl: 'https://github.com/zaaack',
    apiUrl: 'http://zaaack.github.io/foy/api',
  }
  let html = await ejs.renderFile('./docs-src/index.html', data)
  await ctx.fs.outputFile('./docs/index.html', html)
  await ctx.fs.copy('./docs-src/css', './docs/css', { overwrite: true })
})
task('site:watch', async ctx => {
  ctx.fs.watchDir('./docs-src', async (evt, file) => {
    console.log(evt, file)
    await ctx.run('site:home')
    console.log('build')
  })
})

task('site', ['doc'.async(), 'site:home'.async()])

task('demodemodemodemodemodemodemo1', async ctx => {
  console.log('demodemodemodemodemodemodemo1')
  ctx.log('demo1demo2')
  await ctx.exec('ls')
  await sleep(3000)
})
task('demo2', async ctx => sleep(3000))
task('demo3', ['demo2', 'demodemodemodemodemodemodemo1'], async ctx => sleep(3000))

task('demo', ['demodemodemodemodemodemodemo1', 'demo2'.async(), 'demo3'.async()])

task('error', async ctx=> {
  throw new Error('aa')
})


namespace('client', ns => {
  task('build', async ctx => {
  }) // client:build
  task('start', async ctx => { /* ... */ }) // client:start
  task('watch', async ctx => { /* ... */ }) // client:watch
})

namespace('server', ns => {
  task('build', async ctx => { /* ... */ }) // server:build
  task('start', async ctx => { /* ... */ }) // server:start
  task('watch', async ctx => { /* ... */ }) // server:watch
})

task('start', ['client:start'.async(), 'server:start'.async()])

task('w', async ctx => {
  let inc = 1
  // ctx.monitor('./src', 'sleep 5')
  // ctx.monitor('./src', ['echo test', 'sleep 5'])
  ctx.monitor('./src', async () => {
    console.log('test')
    ctx.exec('sleep 3')
  })
})
