import * as os from 'os'
import * as pathLib from 'path'

import { fs } from '../fs'

const baseDir = os.tmpdir() + '/foy-fs-test'
describe('fs', () => {
  beforeAll(async () => {
    if (fs.existsSync(baseDir)) {
      await fs.rmrf(baseDir)
    }
    expect(fs.existsSync(baseDir)).toBeFalsy()
    console.log('baseDir', baseDir)
  })
  it('copy file', async () => {
    await fs.outputFile(`${baseDir}/test`, 'aaa')
    await fs.copy(`${baseDir}/test`, `${baseDir}/test2`)
    let s = await fs.readFile(`${baseDir}/test`, 'utf8')
    expect(s).toBe('aaa')
  })
  it('json', async () => {
    let o1 = { aa: 1 }
    fs.outputJsonSync(`${baseDir}/json/dir/1`, o1)
    expect(
      fs.readJsonSync(`${baseDir}/json/dir/1`),
    ).toEqual(
      o1,
    )

    let o2 = { aa: 2 }
    await fs.outputJson(`${baseDir}/json/dir/2`, o2)
    expect(
      await fs.readJson(`${baseDir}/json/dir/2`),
    ).toEqual(
      o2,
    )
  })
  it('copy dir', async () => {
    fs.outputFileSync(`${baseDir}/dir1/dir2/test`, 'aaa')
    let s = await fs.readFile(`${baseDir}/dir1/dir2/test`, 'utf8')
    expect(s).toEqual('aaa')
    await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`)
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`, 'utf8')
    expect(s).toEqual('aaa')
    // override

    await fs.outputFile(`${baseDir}/dir1/dir2/test`, 'aaa')
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`, 'utf8')
    expect(s).toEqual('aaa')
    await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`, { overwrite: false })
    await fs.copy(`${baseDir}/dir1`, `${baseDir}/dir2`, { overwrite: true })
    s = await fs.readFile(`${baseDir}/dir2/dir2/test`, 'utf8')
    expect(s).toEqual('aaa')
  })

  it('iter', async () => {
    await fs.outputFile(`${baseDir}/dir1/dir2/test`, 'aaa')
    await fs.outputFile(`${baseDir}/dir1/test`, 'bbb')
    let paths = [] as string[]
    await fs.iter(`${baseDir}/dir1`, (file, stat) => {
      paths.push(pathLib.relative(baseDir, file))
    })
    expect(paths.sort()).toEqual([
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
    expect(paths.sort()).toEqual([
      'dir1/dir2',
      'dir1/test',
    ])
  })

  it('symlink copy', async () => {
    const symlinkDir = `${baseDir}/symlink_copy`
    await fs.outputFile(`${symlinkDir}/file1`, 'aa')
    await fs.outputFile(`${symlinkDir}/dir1/dir2/file1`, 'aa')
    await fs.symlink(`${symlinkDir}/file1`, `${symlinkDir}/link1`)
    await fs.symlink(`${symlinkDir}/dir1`, `${symlinkDir}/linkdir1`)
    await fs.copy(`${symlinkDir}/link1`, `${symlinkDir}/copy/link1`)

    expect(await fs.isSymbolicLink(`${symlinkDir}/copy/link1`)).toBeFalsy()

    await fs.copy(`${symlinkDir}/linkdir1`, `${symlinkDir}/copy/linkdir1`)

    expect(await fs.isSymbolicLink(`${symlinkDir}/copy/linkdir1`)).toBeFalsy()
    expect(await fs.exists(`${symlinkDir}/copy/linkdir1/dir2/file1`)).toBeTruthy()
  })

  it('symlink rmrf', async () => {
    const symlinkDir = `${baseDir}/symlink_rmrf`
    await fs.outputFile(`${symlinkDir}/file1`, 'aa')
    await fs.outputFile(`${symlinkDir}/dir1/dir2/file1`, 'aa')

    await fs.symlink(`${symlinkDir}/file1`, `${symlinkDir}/link1`)
    await fs.rmrf(`${symlinkDir}/link1`)
    expect(await fs.exists(`${symlinkDir}/file1`)).toBeTruthy('await fs.exists(`${symlinkDir}/file1`)')
    expect(await fs.exists(`${symlinkDir}/link1`)).toBeFalsy('await fs.exists(`${symlinkDir}/link1`)')

    await fs.symlink(`${symlinkDir}/dir1`, `${symlinkDir}/linkdir1`)
    await fs.rmrf(`${symlinkDir}/linkdir1`)
    expect(await fs.exists(`${symlinkDir}/dir1`)).toBeTruthy('await fs.exists(`${symlinkDir}/dir1`)')
    expect(await fs.exists(`${symlinkDir}/linkdir1`)).toBeFalsy('await fs.exists(`${symlinkDir}/linkdir1`)')
  })
})
