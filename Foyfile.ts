import { task, desc, option, logger, fs, strict, setGlobalOptions } from './src/'
import * as marked from 'marked'
import * as ejs from 'ejs'
task('build', async ctx => {
  await fs.rmrf('./lib')
  await ctx.exec([
    'tsc',
    'chmod +x ./lib/cli.js',
  ])
})

task('doc', async ctx => {
  await ctx.exec(`typedoc --theme default --mode file   --excludeNotExported --excludePrivate --out ./docs/api ./src/index.ts`)
  await ctx.exec(`touch ./docs/.nojekyll`)
})

const MochaCli = `mocha --exit -r tsconfig-paths/register -r ts-node/register`

task<{ args: string, env: NodeJS.ProcessEnv }>('test', async ctx => {
  await ctx.exec(`${MochaCli} "src/test/*.test.ts" ${ctx.options.args || ''} ${ctx.task.rawArgs.map(a => `"${a}"`).join(' ')}`, { env: ctx.options.env || process.env })
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
  options: { args: `-w --watch-extensions ts,tsx` },

}])

task('preversion', ['test', 'build'], async ctx => {
  await fs.rmrf('./lib/test')
  await ctx.exec(`git add -A`)
})

task('postversion', async ctx => {
  await ctx.exec(`git push origin master --tags`)
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
  let html = await ejs.renderFile<string>('./docs-src/index.html', data)
  await ctx.fs.outputFile('./docs/index.html', html)
})
task('site:watch', async ctx => {
  ctx.fs.watchDir('./docs-src', async (evt, file) => {
    console.log(evt, file)
    await ctx.run('site:home')
    console.log('build')
  })
})

task('site', ['doc'])
