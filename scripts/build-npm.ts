import {mkdir, copyFile, chmod, writeFile} from 'node:fs/promises';
const root = 'dist/npm';
await mkdir(`${root}/bin`, {recursive: true});
const result = await Bun.build({entrypoints: ['src/cli.tsx'], outdir: `${root}/bin`, naming: 'cli.mjs', target: 'node', format: 'esm', packages: 'external', banner: '#!/usr/bin/env node'});
if (!result.success) throw new AggregateError(result.logs, 'Сборка пакета завершилась ошибкой.');
for (const platform of ['win32', 'linux', 'darwin']) {
  for (const arch of ['x64', 'arm64']) {
    const dir = `${root}/bin/engines/${platform}-${arch}`;
    await mkdir(dir, {recursive: true});
    const output = `${dir}/monkey-engine${platform === 'win32' ? '.exe' : ''}`;
    const proc = Bun.spawn(['go', 'build', '-trimpath', '-ldflags=-s -w', '-o', output, './cmd/monkey-engine'], {
      stdout: 'inherit', stderr: 'inherit',
      env: {...process.env, CGO_ENABLED: '0', GOOS: platform === 'win32' ? 'windows' : platform, GOARCH: arch === 'x64' ? 'amd64' : 'arm64'},
    });
    if (await proc.exited !== 0) throw new Error(`Сборка ${platform}-${arch} завершилась ошибкой.`);
    await chmod(output, 0o755);
  }
}
const workspace = await Bun.file('package.json').json();
const manifest = {
  name: 'tui-monkey', version: workspace.version,
  description: 'Terminal typing trainer with session history and an animated monkey.',
  type: 'module', bin: {'tui-monkey': 'bin/cli.mjs'},
  engines: {node: '>=22'}, os: ['win32', 'linux', 'darwin'], cpu: ['x64', 'arm64'],
  files: ['bin', 'THIRD_PARTY_NOTICES.md', 'TTYper-LICENSE.md'],
  dependencies: workspace.dependencies,
  license: 'UNLICENSED', author: 'Calcifer-02',
  repository: {type: 'git', url: 'git+https://github.com/Calcifer-02/TUI-Monkey.git'},
  keywords: ['typing', 'terminal', 'monkey', 'ink', 'wpm'],
  publishConfig: {access: 'public'},
};
await writeFile(`${root}/package.json`, JSON.stringify(manifest, null, 2));
for (const file of ['README.md', 'THIRD_PARTY_NOTICES.md']) await copyFile(file, `${root}/${file}`);
await copyFile('reference/ttyper/LICENSE.md', `${root}/TTYper-LICENSE.md`);
await chmod(`${root}/bin/cli.mjs`, 0o755);
console.log('Пакет собран для шести платформ.');
