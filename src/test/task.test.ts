import { task } from '../task'
import { fs } from '../fs'
import { exec } from '../exec'
import * as path from 'path'
import * as assert from 'assert'

const fixturesDir = `${__dirname}/fixtures`
const snapsDir = `${fixturesDir}/snaps`
const UpdateSnap = process.env.UPDATE_SNAP === '1'

function test(cmd: string) {
  it(cmd, async () => {
    let p = await exec(`ts-node ./src/cli.ts --config ${fixturesDir}/${cmd}`).catch(er => er)
    let out = p.stdout + p.stderr
    let snapFile = snapsDir + '/' + cmd.replace(/[^\w-]/g, '_')
    if (UpdateSnap) {
      return fs.outputFile(snapFile, out)
    }
    let snap = await fs.readFile(snapFile, 'utf8')
    assert.equal(out.trim(), snap.trim())
  })
}
describe('task', function () {
  before(async () => {
    if (UpdateSnap) {
      await fs.rmrf(snapsDir)
    }
  })
  this.timeout(1000 * 60 * 10)
  test(`Foyfile1.ts aa -a 1 -b 1 -d`)
  test(`Foyfile1.ts aa -h`)
  test(`Foyfile1.ts -h`)
  test(`Foyfile1.ts aa -a`)
  test(`Foyfile1.ts aa -a bb`)
  test(`Foyfile1.ts bb`)
  test(`Foyfile1.ts cc`)
  test(`Foyfile1.ts dd`)
  test(`Foyfile1.ts ee`)
  test(`Foyfile1.ts ff`)
  test(`Foyfile1.ts force`)
  test(`Foyfile1.ts notForce`)
  test(`Foyfile1.ts sync`)
  test(`Foyfile1.ts async`)
  test(`Foyfile1.ts resolveOptions -c 123`)
  test(`Foyfile1.ts resolveOptions`)
})
