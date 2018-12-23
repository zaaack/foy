import * as assert from 'assert'
import * as os from 'os'
import * as pathLib from 'path'

import { fs } from '../fs'

const baseDir = os.tmpdir() + '/' + Math.random().toString(36).slice(2)
describe('fs', () => {
  it('copy file', async () => {
    await fs.outputFile(`${baseDir}/test`, 'aaa')
    await fs.copy(`${baseDir}/test`, `${baseDir}/test2`)
    let s = await fs.readFile(`${baseDir}/test`)
    assert.equal(s, 'aaa')
  })
  it('json', async () => {
    let o1 = { aa: 1 }
    fs.outputJsonSync(`${baseDir}/json/dir/1`, o1)
    assert.deepEqual(
      fs.readJsonSync(`${baseDir}/json/dir/1`),
      o1,
    )

    let o2 = { aa: 2 }
    await fs.outputJson(`${baseDir}/json/dir/2`, o2)
    assert.deepEqual(
      await fs.readJson(`${baseDir}/json/dir/2`),
      o2,
    )
  })
  it('copy dir', async () => {
    fs.outputFileSync(`${baseDir}/dir1/dir2/test`, 'aaa')
    let s = await fs.readFile(`${baseDir}/dir1/dir2/test`)
    assert.equal(s, 'aaa')
    await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`)
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`)
    assert.equal(s, 'aaa')
    // override

    await fs.outputFile(`${baseDir}/dir1/dir2/test`, 'aaa')
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`)
    assert.equal(s, 'aaa')
    try {
      await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`, { override: false })
      assert.fail('expect throws')
    } catch (error) {
      // error
    }
    await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`, { override: true })
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`)
    assert.equal(s, 'aaa')
  })

  it('iter', async () => {
    await fs.outputFile(`${baseDir}/dir1/dir2/test`, 'aaa')
    await fs.outputFile(`${baseDir}/dir1/test`, 'bbb')
    let paths = [] as string[]
    await fs.iter(`${baseDir}/dir1`, (file, stat) => {
      paths.push(pathLib.relative(baseDir, file))
    })
    assert.deepEqual(paths.sort(), [
      'dir1/dir2',
      'dir1/dir2/test',
      'dir1/test',
    ])
    paths = []
    await fs.iter(`${baseDir}/dir1`, (file, stat) => {
      file = pathLib.relative(baseDir, file)
      paths.push(file)
      if (file === 'dir1/dir2') return true
    })
    assert.deepEqual(paths.sort(), [
      'dir1/dir2',
      'dir1/test',
    ])
  })
})
