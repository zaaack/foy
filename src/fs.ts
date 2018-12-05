import * as _fs from 'fs'
import * as util from 'util'
import * as pathLib from 'path';
async function copy(
  src: string,
  dist: string,
  opts?: { filter?: (stat: _fs.Stats) => boolean, override?: boolean },
) {
  let srcStat = await fs.stat(src)
  let isFiltered = true
  let isOverrided = false
  if (opts) {
    if (opts.filter) isFiltered = opts.filter(srcStat)
    if (opts.override) isOverrided = opts.override
  }
  if (!isFiltered) return
  if (srcStat.isDirectory()) {
    await fs.mkdirp(dist)
    let childs = await fs.readdir(src)
    await Promise.all(
      childs.map(
        child => copy(
          pathLib.join(src, child),
          pathLib.join(dist, child),
          opts
        )
      )
    )
  } else if (
    srcStat.isFile() || srcStat.isSymbolicLink()
  ) {
    try {
      let stat = await fs.stat(dist)
      if (isOverrided) {
        if (stat.isFile() || stat.isSymbolicLink()) {
          await fs.unlink(dist)
        } else if (stat.isDirectory()) {
          await fs.rmdir(dist)
        }
      } else return
    } catch (error) {
      let lastChar = dist[dist.length - 1]
      if (lastChar === '/' || lastChar === '\\') {
        await fs.mkdirp(dist)
        dist = pathLib.join(dist, pathLib.basename(src))
      } else {
        let dir = pathLib.dirname(dist)
        await fs.mkdirp(dir)
      }
    }
    await fs.copyFile(src, dist)
  }
}
export const fs = {
  ..._fs,
  access: util.promisify(_fs.access),
  copyFile: _fs.copyFile ? util.promisify(_fs.copyFile) : async (src: _fs.PathLike, dist: _fs.PathLike) => {
    await fs.stat(src)
    return new Promise(
      (res, rej) => {
        fs
          .createReadStream(src, { highWaterMark: 512 * 1024 })
          .pipe(fs.createWriteStream(dist))
          .on('error', rej)
          .on('close', res)
      }
    )
  },
  open: util.promisify(_fs.open),
  rename: util.promisify(_fs.rename),
  truncate: util.promisify(_fs.truncate),
  rmdir: util.promisify(_fs.rmdir),
  mkdir: util.promisify(_fs.mkdir),
  readdir: util.promisify(_fs.readdir),
  readlink: util.promisify(_fs.readlink),
  symlink: util.promisify(_fs.symlink),
  lstat: util.promisify(_fs.lstat),
  stat: util.promisify(_fs.stat),
  link: util.promisify(_fs.link),
  unlink: util.promisify(_fs.unlink),
  chmod: util.promisify(_fs.chmod),
  chown: util.promisify(_fs.chown),
  utimes: util.promisify(_fs.utimes),
  realpath: util.promisify(_fs.realpath),
  mkdtemp: util.promisify(_fs.mkdtemp),
  writeFile: util.promisify(_fs.writeFile),
  appendFile: util.promisify(_fs.appendFile),
  readFile: util.promisify(_fs.readFile),
  existsSync: _fs.existsSync,
  createReadString: _fs.createReadStream,
  createWriteStream: _fs.createWriteStream,
  constants: _fs.constants,
  copy,
  /**
   * Make directory with parents, like `mkdir -p`
   * @param dir
   */
  async mkdirp(dir: string) {
    if (dir === '/') return
    let parent = pathLib.dirname(dir)
    if (parent && parent !== '/') {
      try {
        await fs.stat(parent)
      } catch (error) {
        await fs.mkdirp(parent)
      }
    }
    try {
      await fs.stat(dir)
    } catch (error) {
      return fs.mkdir(dir)
    }
  },
  /**
   * Remove file or directory recursively, like `rm -rf`
   * @param di
   */
  async rmrf(path: string) {
    if (!fs.existsSync(path)) return

    let stat = await fs.stat(path)
    if (stat.isDirectory()) {
      const children = await fs.readdir(path)
      await Promise.all(
        children
        .map(child => pathLib.join(path, child))
        .map(fs.rmrf)
      )
    } else {
      await fs.unlink(path)
    }
  },
  async outputFile(path: string, data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string } | string | null) {
    let dir = pathLib.dirname(path)
    await fs.mkdirp(dir)
    return fs.writeFile(path, data, options)
  },
  async outputFileSync(path: string, data: any, options?: { encoding?: string | null, mode?: string | number, flag?: string } | string | null) {
    let dir = pathLib.dirname(path)
    await fs.mkdirp(dir)
    return fs.writeFileSync(path, data, options)
  },
  async outputJson(path: string, data: object, options?: { encoding?: string | null, mode?: string | number, flag?: string } | string | null) {
    return fs.outputFile(path, JSON.stringify(data), options)
  },
  async outputJsonSync(path: string, data: object, options?: { encoding?: string | null, mode?: string | number, flag?: string } | string | null) {
    return fs.outputFileSync(path, JSON.stringify(data), options)
  },
  async readJson(path: string, options?: { encoding?: null, flag?: string } | null) {
    let data: Buffer | string = await fs.readFile(path, options)
    if (typeof data !== 'string') {
      data = data.toString('utf8')
    }
    return JSON.parse(data)
  },
  async readJsonSync(path: string, options?: { encoding?: null, flag?: string } | null) {
    let data: Buffer | string = fs.readFileSync(path, options)
    if (typeof data !== 'string') {
      data = data.toString('utf8')
    }
    return JSON.parse(data)
  }
}
