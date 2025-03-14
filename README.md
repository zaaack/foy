# Foy

[![publish](https://github.com/zaaack/foy/actions/workflows/publish.yml/badge.svg)](https://github.com/zaaack/foy/actions/workflows/publish.yml) [![npm](https://img.shields.io/npm/v/foy.svg)](https://www.npmjs.com/package/foy) [![npm](https://img.shields.io/npm/dm/foy.svg)](https://www.npmjs.com/package/foy) [![install size](https://packagephobia.now.sh/badge?p=foy)](https://packagephobia.now.sh/result?p=foy)

A simple, light-weight and modern task runner for general purpose.

## Contents

- [Foy](#foy)
  - [Contents](#contents)
  - [Features](#features)
  - [Install](#install)
  - [Write a Foyfile](#write-a-foyfile)
  - [Using with built-in promised-based API](#using-with-built-in-promised-based-api)
  - [Using with other packages](#using-with-other-packages)
  - [Using dependencies](#using-dependencies)
  - [Using namespaces](#using-namespaces)
  - [Useful utils](#useful-utils)
    - [fs](#fs)
    - [logger](#logger)
    - [exec command](#exec-command)
  - [Using in CI servers](#using-in-ci-servers)
  - [Using lifecycle hooks](#using-lifecycle-hooks)
  - [run task in task](#run-task-in-task)
  - [Watch and build](#watch-and-build)
  - [Using with custom compiler](#using-with-custom-compiler)
  - [zsh/bash auto completion (**New!!!**)](#zshbash-auto-completion-new)
  - [API documentation](#api-documentation)
  - [License](#license)

## Features

- Promise-based tasks and built-in utilities.
- `<a href="https://github.com/shelljs/shelljs" target="_blank">`shelljs `</a>`-like commands
- Easy to learn, stop spending hours for build tools.
- Small install size
  - foy: [![install size](https://packagephobia.now.sh/badge?p=foy)](https://packagephobia.now.sh/result?p=foy)
  - gulp: [![install size](https://packagephobia.now.sh/badge?p=gulp)](https://packagephobia.now.sh/result?p=gulp)
  - grunt: [![install size](https://packagephobia.now.sh/badge?p=grunt)](https://packagephobia.now.sh/result?p=grunt)

![GIF](https://github.com/zaaack/foy/blob/master/docs-src/capture.gif?raw=true)

## Install

```sh
yarn add -D foy # or npm i -D foy
```

Or install globally with

```sh
yarn add -g foy # or npm i -g foy
```

## Write a Foyfile

You need to add a Foyfile.js(or Foyfile.ts with [tsx](https://github.com/privatenumber/tsx) or [@swc-node/register](https://github.com/swc-project/swc-node) or [ts-node](https://github.com/TypeStrong/ts-node) installed) to your project root.

Also, you can simply generate a Foyfile.js via:

```sh
foy --init
```

which will create a simple `Foyfile.js` in the current folder:

```js
// Foyfile.js
const { task } = require('foy')

task('build', async ctx => {
  await ctx.exec('tsc')
})
```

You can also generate a `Foyfile.ts` via

```sh
foy --init ts
```

Then we can run `foy build` to execute the `build` task.

```sh
foy build
```

You can also add some options and a description to your tasks:

```ts
import { task, desc, option, strict } from 'foy'

desc('Build ts files with tsc')
option('-w, --watch', 'watch file changes')
strict() // This will throw an error if you passed some options that doesn't defined via `option()`
task('build', async ctx => {
  await ctx.exec(`tsc ${ctx.options.watch ? '-w' : ''}`)
})
```

And, if using TypeScript, add types to your options through the `task` generic:

```ts
import { task, desc, option, strict } from 'foy'

type BuildOptions = {
  watch: boolean
}

desc('Build ts files with tsc')
option('-w, --watch', 'watch file changes')
strict() // This will throw an error if you passed some options that doesn't defined via `option()`
task<BuildOptions>('build', async ctx => { // ctx.options now has type BuildOptions instead of unknown
  await ctx.exec(`tsc ${ctx.options.watch ? '-w' : ''}`)
})
```

```sh
foy build -w
```

Warning! If you want to set flags like strict for all tasks, please use `setGlobalOptions`:

```ts
import { setGlobalOptions } from 'foy'

setGlobalOptions({ strict: true }) // all tasks' options will be strict.

option('-aa') // strict via default
task('dev', async ctx => {

})
option('-bb') // strict via default
task('build', async ctx => {

})

```

## Using with built-in promised-based API

```ts
import { fs, task } from 'foy'

task('some task', async ctx => {
  await fs.rmrf('/some/dir/or/file') // Remove directory or file
  await fs.copy('/src', '/dist') // Copy folder or file
  let json = await fs.readJson('./xx.json')
  await ctx
    .env('NODE_ENV', 'production')
    .env('NODE_ENV=production')
    .cd('./src')
    .exec('some command') // Execute an command
  let { stdout } = await ctx.exec('ls', { stdio: 'pipe' }) // Get the stdout, default is empty because it's redirected to current process via `stdio: 'inherit'`.
})
```

## Using with other packages

```ts
import { task, logger } from 'foy'
import * as axios from 'axios'

task('build', async ctx => {
  let res = await axios.get('https://your.server/data.json')
  logger.info(res.data)
})
```

## Using dependencies

```ts

import { task, dep } from 'foy'
import * as axios from 'axios'

task('test', async ctx => {
  await ctx.exec('mocha')
})

task('build', async ctx => {
  let res = await axios.get('https://your.server/data.json')
  console.log(res.data)
  await ctx.exec('build my awesome project')
})
task(
  'publish:patch',
  ['test', 'build'], // Run test and build before publish
  async ctx => {
    await ctx.exec('npm version patch')
    await ctx.exec('npm publish')
  }
)
```

Dependencies run serially by default but you can specify when a task should be run concurrently.

Example: Passing running options to dependencies:

```ts
import { task, dep } from 'foy'
task(
  'publish:patch',
  [{
    name: 'test',
    async: true, // run test parallelly
    force: true, // force rerun test whether it has been executed before or not.
  }, {
    name: 'build',
    async: true,
    force: true,
  },],
  async ctx => {
    await ctx.exec('npm version patch')
    await ctx.exec('npm publish')
  }
)

/* Sugar version */
task(
  'publish:patch',
  [ dep('test').async().force(),
    dep('build').async().force() ],
  async ctx => {
    await ctx.exec('npm version patch')
    await ctx.exec('npm publish')
  }
)

/*
Priority for async tasks

Default is 0, higher values will be run earlier; so, in this next example, `build` will be run before `test`.
(Note: If you have multiple async dependencies with same priority, they will be executed in parallel.)
*/
task(
  'publish:patch',
  [ dep('test').async(0).force(),
    dep('build').async(1).force() ],
  async ctx => {
    await ctx.exec('npm version patch')
    await ctx.exec('npm publish')
  }
)
```

You can also pass options to dependencies:

```ts
task('task1', async ctx => {
  console.log(ctx.options) // "{ forceRebuild: true, lazyOptions: 1 }"
  console.log(ctx.global.options) // options from command line "{ a: 1 }"
})


task('task2', [{
  name: 'task1',
  options: {
    forceRebuild: true,
  },
  // Some options that rely on ctx or asynchronization,
  // it will be merged to options.
  resolveOptions: async ctx => {
    return { lazyOptions: 1 }
  }
}])

// foy task2 -a 1
```

## Using namespaces

To avoid name collisions, Foy provides namespaces to group tasks via the `namespace` function:

```ts
import { task, namespace } from 'foy'

namespace('client', ns => {
  before(() => {
    logger.info('before')
  })
  after(() => {
    logger.info('after')
  })
  onerror(() => {
    logger.info('onerror')
  })
  task('start', async ctx => { /* ... */ }) // client:start
  task('build', async ctx => { /* ... */ }) // client:build
  task('watch', async ctx => { /* ... */ }) // client:watch
  namespace('proj1', ns => { // nested namespace
    onerror(() => {
      logger.info('onerror', ns)
    })
    task('start', async ctx => { /* ... */ }) // client:proj1:start

  })
})

namespace('server', ns => {
  task('build', async ctx => { /* ... */ }) // server:build
  task('start', async ctx => { /* ... */ }) // server:start
  task('watch', async ctx => { /* ... */ }) // server:watch
})

task('start', [dep('client:start').async(), dep('server:start').async()]) // start

// foy start
// foy client:build
```

## Useful utils

### fs

Foy wraps the NodeJS's `fs` (file system) module with a promise-based API, so you can easily use async/await patterns, if you prefer. Foy also implements some useful utility functions for build scripts not present in NodeJS's built-in modules.

```ts
import { fs } from 'foy'


task('build', async ctx => {
  let f = await fs.readFileSync('./assets/someFile')

  // copy file or directory
  await fs.copy('./fromPath', './toPath')

  // watch a directory
  await fs.watchDir('./src', (event, filename) => {
    logger.info(event, filename)
  })

  // make directory with parent directories
  await fs.mkdirp('./some/directory/with/parents/not/exists')

  // write file will auto create missing parent directories
  await fs.outputFile('./some/file/with/parents/not/exists', 'file data')

  // write json file will auto create missing parent directories
  await fs.outputJson('./some/file/with/parents/not/exists', {text: 'json data'})
  let file = await fs.readJson('./some/jsonFile')

  // iterate directory tree
  await fs.iter('./src', async (path, stat) => {
    if (stat.isDirectory()) {
      logger.info('directory:', path)
      // skip scan node_modules
      if (path.endsWith('node_modules')) {
        return true
      }
    } else if (stat.isFile()) {
      logger.warn('file:', path)
    }
  })
})
```

### logger

Foy includes a light-weight built-in logger

```ts
import { logger } from 'foy'

task('build', async ctx => {

  logger.debug('debug', { aa: 1})
  logger.info('info')
  logger.warn('warn')
  logger.error('error')

})

```

### exec command

A simple wrapper for sindresorhus's lovely module
[execa](https://github.com/sindresorhus/execa)

```ts
import { logger } from 'foy'

task('build', async ctx => {
  await ctx.exec('tsc')

  // run multiple commands synchronously
  await ctx.exec([
    'tsc --outDir ./lib',
    'tsc --module es6 --outDir ./es',
  ])

  // run multiple commands concurrently
  await Promise.all([
    ctx.exec('eslint'),
    ctx.exec('tsc'),
    ctx.exec('typedoc'),
  ])
  // restart process when file changes
  ctx.monitor('./src', 'node ./dist')
  ctx.monitor('./src', ['rm -rf dist', 'tsc', 'node dist'])
  ctx.monitor('./src', async () => {
    await ctx.run('build:server')
    await ctx.exec('node ./dist') // auth detect long-running process when using ctx.exec
  })
  ctx.monitor('./src', async (p) => {
    // manually point out the process need to be killed when restart
    p.current = require('child_process').exec('node dist')
  })
})


```

## Using in CI servers

If you use Foy in CI servers, you won't want the [cli spinners](https://github.com/sindresorhus/cli-spinners) as most CI servers will log stdout and stderr in discreet frames not meant for continuous streaming animations. Luckily, Foy has already considered this! You can simply disable the loading animation like this:

```ts
import { task, spinner, setGlobalOptions } from 'foy'

setGlobalOptions({ spinner: true }) // enable loading animations, default is false

spinner(false) // disable spinner for current task
task('test', async ctx => { /* ... */ })
/*
$ foy test
DependencyGraph for task [test]:
─ test

Task: test
...
*/
```

## Using lifecycle hooks

You can add lifecycle hooks via the `before`, `after`, and `onerror` functions.

```ts
import { before, after, onerror } from 'foy'
before(() => { // do something before all tasks tree start
  // ...
})
after(() => { // do something after all tasks tree finished
  // ...
})
onerror((err) => { // do something when error happens
  // ...
})
```

## run task in task

```ts

task('task1', async ctx => { /* ... */ })
task('task2', async ctx => {
  // do things before task1

  // run task1 manually, so we can
  // do things before or after it
  await ctx.run('task1')

  // do things after task1
})

```

## Watch and build

```ts

task('build', async ctx => { /* build your project */ })


let p = null
task('watch', async ctx => {
  ctx.monitor('./src', async ()=> {
    ctx.exec('node ./src/server.ts')
  })
})
```

## Using with custom compiler

```sh

# Write Foyfile in ts, enabled by default
foy -r ts-node/register -c ./some/Foyfile.ts build

# Write Foyfile in coffee
foy -r coffeescript/register -c ./some/Foyfile.coffee build

```

## zsh/bash auto completion (**New!!!**)

Add foy auto completion in zsh/bash:

```sh
# for bash
foy --completion-profile >> ~/.bashrc

# for zsh
foy --completion-profile >> ~/.zshrc
```

## API documentation

[https://zaaack.github.io/foy/api](https://zaaack.github.io/foy/api)

## License

MIT
