import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'

const fixturesDir = `${__dirname}/fixtures`
const snapsDir = `${fixturesDir}/snaps`
const UpdateSnap = process.env.UPDATE_SNAP === '1'

function test(cmd: string) {
  let out = 'Not initialized'
  let snap = ''
  return {
    name: cmd,
    it() {
      it(cmd, () => {
        expect(out.trim()).toBe(snap.trim())
      })
    },
    async init() {
      let p = await exec(`ts-node ./src/cli.ts --config ${fixturesDir}/${cmd}`).catch(er => er)
      out = p.stdout + p.stderr
      let snapFile = snapsDir + '/' + cmd.replace(/[^\w-]/g, '_')
      if (UpdateSnap) {
        // tslint:disable-next-line:no-floating-promises
        fs.outputFile(snapFile, out)
        out = snap = ''
        return null
      }
      snap = await fs.readFile(snapFile, 'utf8')
    }
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
    test(`Foyfile1.ts pushpopd`),
  ]
  beforeAll(async () => {
    if (UpdateSnap) {
      await fs.rmrf(snapsDir)
    }
    await Promise.all(tests.map(t => t.init()))
    console.log('init')
  }, 60 * 1000)
  tests.forEach(t => t.it())
})
