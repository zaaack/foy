import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(join(import.meta.dirname, '../package.json'));
const tsMain = require.resolve('typescript');
const tsPkgDir = dirname(dirname(tsMain));

const content = readFileSync(tsMain, 'utf-8');
if (content.includes('unstable')) {
  console.log('TS7 compat shim already applied');
  process.exit(0);
}

const shim = `
try {
  const ast = require('${tsPkgDir}/dist/ast/index.js');
  Object.assign(exports, ast);
  const sync = require('${tsPkgDir}/dist/api/sync/api.js');
  Object.assign(exports, sync);
  const fsApi = require('${tsPkgDir}/dist/api/fs.js');
  Object.assign(exports, fsApi);
} catch(e) {}
`;

writeFileSync(tsMain, content + shim);
console.log('TS7 compat shim applied to', tsMain);
