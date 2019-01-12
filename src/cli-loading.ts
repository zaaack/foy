import * as Spinners from 'cli-spinners';
import * as logUpdate from 'log-update';
import * as logFigures from 'figures';
import { Is } from './utils';
import chalk from 'chalk';
import { DepsTree, TaskState } from './task-manager';

export interface Props {
  depsTree: DepsTree
  indent?: number
  symbolMap?: {[k: string]: string}
  grayState?: TaskState[] | null
}

export class CliLoading {
  props: Required<Props>
  _loadingFrameMap = new Map<string, number>()
  id?: NodeJS.Timer
  constructor(props: Props) {
    this.props = {
      indent: 3,
      symbolMap: {},
      grayState: null,
      ...props,
    }
  }
  count(uid: string) {
    let count = this._loadingFrameMap.get(uid) || 0
    this._loadingFrameMap.set(uid, count + 1)
    return count
  }
  renderDepsTree(depsTree: DepsTree, output: string[] = []) {
    let indent = Array(depsTree.depth * this.props.indent).fill(' ').join('')
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
    let color = (
      this.props.grayState ||
      [ TaskState.waiting ]
    ).indexOf(depsTree.state) >= 0
      ? f => chalk.gray(f)
      : f => f
    let skipped = depsTree.state === TaskState.skipped
    output.push(`${
      indent
    }${
      symbol
    } ${
      color(depsTree.task.name)
    }${
      skipped
        ? chalk.gray(` [skipped]`)
        : ''
    }`)
    for (const child of depsTree.asyncDeps.concat(depsTree.syncDeps)) {
      this.renderDepsTree(child, output)
    }
    return output
  }
  render() {
    let output = this.renderDepsTree(this.props.depsTree)
    logUpdate.stderr(output.join('\n'))
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
    setTimeout(() => {
      logUpdate.stderr.done()
    }, 1)
  }
}
