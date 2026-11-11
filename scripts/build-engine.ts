import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

export async function buildEngine(outDir = 'dist/bin') {
  await mkdir(outDir, {recursive: true});
  const output = join(outDir, `monkey-engine${process.platform === 'win32' ? '.exe' : ''}`);
  const proc = Bun.spawn(['go', 'build', '-trimpath', '-ldflags=-s -w', '-o', output, './cmd/monkey-engine'], {stdout: 'inherit', stderr: 'inherit', env: {...process.env, CGO_ENABLED: '0'}});
  if (await proc.exited !== 0) throw new Error('Сборка движка завершилась ошибкой.');
  return output;
}
if (import.meta.main) await buildEngine();
