# Foy

[![Build Status](https://travis-ci.org/zaaack/foy.svg?branch=master)](https://travis-ci.org/zaaack/foy) [![npm](https://img.shields.io/npm/v/foy.svg)](https://www.npmjs.com/package/foy) [![npm](https://img.shields.io/npm/dm/foy.svg)](https://www.npmjs.com/package/foy)

A simple, light-weight and modern task runner for general purpose.

## Features

* Promise-based tasks and built-in utilities.
* <a href="https://github.com/shelljs/shelljs" target="_blank">shelljs</a> like commands
* Easy to learn, stop spending hours for build tools.

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
strict() // This will throw an error if you passed some options thats doesn't defined via `option()`
task('build', async ctx => {
  await ctx.exec(`tsc ${ctx.options.watch ? '-w' : ''}`)
})
```

```sh
foy build -w
```

## Using built-in promised-based API

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

## API documentation

<https://zaaack.github.io/foy/api>

## License

MIT
