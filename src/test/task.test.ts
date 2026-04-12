import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../logger'
import { Is, sleep } from '../utils'
import { describe, it, before, beforeEach } from 'node:test'
import assert, { equal } from 'assert'
import stripAnsi from 'strip-ansi'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixturesDir = `${__dirname}/fixtures`
const snapsDir = `${fixturesDir}/snaps`
const UpdateSnap = process.env.UPDATE_SNAP === '1'

function normal(s: string) {
  s = stripAnsi(s)
  let lines = s.split('\n')
  lines = lines.map((l) => l.trim())
  lines = lines.filter((l) => l !== '')
  lines = lines.filter(
    (l) =>
      l.startsWith('Error:') ||
      l.startsWith('[') ||
      l.startsWith('-') ||
      l.startsWith('DependencyGraph') ||
      l.startsWith('Task:'),
  )
  return lines.join('\n')
}
function test(cmd: string, expectedExitCode?: number) {
  let out = 'Not initialized'
  let snap = ''
  let exitCode = 0
  return {
    name: cmd,
    it() {
      it(cmd, () => {
        equal(normal(out), normal(snap))
        if (Is.defined(expectedExitCode)) {
          equal(exitCode, expectedExitCode)
        }
      })
    },
    async init() {
      let p = await exec(`tsx ./src/cli.ts --config ${fixturesDir}/${cmd}`, {
        stdio: void 0,
        verbose: 'none',
        env: {
          DISABLE_V8_COMPILE_CACHE: '1',
        },
      }).catch((er) => er)
      exitCode = p.exitCode
      out = normal(p.stdout + p.stderr)
      let snapFile = snapsDir + '/' + cmd.replace(/[^\w-]/g, '_')
      if (UpdateSnap) {
        // tslint:disable-next-line:no-floating-promises
        fs.outputFile(snapFile, out)
        out = snap = ''
        return null
      }
      snap = await fs.readFile(snapFile, 'utf8')
    },
  }
}

describe('task', function () {
  let tests = [
    test(`Foyfile1.ts aa -a 1 -b 1 -d`),
    test(`Foyfile1.ts aa -h`),
    test(`Foyfile1.ts -h`),
    test(`Foyfile1.ts aa -a`),
    test(`Foyfile1.ts aa -a bb`),
    test(`Foyfile1.ts bb`),
    test(`Foyfile1.ts cc`),
    test(`Foyfile1.ts dd`),
    test(`Foyfile1.ts ee`),
    test(`Foyfile1.ts ff`),
    test(`Foyfile1.ts force`),
    test(`Foyfile1.ts notForce`),
    test(`Foyfile1.ts sync`),
    test(`Foyfile1.ts async`),
    test(`Foyfile1.ts async:priority`),
    test(`Foyfile1.ts resolveOptions -c 123`),
    test(`Foyfile1.ts resolveOptions`),
    test(`Foyfile1.ts fails`, 1),
    test(`Foyfile1.ts pushpopd`),
    test(`Foyfile2.ts start`),
    test(`Foyfile2.ts ns1:error`),
    test(`Foyfile2.ts ns1:t1`),
    test(`Foyfile2.ts ns1:error`),
    test(`Foyfile2.ts ns1:ns2:t2`),
    test(`Foyfile2.ts exec`),
    test(`Foyfile2.ts $`),
  ]
  before(
    async () => {
      if (UpdateSnap) {
        await fs.rmrf(snapsDir)
      }
      await Promise.allSettled(tests.map((t) => t.init())).catch(logger.error)
      console.log('init')
    },
    {
      timeout: 600 * 1000,
    },
  )
  tests.forEach((t) => t.it())
})

describe('loading', async () => {
  it('loading', async () => {
    await assert.doesNotReject(exec(`tsx ./src/cli.ts --config ${fixturesDir}/Foyfile2.ts start`))
  })
})
