import * as Spinners from 'cli-spinners'
import * as logFigures from 'figures'
import { Is } from './utils'
import chalk from 'chalk'
import { DepsTree, TaskState } from './task-manager'
import * as wcwidth from 'wcwidth'
import stripAnsi = require('strip-ansi')

declare global {
  namespace NodeJS {
    export interface WriteStream {
      clearLine(dir?: number)
      cursorTo(x: number, y?: number)
      moveCursor(dx: number, dy: number)
    }
  }
}

export interface Props {
  depsTree: DepsTree
  indent?: number
  symbolMap?: { [k: string]: string }
  grayState?: TaskState[] | null
  stream?: NodeJS.WriteStream
}

export class CliLoading {
  props: Required<Props>
  _loadingFrameMap = new Map<string, number>()
  id?: NodeJS.Timer
  linesToClear = 0
  constructor(props: Props) {
    this.props = {
      indent: 3,
      symbolMap: {},
      grayState: null,
      stream: process.stderr as any,
      ...props,
    }
  }
  count(uid: string) {
    let count = this._loadingFrameMap.get(uid) || 0
    this._loadingFrameMap.set(uid, count + 1)
    return count
  }
  renderDepsTree(depsTree: DepsTree, output: string[] = []) {
    let indent = Array(depsTree.depth * this.props.indent)
      .fill(' ')
      .join('')
    let frames = Spinners.dots.frames as string[]
    let symbol = {
      [TaskState.waiting]: chalk.gray(logFigures.ellipsis),
      [TaskState.pending]: chalk.blueBright(logFigures.arrowRight),
      [TaskState.loading]: chalk.cyan(frames[this.count(depsTree.uid) % frames.length]),
      [TaskState.succeeded]: chalk.green(logFigures.tick),
      [TaskState.failed]: chalk.red(logFigures.cross),
      [TaskState.skipped]: chalk.yellow(logFigures.info),
      ...this.props.symbolMap,
    }[depsTree.state]
    let color =
      (this.props.grayState || [TaskState.waiting]).indexOf(depsTree.state) >= 0
        ? f => chalk.gray(f)
        : f => f
    let skipped = depsTree.state === TaskState.skipped
    output.push(
      `${indent}${symbol} ${color(depsTree.task.name)}${skipped ? chalk.gray(` [skipped]`) : ''}`,
    )
    for (const child of depsTree.asyncDeps.concat(depsTree.syncDeps)) {
      this.renderDepsTree(child, output)
    }
    return output
  }
  render() {
    let columns = this.props.stream.columns || 80
    let rows = this.props.stream.rows || Infinity
    let output = this.renderDepsTree(this.props.depsTree)
    let isFirstRendering = this.linesToClear === 0
    output.push('')
    let outputLineCounts = output.map(
      line => Math.max(1, Math.ceil(wcwidth(stripAnsi(line)) / columns))
    )
    this.clear()
    this.linesToClear = 0
    for (let i = outputLineCounts.length - 1; i >= 0; i--) {
      const count = outputLineCounts[i]
      this.linesToClear += count
      if (this.linesToClear > rows) {
        this.linesToClear -= count
        if (!isFirstRendering) {
          output = output.slice(i + 1)
        }
        break
      }
    }
    this.props.stream.write(output.join('\n'))
  }
  // Adopted from https://github.com/sindresorhus/ora/blob/bbc82a44884b23f1787d91f95b2d3f93afe653e3/index.js#L74
  clear() {
    if (!this.props.stream.isTTY) {
      return this
    }

    for (let i = 0; i < this.linesToClear; i++) {
      if (i > 0) {
        this.props.stream.moveCursor(0, -1)
      }
      this.props.stream.clearLine()
      this.props.stream.cursorTo(0)
    }
    this.linesToClear = 0

    return this
  }
  start() {
    if (this.id) return
    this.id = setInterval(() => {
      this.render()
    }, 100)
  }
  stop() {
    this.id && clearInterval(this.id)
    this.id = undefined
    this.render()
  }
}
