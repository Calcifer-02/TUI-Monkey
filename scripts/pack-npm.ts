import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {create} from 'tar';
await mkdir('artifacts', {recursive: true});
const {version} = await Bun.file('dist/npm/package.json').json();
const output = resolve(`artifacts/tui-monkey-${version}.tgz`);
await create({cwd: resolve('dist/npm'), file: output, gzip: true, portable: true, prefix: 'package', onWriteEntry(entry) {
  if (entry.stat && (entry.path === 'bin/cli.mjs' || /bin\/engines\/[^/]+\/monkey-engine(?:\.exe)?$/.test(entry.path))) entry.stat.mode = 0o100755;
}}, ['package.json', 'README.md', 'THIRD_PARTY_NOTICES.md', 'TTYper-LICENSE.md', 'bin']);
console.log(output);
