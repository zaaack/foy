# Foy

[![Build Status](https://travis-ci.org/zaaack/foy.svg?branch=master)](https://travis-ci.org/zaaack/foy) [![npm](https://img.shields.io/npm/v/foy.svg)](https://www.npmjs.com/package/foy) [![npm](https://img.shields.io/npm/dm/foy.svg)](https://www.npmjs.com/package/foy) [![install size](https://packagephobia.now.sh/badge?p=foy)](https://packagephobia.now.sh/result?p=foy)

A simple, light-weight and modern task runner for general purpose.

## Features

* Promise-based tasks and built-in utilities.
* <a href="https://github.com/shelljs/shelljs" target="_blank">shelljs</a> like commands
* Easy to learn, stop spending hours for build tools.
* Small install size
  * foy: [![install size](https://packagephobia.now.sh/badge?p=foy)](https://packagephobia.now.sh/result?p=foy)
  * gulp: [![install size](https://packagephobia.now.sh/badge?p=gulp)](https://packagephobia.now.sh/result?p=gulp)
  * grunt: [![install size](https://packagephobia.now.sh/badge?p=grunt)](https://packagephobia.now.sh/result?p=grunt)

![](https://github.com/zaaack/foy/blob/master/docs/capture.gif?raw=true)

## Install

```sh
yarn add -D foy # or npm i -D foy
```

Or Install globally with

```sh
yarn add -g foy # or npm i -g foy
```

## Write a Foyfile

You need to add a Foyfile.js(or Foyfile.ts with [ts-node](https://github.com/TypeStrong/ts-node) installed) in your project root.

Here is an minimal example

```ts
// Foyfile.js
import { task } from 'foy'

task('build', async ctx => {
  await ctx.exec('tsc')
})
```

We added a build command to execute, then we can run `foy build` to execute this task.

```sh
foy build
```

You can also add some options and description to task:

```ts
import { task, desc, option, strict } from 'foy'

desc('Build ts files with tsc')
option('-w, --watch', 'watch file changes')
strict() // This will throw an error if you passed some options that doesn't defined via `option()`
task('build', async ctx => {
  await ctx.exec(`tsc ${ctx.options.watch ? '-w' : ''}`)
})
```

```sh
foy build -w
```

## Using with built-in promised-based API

```ts
import { fs, task } from 'foy'

task('some task', async ctx => {
  await fs.rmrf('/some/dir/or/file') // Remove directory or file
  await fs.copy('/src', '/dist') // Copy folder or file
  let json = await fs.readJson('./xx.json')
  await ctx.env('NODE_ENV', 'production')
  await ctx.cd('./src')
  await ctx.exec('some command') // Execute an command
  let { stdout } = await ctx.exec('ls', { stdio: 'pipe' }) // Get the stdout, default is empty because it's redirected to current process via `stdio: 'inherit'`.
})
```

## Using with other packages

```ts
import { task } from 'foy'
import * as axios from 'axios'

task('build', async ctx => {
  let res = await axios.get('https://your.server/data.json')
  console.log(res.data)
})
```

## Using dependencies

```ts

import { task } from 'foy'
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

Or, you can pass options to customize the execution of dependences:

```ts
task(
  'publish:patch',
  [{
    name: 'test',
    async: true, // run test parallelly
    force: true, // force rerun test whether it is executed before or not,
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
```

You can also pass options to dependences:

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


## Using with custom compiler

```sh

# Write Foyfile in ts, enabled by default
foy -r ts-node/register -c ./some/Foyfile.ts build

# Write Foyfile in coffee
foy -r coffeescript/register -c ./some/Foyfile.coffee build

```

## API documentation

<https://zaaack.github.io/foy/api>

## License

MIT
