import _fs from 'fs'
import util from 'util'
import pathLib from 'path'
import { debounce, Is, promiseQueue } from './utils'

const ENOENT = 'ENOENT' // not found
const EEXIST = 'EEXIST'



export interface WriteOptions {
  encoding?: BufferEncoding
  mode?: string | number | undefined
  flag?: string | undefined
}

async function copy(
  src: string,
  dist: string,
  opts?: {
    /** return true will skip */
    skip?: (file: string, stat: _fs.Stats) => Promise<boolean | void> | boolean | void
    /** overwrite if exists, default is true */
    overwrite?: boolean
  },
) {
  opts = {
    overwrite: true,
    ...opts,
  }
  const srcStat = await _fs.promises.stat(src)
  const isSkiped = opts.skip ? await opts.skip(src, srcStat) : false
  if (isSkiped) return
  // auto merge for directory
  if (srcStat.isDirectory()) {
    await fsExtra.mkdirp(dist)
    let childs = await _fs.promises.readdir(src)
    await Promise.all(
      childs.map((child) => copy(pathLib.join(src, child), pathLib.join(dist, child), opts)),
    )
  } else if (srcStat.isFile() || srcStat.isSymbolicLink()) {
    if (await fsExtra.lexists(dist)) {
      let isDir = await fsExtra.isDirectory(dist)
      if (isDir) {
        dist = pathLib.join(dist, pathLib.basename(src))
      } else if (opts.overwrite) {
        await fsExtra.rmrf(dist)
      } else {
        return
      }
    } else {
      let lastChar = dist[dist.length - 1]
      if (lastChar === '/' || lastChar === '\\') {
        await fsExtra.mkdirp(dist)
        dist = pathLib.join(dist, pathLib.basename(src))
      } else {
        let dir = pathLib.dirname(dist)
        await fsExtra.mkdirp(dir)
      }
    }
    await fsExtra.copyFile(src, dist)
  }
}

export type WatchDirHandler = (event: string, filename: string) => void
export type WatchDirOptions = {
  persistent?: boolean
  /** ms, default 300 */
  threshold?: number
  /** using iter on linux, default false */
  iterOnLinux?: boolean
}

function watchDir(dir: string, cb: WatchDirHandler): void
function watchDir(dir: string, options: WatchDirOptions, cb: WatchDirHandler): void
function watchDir(
  dir: string,
  options?: WatchDirOptions | WatchDirHandler,
  cb?: WatchDirHandler,
): void {
  if (Is.fn(options)) {
    cb = options as any
    options = void 0
  }
  options = {
    persistent: true,
    threshold: 300,
    ...options,
  } as WatchDirOptions
  cb = cb && promiseQueue(cb)
  if (options.threshold) {
    cb = cb && debounce(cb, options.threshold)
  }
  if (process.platform === 'linux' && options.iterOnLinux) {
    // tslint:disable-next-line:no-floating-promises
    fsExtra.iter(dir, (file) => {
      _fs.watch(
        file,
        {
          recursive: false,
          persistent: (options as WatchDirOptions).persistent,
        },
        cb,
      )
    })
  } else {
    _fs.watch(dir, { recursive: true, persistent: options.persistent }, cb)
  }
}

const fsExtra = {
  watchDir,
  copy,
  async exists(path: _fs.PathLike) {
    try {
      await _fs.promises.stat(path)
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return false
      } else {
        throw error
      }
    }
    return true
  },
  /** exists via lstat, if a symbolic link's target file doesn't exists, `fs.exists` will return false, but `fs.lexists` will return true. */
  async lexists(path: _fs.PathLike) {
    try {
      await _fs.promises.lstat(path)
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return false
      } else {
        throw error
      }
    }
    return true
  },
  async isFile(path: _fs.PathLike) {
    try {
      return (await _fs.promises.lstat(path)).isFile()
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return false
      } else {
        throw error
      }
    }
  },
  async isDirectory(path: _fs.PathLike) {
    try {
      return (await _fs.promises.lstat(path)).isDirectory()
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return false
      } else {
        throw error
      }
    }
  },
  async isSymbolicLink(path: _fs.PathLike) {
    try {
      return (await _fs.promises.lstat(path)).isSymbolicLink()
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return false
      } else {
        throw error
      }
    }
  },
  copyFile: _fs.copyFile
    ? util.promisify(_fs.copyFile)
    : async (src: _fs.PathLike, dist: _fs.PathLike) => {
        await _fs.promises.stat(src)
        return new Promise((res, rej) => {
          _fs.createReadStream(src, { highWaterMark: 2 * 1024 * 1024 })
            .pipe(_fs.createWriteStream(dist))
            .on('error', rej)
            .on('close', res)
        })
      },
  /**
   * Make directory with parents, like `mkdir -p`
   * @param dir
   */
  async mkdirp(dir: string) {
    let parent = pathLib.dirname(dir)
    if (!(await fsExtra.exists(parent))) {
      await fsExtra.mkdirp(parent)
    }
    return _fs.promises.mkdir(dir).catch((error) => {
      if (error.code !== EEXIST) {
        throw error
      }
    })
  },
  /**
   * Make directory with parents, like `mkdir -p`
   * @param dir
   */
  mkdirpSync(dir: string) {
    if (dir === '/') return
    let parent = pathLib.dirname(dir)
    if (!_fs.existsSync(parent)) {
      fsExtra.mkdirpSync(parent)
    }
    if (!_fs.existsSync(dir)) {
      try {
        _fs.mkdirSync(dir)
      } catch (error) {
        if ((<NodeJS.ErrnoException>error).code !== EEXIST) {
          throw error
        }
      }
    }
  },
  /**
   * Remove file or directory recursively, like `rm -rf`
   * @param path The path to remove
   * @param opts Options
   */
  async rmrf(path: string) {
    let stat: _fs.Stats
    try {
      stat = await _fs.promises.lstat(path)
    } catch (error) {
      if ((<NodeJS.ErrnoException>error).code === ENOENT) {
        return
      }
      throw error
    }
    if (stat.isDirectory()) {
      const children = await _fs.promises.readdir(path)
      await Promise.all(children.map((child) => pathLib.join(path, child)).map(fsExtra.rmrf))
      await _fs.promises.rmdir(path)
    } else {
      await _fs.promises.unlink(path)
    }
  },
  async outputFile(path: string, data: any, options?: WriteOptions) {
    let dir = pathLib.dirname(path)
    await fsExtra.mkdirp(dir)
    return _fs.promises.writeFile(path, data, options)
  },
  outputFileSync(path: string, data: any, options?: WriteOptions) {
    let dir = pathLib.dirname(path)
    fsExtra.mkdirpSync(dir)
    return _fs.writeFileSync(path, data, options)
  },
  async outputJson(
    path: string,
    data: object,
    options?: {
      space?: number
      replacer?: (key: string, value: any) => any
    } & WriteOptions,
  ) {
    const [replacer, space] = Is.obj(options) ? [options.replacer, options.space] : [void 0, void 0]
    return fsExtra.outputFile(path, JSON.stringify(data, replacer, space), options)
  },
  outputJsonSync(
    path: string,
    data: any,
    options?: {
      space?: number
      replacer?: (key: string, value: any) => any
    } & WriteOptions,
  ) {
    const [replacer, space] = Is.obj(options) ? [options.replacer, options.space] : [void 0, void 0]
    return fsExtra.outputFileSync(path, JSON.stringify(data, replacer, space), options)
  },
  async readJson<T = any>(path: string, options?: { encoding?: null; flag?: string } | null) {
    let data: Buffer | string = await _fs.promises.readFile(path, options)
    if (!Is.str(data)) {
      data = data.toString('utf8')
    }
    return JSON.parse(data) as T
  },
  readJsonSync<T = any>(path: string, options?: { encoding?: null; flag?: string } | null) {
    let data: Buffer | string = _fs.readFileSync(path, options)
    if (!Is.str(data)) {
      data = data.toString('utf8')
    }
    return JSON.parse(data) as T
  },
  async iter(
    dir: string,
    /** return true will skip */
    skip: (path: string, stat: _fs.Stats) => Promise<boolean | void> | boolean | void,
  ) {
    let children = await _fs.promises.readdir(dir)
    await Promise.all(
      children.map(async (child) => {
        let path = pathLib.join(dir, child)
        let stat = await _fs.promises.stat(path)
        let isSkipped = await skip(path, stat)
        if (isSkipped) return
        if (stat.isDirectory()) {
          await fsExtra.iter(path, skip)
        }
      }),
    )
  },
}

export const fs = Object.assign({}, _fs, _fs.promises, fsExtra)
