import {mkdir, copyFile} from 'node:fs/promises';
import {buildEngine} from './build-engine';

const dir = 'extension/dist/bin';
await buildEngine(dir);
await mkdir('dist/bin', {recursive: true});
const exe = process.platform === 'win32' ? '.exe' : '';
async function copyLocal(name: string) {
  try { await copyFile(`${dir}/${name}${exe}`, `dist/bin/${name}${exe}`); }
  catch (e) {
    if (['EBUSY', 'EPERM'].includes((e as NodeJS.ErrnoException).code ?? '')) console.log(`Закройте приложение для обновления dist/bin/${name}${exe}.`);
    else throw e;
  }
}
await copyLocal('monkey-engine');
const result = await Bun.build({entrypoints: ['extension/src/extension.ts'], outdir: 'extension/dist', target: 'node', format: 'cjs', external: ['vscode'], naming: 'extension.cjs', minify: true});
if (!result.success) throw new AggregateError(result.logs, 'Сборка расширения завершилась ошибкой.');
const cli = Bun.spawn(['bun', 'build', 'src/cli.tsx', '--compile', '--minify', '--production', '--no-compile-autoload-dotenv', '--no-compile-autoload-bunfig', '--define', 'process.env.DEV="false"', '--outfile', `${dir}/tui-monkey${exe}`], {stdout: 'inherit', stderr: 'inherit'});
if (await cli.exited !== 0) throw new Error('Сборка интерфейса завершилась ошибкой.');
await copyLocal('tui-monkey');
console.log('Движок, интерфейс, расширение собраны.');
