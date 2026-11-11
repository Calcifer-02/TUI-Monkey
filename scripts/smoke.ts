import {resolve} from 'node:path';
import {EngineClient} from '../src/engine-client';
import {configSchema} from '../src/schema';
const suffix = process.platform === 'win32' ? '.exe' : '';
const client = new EngineClient(resolve(`extension/dist/bin/monkey-engine${suffix}`));
try {
  const languages = (await client.request('languages')).languages!;
  if (!languages.includes('russian') || !languages.includes('go')) throw new Error('Отсутствуют словари.');
  await client.start(configSchema.parse({mode: 'custom', text: 'привет go'}));
  const result = (await client.request('input', {text: 'привет go'})).state!;
  if (result.status !== 'complete' || result.accuracy !== 100) throw new Error('Тренировка завершилась неверно.');
} finally { client.close(); }
const cli = Bun.spawn([resolve(`extension/dist/bin/tui-monkey${suffix}`), '--list-languages'], {stdout: 'pipe', stderr: 'pipe'});
const output = await new Response(cli.stdout).text();
const error = await new Response(cli.stderr).text();
if (await cli.exited !== 0 || !output.includes('Привет,') || !output.includes('english200')) throw new Error(error || output);
console.log('Собранное приложение: приветствие, словари, Unicode — проверено.');
